import * as vscode from 'vscode';

export class LspClient {
    private async executeCommandWithTimeout<T>(command: string, ...args: any[]): Promise<T | undefined> {
        const timeoutMs = 2000; // 2 seconds timeout for LSP calls
        return Promise.race([
            vscode.commands.executeCommand<T>(command, ...args),
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs))
        ]);
    }

    async resolveSymbol(document: vscode.TextDocument, position: vscode.Position): Promise<any> {
        // Try to get word range, but don't fail immediately if not found (might be a symbol like [ or {)
        const range = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
        let word = '';
        if (range) {
            word = document.getText(range);
        }

        // If no word found, we might be on a symbol. Return null to let AST identifier handle it.
        if (!word) {
            return null;
        }

        const result: any = { name: word };

        // 1. Get Definition (for path)
        let definitionLocation: vscode.Location | undefined;
        try {
            const definitions = await this.executeCommandWithTimeout<vscode.Location[] | vscode.LocationLink[]>('vscode.executeDefinitionProvider', document.uri, position);
            if (definitions && definitions.length > 0) {
                const loc = definitions[0];
                if ('uri' in loc) {
                    definitionLocation = loc;
                    result.path = loc.uri.fsPath;
                } else if ('targetUri' in loc) {
                    definitionLocation = new vscode.Location(loc.targetUri, loc.targetRange);
                    result.targetUri = loc.targetUri.fsPath;
                    result.path = loc.targetUri.fsPath;
                }
            }
        } catch (e) {
            // Definition lookup failed - this is common for some symbols, don't spam logs
        }

        // 1.1 Refine Name using Definition (Reverse Lookup)
        // If we have a definition, try to resolve the real name from the definition file
        // This fixes issues where hovering 'ls.append' returns 'ls.append' instead of 'list.append'
        if (definitionLocation) {
            const resolved = await this.resolveNameFromLocation(definitionLocation);
            if (resolved) {
                let realName = resolved.name;
                const kind = this.mapSymbolKind(resolved.kind);
                if (kind) {
                    result.kind = kind;
                }

                // Try to prepend module name if we can guess it from the path.
                // This fixes issues where hovering 'plt.plot' returns 'plot' (from pyplot.pyi)
                // instead of 'matplotlib.pyplot.plot'.
                const moduleName = this.getModuleNameFromPath(definitionLocation.uri.fsPath);
                if (moduleName) {
                    // If the definition symbol is a module, the correct fully qualified name *is* the module.
                    if (resolved.kind === vscode.SymbolKind.Module) {
                        result.name = moduleName;
                    } else {
                        result.name = `${moduleName}.${realName}`;
                    }
                } else {
                    result.name = realName;
                }
            }
        }

        // 2. Get Hover (for signature)
        try {
            const hovers = await this.executeCommandWithTimeout<vscode.Hover[]>('vscode.executeHoverProvider', document.uri, position);
            if (hovers && hovers.length > 0) {
                for (const hover of hovers) {
                    for (const content of hover.contents) {
                        const str = (typeof content === 'string') ? content : content.value;
                        // Look for python code block which usually contains the signature
                        const codeBlockMatch = /```python\n([\s\S]*?)\n```/.exec(str);
                        if (codeBlockMatch) {
                            let signature = codeBlockMatch[1].trim();
                            // Clean up Pylance prefixes like (function), (variable), etc.
                            signature = signature.replace(/^\((function|method|class|variable|field|property|module)\)\s*/, '');
                            result.signature = signature;

                            // Extract docstring (everything after the code block)
                            // Pylance usually puts the docstring after the signature block
                            let afterCode = str.substring(codeBlockMatch.index + codeBlockMatch[0].length).trim();

                            // Filter out internal Pylance markers like <!--moduleHash:-->
                            if (afterCode) {
                                // Remove lines starting with <!--moduleHash
                                afterCode = afterCode.split('\n')
                                    .filter(line => !line.trim().startsWith('<!--moduleHash'))
                                    .join('\n').trim();

                                if (afterCode) {
                                    result.docstring = afterCode;
                                }
                            }

                            // Fix name mismatch (e.g. hovering 'print' returns 'builtins.object.__str__')
                            this.fixNameMismatch(result, signature);
                            break;
                        }
                    }
                    if (result.signature) break;
                }
            }
        } catch (e) {
            // Hover lookup failed - this is common for some symbols, don't spam logs
        }

        return result;
    }

    private getModuleNameFromPath(fsPath: string): string | null {
        // Normalize separators
        const path = fsPath.replace(/\\/g, '/');

        // Common roots for python libraries/stubs
        // Order matters: more specific first
        const markers = [
            '/site-packages/',
            '/dist-packages/',
            '/bundled/stubs/',
            '/typeshed-fallback/stdlib/',
            '/stdlib/',
            '/stubs/',
            '/lib/'
        ];

        for (const marker of markers) {
            const index = path.lastIndexOf(marker);
            if (index !== -1) {
                let relativePath = path.substring(index + marker.length);

                // Strip version folders that appear in stdlib/typeshed layouts.
                // Examples:
                // - .../typeshed-fallback/stdlib/3.11/base64.pyi -> base64
                // - .../lib/python3.11/base64.py -> base64
                relativePath = relativePath.replace(/^python\d+(?:\.\d+)?\//, '');
                relativePath = relativePath.replace(/^\d+\.\d+\//, '');

                // Remove extension
                relativePath = relativePath.replace(/\.(py|pyi)$/, '');
                // Handle __init__
                if (relativePath.endsWith('/__init__')) {
                    relativePath = relativePath.substring(0, relativePath.length - '/__init__'.length);
                }
                // Replace slashes with dots
                let moduleName = relativePath.replace(/\//g, '.');

                // Extra safety: strip any dotted python version prefix that survived path normalization.
                // Examples:
                // - python3.11.base64 -> base64
                // - 3.11.base64 -> base64
                moduleName = moduleName.replace(/^python\d+\.(\d+)\./, '');
                moduleName = moduleName.replace(/^\d+\.\d+\./, '');

                return moduleName;
            }
        }
        return null;
    }

    private mapSymbolKind(kind: vscode.SymbolKind): string | undefined {
        switch (kind) {
            case vscode.SymbolKind.Module:
                return 'module';
            case vscode.SymbolKind.Class:
                return 'class';
            case vscode.SymbolKind.Method:
                return 'method';
            case vscode.SymbolKind.Function:
                return 'function';
            case vscode.SymbolKind.Property:
                return 'property';
            case vscode.SymbolKind.Field:
                return 'field';
            case vscode.SymbolKind.Variable:
                return 'variable';
            default:
                return undefined;
        }
    }

    private async resolveNameFromLocation(location: vscode.Location): Promise<{ name: string; kind: vscode.SymbolKind } | null> {
        try {
            // We need to open the document to get symbols.
            // executeDocumentSymbolProvider works on a URI, so the doc doesn't need to be open in editor,
            // but VS Code needs to be able to read it.
            const symbols = await this.executeCommandWithTimeout<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', location.uri);
            if (!symbols) return null;

            // Recursive function to find the symbol containing the position
            const findSymbolPath = (symbols: vscode.DocumentSymbol[]): { names: string[]; kind: vscode.SymbolKind } | null => {
                for (const symbol of symbols) {
                    if (symbol.range.contains(location.range.start)) {
                        const childPath = findSymbolPath(symbol.children);
                        if (childPath) {
                            return { names: [symbol.name, ...childPath.names], kind: childPath.kind };
                        }
                        return { names: [symbol.name], kind: symbol.kind };
                    }
                }
                return null;
            };

            const found = findSymbolPath(symbols);
            if (found) {
                return { name: found.names.join('.'), kind: found.kind };
            }
        } catch (e) {
            // Failed to resolve symbol from location - common for some symbols
        }
        return null;
    }

    private fixNameMismatch(result: any, signature: string) {
        if (!result.name) { return; }

        let signatureName = '';
        // Extract name from signature
        const defMatch = /^(?:def|class)\s+([a-zA-Z0-9_]+)/.exec(signature);
        if (defMatch) {
            signatureName = defMatch[1];
        } else {
            // Try to match start of string if it looks like an identifier
            const idMatch = /^([a-zA-Z0-9_]+)/.exec(signature);
            if (idMatch) {
                signatureName = idMatch[1];
            }
        }

        if (signatureName && !result.name.endsWith(signatureName)) {
            // Mismatch detected
            // If we have a file path, try to reconstruct the name using the module + signature name
            if (result.path) {
                const moduleName = this.getModuleNameFromPath(result.path);
                if (moduleName) {
                    const newName = `${moduleName}.${signatureName}`;
                    result.name = newName;
                    return;
                }
            }

            // Fallback: just use the signature name
            result.name = signatureName;
        }
    }
}

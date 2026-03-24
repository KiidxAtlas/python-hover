import * as vscode from 'vscode';
import { LspSymbol } from '../../shared/types';

export class LspClient {
    private async executeCommandWithTimeout<T>(command: string, ...args: any[]): Promise<T | undefined> {
        const timeoutMs = 2000; // 2 seconds timeout for LSP calls
        return Promise.race([
            vscode.commands.executeCommand<T>(command, ...args),
            new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), timeoutMs))
        ]);
    }

    async resolveSymbol(document: vscode.TextDocument, position: vscode.Position): Promise<LspSymbol | null> {
        const access = this.getAccessContextAtPosition(document, position);
        const wordRange = access?.segmentRange;

        let word = access?.expression ?? '';

        if (!word) {
            return null;
        }

        const result: LspSymbol = { name: word };

        // Compute the best LSP query position for attribute access.
        // Pylance resolves differently depending on the exact cursor position within a
        // word.  For dotted expressions (e.g. "df.agg"), some positions within the last
        // segment may fail to resolve while others succeed.  We use the LAST character
        // of the word as the canonical position — this reliably resolves the full
        // attribute chain in Pylance.
        const canonicalChar = wordRange
            ? wordRange.end.character - 1
            : position.character;
        const needsCanonicalRetry = canonicalChar !== position.character;

        // 1 + 2. Run definition lookup and hover provider concurrently.
        //   Definition → path + kind (then we do a sequential reverse-lookup from it)
        //   Hover provider → signature + docstring (fully independent)
        //
        // For dotted words, query at BOTH the cursor position and the canonical position
        // (last char of the word) concurrently — use whichever returns results.
        const defPromise = this.executeCommandWithTimeout<vscode.Location[] | vscode.LocationLink[]>(
            'vscode.executeDefinitionProvider', document.uri, position
        ).catch(() => undefined);

        const hoverPromise = this.executeCommandWithTimeout<vscode.Hover[]>(
            'vscode.executeHoverProvider', document.uri, position
        ).catch(() => undefined);

        const canonicalPos = needsCanonicalRetry
            ? new vscode.Position(position.line, canonicalChar)
            : undefined;

        const canonDefPromise = canonicalPos
            ? this.executeCommandWithTimeout<vscode.Location[] | vscode.LocationLink[]>(
                'vscode.executeDefinitionProvider', document.uri, canonicalPos
            ).catch(() => undefined)
            : Promise.resolve(undefined);

        const canonHoverPromise = canonicalPos
            ? this.executeCommandWithTimeout<vscode.Hover[]>(
                'vscode.executeHoverProvider', document.uri, canonicalPos
            ).catch(() => undefined)
            : Promise.resolve(undefined);

        const [definitions, hovers, canonDefs, canonHovers] = await Promise.all([
            defPromise, hoverPromise, canonDefPromise, canonHoverPromise
        ]);

        // For dotted expressions, prefer the canonical-position result (end of the
        // full expression) so the most specific symbol is resolved regardless of
        // which segment the cursor is on.  Fall back to cursor-position results.
        const effectiveDefinitions = (canonDefs && canonDefs.length > 0) ? canonDefs : definitions;
        const effectiveHovers = (canonHovers && canonHovers.length > 0) ? canonHovers : hovers;

        // 1. Process definition result
        let definitionLocation: vscode.Location | undefined;

        if (effectiveDefinitions && effectiveDefinitions.length > 0) {
            const loc = effectiveDefinitions[0];
            if ('uri' in loc) {
                definitionLocation = loc;
                result.path = loc.uri.fsPath;
            } else if ('targetUri' in loc) {
                definitionLocation = new vscode.Location(loc.targetUri, loc.targetRange);
                result.targetUri = loc.targetUri.fsPath;
                result.path = loc.targetUri.fsPath;
            }
        }

        // 1.1 Refine Name using Definition (Reverse Lookup — still sequential; depends on step 1)
        // If we have a definition, try to resolve the real name from the definition file
        // This fixes issues where hovering 'ls.append' returns 'ls.append' instead of 'list.append'
        if (definitionLocation) {
            const resolved = await this.resolveNameFromLocation(definitionLocation);
            if (resolved) {
                let realName = resolved.name;

                // When Pylance falls back to __getattr__ (can't resolve a specific
                // attribute, e.g. df.agg → DataFrame.__getattr__), reconstruct the
                // intended name using the class from the definition + the original
                // attribute name from the cursor word.
                const leafName = realName.split('.').pop();
                if (leafName === '__getattr__' || leafName === '__getitem__') {
                    result.path = definitionLocation.uri.fsPath;
                    // Extract the class name: 'DataFrame.__getattr__' → 'DataFrame'
                    const classPath = realName.split('.').slice(0, -1).join('.');
                    if (classPath) {
                        const attrName = word.split('.').pop() || word;
                        const moduleName = this.getModuleNameFromPath(definitionLocation.uri.fsPath);
                        if (moduleName) {
                            result.name = `${moduleName}.${classPath}.${attrName}`;
                        } else {
                            result.name = `${classPath}.${attrName}`;
                        }
                    }
                } else {
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
        }

        // 2. Process hover result
        try {
            if (effectiveHovers && effectiveHovers.length > 0) {
                for (const hover of effectiveHovers) {
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

    private getAccessContextAtPosition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): { expression: string; segmentRange: vscode.Range } | null {
        const segmentRange = document.getWordRangeAtPosition(position, /[A-Za-z_][A-Za-z0-9_]*/);
        if (!segmentRange) return null;

        const line = document.lineAt(position.line).text;
        const segmentText = document.getText(segmentRange);
        const segments = [segmentText];
        let cursor = segmentRange.start.character;

        while (cursor > 0) {
            let index = cursor - 1;

            while (index >= 0 && /\s/.test(line[index])) index--;
            if (index < 0 || line[index] !== '.') break;
            index--;

            while (index >= 0 && /\s/.test(line[index])) index--;
            if (index < 0) break;

            if (line[index] === ')' || line[index] === ']') {
                index = this.scanLeftPastBalanced(line, index, line[index] === ')' ? '(' : '[', line[index]);
                if (index < 0) break;
                while (index >= 0 && /\s/.test(line[index])) index--;
                if (index < 0) break;
            }

            const identEnd = index + 1;
            while (index >= 0 && /[A-Za-z0-9_]/.test(line[index])) index--;
            const identStart = index + 1;

            if (identStart >= identEnd) {
                break;
            }

            const ident = line.slice(identStart, identEnd);
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(ident)) {
                break;
            }

            segments.unshift(ident);
            cursor = identStart;
        }

        return {
            expression: segments.join('.'),
            segmentRange,
        };
    }

    private scanLeftPastBalanced(line: string, index: number, openChar: string, closeChar: string): number {
        let depth = 0;

        for (let cursor = index; cursor >= 0; cursor--) {
            const char = line[cursor];

            if (char === closeChar) {
                depth++;
                continue;
            }

            if (char === openChar) {
                depth--;
                if (depth === 0) {
                    return cursor - 1;
                }
            }
        }

        return -1;
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

                // Strip '-stubs' suffix from stub packages
                // e.g. 'pandas-stubs.core.frame' → 'pandas.core.frame'
                moduleName = moduleName.replace(/^([^.]+)-stubs/, '$1');

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

    private fixNameMismatch(result: LspSymbol, signature: string) {
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

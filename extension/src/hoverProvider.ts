import * as vscode from 'vscode';
import { DocResolver } from '../../docs-engine/docResolver';
import { HoverDocBuilder } from '../../docs-engine/src/builder/hoverDocBuilder';
import { DiskCache } from '../../docs-engine/src/cache/diskCache';
import { TypeshedParser } from '../../docs-engine/src/parsing/typeshedParser';
import { DocKeyBuilder } from '../../shared/docKey';
import { HoverDoc, ResolutionSource } from '../../shared/types';
import { AliasResolver } from './aliasResolver';
import { Config } from './config';
import { Logger } from './logger';
import { LspClient } from './lspClient';
import { PythonHelper } from './pythonHelper';
import { HoverRenderer } from './ui/hoverRenderer';

export class HoverProvider implements vscode.HoverProvider {
    private renderer: HoverRenderer;
    private docResolver: DocResolver;
    private pythonHelper: PythonHelper;
    private docBuilder: HoverDocBuilder;
    private aliasResolver: AliasResolver;
    private isFetching = false;

    constructor(private lspClient: LspClient, private config: Config, diskCache: DiskCache) {
        this.renderer = new HoverRenderer(config);
        this.docResolver = new DocResolver(diskCache, {
            cacheTTL: {
                inventoryDays: config.inventoryCacheDays,
                snippetHours: config.snippetCacheHours
            },
            requestTimeout: config.requestTimeout,
            customLibraries: config.customLibraries,
            onlineDiscovery: config.onlineDiscovery
        });
        this.pythonHelper = new PythonHelper(config.pythonPath, diskCache);
        this.docBuilder = new HoverDocBuilder();
        this.aliasResolver = new AliasResolver();

        // Initialize Python Version
        this.initializePythonVersion();
    }

    private async initializePythonVersion() {
        const version = await this.pythonHelper.getPythonVersion();
        Logger.log(`Detected Python Version: ${version}`);
        this.docResolver.setPythonVersion(version);
    }

    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | null> {
        if (this.isFetching) {
            return null;
        }

        Logger.log('HoverProvider triggered');
        if (!this.config.isEnabled) {
            Logger.log('HoverProvider disabled via config');
            return null;
        }

        this.isFetching = true;
        try {
            // 1. Resolve symbol via LSP
            let lspSymbol = await this.lspClient.resolveSymbol(document, position);

            // 1.1 AST Identification (Always try if LSP failed OR if we want to be robust)
            // We now pass the document content to handle unsaved changes
            const identifiedType = await this.pythonHelper.identify(
                document.getText(),
                position.line + 1, // AST uses 1-based lines
                position.character
            );

            if (identifiedType) {
                Logger.log(`AST Identified type: ${identifiedType}`);

                // Check if it's a literal/builtin type
                const isLiteral = ['list', 'dict', 'set', 'tuple', 'str', 'int', 'float', 'bool', 'None', 'f-string'].includes(identifiedType);

                if (isLiteral) {
                    // For literals, we want to force the builtin type lookup
                    lspSymbol = {
                        name: identifiedType,
                        kind: 'class',
                        module: 'builtins',
                        path: 'builtins'
                    };
                } else {
                    // It's a definition (e.g. Person.__init__) identified by AST
                    if (!lspSymbol) {
                        // If LSP failed, use AST result
                        lspSymbol = {
                            name: identifiedType,
                            kind: 'function', // Best guess
                            module: 'user',
                            path: document.uri.fsPath
                        };
                    } else {
                        // If LSP succeeded, we might want to refine the name (e.g. __init__ -> Person.__init__)
                        // but we MUST preserve the docstring and signature from LSP
                        if (identifiedType !== lspSymbol.name) {
                            Logger.log(`Refining LSP name ${lspSymbol.name} with AST name ${identifiedType}`);
                            lspSymbol.name = identifiedType;
                        }
                    }
                }
            }

            if (!lspSymbol) {
                Logger.log('LSP failed to resolve symbol');
                return null;
            }

            // 1.1.5 Refine Name from Signature (Fix for methods resolved as top-level functions)
            // If the name is simple (e.g. "append") or missing class (e.g. "builtins.join")
            // but signature shows "self: ClassName", we can infer the real qualified name.
            if (lspSymbol.name && lspSymbol.signature) {
                // Match "self: ClassName" or "self: Self@ClassName"
                // Note: ClassName might be followed by [T] or similar, so we stop at [ or space or comma
                const selfMatch = /\bself\s*:\s*([a-zA-Z0-9_.]+(?:@[a-zA-Z0-9_.]+)?)/.exec(lspSymbol.signature);
                if (selfMatch) {
                    let className = selfMatch[1];
                    // Handle Pylance's "Self@ClassName" format
                    if (className.includes('@')) {
                        className = className.split('@')[1];
                    }

                    // Ignore "Unknown" class name which Pylance uses when inference fails
                    if (className === 'Unknown') {
                        // Do nothing, keep original name
                    } else {
                        const methodName = lspSymbol.name.split('.').pop();
                        const expectedSuffix = `${className}.${methodName}`;

                        if (!lspSymbol.name.endsWith(expectedSuffix)) {
                            const lastDotIndex = lspSymbol.name.lastIndexOf('.');
                            let newName = '';

                            if (lastDotIndex !== -1) {
                                // e.g. "builtins.join" -> "builtins.str.join"
                                const prefix = lspSymbol.name.substring(0, lastDotIndex);
                                newName = `${prefix}.${className}.${methodName}`;
                            } else {
                                // e.g. "append" -> "list.append"
                                newName = `${className}.${methodName}`;
                            }

                            Logger.log(`Refined symbol name from signature: ${lspSymbol.name} -> ${newName}`);
                            lspSymbol.name = newName;
                        }
                    }
                }
            }

            // 1.1.6 Refine Name from Path (Generic fix for stdlib and third-party)
            // If the name is simple (e.g. "join") and we have a path to a library file,
            // we can try to prepend the module name.
            if (lspSymbol.name && !lspSymbol.name.includes('.') && lspSymbol.path) {
                const normalizedPath = lspSymbol.path.replace(/\\/g, '/');
                // Common roots for python libraries
                const markers = ['/site-packages/', '/dist-packages/', '/Lib/', '/lib/'];

                for (const marker of markers) {
                    const index = normalizedPath.lastIndexOf(marker);
                    if (index !== -1) {
                        let relativePath = normalizedPath.substring(index + marker.length);
                        // Remove extension
                        relativePath = relativePath.replace(/\.(py|pyi)$/, '');
                        // Handle __init__
                        if (relativePath.endsWith('/__init__')) {
                            relativePath = relativePath.substring(0, relativePath.length - '/__init__'.length);
                        }

                        // Convert slashes to dots
                        let moduleName = relativePath.replace(/\//g, '.');

                        // Special handling for os.path implementations
                        if (moduleName === 'ntpath' || moduleName === 'posixpath' || moduleName === 'macpath') {
                            moduleName = 'os.path';
                        }

                        if (moduleName) {
                            if (moduleName !== lspSymbol.name) {
                                const newName = `${moduleName}.${lspSymbol.name}`;
                                Logger.log(`Refined symbol name from path (${marker}): ${lspSymbol.name} -> ${newName}`);
                                lspSymbol.name = newName;
                            }
                            break; // Stop after first match (e.g. if site-packages matched, don't fall back to Lib)
                        }
                    }
                }
            }

            Logger.log('LSP Symbol:', lspSymbol);

            // 1.2 Typeshed Enrichment
            // If the path points to a .pyi file, try to parse it for better signature/overloads
            if (lspSymbol.path && lspSymbol.path.endsWith('.pyi')) {
                try {
                    const typeshedInfo = await TypeshedParser.parse(lspSymbol.path, lspSymbol.name);
                    if (typeshedInfo) {
                        Logger.log('Typeshed Info:', typeshedInfo);
                        if (typeshedInfo.signature) {
                            lspSymbol.signature = typeshedInfo.signature;
                        }
                        if (typeshedInfo.overloads) {
                            lspSymbol.overloads = typeshedInfo.overloads;
                        }
                        if (typeshedInfo.protocolHints) {
                            lspSymbol.protocolHints = typeshedInfo.protocolHints;
                        }
                    }
                } catch (e) {
                    Logger.error('Failed to parse typeshed file', e);
                }
            }

            // 1.5 Resolve Aliases (e.g. pd.DataFrame -> pandas.DataFrame)
            const resolvedName = this.aliasResolver.resolve(document.getText(), lspSymbol.name);
            if (resolvedName !== lspSymbol.name) {
                Logger.log(`Resolved alias: ${lspSymbol.name} -> ${resolvedName}`);
                lspSymbol.name = resolvedName;
            }

            // 2. Introspect via Python Helper (Runtime)
            // This enriches the static analysis with runtime info (e.g. installed version, real path)
            const runtimeInfo = await this.pythonHelper.resolveRuntime(lspSymbol.name);
            Logger.log('Runtime Info:', runtimeInfo);

            // Check for local user symbols to avoid false positive lookups
            const isLocalPath = lspSymbol.path &&
                !lspSymbol.path.includes('site-packages') &&
                !lspSymbol.path.includes('dist-packages') &&
                !/[\\/]Lib[\\/]/.test(lspSymbol.path); // Check for stdlib Lib folder

            if ((!runtimeInfo || !runtimeInfo.module) && isLocalPath) {
                Logger.log('Symbol detected as local user code. Skipping remote documentation lookup.');

                let content = lspSymbol.docstring || '';

                // Fallback for dunder methods (e.g. __init__, __str__) if no local docstring
                if (!content && lspSymbol.name) {
                    const methodName = lspSymbol.name.split('.').pop();
                    if (methodName && methodName.startsWith('__') && methodName.endsWith('__')) {
                        Logger.log(`Local dunder method ${methodName} has no docstring. Attempting fallback to object.${methodName}.`);
                        try {
                            // Construct a key for the builtin object method
                            const fallbackKey = DocKeyBuilder.fromSymbol({
                                name: methodName,
                                module: 'builtins',
                                path: 'builtins',
                                kind: 'method',
                                qualname: `object.${methodName}`,
                                isStdlib: true
                            });

                            const fallbackDocs = await this.docResolver.resolve(fallbackKey);
                            if (fallbackDocs && fallbackDocs.content) {
                                content = fallbackDocs.content;
                                Logger.log(`Fallback successful. Using docs from object.${methodName}`);
                            }
                        } catch (e) {
                            Logger.error('Fallback lookup failed', e);
                        }
                    }
                }

                // For local symbols, we rely on LSP/Typeshed signature and potentially local docstring
                // We do NOT want to show "Documentation not found" or query PyPI.
                const localDoc: HoverDoc = {
                    title: lspSymbol.name,
                    content: content,
                    signature: lspSymbol.signature,
                    kind: lspSymbol.kind,
                    source: ResolutionSource.Local,
                    confidence: 1.0,
                    overloads: lspSymbol.overloads,
                    protocolHints: lspSymbol.protocolHints
                };
                return this.renderer.render(localDoc);
            }

            // Merge info (prefer runtime for some things, LSP for others)
            const symbolInfo = { ...lspSymbol, ...runtimeInfo };

            // Fix Name/Title:
            // If LSP gave us a qualified name (e.g. "os.chdir") and runtime gave us a simple name (e.g. "chdir"),
            // we prefer the qualified name for the hover title.
            if (runtimeInfo && lspSymbol.name.includes('.') && runtimeInfo.name && !runtimeInfo.name.includes('.')) {
                // Special case: If runtime module is os.path, prefer it over ntpath/posixpath
                if (runtimeInfo.module === 'os.path' && (lspSymbol.name.startsWith('ntpath.') || lspSymbol.name.startsWith('posixpath.'))) {
                    symbolInfo.name = `os.path.${runtimeInfo.name}`;
                    symbolInfo.qualname = `os.path.${runtimeInfo.name}`;
                } else {
                    symbolInfo.name = lspSymbol.name;
                    // If qualname is also simple (matching the runtime name), update it too so HoverDocBuilder uses the full name
                    if (symbolInfo.qualname === runtimeInfo.name) {
                        symbolInfo.qualname = lspSymbol.name;
                    }
                }
            }

            // 3. Normalize to DocKey
            const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
            Logger.log('DocKey:', docKey);

            // 4. Resolve Docs (Canonical Linking)
            const docs = await this.docResolver.resolve(docKey);
            Logger.log('Resolved Docs:', docs);

            // 5. Build Standardized Hover Doc
            const hoverDoc = this.docBuilder.build(symbolInfo, docs);

            // 6. Render
            return this.renderer.render(hoverDoc);
        } finally {
            this.isFetching = false;
        }
    }
}

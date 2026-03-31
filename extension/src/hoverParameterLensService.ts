import * as vscode from 'vscode';
import { HoverDocBuilder } from '../../docs-engine/src/builder/hoverDocBuilder';
import { DocResolver } from '../../docs-engine/src/docResolver';
import { DocKeyBuilder } from '../../shared/docKey';
import { BUILTIN_TYPES, isKnownTopLevelBuiltin } from '../../shared/pythonBuiltins';
import { ActiveParameterLens, HoverDoc, ResolutionSource, SymbolInfo } from '../../shared/types';
import { mergeActiveParameterLensWithDoc, resolveActiveParameterLens } from './parameterLens';
import { isStdlibTopLevelModule } from './symbolClassifier';
import { HoverRenderer } from './ui/hoverRenderer';

type HoverCommandStore = {
    rememberCommandDoc: (doc: HoverDoc, commandToken: string) => HoverDoc;
    getExactDocByCommandToken: (token: string) => HoverDoc | null;
};

type AliasResolver = {
    resolveAliasForDocument: (document: vscode.TextDocument, documentText: string, symbol: string) => string;
};

export class HoverParameterLensService {
    private parameterLensCache = new Map<string, ActiveParameterLens | null>();
    private inflightParameterLens = new Map<string, Promise<ActiveParameterLens | null>>();

    constructor(
        private readonly renderer: HoverRenderer,
        private readonly docResolver: DocResolver,
        private readonly docBuilder: HoverDocBuilder,
        private readonly commandStore: HoverCommandStore,
        private readonly aliasResolver: AliasResolver,
    ) { }

    clearSessionCache(): void {
        this.parameterLensCache.clear();
        this.inflightParameterLens.clear();
    }

    async getParameterLens(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
    ): Promise<ActiveParameterLens | null> {
        if (token.isCancellationRequested) {
            return null;
        }

        const cacheKey = this.positionCacheKey(document, position);
        if (this.parameterLensCache.has(cacheKey)) {
            return this.parameterLensCache.get(cacheKey) ?? null;
        }

        const inflight = this.inflightParameterLens.get(cacheKey);
        if (inflight) {
            return inflight;
        }

        const promise = resolveActiveParameterLens(document, position)
            .catch(() => null)
            .then(lens => {
                this.parameterLensCache.set(cacheKey, lens);
                return lens;
            })
            .finally(() => this.inflightParameterLens.delete(cacheKey));

        this.inflightParameterLens.set(cacheKey, promise);
        return promise;
    }

    async decorateHoverWithParameterLens(
        hover: vscode.Hover | null,
        baseCommandToken: string | undefined,
        lens: ActiveParameterLens | null,
        hoverRange: vscode.Range | undefined,
        document: vscode.TextDocument,
        documentText: string,
        position: vscode.Position,
    ): Promise<vscode.Hover | null> {
        if (!lens) {
            return hover;
        }

        const tokenBase = baseCommandToken
            ? `${baseCommandToken}::lens`
            : `__lens__:${document.uri.toString()}`;
        const commandToken = `${tokenBase}:${document.version}:${position.line}:${position.character}:${lens.parameterIndex}`;
        const baseDoc = baseCommandToken ? this.commandStore.getExactDocByCommandToken(baseCommandToken) : null;
        if (baseCommandToken && !baseDoc && hover) {
            return hover;
        }

        const contextualDoc = baseDoc && !this.shouldPromoteCallableContext(baseDoc, lens)
            ? this.buildContextualHoverDoc(baseDoc, lens, commandToken)
            : await this.buildPromotedCallableDoc(document, documentText, lens, commandToken)
            ?? this.buildLensOnlyHoverDoc(lens, commandToken);

        const contextualHover = this.renderer.render(contextualDoc);
        if (hoverRange) {
            contextualHover.range = hoverRange;
        }
        return contextualHover;
    }

    private positionCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
        return `${document.uri.toString()}:${document.version}:${position.line}:${position.character}`;
    }

    private buildContextualHoverDoc(doc: HoverDoc, lens: ActiveParameterLens, commandToken: string): HoverDoc {
        const contextualDoc: HoverDoc = {
            ...doc,
            metadata: { ...(doc.metadata ?? {}) },
            parameterLens: mergeActiveParameterLensWithDoc(lens, doc),
            parameters: doc.parameters ?? lens.parameters,
        };
        return this.commandStore.rememberCommandDoc(contextualDoc, commandToken);
    }

    private buildLensOnlyHoverDoc(lens: ActiveParameterLens, commandToken: string): HoverDoc {
        const lensDoc: HoverDoc = {
            title: lens.callable,
            kind: 'function',
            signature: lens.signature,
            summary: lens.callableDocumentation,
            content: lens.callableDocumentation,
            source: ResolutionSource.LSP,
            confidence: 0.82,
            parameters: lens.parameters,
            parameterLens: lens,
        };
        return this.commandStore.rememberCommandDoc(lensDoc, commandToken);
    }

    private async buildPromotedCallableDoc(
        document: vscode.TextDocument,
        documentText: string,
        lens: ActiveParameterLens,
        commandToken: string,
    ): Promise<HoverDoc | null> {
        const callableName = lens.callable.trim();
        if (!callableName || callableName.startsWith('(')) {
            return null;
        }

        const resolvedCallable = this.aliasResolver.resolveAliasForDocument(document, documentText, callableName).trim();
        if (!resolvedCallable || resolvedCallable.startsWith('(')) {
            return null;
        }

        const symbolInfo = this.buildPromotedSymbolInfo(resolvedCallable, lens);

        const docs = await this.docResolver.resolve(DocKeyBuilder.fromSymbol(symbolInfo)).catch(() => null);
        if (!docs) {
            return null;
        }

        const hoverDoc = this.docBuilder.build(symbolInfo, docs);
        hoverDoc.signature = hoverDoc.signature || lens.signature;
        hoverDoc.summary = hoverDoc.summary || lens.callableDocumentation;
        hoverDoc.content = hoverDoc.content || lens.callableDocumentation;
        hoverDoc.parameters = hoverDoc.parameters ?? lens.parameters;
        hoverDoc.parameterLens = mergeActiveParameterLensWithDoc(lens, hoverDoc);
        return this.commandStore.rememberCommandDoc(hoverDoc, commandToken);
    }

    private shouldPromoteCallableContext(baseDoc: HoverDoc, lens: ActiveParameterLens): boolean {
        const baseLeaf = this.hoverDocLeafName(baseDoc.title);
        const callableLeaf = this.hoverDocLeafName(lens.callable);
        if (!baseLeaf || !callableLeaf) {
            return true;
        }
        return baseLeaf !== callableLeaf;
    }

    private hoverDocLeafName(value: string | undefined): string {
        return value?.trim().replace(/^builtins\./, '').split('.').pop()?.trim().toLowerCase() ?? '';
    }

    private buildPromotedSymbolInfo(resolvedCallable: string, lens: ActiveParameterLens): SymbolInfo {
        const normalizedCallable = resolvedCallable.replace(/^builtins\./, '');
        const rootName = normalizedCallable.split('.')[0] ?? '';
        const isBuiltinCallable = resolvedCallable.startsWith('builtins.')
            || BUILTIN_TYPES.has(rootName)
            || isKnownTopLevelBuiltin(rootName);
        const isStdlib = isBuiltinCallable || isStdlibTopLevelModule(rootName);
        const module = this.getPromotedCallableModule(resolvedCallable, rootName, isBuiltinCallable, isStdlib);
        const name = !resolvedCallable.startsWith('builtins.') && isBuiltinCallable && !resolvedCallable.includes('.')
            ? `builtins.${resolvedCallable}`
            : resolvedCallable;

        return {
            name,
            qualname: this.getPromotedCallableQualname(name, module, normalizedCallable, isBuiltinCallable),
            module,
            kind: 'function',
            isStdlib,
            path: module,
            signature: lens.signature,
            docstring: lens.callableDocumentation,
        };
    }

    private getPromotedCallableModule(
        resolvedCallable: string,
        rootName: string,
        isBuiltinCallable: boolean,
        isStdlib: boolean,
    ): string | undefined {
        if (isBuiltinCallable) {
            return 'builtins';
        }

        if (resolvedCallable.includes('.')) {
            return resolvedCallable.split('.').slice(0, -1).join('.');
        }

        return isStdlib ? rootName : undefined;
    }

    private getPromotedCallableQualname(
        name: string,
        module: string | undefined,
        normalizedCallable: string,
        isBuiltinCallable: boolean,
    ): string | undefined {
        if (module && name.startsWith(`${module}.`)) {
            return name.slice(module.length + 1);
        }

        return isBuiltinCallable ? normalizedCallable : undefined;
    }
}

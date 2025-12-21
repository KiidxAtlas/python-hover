
import { Badge, HoverDoc, ParameterInfo, ResolutionSource, SymbolInfo } from '../../../shared/types';
import { DocstringParser, ParsedDocstring } from '../parsing/docstringParser';

export class HoverDocBuilder {
    private parser: DocstringParser;

    constructor() {
        this.parser = new DocstringParser();
    }

    build(symbolInfo: SymbolInfo, docs: HoverDoc | null): HoverDoc {
        const parsedDocstring = this.parser.parse(symbolInfo.docstring || '');

        const title = this.buildTitle(symbolInfo);
        const signature = this.buildSignature(symbolInfo);
        const summary = this.buildSummary(parsedDocstring, docs, symbolInfo);
        const parameters = this.buildParameters(parsedDocstring, symbolInfo);
        const badges = this.buildBadges(symbolInfo, parsedDocstring);
        const examples = this.buildExamples(parsedDocstring, docs);
        const kind = this.inferKind(symbolInfo);

        return {
            title: title,
            kind: kind,
            signature: signature,
            summary: summary,
            parameters: parameters,
            returns: parsedDocstring.returns,
            raises: parsedDocstring.raises,
            notes: parsedDocstring.notes,
            examples: examples,
            url: docs?.url,
            links: docs?.links,
            badges: badges,
            source: docs?.source || ResolutionSource.Runtime,
            confidence: docs?.confidence || 0.5,
            content: docs?.content, // Keep legacy content if needed
            overloads: symbolInfo.overloads,
            protocolHints: symbolInfo.protocolHints
        };
    }

    private buildTitle(symbolInfo: SymbolInfo): string {
        return symbolInfo.qualname || symbolInfo.name;
    }

    private buildSignature(symbolInfo: SymbolInfo): string | undefined {
        // Priority: LSP > Runtime > Docstring
        // For now, we use what's in symbolInfo which is a merge
        return symbolInfo.signature;
    }

    private buildSummary(parsed: ParsedDocstring, docs: HoverDoc | null, symbolInfo: SymbolInfo): string | undefined {
        // Priority: Scraped Sphinx Content > Runtime docstring > Docs inventory placeholder

        if (docs && docs.content && !docs.content.startsWith('Documentation for') && !docs.content.startsWith('Documentation from')) {
            // If docs.content is actual content (scraped from Sphinx or Static Typing), use it
            return docs.content;
        }

        // For keywords, the parser might truncate too much (it expects function-like docstrings).
        // Use the specialized help text parser for keywords.
        if (symbolInfo.kind === 'keyword') {
            return this.parser.parseHelpText(symbolInfo.docstring || '').summary;
        }

        if (parsed.summary) return parsed.summary;

        return undefined;
    }

    private buildExamples(parsed: ParsedDocstring, docs: HoverDoc | null): string[] | undefined {
        const examples: string[] = [];

        // 1. Static/Enhanced Examples (High quality)
        if (docs && docs.examples) {
            examples.push(...docs.examples);
        }

        // 2. Parsed Runtime Examples
        if (parsed.examples) {
            examples.push(...parsed.examples);
        }

        return examples.length > 0 ? examples : undefined;
    }

    private buildParameters(parsed: ParsedDocstring, symbolInfo: SymbolInfo): ParameterInfo[] | undefined {
        // Merge parsed parameters with runtime/LSP info if available
        // For now, return parsed parameters
        return parsed.parameters;
    }

    private buildBadges(symbolInfo: SymbolInfo, parsed: ParsedDocstring): Badge[] {
        const badges: Badge[] = [];

        if (symbolInfo.isStdlib) {
            badges.push({ label: 'stdlib', color: 'blue' });
        }

        // Heuristics for other badges
        const doc = (symbolInfo.docstring || '').toLowerCase();

        // Deprecation
        if (doc.includes('deprecated') || doc.includes('.. deprecated::')) {
            badges.push({ label: 'deprecated', color: 'red' });
        }

        // Async
        if (doc.includes('async') || (symbolInfo.signature && symbolInfo.signature.startsWith('async'))) {
            badges.push({ label: 'async', color: 'purple' });
        }

        // Purity / Side Effects
        const impureKeywords = ['inplace', 'mutate', 'set', 'update', 'write', 'delete', 'save'];
        if (impureKeywords.some(k => doc.includes(k))) {
            badges.push({ label: 'side-effects', color: 'orange', tooltip: 'This function likely mutates state.' });
        }

        // I/O
        const ioKeywords = ['path', 'file', 'socket', 'requests', 'open', 'read', 'write'];
        if (ioKeywords.some(k => doc.includes(k))) {
            badges.push({ label: 'i/o', color: 'yellow', tooltip: 'This function performs I/O operations.' });
        }

        return badges;
    }

    private inferKind(symbolInfo: SymbolInfo): string {
        if (symbolInfo.kind) return symbolInfo.kind;

        if (symbolInfo.name === symbolInfo.module) return 'package';

        if (symbolInfo.signature) {
            if (symbolInfo.signature.startsWith('class')) return 'class';
            if (symbolInfo.signature.includes('def ')) return 'function';
        }

        if (symbolInfo.qualname) {
            const parts = symbolInfo.qualname.split('.');
            const name = parts[parts.length - 1];
            if (name && name[0] === name[0].toUpperCase()) return 'class';
            if (name && name[0] === name[0].toLowerCase()) return 'function';
        }

        return 'symbol';
    }
}

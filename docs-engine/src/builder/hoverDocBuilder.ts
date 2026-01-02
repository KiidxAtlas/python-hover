
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

        // Ensure we don't pass placeholder content in the legacy field
        let legacyContent = docs?.content;
        if (legacyContent && (legacyContent.startsWith('Documentation for') || legacyContent.startsWith('Documentation from'))) {
            legacyContent = undefined;
        }

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
            content: legacyContent, // Keep legacy content if needed (but filtered)
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

        let content = docs?.content;

        // Filter out placeholder content
        if (content && (content.startsWith('Documentation for') || content.startsWith('Documentation from'))) {
            content = undefined;
        }

        // Heuristic: If content is very short (likely just a title or signature) and we have a better docstring, use docstring.
        if (content) {
            const isShort = content.length < 100; // Arbitrary threshold for "short" content
            const docstring = symbolInfo.docstring || '';
            // If docstring is significantly longer/better than the scraped content
            if (isShort && docstring.length > content.length * 1.5) {
                content = undefined;
            }
        }

        if (content) {
            return content;
        }

        // For keywords, use the raw docstring directly - the renderer will format it
        if (symbolInfo.kind === 'keyword') {
            return symbolInfo.docstring || undefined;
        }

        if (parsed.summary) return parsed.summary;

        // Fallback to raw docstring if parsing failed but we have one
        if (symbolInfo.docstring) {
            return symbolInfo.docstring;
        }

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

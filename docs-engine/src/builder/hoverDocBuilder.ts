
import { Badge, HoverDoc, ResolutionSource, SymbolInfo } from '../../../shared/types';
import { DocstringParser, ParsedDocstring } from '../parsing/docstringParser';

const PLACEHOLDER_MSGS = [
    'Documentation for',
    'Documentation from',
    'No documentation found.',
    'Documentation lookup failed.',
];

export class HoverDocBuilder {
    private parser: DocstringParser;

    constructor() {
        this.parser = new DocstringParser();
    }

    build(symbolInfo: SymbolInfo, docs: HoverDoc | null): HoverDoc {
        const parsedDocstring = this.parser.parse(symbolInfo.docstring || '');

        const title = this.buildTitle(symbolInfo);
        const signature = symbolInfo.signature;
        const summary = this.buildSummary(parsedDocstring, docs, symbolInfo);
        const parameters = parsedDocstring.parameters;
        const badges = this.buildBadges(symbolInfo, parsedDocstring);
        const examples = this.buildExamples(parsedDocstring, docs);
        const notes = parsedDocstring.notes;
        const kind = this.inferKind(symbolInfo);

        // Ensure we don't pass placeholder content in the legacy field
        let legacyContent = docs?.content;
        if (legacyContent && PLACEHOLDER_MSGS.some(p => legacyContent!.startsWith(p) || legacyContent === p)) {
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
            notes: notes,
            examples: examples,
            url: docs?.url,
            devdocsUrl: docs?.devdocsUrl,
            links: docs?.links,
            badges: badges,
            source: docs?.source || ResolutionSource.Runtime,
            confidence: docs?.confidence || 0.5,
            content: legacyContent,
            overloads: symbolInfo.overloads,
            protocolHints: symbolInfo.protocolHints,
            seeAlso: docs?.seeAlso,
            module: symbolInfo.module || docs?.module,
        };
    }

    private buildTitle(symbolInfo: SymbolInfo): string {
        const name = symbolInfo.name;
        const qualname = symbolInfo.qualname;

        if (!qualname) return name;
        if (!name || name === qualname) return qualname;

        const nameParts = name.split('.');
        const qualnameParts = qualname.split('.');
        const nameLeaf = nameParts[nameParts.length - 1];
        const qualnameLeaf = qualnameParts[qualnameParts.length - 1];
        const nameOwner = nameParts.length >= 2 ? nameParts[nameParts.length - 2] : undefined;
        const qualnameOwner = qualnameParts.length >= 2 ? qualnameParts[qualnameParts.length - 2] : undefined;

        // Runtime reflection often resolves aliases/inherited methods to the implementation
        // target (e.g. DataFrame.aggregate, Starlette.add_middleware). For display, prefer
        // the hovered public symbol name in those cases.
        if (nameLeaf !== qualnameLeaf || (nameOwner && qualnameOwner && nameOwner !== qualnameOwner)) {
            return nameOwner ? `${nameOwner}.${nameLeaf}` : name;
        }

        return qualname;
    }

    private buildSummary(parsed: ParsedDocstring, docs: HoverDoc | null, symbolInfo: SymbolInfo): string | undefined {
        let content = docs?.content;
        if (content && PLACEHOLDER_MSGS.some(p => content!.startsWith(p) || content === p)) {
            content = undefined;
        }

        // Keyword hovers render best when the renderer gets the full source text
        // (syntax, examples, related topics), not a compressed first-paragraph summary.
        if (symbolInfo.kind === 'keyword' && content) {
            return undefined;
        }

        const summaryFromDocs = this.extractUsefulSummary(docs?.summary);
        const docstringSummary = this.extractUsefulSummary(symbolInfo.docstring);
        let contentSummary = this.extractUsefulSummary(content);
        const parsedSummary = this.extractUsefulSummary(parsed.summary);

        // Heuristic: If content is very short (likely just a title or signature) and we have a better docstring, use docstring.
        if (content) {
            const isShort = content.length < 100; // Arbitrary threshold for "short" content
            const docstring = symbolInfo.docstring || '';
            // If docstring is significantly longer/better than the scraped content
            if (isShort && docstring.length > content.length * 1.5) {
                contentSummary = undefined;
            }
        }

        if (summaryFromDocs && this.isGoodSummary(summaryFromDocs)) {
            return summaryFromDocs;
        }

        if (contentSummary && (this.isGoodSummary(contentSummary) || !docstringSummary)) {
            return contentSummary;
        }

        if (docstringSummary && (this.isGoodSummary(docstringSummary) || !parsedSummary)) {
            return docstringSummary;
        }

        if (parsedSummary && !this.shouldPreferRawDocstring(parsedSummary, symbolInfo.docstring)) {
            return parsedSummary;
        }

        // Fallback to raw docstring if parsing failed but we have one —
        // but never surface the unhelpful "No Python documentation found …" text.
        if (symbolInfo.docstring && !this.isUnhelpfulRuntimeFallback(symbolInfo.docstring)) {
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

    private buildBadges(symbolInfo: SymbolInfo, parsed: ParsedDocstring): Badge[] {
        const badges: Badge[] = [];
        const doc = symbolInfo.docstring || '';
        const sig = symbolInfo.signature || '';

        if (symbolInfo.isStdlib) {
            badges.push({ label: 'stdlib', color: 'blue' });
        }

        // Deprecation — very reliable signal
        if (this.isDeprecatedDocstring(doc)) {
            badges.push({ label: 'deprecated', color: 'red' });
        }

        // Async — check signature first, then docstring
        if (sig.startsWith('async def') || sig.startsWith('async ')) {
            badges.push({ label: 'async', color: 'purple' });
        }

        // Generator — return type hint is the most reliable signal
        if (/[-:]\s*(Generator|Iterator|Iterable|AsyncGenerator|AsyncIterator)\b/.test(sig)) {
            badges.push({ label: 'generator', color: 'teal' });
        }

        return badges;
    }

    private isDeprecatedDocstring(docstring: string): boolean {
        if (!docstring.trim()) return false;

        for (const rawLine of docstring.split('\n')) {
            const line = rawLine.trim().toLowerCase();
            if (!line) continue;

            if (line.includes('.. deprecated::')) {
                return true;
            }

            if (/\bdeprecated since\b/.test(line) || /\bis deprecated\b/.test(line) || /\bhas been deprecated\b/.test(line)) {
                return true;
            }

            if (/^deprecated(?:\s+since(?:\s+version)?\s+\S+)?\s*:\s*(?:use|replaced|removed|avoid|this|the|please|prefer|import|call|passing|parameter|method|function|class|module|path)\b/.test(line)) {
                return true;
            }
        }

        return false;
    }

    private shouldPreferRawDocstring(summary: string, rawDocstring?: string): boolean {
        if (!rawDocstring?.trim()) return false;

        const normalizedSummary = summary.trim();
        if (!normalizedSummary) return true;

        if (/^Help on\s+\w+\s+object:/i.test(normalizedSummary)) {
            return true;
        }

        if (/^\.\.\s+[\w-]+::/.test(normalizedSummary)) {
            return true;
        }

        return false;
    }

    private extractUsefulSummary(text?: string): string | undefined {
        if (!text?.trim()) return undefined;

        if (this.isUnhelpfulRuntimeFallback(text)) {
            return undefined;
        }

        const pydocSummary = this.extractPydocSummary(text);
        if (pydocSummary) {
            return pydocSummary;
        }

        const lines = text.split('\n');
        const collected: string[] = [];
        let paragraphCount = 0;

        for (let index = 0; index < lines.length; index++) {
            const trimmed = lines[index].trim();
            const nextTrimmed = lines[index + 1]?.trim();

            if (!trimmed) {
                if (collected.length > 0) {
                    const last = collected[collected.length - 1];
                    const joined = this.normalizeSummaryText(collected.join(' '));
                    const needsMoreContext = joined.length < 120 && paragraphCount < 2;
                    if (!last.endsWith(':') && !needsMoreContext) {
                        break;
                    }
                    paragraphCount++;
                }
                continue;
            }

            if (this.isSummarySectionBoundary(trimmed, nextTrimmed)) {
                if (collected.length > 0) break;
                continue;
            }

            if (this.isMarkdownSectionBoundary(trimmed)) {
                if (collected.length > 0) break;
                continue;
            }

            if (this.looksLikeSignatureLine(trimmed)) {
                if (collected.length > 0) break;
                continue;
            }

            const normalized = this.normalizeSummaryLine(trimmed);
            if (!normalized) continue;

            collected.push(normalized);

            const joined = this.normalizeSummaryText(collected.join(' '));
            if (joined.length >= 260 && /[.!?]$/.test(normalized)) {
                return joined;
            }
        }

        if (collected.length === 0) return undefined;
        return this.normalizeSummaryText(collected.join(' '));
    }

    private isGoodSummary(summary: string): boolean {
        const normalized = summary.trim();
        if (!normalized) return false;
        if (normalized.length < 24) return false;
        if (/^(?:documentation|module|package|class|function)\b$/i.test(normalized)) return false;
        if (this.isUnhelpfulRuntimeFallback(normalized)) return false;
        return true;
    }

    private isUnhelpfulRuntimeFallback(text: string): boolean {
        const normalized = text.trim();
        if (!normalized) return false;

        return /^No Python documentation found for\s+/i.test(normalized)
            || /^Use help\(\) to get the interactive help utility\.?/i.test(normalized)
            || /^Use help\([^)]*\) for help on/i.test(normalized);
    }

    private extractPydocSummary(text: string): string | undefined {
        const match = text.match(/^Help on \w+ object:\s*[\r\n]+\s*class\s+\w+[^|]*\|\s*(.+?)(?:\s*\||$)/s);
        if (!match?.[1]) return undefined;

        const summary = match[1].trim().replace(/\|/g, '').trim();
        if (!summary || summary.startsWith('Methods defined')) return undefined;
        return this.normalizeSummaryText(summary);
    }

    private normalizeSummaryLine(line: string): string | undefined {
        const trimmed = line.trim();
        if (!trimmed) return undefined;
        if (/^[-=~^#*]{3,}$/.test(trimmed)) return undefined;
        if (/^```/.test(trimmed)) return undefined;
        if (this.isUnhelpfulRuntimeFallback(trimmed)) return undefined;
        if (/^:(?:param|type|returns?|raises?|rtype|yield|ytype|example|examples)\b/i.test(trimmed)) return undefined;

        const directiveTransforms: Array<[RegExp, string]> = [
            [/^\.\.\s+note::\s*/i, 'Note: '],
            [/^\.\.\s+warning::\s*/i, 'Warning: '],
            [/^\.\.\s+caution::\s*/i, 'Caution: '],
            [/^\.\.\s+important::\s*/i, 'Important: '],
            [/^\.\.\s+tip::\s*/i, 'Tip: '],
            [/^\.\.\s+deprecated::\s*(\S+)\s*/i, 'Deprecated since $1: '],
            [/^\.\.\s+versionadded::\s*(\S+)\s*/i, 'New in $1: '],
            [/^\.\.\s+versionchanged::\s*(\S+)\s*/i, 'Changed in $1: '],
        ];

        let normalized = trimmed;
        for (const [pattern, replacement] of directiveTransforms) {
            if (pattern.test(normalized)) {
                normalized = normalized.replace(pattern, replacement);
                return this.processInlineLinks(normalized).trim();
            }
        }

        if (/^\.\.\s+[\w-]+::/.test(normalized)) return undefined;
        return this.processInlineLinks(normalized).trim();
    }

    private normalizeSummaryText(text: string): string {
        let normalized = text
            .replace(/\s+/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();

        if (normalized.length > 280) {
            const sentenceBreak = normalized.lastIndexOf('. ', 260);
            if (sentenceBreak > 80) {
                normalized = normalized.slice(0, sentenceBreak + 1);
            }
        }

        return normalized;
    }

    private processInlineLinks(text: string): string {
        return text
            .replace(/\bPEP\s+(\d+)\b/g, (_match, num) => `PEP ${num}`)
            .replace(/`([^`\n]+)\s+<([^>\n]+)>`_/g, '$1')
            .replace(/:ref:`([^`\n]+)`/g, '$1')
            .replace(/:(?:func|class|meth|mod|attr|exc|data|const|type|obj):`([^`\n]+)`/g, '`$1`');
    }

    private isSummarySectionBoundary(line: string, nextLine?: string): boolean {
        if (/^(?:Parameters|Returns|Raises|Examples?|Notes?|See Also|Args|Arguments|Attributes|Methods|Yields|Warns|References?)\s*:?$/i.test(line)) {
            return true;
        }

        if (nextLine && /^[-=~^#*]{3,}$/.test(nextLine) && /^[A-Z][A-Za-z0-9 _-]+$/.test(line)) {
            return true;
        }

        return false;
    }

    private isMarkdownSectionBoundary(line: string): boolean {
        return /^#{1,6}\s+/.test(line)
            || /^```/.test(line)
            || /^(?:Examples?|See Also|Notes?)\b/i.test(line);
    }

    private looksLikeSignatureLine(line: string): boolean {
        return line.includes('->') || /^\w+(?:\.\w+)*\(.*\)$/.test(line);
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

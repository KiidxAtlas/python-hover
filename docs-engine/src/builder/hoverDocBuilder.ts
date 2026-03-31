
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
        const structuredContent = docs?.structuredContent;
        const structuredParameters = this.extractParametersFromStructuredContent(structuredContent);
        const structuredReturns = this.extractReturnFromStructuredContent(structuredContent);
        const structuredRaises = this.extractRaisesFromStructuredContent(structuredContent);

        const title = this.buildTitle(symbolInfo);
        const signature = symbolInfo.kind === 'keyword'
            ? undefined
            : this.sanitizeSignature(
                symbolInfo.signature || structuredContent?.signature || this.extractSignatureFromContent(docs?.content, title)
            );
        const summary = this.buildSummary(parsedDocstring, docs, symbolInfo);
        const parameters = parsedDocstring.parameters && parsedDocstring.parameters.length > 0
            ? parsedDocstring.parameters
            : structuredParameters;
        const badges = this.buildBadges(symbolInfo);
        const examples = this.buildExamples(parsedDocstring, docs);
        const notes = this.buildNotes(parsedDocstring, docs);
        const kind = this.inferKind(symbolInfo, docs);

        // Ensure we don't pass placeholder content in the legacy field
        let legacyContent = structuredContent?.description || docs?.content;
        if (legacyContent && PLACEHOLDER_MSGS.some(p => legacyContent!.startsWith(p) || legacyContent === p)) {
            legacyContent = undefined;
        }

        return {
            title: title,
            kind: kind,
            signature: signature,
            summary: summary,
            parameters: parameters,
            returns: parsedDocstring.returns || structuredReturns,
            raises: parsedDocstring.raises && parsedDocstring.raises.length > 0 ? parsedDocstring.raises : structuredRaises,
            notes: notes,
            examples: examples,
            url: docs?.url,
            devdocsUrl: docs?.devdocsUrl,
            sourceUrl: docs?.sourceUrl,
            links: docs?.links,
            badges: badges,
            source: docs?.source || ResolutionSource.Runtime,
            confidence: docs?.confidence || 0.5,
            metadata: docs?.metadata,
            content: legacyContent,
            structuredContent,
            overloads: symbolInfo.overloads,
            protocolHints: symbolInfo.protocolHints,
            seeAlso: docs?.seeAlso,
            module: symbolInfo.module || docs?.module,
            moduleExports: docs?.moduleExports,
            exportCount: docs?.exportCount,
            installedVersion: docs?.installedVersion,
            latestVersion: docs?.latestVersion,
            license: docs?.license,
            requiresPython: docs?.requiresPython,
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
        let content = docs?.structuredContent?.description || docs?.content;
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

        // Language-server / in-editor docstrings before fetched summaries (augment-LS mode).
        if (symbolInfo.kind !== 'keyword') {
            const raw = symbolInfo.docstring?.trim() ?? '';
            if (raw.length >= 48 && !this.isUnhelpfulRuntimeFallback(symbolInfo.docstring!)) {
                if (parsedSummary && !this.shouldPreferRawDocstring(parsedSummary, symbolInfo.docstring)) {
                    return parsedSummary;
                }
                if (docstringSummary && (this.isGoodSummary(docstringSummary) || !summaryFromDocs)) {
                    return docstringSummary;
                }
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
        const examples = new Set<string>();

        // 1. Static/Enhanced Examples (High quality)
        if (docs?.structuredContent?.examples) {
            docs.structuredContent.examples.forEach(example => examples.add(example));
        }

        if (docs && docs.examples) {
            docs.examples.forEach(example => examples.add(example));
        }

        // 2. Parsed Runtime Examples
        if (parsed.examples) {
            parsed.examples.forEach(example => examples.add(example));
        }

        return examples.size > 0 ? [...examples] : undefined;
    }

    private buildNotes(parsed: ParsedDocstring, docs: HoverDoc | null): string[] | undefined {
        const notes = new Set<string>();

        if (docs?.structuredContent?.notes) {
            docs.structuredContent.notes.forEach(note => notes.add(note));
        }

        if (parsed.notes) {
            parsed.notes.forEach(note => notes.add(note));
        }

        return notes.size > 0 ? [...notes] : undefined;
    }

    private buildBadges(symbolInfo: SymbolInfo): Badge[] {
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
        if (/^`{1,3}\s*[A-Za-z_][\w.]*\s*`{0,3}$/.test(trimmed)) return undefined;
        if (/^``\s+[A-Za-z_][\w.]*$/.test(trimmed)) return undefined;
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

    private extractSignatureFromContent(content?: string, title?: string): string | undefined {
        if (!content?.trim()) return undefined;

        const fenceMatch = content.match(/```(?:python)?\n([\s\S]*?)\n```/i);
        const firstLine = fenceMatch?.[1]
            ?.split('\n')
            .map(line => line.trim())
            .find(Boolean);
        if (!firstLine) return undefined;
        if (firstLine.length > 240) return undefined;

        const leaf = title?.split('.').pop();
        if (leaf && firstLine.startsWith(`${leaf}(`)) {
            return firstLine;
        }

        if (/^[A-Za-z_][\w.]*\(.*\)$/.test(firstLine)) {
            return firstLine;
        }

        return undefined;
    }

    private inferKind(symbolInfo: SymbolInfo, docs?: HoverDoc | null): string {
        if (symbolInfo.kind) return symbolInfo.kind;
        if (docs?.kind) return docs.kind;

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

    private sanitizeSignature(signature?: string): string | undefined {
        if (!signature) return undefined;
        return signature.replace(/\s*\[\[source\]\]\([^\s)]+\)/gi, '').trim();
    }

    private extractParametersFromStructuredContent(structuredContent?: HoverDoc['structuredContent']) {
        if (!structuredContent?.sections?.length) return undefined;

        const parameters: NonNullable<HoverDoc['parameters']> = [];
        let currentField: 'parameters' | 'returns' | 'raises' | undefined;

        for (const section of structuredContent.sections) {
            const nextField = this.getStructuredFieldKind(section.title);
            if (nextField) {
                currentField = nextField;
            } else if (section.title) {
                currentField = undefined;
            }

            if (currentField !== 'parameters') continue;
            if (section.kind === 'list' && section.items && section.items.length > 0) {
                for (const item of section.items) {
                    const parameter = this.parseStructuredParameter(item);
                    if (parameter) parameters.push(parameter);
                }
            } else {
                const parameter = this.parseStructuredParameter(section.content);
                if (parameter) parameters.push(parameter);
            }
        }

        return parameters.length > 0 ? parameters : undefined;
    }

    private extractReturnFromStructuredContent(structuredContent?: HoverDoc['structuredContent']) {
        if (!structuredContent?.sections?.length) return undefined;

        let currentField: 'parameters' | 'returns' | 'raises' | undefined;
        for (const section of structuredContent.sections) {
            const nextField = this.getStructuredFieldKind(section.title);
            if (nextField) {
                currentField = nextField;
            } else if (section.title) {
                currentField = undefined;
            }

            if (currentField !== 'returns') continue;
            const parsed = this.parseStructuredTypedEntry(section.content);
            if (parsed) {
                return {
                    type: parsed.label,
                    description: parsed.description,
                };
            }
        }

        return undefined;
    }

    private extractRaisesFromStructuredContent(structuredContent?: HoverDoc['structuredContent']) {
        if (!structuredContent?.sections?.length) return undefined;

        const raises: NonNullable<HoverDoc['raises']> = [];
        let currentField: 'parameters' | 'returns' | 'raises' | undefined;

        for (const section of structuredContent.sections) {
            const nextField = this.getStructuredFieldKind(section.title);
            if (nextField) {
                currentField = nextField;
            } else if (section.title) {
                currentField = undefined;
            }

            if (currentField !== 'raises') continue;
            const parsed = this.parseStructuredTypedEntry(section.content);
            if (parsed) {
                raises.push({
                    type: parsed.label,
                    description: parsed.description,
                });
            }
        }

        return raises.length > 0 ? raises : undefined;
    }

    private getStructuredFieldKind(title?: string): 'parameters' | 'returns' | 'raises' | undefined {
        if (!title) return undefined;
        if (/^(?:Parameters|Args|Arguments)$/i.test(title)) return 'parameters';
        if (/^Returns?$/i.test(title)) return 'returns';
        if (/^Raises?$/i.test(title)) return 'raises';
        return undefined;
    }

    private parseStructuredParameter(content: string): NonNullable<HoverDoc['parameters']>[number] | undefined {
        const parsed = this.parseStructuredTypedEntry(content);
        if (!parsed) return undefined;

        return {
            name: parsed.label,
            type: parsed.type,
            description: parsed.description,
        };
    }

    private parseStructuredTypedEntry(content: string): { label: string; type?: string; description?: string } | undefined {
        const normalized = content.trim().replace(/\[\[source\]\]\([^\s)]+\)/gi, '');
        if (!normalized) return undefined;

        const lines = normalized.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) return undefined;

        const heading = lines[0];
        const parsedHeading = this.parseStructuredHeading(heading);
        if (!parsedHeading) return undefined;

        const description = lines.slice(1).join(' ').trim() || undefined;
        return {
            label: parsedHeading.label,
            type: parsedHeading.type,
            description,
        };
    }

    private parseStructuredHeading(heading: string): { label: string; type?: string } | undefined {
        const compact = heading.replace(/\s+/g, ' ').trim();
        const boldWrapped = compact.match(/^\*\*(.+)\*\*$/);
        const inner = boldWrapped ? boldWrapped[1].trim() : compact;

        const malformedBold = /^\*{4}([^*]+)\*{2}(.+?)\*{2}$/.exec(compact);
        if (malformedBold) {
            return {
                label: malformedBold[1].trim(),
                type: malformedBold[2].trim(),
            };
        }

        // Strip link URLs ([text](url) → text) and leading bullets before structural parsing
        // to avoid splitting on '://' inside markdown links when using the name:type regex.
        const stripped = inner
            .replace(/^[-•]\s*/, '')
            .replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, '$1');

        // Sphinx-style: **name** (type) – optional description
        const sphinxMatch = /^\*\*([^*]+)\*\*\s*\((.+?)\)\s*(?:[-–—].*)?$/.exec(stripped);
        if (sphinxMatch) {
            return {
                label: sphinxMatch[1].trim(),
                type: sphinxMatch[2].replace(/[*_]/g, '').trim() || undefined,
            };
        }

        // Sphinx-style: **name** with no type
        const boldOnly = /^\*\*([^*]+)\*\*\s*(?:[-–—].*)?$/.exec(stripped);
        if (boldOnly) {
            return { label: boldOnly[1].trim() };
        }

        // Docstring-style: name : type (use stripped to avoid splitting on '://')
        const typed = /^([^:]+?)\s*:\s*(.+)$/.exec(stripped);
        if (typed) {
            return {
                label: typed[1].replace(/^\*+|\*+$/g, '').trim(),
                type: typed[2].replace(/^\*+|\*+$/g, '').trim(),
            };
        }

        const cleaned = inner.replace(/^\*+|\*+$/g, '').trim();
        return cleaned ? { label: cleaned } : undefined;
    }
}

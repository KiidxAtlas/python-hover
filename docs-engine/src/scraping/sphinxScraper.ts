import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { StructuredHoverContent, StructuredHoverSection } from '../../../shared/types';
import { DiskCache } from '../cache/diskCache';

const DOCS_REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; PyHover/0.6; +https://github.com/KiidxAtlas/python-hover)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const NON_CONTENT_PAGE_PATTERNS = [
    /\/py-modindex(?:\.html)?\/?$/i,
    /\/genindex(?:\.html)?\/?$/i,
    /\/modindex(?:\.html)?\/?$/i,
    /\/search(?:\.html)?\/?$/i,
];

export class SphinxScraper {
    private diskCache: DiskCache;
    private timeout: number;
    /** In-memory HTML cache: avoids re-fetching the same page for content + seeAlso in one session.
     *  Capped at 30 pages (raw HTML is large) — oldest entry evicted when full. */
    private htmlCache = new Map<string, string>();
    private static readonly HTML_CACHE_MAX = 30;
    private readonly loggedFetchSkips = new Set<string>();

    constructor(diskCache: DiskCache, timeout: number = 5000) {
        this.diskCache = diskCache;
        this.timeout = timeout;
    }

    private normalizeToHttps(url: string): string {
        if (url.startsWith('http://')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    private normalizeCorpusUrl(url: string): string {
        const normalized = this.normalizeToHttps(url);

        try {
            const parsed = new URL(normalized);
            if (parsed.pathname.endsWith('.rst')) {
                parsed.pathname = `${parsed.pathname.slice(0, -4)}.html`;
            }
            return parsed.toString();
        } catch {
            return normalized;
        }
    }

    private shouldSkipUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return NON_CONTENT_PAGE_PATTERNS.some(pattern => pattern.test(parsed.pathname));
        } catch {
            return false;
        }
    }

    private logSkippedFetch(url: string, reason: string): void {
        const key = `${url}|${reason}`;
        if (this.loggedFetchSkips.has(key)) {
            return;
        }
        this.loggedFetchSkips.add(key);
        Logger.debug(`SphinxScraper skipped ${url}: ${reason}`);
    }

    getCachedContent(packageName: string, url: string, group?: string): string | null {
        return this.diskCache.getCorpusEntry(packageName, this.normalizeCorpusUrl(url), group)?.content ?? null;
    }

    getCachedStructuredContent(packageName: string, url: string, group?: string): StructuredHoverContent | null {
        return this.diskCache.getCorpusEntry(packageName, this.normalizeCorpusUrl(url), group)?.structuredContent ?? null;
    }

    getCachedSeeAlso(packageName: string, url: string, group?: string): string[] | null {
        return this.diskCache.getCorpusEntry(packageName, this.normalizeCorpusUrl(url), group)?.seeAlso ?? null;
    }

    async fetchSeeAlso(packageName: string, url: string, group?: string, forceRefresh = false): Promise<string[]> {
        try {
            const normalizedUrl = this.normalizeCorpusUrl(url);
            if (this.shouldSkipUrl(normalizedUrl)) {
                this.logSkippedFetch(normalizedUrl, 'non-content page');
                return [];
            }

            const cached = forceRefresh ? null : this.getCachedSeeAlso(packageName, normalizedUrl, group);
            if (cached) return cached;

            const [baseUrl, anchor] = normalizedUrl.split('#');
            const cachedHtml = this.htmlCache.get(baseUrl);
            const html = cachedHtml ?? await this.fetchHtml(baseUrl).then(h => { this.setHtmlCache(baseUrl, h); return h; });
            if (!anchor || !html) return [];

            const extracted = this.extractSeeAlso(html, anchor, baseUrl);
            this.diskCache.setCorpusEntry(packageName, normalizedUrl, { seeAlso: extracted }, group);
            return extracted;
        } catch {
            return [];
        }
    }

    private extractSeeAlso(html: string, anchor: string, pageUrl: string): string[] {
        const results: string[] = [];

        // Find anchor position in HTML
        const idRegex = new RegExp(`id=["']${escapeRegExp(anchor)}["']`, 'i');
        const anchorMatch = idRegex.exec(html);
        if (!anchorMatch) return results;

        // Search within 5000 chars after the anchor for seealso blocks
        const region = html.substring(anchorMatch.index, anchorMatch.index + 5000);

        // Match Sphinx seealso admonition divs
        const seealsoRegex = /<div[^>]+class=["'][^"']*seealso[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi;
        let seealsoMatch: RegExpExecArray | null;
        while ((seealsoMatch = seealsoRegex.exec(region)) !== null) {
            const linkRegex = /<a[^>]+href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let linkMatch: RegExpExecArray | null;
            while ((linkMatch = linkRegex.exec(seealsoMatch[1])) !== null) {
                const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();
                const href = linkMatch[1];
                if (!text || !href) continue;
                try {
                    const abs = new URL(href, pageUrl).toString();
                    results.push(`[${text}](${abs})`);
                } catch {
                    if (text) results.push(text);
                }
            }
        }

        return [...new Set(results)].slice(0, 8); // dedupe + limit
    }

    async fetchContent(packageName: string, url: string, group?: string, forceRefresh = false): Promise<string | null> {
        try {
            const normalizedUrl = this.normalizeCorpusUrl(url);
            if (this.shouldSkipUrl(normalizedUrl)) {
                this.logSkippedFetch(normalizedUrl, 'non-content page');
                return null;
            }

            const cached = forceRefresh ? null : this.getCachedContent(packageName, normalizedUrl, group);
            if (cached) return cached;

            const [baseUrl, anchor] = normalizedUrl.split('#');

            let html = this.htmlCache.get(baseUrl);
            if (!html) {
                html = await this.fetchHtml(baseUrl);
                this.setHtmlCache(baseUrl, html);
            }

            const extracted = anchor
                ? this.extractSection(html!, anchor, baseUrl)
                : this.extractPageSummary(html!, baseUrl);

            if (extracted) {
                const derivedSeeAlso = this.deriveSeeAlsoFromMarkdown(extracted);
                this.diskCache.setCorpusEntry(packageName, normalizedUrl, {
                    content: extracted,
                    structuredContent: this.deriveStructuredContent(extracted),
                    seeAlso: derivedSeeAlso.length > 0 ? derivedSeeAlso : undefined,
                }, group);
            }

            return extracted;
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (/Status code 404/i.test(message) || /Request timed out/i.test(message)) {
                this.logSkippedFetch(this.normalizeCorpusUrl(url), message);
                return null;
            }
            Logger.error(`SphinxScraper failed for ${url}:`, e);
            return null;
        }
    }

    deriveStructuredContent(markdown: string): StructuredHoverContent | undefined {
        const trimmed = this.stripOrphanFenceLines(markdown.trim());
        if (!trimmed) return undefined;

        const blocks = this.splitMarkdownBlocks(trimmed);
        const sections: StructuredHoverSection[] = [];
        const examples: string[] = [];
        const notes: string[] = [];
        let summary: string | undefined;
        let signature: string | undefined;
        let pendingTitle: string | undefined;
        let activeRole: StructuredHoverSection['role'] | undefined;

        for (const [blockIndex, block] of blocks.entries()) {
            const title = this.extractSectionTitle(block);
            if (title) {
                if (!signature && this.isSignatureLikeParagraph(title)) {
                    signature = title;
                    pendingTitle = undefined;
                    activeRole = undefined;
                    continue;
                }
                pendingTitle = title;
                activeRole = this.inferSectionRole(title);
                continue;
            }

            const titleForSection = pendingTitle;
            const role = titleForSection ? this.inferSectionRole(titleForSection) : activeRole ?? 'description';
            if (this.extractSeeAlsoItems(block)) {
                pendingTitle = undefined;
                activeRole = undefined;
                continue;
            }

            const fenced = this.parseFencedCodeBlock(block);
            if (fenced) {
                const code = fenced.code.trim();
                if (!code) continue;

                if (!signature) {
                    const candidate = this.extractSignatureFromCodeBlock(code);
                    if (candidate && role !== 'example') {
                        signature = candidate;
                        pendingTitle = undefined;
                        continue;
                    }
                }

                const sectionRole = role === 'example' ? 'example' : 'description';
                sections.push({
                    kind: 'code',
                    role: sectionRole,
                    title: titleForSection,
                    content: code,
                    language: fenced.language || undefined,
                });
                if (sectionRole === 'example') {
                    examples.push(code);
                }
                pendingTitle = undefined;
                continue;
            }

            if (this.isDoctestTranscriptBlock(block)) {
                const code = block.trim();
                sections.push({
                    kind: 'code',
                    role: 'example',
                    title: titleForSection,
                    content: code,
                    language: 'python',
                });
                examples.push(code);
                pendingTitle = undefined;
                continue;
            }

            const normalized = block.trim();
            if (!normalized) {
                pendingTitle = undefined;
                continue;
            }

            if (!signature && this.isSignatureLikeParagraph(normalized)) {
                signature = normalized;
                pendingTitle = undefined;
                continue;
            }

            if (this.isGrammarLikeParagraph(normalized)) {
                sections.push({
                    kind: 'code',
                    role: 'description',
                    title: titleForSection || 'Syntax',
                    content: this.normalizeGrammarParagraph(normalized),
                    language: 'text',
                });
                pendingTitle = undefined;
                continue;
            }

            const listItems = this.parseListItems(normalized);
            if (listItems) {
                const sectionRole = role === 'note'
                    ? 'note'
                    : role === 'example'
                        ? 'example'
                        : 'description';
                sections.push({
                    kind: 'list',
                    role: sectionRole,
                    title: titleForSection,
                    content: normalized,
                    items: listItems,
                });
                if (sectionRole === 'note') {
                    notes.push(...listItems);
                } else if (sectionRole === 'example') {
                    examples.push(listItems.map(item => `- ${item}`).join('\n'));
                }
                pendingTitle = undefined;
                continue;
            }

            if (this.isNoteLikeParagraph(normalized) || role === 'note') {
                sections.push({
                    kind: 'note',
                    role: 'note',
                    title: titleForSection,
                    content: normalized,
                });
                notes.push(normalized);
                pendingTitle = undefined;
                continue;
            }

            if (role === 'example') {
                sections.push({
                    kind: 'paragraph',
                    role: 'example',
                    title: titleForSection,
                    content: normalized,
                });
                examples.push(normalized);
                pendingTitle = undefined;
                continue;
            }

            const summaryCandidate = this.stripExampleLeadIn(normalized, blocks[blockIndex + 1]);
            if (!summary && summaryCandidate) {
                summary = summaryCandidate;
                sections.push({
                    kind: 'paragraph',
                    role: 'summary',
                    title: titleForSection,
                    content: summaryCandidate,
                });
                activeRole = summaryCandidate !== normalized ? 'example' : undefined;
                pendingTitle = undefined;
                continue;
            }

            sections.push({
                kind: 'paragraph',
                role: 'description',
                title: titleForSection,
                content: normalized,
            });
            pendingTitle = undefined;
        }

        const descriptionParts = sections
            .filter(section => section.role === 'description')
            .map(section => this.serializeSection(section));
        const description = descriptionParts.length > 0 ? descriptionParts.join('\n\n') : undefined;

        if (!signature && !summary && !description && examples.length === 0 && notes.length === 0) {
            return undefined;
        }

        return {
            signature,
            summary,
            description,
            examples: examples.length > 0 ? examples : undefined,
            notes: notes.length > 0 ? notes : undefined,
            sections,
        };
    }

    private extractSectionTitle(block: string): string | undefined {
        const trimmed = block.trim();
        const boldMatch = /^\*\*([^*\n][\s\S]*?)\*\*$/.exec(trimmed);
        if (boldMatch) {
            return this.normalizeSectionTitle(boldMatch[1]);
        }

        const headingMatch = /^#{1,6}\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
            return this.normalizeSectionTitle(headingMatch[1]);
        }

        return undefined;
    }

    private normalizeSectionTitle(title: string): string {
        return title.replace(/\s+/g, ' ').trim().replace(/:$/, '');
    }

    private inferSectionRole(title?: string): StructuredHoverSection['role'] {
        if (!title) return 'description';

        if (/^(?:Examples?|Usage|Demo)\b/i.test(title)) return 'example';
        if (/^(?:Note|Notes|Warning|Warnings|Caution|Important|Tip|Tips|Changed in version|New in version|Deprecated)\b/i.test(title)) {
            return 'note';
        }

        return 'description';
    }

    private parseListItems(block: string): string[] | undefined {
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return undefined;

        const items: string[] = [];
        for (const line of lines) {
            const bulletMatch = /^(?:[-*]|\d+\.)\s+(.+)$/.exec(line);
            if (!bulletMatch) {
                return undefined;
            }
            items.push(bulletMatch[1].trim());
        }

        return items.length > 0 ? items : undefined;
    }

    private serializeSection(section: StructuredHoverSection): string {
        const heading = section.title ? `**${section.title}**\n\n` : '';

        if (section.kind === 'code') {
            const language = section.language || 'python';
            return `${heading}\`\`\`${language}\n${section.content}\n\`\`\``;
        }

        if (section.kind === 'list' && section.items && section.items.length > 0) {
            return `${heading}${section.items.map(item => `- ${item}`).join('\n')}`;
        }

        return `${heading}${section.content}`;
    }

    private extractPageSummary(html: string, pageUrl: string): string | null {
        // Strategy 1: module section with id="module-..."
        const sectionMatch = /<section[^>]*id=["']module-[^"']*["'][^>]*>([\s\S]*?)<\/section>/i.exec(html);
        if (sectionMatch) {
            const paragraphs = this.extractParagraphs(sectionMatch[1], pageUrl, 3);
            if (paragraphs) return paragraphs;
        }

        // Strategy 2: first paragraphs after <h1>
        const h1Index = html.search(/<h1[^>]*>/i);
        if (h1Index !== -1) {
            const afterH1 = html.substring(h1Index);
            const h1End = afterH1.indexOf('</h1>');
            if (h1End !== -1) {
                const paragraphs = this.extractParagraphs(afterH1.substring(h1End + 5), pageUrl, 3);
                if (paragraphs) return paragraphs;
            }
        }

        // Strategy 3: first substantial paragraph anywhere
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let pMatch;
        while ((pMatch = pRegex.exec(html)) !== null) {
            const text = this.htmlToMarkdown(pMatch[1], pageUrl).trim();
            if (text && text.length > 50) return text;
        }

        return null;
    }

    private extractParagraphs(html: string, pageUrl: string, max: number): string | null {
        const paragraphs: string[] = [];
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let pMatch;
        while ((pMatch = pRegex.exec(html)) !== null && paragraphs.length < max) {
            const text = this.htmlToMarkdown(pMatch[1], pageUrl).trim();
            if (text && text.length > 20) paragraphs.push(text);
        }
        return paragraphs.length > 0 ? paragraphs.join('\n\n') : null;
    }

    private splitMarkdownBlocks(markdown: string): string[] {
        const blocks: string[] = [];
        const lines = markdown.split('\n');
        const current: string[] = [];
        let inFence = false;

        const flush = () => {
            const block = current.join('\n').trim();
            if (block) blocks.push(block);
            current.length = 0;
        };

        for (const [lineIndex, line] of lines.entries()) {
            if (/^```/.test(line.trim())) {
                if (!inFence && !this.hasFenceAhead(lines, lineIndex + 1)) {
                    continue;
                }
                if (!inFence && current.length > 0) {
                    flush();
                }
                current.push(line);
                inFence = !inFence;
                if (!inFence) {
                    flush();
                }
                continue;
            }

            if (inFence) {
                current.push(line);
                continue;
            }

            if (!line.trim()) {
                flush();
                continue;
            }

            current.push(line);
        }

        flush();
        return blocks;
    }

    private hasFenceAhead(lines: string[], startIndex: number): boolean {
        for (let index = startIndex; index < lines.length; index++) {
            if (/^```/.test(lines[index].trim())) {
                return true;
            }
        }
        return false;
    }

    private extractSeeAlsoItems(block: string): string[] | undefined {
        const trimmed = block.trim();
        const match = /^See also\s+([\s\S]+)$/i.exec(trimmed);
        if (!match) return undefined;

        const raw = match[1].trim();
        if (!raw) return undefined;

        const links = [...raw.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)].map(([, text, href]) => `[${text}](${href})`);
        if (links.length > 0) {
            return links;
        }

        return raw
            .split(/,|\s+or\s+/i)
            .map(item => item.trim())
            .filter(Boolean);
    }

    private isDoctestTranscriptBlock(block: string): boolean {
        const lines = block
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        if (lines.length === 0) return false;

        const promptLines = lines.filter(line => /^>>>\s/.test(line) || /^\.\.\.\s/.test(line)).length;
        if (promptLines === 0) return false;

        return promptLines >= 1;
    }

    private stripExampleLeadIn(text: string, nextBlock?: string): string {
        if (!nextBlock) return text;
        if (!/(?:For example|Examples?)\s*:\s*$/i.test(text)) return text;
        if (!this.isDoctestTranscriptBlock(nextBlock) && !this.parseFencedCodeBlock(nextBlock)) {
            return text;
        }

        return text.replace(/\s*(?:For example|Examples?)\s*:\s*$/i, '').trim();
    }

    deriveSeeAlsoFromMarkdown(markdown: string): string[] {
        const blocks = this.splitMarkdownBlocks(markdown);
        const items = blocks
            .map(block => this.extractSeeAlsoItems(block) ?? [])
            .flat();
        return [...new Set(items)];
    }

    private parseFencedCodeBlock(block: string): { language: string; code: string } | null {
        const match = /^```([A-Za-z0-9_-]*)\n([\s\S]*?)\n```$/.exec(block.trim());
        if (!match) return null;
        return {
            language: match[1] || '',
            code: match[2],
        };
    }

    private extractSignatureFromCodeBlock(code: string): string | undefined {
        const lines = code
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);
        if (lines.length !== 1) return undefined;

        const candidate = lines[0];
        if (candidate.includes('#')) return undefined;
        return this.isSignatureLikeParagraph(candidate) ? candidate : undefined;
    }

    private isSignatureLikeParagraph(text: string): boolean {
        const normalized = text.replace(/[`*_]/g, '').trim();
        if (!normalized) return false;

        return /^(?:class|async\s+def|def)\s+[A-Za-z_][\w.]*\s*\(.*\)\s*(?:->\s*.+)?$/i.test(normalized)
            || /^[A-Za-z_][\w.]*\s*\(.*\)\s*(?:->\s*.+)?$/.test(normalized);
    }

    private isNoteLikeParagraph(text: string): boolean {
        return /^(?:Note|Warning|Caution|Important|Tip):\s+/i.test(text)
            || /^(?:New|Changed|Added) in version\s+/i.test(text)
            || /^Deprecated since\s+/i.test(text);
    }

    /** Insert into htmlCache, evicting the oldest entry when the cap is reached. */
    private setHtmlCache(url: string, html: string): void {
        if (this.htmlCache.size >= SphinxScraper.HTML_CACHE_MAX) {
            const oldest = this.htmlCache.keys().next().value;
            if (oldest !== undefined) this.htmlCache.delete(oldest);
        }
        this.htmlCache.set(url, html);
    }

    private fetchHtml(url: string): Promise<string> {
        const httpsUrl = this.normalizeToHttps(url);
        return new Promise((resolve, reject) => {
            const req = https.get(httpsUrl, { timeout: this.timeout, headers: DOCS_REQUEST_HEADERS }, (res) => {
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = this.normalizeToHttps(new URL(res.headers.location, httpsUrl).toString());
                    this.fetchHtml(redirectUrl).then(resolve).catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    reject(new Error(`Status code ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
            req.on('error', reject);
        });
    }

    private extractSection(html: string, id: string, pageUrl: string): string | null {
        // Find the element with the target id
        const idRegex = new RegExp(`id=["']${escapeRegExp(id)}["']`, 'i');
        const match = idRegex.exec(html);
        if (!match) return null;

        // Find start of the tag containing the id
        let tagStart = -1;
        let cursor = match.index;
        while (cursor >= 0) {
            const openBracket = html.lastIndexOf('<', cursor);
            if (openBracket === -1) break;
            if (html[openBracket + 1] === '/') { cursor = openBracket - 1; continue; }
            const closeBracket = html.indexOf('>', openBracket);
            if (closeBracket !== -1 && closeBracket < match.index) { cursor = openBracket - 1; continue; }
            tagStart = openBracket;
            break;
        }
        if (tagStart === -1) return null;

        const tagMatch = html.substring(tagStart).match(/^<(\w+)/);
        const tagName = tagMatch ? tagMatch[1].toLowerCase() : 'span';

        let content = '';

        if (tagName === 'dt') {
            // Sphinx definitions can have multiple consecutive <dt> signatures before
            // a shared <dd> body (for example, range(stop) and range(start, stop, step)).
            // Capture the signature block plus the shared body so summary extraction can
            // skip the signatures and use the first real paragraph.
            const rest = html.substring(tagStart);
            const dtBlock = this.extractDefinitionListEntry(rest);

            if (dtBlock) {
                content = dtBlock;
            } else {
                // Malformed HTML — capture a safe chunk
                content = rest.substring(0, 3000);
            }
        } else if (tagName === 'section') {
            const rest = html.substring(tagStart);
            const endSection = rest.indexOf('</section>');
            content = endSection !== -1 ? rest.substring(0, endSection) : rest.substring(0, 5000);
        } else {
            const rest = html.substring(tagStart);
            const closeTag = rest.indexOf('>');
            const body = rest.substring(closeTag + 1);
            const nextHeader = body.search(/<h[1-6]/i);
            content = nextHeader !== -1 ? body.substring(0, nextHeader) : body.substring(0, 2000);
        }

        const md = this.normalizeExtractedMarkdown(this.htmlToMarkdown(content, pageUrl));
        // Trim to a reasonable hover length
        if (md.length > 1500) {
            const cut = md.lastIndexOf('\n\n', 1500);
            return (cut > 800 ? md.substring(0, cut) : md.substring(0, 1500)) + '\n\n…';
        }
        return md || null;
    }

    private extractDefinitionListEntry(html: string): string | null {
        let offset = 0;
        const signatureBlocks: string[] = [];

        while (offset < html.length) {
            offset = this.skipWhitespace(html, offset);
            if (!html.substring(offset).toLowerCase().startsWith('<dt')) {
                break;
            }

            const dtEnd = this.findBalancedClose(html, offset, 'dt');
            if (dtEnd === -1) {
                break;
            }

            const closeEnd = dtEnd + '</dt>'.length;
            signatureBlocks.push(html.substring(offset, closeEnd));
            offset = closeEnd;
        }

        if (signatureBlocks.length === 0) {
            return null;
        }

        const ddStart = this.skipWhitespace(html, offset);
        if (!html.substring(ddStart).toLowerCase().startsWith('<dd')) {
            return signatureBlocks.join('');
        }

        const ddOpenEnd = html.indexOf('>', ddStart);
        if (ddOpenEnd === -1) {
            return signatureBlocks.join('');
        }

        const ddEnd = this.findBalancedClose(html, ddStart, 'dd');
        const ddBody = ddEnd !== -1
            ? html.substring(ddOpenEnd + 1, ddEnd)
            : html.substring(ddOpenEnd + 1, ddOpenEnd + 4001);

        return `${signatureBlocks.join('')}\n${ddBody}`;
    }

    private skipWhitespace(text: string, index: number): number {
        let cursor = index;
        while (cursor < text.length && /\s/.test(text[cursor])) {
            cursor++;
        }
        return cursor;
    }

    private normalizeExtractedMarkdown(markdown: string): string {
        if (!markdown) return markdown;

        let cleaned = markdown.trim();
        cleaned = cleaned.replace(/^`{1,3}\s*[A-Za-z_][\w.]*\s*`{0,3}\s*\n\n(?=```)/, '');
        cleaned = cleaned.replace(/^``\s+[A-Za-z_][\w.]*\s*\n\n(?=```)/, '');
        cleaned = cleaned.replace(/^`{1,3}\s*[A-Za-z_][\w.]*\s*`{0,3}\s*$/m, match => match.trim().length <= 32 ? '' : match);
        cleaned = cleaned.replace(/^\s*\n+/, '');
        return this.stripOrphanFenceLines(cleaned.trim());
    }

    private stripOrphanFenceLines(markdown: string): string {
        const lines = markdown.split('\n');
        const fenceCount = lines.filter(line => /^```/.test(line.trim())).length;
        if (fenceCount === 0 || fenceCount % 2 === 0) {
            return markdown;
        }

        const cleaned: string[] = [];
        let inFence = false;

        for (let index = 0; index < lines.length; index++) {
            const line = lines[index];
            const trimmed = line.trim();
            if (!/^```/.test(trimmed)) {
                cleaned.push(line);
                continue;
            }

            if (inFence) {
                cleaned.push(line);
                inFence = false;
                continue;
            }

            if (/^```\s*$/.test(trimmed)) {
                const nextMeaningful = this.nextMeaningfulLine(lines, index + 1);
                if (!nextMeaningful || !this.looksLikeFenceContent(nextMeaningful)) {
                    continue;
                }
            }

            cleaned.push(line);
            inFence = true;
        }

        return cleaned.join('\n');
    }

    private nextMeaningfulLine(lines: string[], startIndex: number): string | undefined {
        for (let index = startIndex; index < lines.length; index++) {
            const trimmed = lines[index].trim();
            if (trimmed) {
                return trimmed;
            }
        }
        return undefined;
    }

    private looksLikeFenceContent(line: string): boolean {
        if (!line) return false;
        if (line.startsWith('```')) return true;
        if (this.isSignatureLikeParagraph(line)) return true;
        if (this.isGrammarLikeParagraph(line)) return true;
        if (line.includes('::=')) return true;
        if (/^[A-Za-z_][\w]*\s*:\s*["'[(]/.test(line)) return true;
        if (/^(?:>>>|\.\.\.|class\s|def\s|async\s+def\s|for\s|if\s|elif\s|while\s|with\s|try:|except\b|finally:|return\s|raise\s|yield\s|import\s|from\s)/.test(line)) {
            return true;
        }
        if (/^[A-Za-z_]\w*(?:\.\w+)*\s*=\s*[^=]/.test(line)) return true;
        return false;
    }

    private isGrammarLikeParagraph(text: string): boolean {
        const normalized = text.replace(/[*`]/g, '').trim();
        if (!normalized) return false;

        return normalized.includes('::=')
            || /^[A-Za-z_][\w]*(?:_[A-Za-z_][\w]*)?\s*:\s*["'[(]/.test(normalized);
    }

    private normalizeGrammarParagraph(text: string): string {
        return text.replace(/[*`]/g, '').trim();
    }

    /**
     * Find the end index of a balanced HTML tag (e.g. <dd>...</dd>).
     * @param html    HTML string to search
     * @param start   Index of the opening tag (the '<')
     * @param tagName Tag name to balance (lowercase, no angle brackets)
     * @returns Index of the character AFTER the closing tag, or -1 if not found.
     */
    private findBalancedClose(html: string, start: number, tagName: string): number {
        const lc = tagName.toLowerCase();
        const openPrefix = `<${lc}`;
        const closeTag = `</${lc}>`;

        // Skip past the opening tag
        const openEnd = html.indexOf('>', start);
        if (openEnd === -1) return -1;

        let depth = 1;
        let i = openEnd + 1;

        while (i < html.length && depth > 0) {
            if (html[i] !== '<') { i++; continue; }

            const sub = html.substring(i);

            // Closing tag?
            if (sub.startsWith(closeTag)) {
                depth--;
                if (depth === 0) return i; // return start of closing tag so caller can exclude it
                i += closeTag.length;
                continue;
            }

            // Opening tag (same name)?
            if (sub.toLowerCase().startsWith(openPrefix)) {
                const afterName = sub[openPrefix.length];
                if (afterName === '>' || afterName === ' ' || afterName === '\n' || afterName === '\t' || afterName === '/') {
                    depth++;
                    const nextClose = sub.indexOf('>');
                    i += nextClose !== -1 ? nextClose + 1 : openPrefix.length;
                    continue;
                }
            }

            i++;
        }
        return -1;
    }

    private htmlToMarkdown(html: string, pageUrl: string): string {
        let md = html;

        // Remove scripts, styles, and SVG
        md = md.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gim, '');
        md = md.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gim, '');
        md = md.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gim, '');

        // Remove Sphinx permalink anchors (¶)
        md = md.replace(/<a[^>]+class="headerlink"[^>]*>[\s\S]*?<\/a>/gim, '');
        md = md.replace(/¶/g, '');

        // Headers → bold (hovers don't need heading hierarchy)
        md = md.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gim, (_, inner) => {
            const text = inner.replace(/<[^>]+>/g, '').trim();
            return text ? `\n**${text}**\n` : '';
        });

        // Strip Sphinx signature-specific emphasis BEFORE general <em> processing.
        // <em class="property"> wraps keywords (class, def, async), and <em class="sig-param">
        // wraps parameters. Converting these to *..* then bold-wrapping the <dt> produces
        // "***class *Name(*arg*)**" — strip to plain text instead.
        md = md.replace(/<em[^>]+class="[^"]*(?:property|sig-param)[^"]*"[^>]*>([\s\S]*?)<\/em>/gim,
            (_, inner) => inner.replace(/<[^>]+>/g, ''));

        // Inline formatting BEFORE stripping tags
        md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gim, '**$1**');
        md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gim, '**$1**');
        md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gim, '*$1*');
        md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gim, '*$1*');

        // Code blocks — strip inner tags first then wrap
        md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gim, (_, inner) => {
            const code = inner.replace(/<[^>]+>/g, '').trim();
            return `\n\`\`\`python\n${code}\n\`\`\`\n`;
        });
        md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gim, '`$1`');
        md = md.replace(/<tt[^>]*>([\s\S]*?)<\/tt>/gim, '`$1`');

        // Paragraphs
        md = md.replace(/<p[^>]*>/gim, '');
        md = md.replace(/<\/p>/gim, '\n\n');

        // Links — make absolute
        md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gim, (_, href, text) => {
            const cleanText = text.replace(/<[^>]+>/g, '').trim();
            if (!cleanText) return '';
            try {
                const abs = new URL(href, pageUrl).toString();
                return `[${cleanText}](${abs})`;
            } catch {
                return `[${cleanText}](${href})`;
            }
        });

        // Ordered lists (numbered)
        md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gim, (_, inner) => {
            let n = 0;
            return '\n' + inner
                .replace(/<li[^>]*>/gim, () => `${++n}. `)
                .replace(/<\/li>/gim, '\n') + '\n';
        });

        // Unordered lists
        md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gim, (_, inner) => {
            return '\n' + inner
                .replace(/<li[^>]*>/gim, '- ')
                .replace(/<\/li>/gim, '\n') + '\n';
        });

        // Definition lists — keep dt content as bold labels (parameter names etc.)
        // Sphinx sig-object <dt> blocks are Python signatures — don't bold-wrap them,
        // as their content is already plain text after the property/sig-param em stripping above.
        md = md.replace(/<dt[^>]*class="[^"]*\bsig\b[^"]*"[^>]*>([\s\S]*?)<\/dt>/gim, (_, inner) => {
            const text = inner.replace(/<[^>]+>/g, '').trim();
            return text ? `\n${text}\n` : '';
        });
        md = md.replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gim, (_, inner) => {
            const text = inner.replace(/<[^>]+>/g, '').trim();
            if (!text || text === ':') return '';
            return `\n**${text}**\n`;
        });
        md = md.replace(/<dd[^>]*>/gim, '');
        md = md.replace(/<\/dd>/gim, '\n');
        md = md.replace(/<dl[^>]*>/gim, '\n');
        md = md.replace(/<\/dl>/gim, '\n');

        // Blockquotes
        md = md.replace(/<blockquote[^>]*>/gim, '\n> ');
        md = md.replace(/<\/blockquote>/gim, '\n');

        // Divs / spans — just strip the tags
        md = md.replace(/<\/?(?:div|span|section|article|aside|nav|header|footer|main)[^>]*>/gim, '');

        // Strip remaining tags
        md = md.replace(/<[^>]+>/gim, '');

        // Decode HTML entities
        md = md.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
        md = md.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        md = md
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/&rarr;/g, '→')
            .replace(/&larr;/g, '←')
            .replace(/&hellip;/g, '…');

        // Normalize whitespace
        md = md.replace(/[ \t]+/g, ' ');
        md = md.replace(/\n[ \t]+/g, '\n');
        md = md.replace(/[ \t]+\n/g, '\n');
        md = md.replace(/\n{3,}/g, '\n\n');

        return md.trim();
    }
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

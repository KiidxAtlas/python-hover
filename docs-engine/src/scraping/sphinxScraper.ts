import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DiskCache } from '../cache/diskCache';

export class SphinxScraper {
    private diskCache: DiskCache;
    private timeout: number;
    /** In-memory HTML cache: avoids re-fetching the same page for content + seeAlso in one session.
     *  Capped at 30 pages (raw HTML is large) — oldest entry evicted when full. */
    private htmlCache = new Map<string, string>();
    private static readonly HTML_CACHE_MAX = 30;

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

    getCachedContent(packageName: string, url: string): string | null {
        return this.diskCache.getCorpusEntry(packageName, this.normalizeToHttps(url))?.content ?? null;
    }

    getCachedSeeAlso(packageName: string, url: string): string[] | null {
        return this.diskCache.getCorpusEntry(packageName, this.normalizeToHttps(url))?.seeAlso ?? null;
    }

    async fetchSeeAlso(packageName: string, url: string): Promise<string[]> {
        try {
            const normalizedUrl = this.normalizeToHttps(url);
            const cached = this.getCachedSeeAlso(packageName, normalizedUrl);
            if (cached) return cached;

            const [baseUrl, anchor] = normalizedUrl.split('#');
            const cachedHtml = this.htmlCache.get(baseUrl);
            const html = cachedHtml ?? await this.fetchHtml(baseUrl).then(h => { this.setHtmlCache(baseUrl, h); return h; });
            if (!anchor || !html) return [];

            const extracted = this.extractSeeAlso(html, anchor, baseUrl);
            this.diskCache.setCorpusEntry(packageName, normalizedUrl, { seeAlso: extracted });
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

    async fetchContent(packageName: string, url: string): Promise<string | null> {
        try {
            const normalizedUrl = this.normalizeToHttps(url);
            const cached = this.getCachedContent(packageName, normalizedUrl);
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
                this.diskCache.setCorpusEntry(packageName, normalizedUrl, { content: extracted });
            }

            return extracted;
        } catch (e) {
            Logger.error(`SphinxScraper failed for ${url}:`, e);
            return null;
        }
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
            const req = https.get(httpsUrl, { timeout: this.timeout }, (res) => {
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
            // Sphinx function/class anchor: capture the <dd> that follows the <dt>
            const rest = html.substring(tagStart);
            const dtCloseIdx = rest.indexOf('</dt>');

            if (dtCloseIdx !== -1) {
                const afterDt = rest.substring(dtCloseIdx + 5);
                // Find the immediately following <dd>
                const ddOpenMatch = afterDt.match(/^(\s*)<dd([^>]*)>/i);
                if (ddOpenMatch) {
                    const ddTagLen = ddOpenMatch[0].length;
                    const ddBodyStart = ddTagLen;
                    const ddEnd = this.findBalancedClose(afterDt, 0, 'dd');
                    if (ddEnd !== -1) {
                        content = afterDt.substring(ddBodyStart, ddEnd);
                    } else {
                        content = afterDt.substring(ddBodyStart, ddBodyStart + 4000);
                    }
                } else {
                    // No <dd> — fall back to capturing until next sibling dt or </dl>
                    const nextDt = rest.indexOf('<dt', 1);
                    const endDl = rest.indexOf('</dl>');
                    let end = rest.length;
                    if (nextDt !== -1) end = Math.min(end, nextDt);
                    if (endDl !== -1) end = Math.min(end, endDl);
                    content = rest.substring(0, end);
                }
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

        const md = this.htmlToMarkdown(content, pageUrl);
        // Trim to a reasonable hover length
        if (md.length > 1500) {
            const cut = md.lastIndexOf('\n\n', 1500);
            return (cut > 800 ? md.substring(0, cut) : md.substring(0, 1500)) + '\n\n…';
        }
        return md || null;
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
        // Strip the top-level Sphinx field-list dt text (like "Parameters:", "Returns:") as bold section headers.
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

import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DiskCache } from '../cache/diskCache';

export class SphinxScraper {
    private diskCache: DiskCache;

    constructor(diskCache: DiskCache) {
        this.diskCache = diskCache;
    }

    async fetchContent(url: string): Promise<string | null> {
        try {
            const [baseUrl, anchor] = url.split('#');
            if (!anchor) return null;

            // Check cache for the HTML page
            const cachedHtml = this.diskCache.get(baseUrl);
            let html = cachedHtml;

            if (!html) {
                html = await this.fetchHtml(baseUrl);
                this.diskCache.set(baseUrl, html);
            }

            return this.extractSection(html!, anchor, baseUrl);
        } catch (e) {
            Logger.error(`SphinxScraper failed for ${url}:`, e);
            return null;
        }
    }

    private fetchHtml(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { timeout: 5000 }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status code ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.on('error', reject);
        });
    }

    private extractSection(html: string, id: string, pageUrl: string): string | null {
        // 1. Find the start anchor
        // Sphinx uses id="anchor" on dt, section, span, div, etc.
        const idRegex = new RegExp(`id=["']${escapeRegExp(id)}["']`, 'i');
        const match = idRegex.exec(html);
        if (!match) return null;

        // Find the start of the tag containing the ID
        // Search backwards for '<' that is not part of a closing tag '</'
        let tagStart = -1;
        let cursor = match.index;
        while (cursor >= 0) {
            const openBracket = html.lastIndexOf('<', cursor);
            if (openBracket === -1) break;

            // Check if it's a closing tag
            if (html[openBracket + 1] === '/') {
                cursor = openBracket - 1;
                continue;
            }

            // Check if the tag closes before our ID (meaning the ID is not in this tag)
            const closeBracket = html.indexOf('>', openBracket);
            if (closeBracket !== -1 && closeBracket < match.index) {
                // The tag closed before our ID attribute.
                // This implies the ID is in text content? Unlikely for valid HTML.
                // Or we skipped the real tag.
                // However, for robust parsing, if we find a '>' between '<' and 'id=',
                // then that '<' is NOT the start of the tag containing 'id='.
                cursor = openBracket - 1;
                continue;
            }

            tagStart = openBracket;
            break;
        }

        if (tagStart === -1) return null;
        const startIndex = tagStart;

        // 2. Find the end of the section
        // Let's try to identify the tag
        const tagMatch = html.substring(startIndex).match(/^<(\w+)/);
        const tagName = tagMatch ? tagMatch[1] : 'span';

        let content = '';

        if (tagName === 'dt') {
            // Definition list item. Includes <dd> following it.
            // Find next <dt> or </dl>
            const rest = html.substring(startIndex);
            const nextDt = rest.indexOf('<dt', 1); // Skip current
            const endDl = rest.indexOf('</dl>');

            let end = rest.length;
            if (nextDt !== -1) end = Math.min(end, nextDt);
            if (endDl !== -1) end = Math.min(end, endDl);

            content = rest.substring(0, end);
        } else if (tagName === 'section') {
            // Read until </section>
            const rest = html.substring(startIndex);
            const endSection = rest.indexOf('</section>');
            if (endSection !== -1) {
                content = rest.substring(0, endSection);
            }
        } else {
            // Fallback: Read until next header (h1-h6) or substantial divider
            const rest = html.substring(startIndex);
            // Skip the tag itself
            const closeTag = rest.indexOf('>');
            const body = rest.substring(closeTag + 1);

            // Find next header
            const nextHeader = body.search(/<h[1-6]/i);
            if (nextHeader !== -1) {
                content = body.substring(0, nextHeader);
            } else {
                content = body.substring(0, 2000); // Cap at 2000 chars
            }
        }

        return this.htmlToMarkdown(content, pageUrl);
    }

    private htmlToMarkdown(html: string, pageUrl: string): string {
        let md = html;

        // Remove scripts and styles
        md = md.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
        md = md.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");

        // Remove headerlinks (¶) and other permalinks
        md = md.replace(/<a class="headerlink"[^>]*>[\s\S]*?<\/a>/gim, '');
        md = md.replace(/¶/g, '');

        // Headers
        md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gim, '# $1\n\n');
        md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gim, '## $1\n\n');
        md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gim, '### $1\n\n');

        // Code blocks
        md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gim, '```python\n$1\n```\n\n');
        md = md.replace(/<code[^>]*>(.*?)<\/code>/gim, '`$1`');
        md = md.replace(/<tt[^>]*>(.*?)<\/tt>/gim, '`$1`');

        // Paragraphs
        md = md.replace(/<p[^>]*>/gim, '');
        md = md.replace(/<\/p>/gim, '\n\n');

        // Links
        md = md.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gim, (match, href, text) => {
            try {
                const absoluteUrl = new URL(href, pageUrl).toString();
                return `[${text}](${absoluteUrl})`;
            } catch (e) {
                return `[${text}](${href})`;
            }
        });

        // Lists
        md = md.replace(/<li[^>]*>/gim, '- ');
        md = md.replace(/<\/li>/gim, '\n');
        md = md.replace(/<ul[^>]*>/gim, '\n');
        md = md.replace(/<\/ul>/gim, '\n');

        // Definitions - Handle multiline content
        // Remove the definition term (signature) as it's usually redundant with the hover title/signature
        md = md.replace(/<dt[^>]*>([\s\S]*?)<\/dt>/gim, '');
        md = md.replace(/<dd[^>]*>/gim, '\n');
        md = md.replace(/<\/dd>/gim, '\n\n');

        // Clean up tags
        md = md.replace(/<[^>]+>/gim, '');

        // Decode entities
        md = md.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

        // Collapse whitespace
        md = md.replace(/\n\s*\n/g, '\n\n');

        return md.trim();
    }
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

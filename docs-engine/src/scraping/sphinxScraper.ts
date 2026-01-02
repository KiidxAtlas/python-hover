import * as https from 'https';
import { Logger } from '../../../extension/src/logger';
import { DiskCache } from '../cache/diskCache';

export class SphinxScraper {
    private diskCache: DiskCache;
    private timeout: number;

    constructor(diskCache: DiskCache, timeout: number = 5000) {
        this.diskCache = diskCache;
        this.timeout = timeout;
    }

    /**
     * Normalize a URL to use HTTPS protocol.
     * VS Code Remote environments require HTTPS connections.
     */
    private normalizeToHttps(url: string): string {
        if (url.startsWith('http://')) {
            return url.replace('http://', 'https://');
        }
        return url;
    }

    async fetchContent(url: string): Promise<string | null> {
        try {
            const normalizedUrl = this.normalizeToHttps(url);
            const [baseUrl, anchor] = normalizedUrl.split('#');

            // Check cache for the HTML page
            const cachedHtml = this.diskCache.get(baseUrl);
            let html = cachedHtml;

            if (!html) {
                html = await this.fetchHtml(baseUrl);
                this.diskCache.set(baseUrl, html);
            }

            // If there's an anchor, extract that specific section
            if (anchor) {
                return this.extractSection(html!, anchor, baseUrl);
            }

            // No anchor - this is likely a module page. Extract the page summary.
            return this.extractPageSummary(html!, baseUrl);
        } catch (e) {
            Logger.error(`SphinxScraper failed for ${url}:`, e);
            return null;
        }
    }

    /**
     * Extract the summary/introduction from a module documentation page.
     * This is used when there's no anchor in the URL.
     */
    private extractPageSummary(html: string, pageUrl: string): string | null {
        // Strategy 1: Look for the first paragraph after the main heading
        // Python docs structure: <section><h1>module name</h1><p>description...</p>

        // Find the main content section
        const sectionMatch = /<section[^>]*id=["']module-[^"']*["'][^>]*>([\s\S]*?)<\/section>/i.exec(html);
        if (sectionMatch) {
            const sectionContent = sectionMatch[1];
            // Extract first few paragraphs (skip the heading)
            const paragraphs: string[] = [];
            const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
            let pMatch;
            let count = 0;
            while ((pMatch = pRegex.exec(sectionContent)) !== null && count < 3) {
                const text = this.htmlToMarkdown(pMatch[1], pageUrl).trim();
                if (text && text.length > 20) { // Skip very short paragraphs
                    paragraphs.push(text);
                    count++;
                }
            }
            if (paragraphs.length > 0) {
                return paragraphs.join('\n\n');
            }
        }

        // Strategy 2: Look for any <p> after <h1>
        const h1Index = html.search(/<h1[^>]*>/i);
        if (h1Index !== -1) {
            const afterH1 = html.substring(h1Index);
            const h1End = afterH1.indexOf('</h1>');
            if (h1End !== -1) {
                const content = afterH1.substring(h1End + 5);
                // Get first 2-3 paragraphs
                const paragraphs: string[] = [];
                const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
                let pMatch;
                let count = 0;
                while ((pMatch = pRegex.exec(content)) !== null && count < 3) {
                    const text = this.htmlToMarkdown(pMatch[1], pageUrl).trim();
                    if (text && text.length > 20) {
                        paragraphs.push(text);
                        count++;
                    }
                }
                if (paragraphs.length > 0) {
                    return paragraphs.join('\n\n');
                }
            }
        }

        // Strategy 3: Just get the first substantial paragraph on the page
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let pMatch;
        while ((pMatch = pRegex.exec(html)) !== null) {
            const text = this.htmlToMarkdown(pMatch[1], pageUrl).trim();
            if (text && text.length > 50) {
                return text;
            }
        }

        return null;
    }

    private fetchHtml(url: string): Promise<string> {
        const httpsUrl = this.normalizeToHttps(url);
        return new Promise((resolve, reject) => {
            const req = https.get(httpsUrl, { timeout: this.timeout }, (res) => {                // Handle redirects
                if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = this.normalizeToHttps(new URL(res.headers.location, httpsUrl).toString());
                    this.fetchHtml(redirectUrl).then(resolve).catch(reject);
                    return;
                } if (res.statusCode !== 200) {
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

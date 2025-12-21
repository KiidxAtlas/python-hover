import * as vscode from 'vscode';
import { HoverDoc } from '../../../shared/types';
import { Config } from '../config';

export class HoverRenderer {
    constructor(private config: Config) { }

    render(doc: HoverDoc): vscode.Hover {
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.supportThemeIcons = true;
        markdown.supportHtml = true;

        // --- Header ---
        markdown.appendMarkdown(`### ${doc.title}`);

        // Quick Link
        if (doc.url && this.config.showQuickActions) {
            markdown.appendMarkdown(` &nbsp; [$(link-external)](${doc.url} "Open Documentation")`);
        }
        markdown.appendMarkdown('\n');

        // Meta Info (Kind • Badges)
        const metaParts: string[] = [];
        if (doc.kind) {
            metaParts.push(`**${doc.kind}**`);
        }

        if (doc.badges && doc.badges.length > 0 && this.config.showColors) {
            doc.badges.forEach(b => {
                let icon = 'tag';
                if (this.config.showEmojis) {
                    switch (b.color) {
                        case 'red': icon = 'error'; break;
                        case 'orange': icon = 'warning'; break;
                        case 'yellow': icon = 'issue-opened'; break;
                        case 'blue': icon = 'verified'; break;
                        case 'purple': icon = 'zap'; break;
                        default: icon = 'tag'; break;
                    }
                }
                metaParts.push(`$(${icon}) ${b.label}`);
            });
        }

        if (metaParts.length > 0) {
            markdown.appendMarkdown(metaParts.join(' &nbsp;•&nbsp; '));
        }

        markdown.appendMarkdown('\n\n---\n\n');

        // --- Signature ---
        if (doc.signature && this.config.showSignatures) {
            // If we have explicit overloads, render them smartly
            if (doc.overloads && doc.overloads.length > 1) {
                // Show first overload
                markdown.appendCodeblock(doc.overloads[0], 'python');

                // Show remaining in a collapsed section
                const remaining = doc.overloads.length - 1;
                const remainingText = doc.overloads.slice(1).join('\n');

                // Note: VS Code MarkdownString doesn't support <details> well in all contexts,
                // but it is supported in Hovers.
                markdown.appendMarkdown(`<details><summary>Show ${remaining} more overloads</summary>\n\n`);
                markdown.appendCodeblock(remainingText, 'python');
                markdown.appendMarkdown('</details>\n\n');
            } else {
                let sig = doc.signature;
                // Prepend name if signature is just arguments (e.g. "(x, y)")
                if (sig.startsWith('(')) {
                    sig = `${doc.title}${sig}`;
                }
                markdown.appendCodeblock(sig, 'python');
                markdown.appendMarkdown('\n');
            }
        }

        // --- Protocol Hints ---
        if (doc.protocolHints && doc.protocolHints.length > 0) {
            doc.protocolHints.forEach(hint => {
                markdown.appendMarkdown(`$(info) ${hint}\n\n`);
            });
        }

        // --- Content ---
        let content = doc.summary || doc.content;
        if (content) {
            // Highlight specific notes and add icons
            content = content.replace(/CPython implementation detail:/g, '$(alert) **CPython implementation detail:**');
            content = content.replace(/(Note:|Warning:|Changed in version)/g, '**$1**');

            // Apply blockquote to all lines to ensure uniform styling
            // Split by newline, prefix each line with >
            content = content.split('\n').map(line => `> ${line}`).join('\n');

            markdown.appendMarkdown(`${content}\n\n`);
        }

        // --- Parameters ---
        if (doc.parameters && doc.parameters.length > 0 && this.config.showParameterTables) {
            markdown.appendMarkdown('**Parameters**\n\n');
            markdown.appendMarkdown('| Name | Type | Default | Description |\n');
            markdown.appendMarkdown('| :--- | :--- | :--- | :--- |\n');

            doc.parameters.slice(0, 10).forEach(p => {
                const name = `\`${p.name}\``;
                const type = p.type ? `\`${p.type}\`` : '';
                const def = p.default ? `\`${p.default}\`` : '';
                const desc = (p.description || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
                markdown.appendMarkdown(`| ${name} | ${type} | ${def} | ${desc} |\n`);
            });

            if (doc.parameters.length > 10) {
                markdown.appendMarkdown(`\n*...and ${doc.parameters.length - 10} more*\n`);
            }
            markdown.appendMarkdown('\n');
        } else if (doc.parameters && doc.parameters.length > 0) {
            doc.parameters.slice(0, 5).forEach(p => {
                const typeStr = p.type ? ` : \`${p.type}\`` : '';
                const defStr = p.default ? ` = ${p.default}` : '';
                markdown.appendMarkdown(`- \`${p.name}\`${typeStr}${defStr}`);
                if (p.description) {
                    markdown.appendMarkdown(` — ${p.description}`);
                }
                markdown.appendMarkdown('\n');
            });
            markdown.appendMarkdown('\n');
        }

        // --- Returns ---
        if (doc.returns && this.config.showReturnTypes) {
            markdown.appendMarkdown('**Returns**\n\n');
            if (doc.returns.type) {
                markdown.appendMarkdown(`\`${doc.returns.type}\``);
            }
            if (doc.returns.description) {
                markdown.appendMarkdown(` — ${doc.returns.description}`);
            }
            markdown.appendMarkdown('\n\n');
        }

        // --- Examples ---
        if (doc.examples && doc.examples.length > 0 && this.config.showPracticalExamples) {
            markdown.appendMarkdown('**Examples**\n\n');
            let example = doc.examples[0];
            const lines = example.split('\n');
            if (lines.length > this.config.maxSnippetLines) {
                example = lines.slice(0, this.config.maxSnippetLines).join('\n') + '\n# ...';
            }
            markdown.appendCodeblock(example, 'python');
            markdown.appendMarkdown('\n');
        }

        // --- Footer ---
        if (this.config.showBorders) {
            markdown.appendMarkdown('---\n');
        }

        const links: string[] = [];
        if (doc.links) {
            Object.entries(doc.links).forEach(([label, url]) => {
                let icon = 'link';
                const lowerLabel = label.toLowerCase();
                if (lowerLabel.includes('github') || lowerLabel.includes('repo')) icon = 'github';
                else if (lowerLabel.includes('documentation') || lowerLabel.includes('docs')) icon = 'book';
                else if (lowerLabel.includes('homepage') || lowerLabel.includes('home')) icon = 'home';
                else if (lowerLabel.includes('pypi')) icon = 'package';
                else if (lowerLabel.includes('issue') || lowerLabel.includes('bug')) icon = 'bug';
                else if (lowerLabel.includes('changelog') || lowerLabel.includes('changes')) icon = 'history';
                else if (lowerLabel.includes('devdocs')) icon = 'globe';

                links.push(`[$(${icon}) ${label}](${this.sanitizeUrl(url)})`);
            });
        } else {
            if (doc.url) links.push(`[$(book) Documentation](${this.sanitizeUrl(doc.url)})`);
            if (doc.sourceUrl) links.push(`[$(file-code) Source](${this.sanitizeUrl(doc.sourceUrl)})`);
        }

        if (links.length > 0) {
            markdown.appendMarkdown(links.join(' &nbsp;&nbsp; '));
        }

        return new vscode.Hover(markdown);
    }

    private sanitizeUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('command:')) return url;

        // Check for Windows path (e.g. C:\...)
        if (/^[a-zA-Z]:\\/.test(url)) {
            return vscode.Uri.file(url).toString();
        }

        // Check for Unix path (e.g. /home/...)
        if (url.startsWith('/')) {
            return vscode.Uri.file(url).toString();
        }

        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            return `https://${url}`;
        }
        return url;
    }
}

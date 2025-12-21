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
        markdown.appendMarkdown(`# ${doc.title}\n\n`);

        // Kind + Icon
        const kind = doc.kind ? `py:${doc.kind.toLowerCase()}` : 'py:function';
        markdown.appendMarkdown(`$(${this.getIconForKind(doc.kind)}) ${kind}\n\n`);

        // Links
        const links: string[] = [];
        if (doc.url) {
            const isDevDocs = doc.url.includes('devdocs.io');
            const label = isDevDocs ? 'DevDocs' : 'Docs';
            links.push(`[$(book) ${label}](${this.sanitizeUrl(doc.url)})`);
        }

        if (doc.title && (!doc.url || !doc.url.includes('devdocs.io'))) {
            const devDocsUrl = `https://devdocs.io/#q=python%20${encodeURIComponent(doc.title)}`;
            links.push(`[$(search) DevDocs](${this.sanitizeUrl(devDocsUrl)})`);
        }

        if (doc.url) {
            const encodedUrl = encodeURIComponent(doc.url);
            links.push(`[$(link) Copy URL](command:python-hover.copyUrl?${JSON.stringify(encodedUrl)})`);
        }

        if (links.length > 0) {
            markdown.appendMarkdown(links.join(' &nbsp;•&nbsp; '));
            markdown.appendMarkdown('\n\n');
        }

        // --- Signature ---
        if (doc.signature && this.config.showSignatures) {
            markdown.appendMarkdown(`</> **Signature**\n`);

            // If we have explicit overloads, render them smartly
            if (doc.overloads && doc.overloads.length > 1) {
                // Show first overload
                markdown.appendCodeblock(doc.overloads[0], 'python');

                // Show remaining in a collapsed section
                const remaining = doc.overloads.length - 1;
                const remainingText = doc.overloads.slice(1).join('\n');

                markdown.appendMarkdown(`<details><summary>Show ${remaining} more overloads</summary>\n\n`);
                markdown.appendCodeblock(remainingText, 'python');
                markdown.appendMarkdown('</details>\n\n');
            } else {
                let shortSig = doc.signature;
                if (shortSig.startsWith('(')) {
                    const shortName = doc.title.split('.').pop() || doc.title;
                    shortSig = `${shortName}${doc.signature}`;
                }

                let fullSig = doc.signature;
                if (fullSig.startsWith('(')) {
                    fullSig = `${doc.title}${doc.signature}`;
                }

                let sigBlock = shortSig;
                if (shortSig !== fullSig) {
                    sigBlock = `${shortSig}\n${fullSig}`;
                }

                markdown.appendCodeblock(sigBlock, 'python');
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
            content = content.replace(/CPython implementation detail:/g, '$(alert) **CPython implementation detail:**');
            content = content.replace(/(Note:|Warning:|Changed in version)/g, '**$1**');
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
        markdown.appendMarkdown('---\n');
        markdown.appendMarkdown(`$(keyboard) **F12**: Go to definition | **Ctrl+Space**: IntelliSense\n\n`);

        const version = this.config.docsVersion === 'auto' ? '3.12' : this.config.docsVersion;
        markdown.appendMarkdown(`Python ${version}`);

        return new vscode.Hover(markdown);
    }

    private getIconForKind(kind?: string): string {
        if (!kind) return 'symbol-function';
        switch (kind.toLowerCase()) {
            case 'class': return 'symbol-class';
            case 'module': return 'symbol-module';
            case 'method': return 'symbol-method';
            case 'property': return 'symbol-property';
            case 'field': return 'symbol-field';
            case 'variable': return 'symbol-variable';
            default: return 'symbol-function';
        }
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

import * as vscode from 'vscode';
import { HoverDoc, ResolutionSource } from '../../../shared/types';
import { Config } from '../config';

export class HoverRenderer {
    private detectedVersion: string | undefined;

    constructor(private config: Config) { }

    setDetectedVersion(version: string) {
        this.detectedVersion = version;
    }

    render(doc: HoverDoc): vscode.Hover {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportThemeIcons = true;
        md.supportHtml = true;

        this.renderHeader(md, doc);
        this.renderToolbar(md, doc);

        if (doc.signature && this.config.showSignatures) {
            this.renderSignature(md, doc);
        }

        this.renderCallouts(md, doc);
        this.renderDescription(md, doc);

        if (doc.parameters && doc.parameters.length > 0) {
            this.renderParameters(md, doc);
        }

        if (doc.returns && this.config.showReturnTypes) {
            this.renderReturns(md, doc);
        }

        if (doc.raises && doc.raises.length > 0) {
            this.renderRaises(md, doc);
        }

        if (doc.examples && doc.examples.length > 0 && this.config.showPracticalExamples) {
            this.renderExamples(md, doc);
        }

        if (doc.moduleExports && doc.moduleExports.length > 0) {
            this.renderModuleExports(md, doc);
        }

        if (doc.seeAlso && doc.seeAlso.length > 0) {
            this.renderSeeAlso(md, doc);
        }

        this.renderFooter(md, doc);
        return new vscode.Hover(md);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HEADER  — title + compact badge row
    // ─────────────────────────────────────────────────────────────────────────

    private renderHeader(md: vscode.MarkdownString, doc: HoverDoc): void {
        const icon = this.getIconForKind(doc.kind);
        const rawTitle = doc.title.replace(/^builtins\./, '');
        const displayTitle = rawTitle.replace(/__/g, '\\_\\_');

        md.appendMarkdown(`### $(${icon}) ${displayTitle}\n\n`);

        // ── Compact badge row ─────────────────────────────────────────────────
        const chips: string[] = [];

        const kindLabel = this.formatKindLabel(doc.kind);
        chips.push(`\`${kindLabel}\``);

        // Source chip — only show when it adds real value to the user
        if (doc.source === ResolutionSource.Local) {
            chips.push(`$(home) local`);
        } else if (doc.source === ResolutionSource.Sphinx && doc.url) {
            // Show the docs hostname (e.g. numpy.org, pandas.pydata.org)
            try {
                const host = new URL(doc.url).hostname.replace(/^www\./, '');
                if (host && !host.includes('docs.python.org')) {
                    chips.push(`$(book) ${host}`);
                }
            } catch { /* skip */ }
        }

        // Meaningful attribute badges only
        if (doc.badges) {
            for (const badge of doc.badges) {
                chips.push(`$(${this.getBadgeIcon(badge.label)}) ${badge.label}`);
            }
        }

        // Installed version — show inline in badge row for non-module hovers,
        // the module exports section handles it for module hovers.
        if (doc.installedVersion && doc.kind !== 'module') {
            chips.push(`$(versions) v${doc.installedVersion}`);
        }

        md.appendMarkdown(chips.join('  ·  ') + '\n\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLBAR  — actions bar, always directly under the header
    // ─────────────────────────────────────────────────────────────────────────

    private renderToolbar(md: vscode.MarkdownString, doc: HoverDoc): void {
        const actions: string[] = [];

        // Pin
        actions.push(`[$(pin) Pin](command:python-hover.pinHover "Pin this hover")`);

        // Go to definition (local symbols)
        if (doc.source === ResolutionSource.Local) {
            actions.push(`[$(go-to-file) Go to def](command:editor.action.revealDefinition "Jump to definition")`);
        }

        // Official docs — always show when we have a URL
        if (doc.url) {
            actions.push(`[$(book) Docs](${this.buildDocsUrl(doc.url)} "Open official documentation")`);
        }

        // DevDocs — scoped search
        const devdocsUrl = doc.devdocsUrl ??
            (doc.source !== ResolutionSource.Local ? this.buildFallbackDevDocsUrl(doc) : null);
        if (doc.source !== ResolutionSource.Local && devdocsUrl) {
            actions.push(`[$(search-view-icon) DevDocs](${this.buildDocsUrl(devdocsUrl)} "Search DevDocs")`);
        }

        // Browse module — inline in toolbar so the header is cleaner
        if (doc.module && doc.module !== 'builtins') {
            const args = encodeURIComponent(JSON.stringify(doc.module));
            actions.push(
                `[$(symbol-namespace) Browse \`${doc.module}\`]` +
                `(command:python-hover.browseModule?${args} "Browse all symbols in ${doc.module}")`
            );
        }

        if (actions.length > 0) {
            md.appendMarkdown(actions.join('  ·  ') + '\n\n---\n\n');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATURE
    // ─────────────────────────────────────────────────────────────────────────

    private renderSignature(md: vscode.MarkdownString, doc: HoverDoc): void {
        if (doc.overloads && doc.overloads.length > 1) {
            const maxShow = 3;
            doc.overloads.slice(0, maxShow).forEach(o => md.appendCodeblock(o, 'python'));
            if (doc.overloads.length > maxShow) {
                const extra = doc.overloads.length - maxShow;
                md.appendMarkdown(`*+${extra} more overload${extra > 1 ? 's' : ''} — see docs*\n\n`);
            }
        } else {
            let sig = doc.signature!;
            if (sig.startsWith('(')) {
                const title = doc.title.replace(/^builtins\./, '');
                sig = `${title}${sig}`;
            }
            md.appendCodeblock(sig, 'python');
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALLOUTS  (protocol hints, notes)
    // ─────────────────────────────────────────────────────────────────────────

    private renderCallouts(md: vscode.MarkdownString, doc: HoverDoc): void {
        if (doc.protocolHints && doc.protocolHints.length > 0) {
            doc.protocolHints.forEach(h => md.appendMarkdown(`$(lightbulb) *${h}*\n\n`));
        }
        if (doc.notes && doc.notes.length > 0) {
            doc.notes.forEach(n => md.appendMarkdown(`$(info) ${n}\n\n`));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DESCRIPTION
    // ─────────────────────────────────────────────────────────────────────────

    private renderDescription(md: vscode.MarkdownString, doc: HoverDoc): void {
        let content = doc.summary || doc.content;
        if (!content) return;

        if (doc.kind?.toLowerCase() === 'keyword') {
            this.renderKeywordContent(md, content);
            return;
        }

        this.renderVersionCompatibility(md, content);

        content = this.cleanRstArtifacts(content);
        if (!content.trim()) return;

        content = this.enhanceContent(content);

        const maxLen = this.config.maxContentLength;
        if (content.length > maxLen) {
            content = this.smartTruncate(content, maxLen);
        }

        md.appendMarkdown(`${content}\n\n`);
    }

    private renderVersionCompatibility(md: vscode.MarkdownString, content: string): void {
        if (!this.detectedVersion) return;
        const match = content.match(/(?:New|Added) in version (\d+\.\d+)/i);
        if (!match) return;
        const [reqMaj, reqMin] = match[1].split('.').map(Number);
        const [userMaj, userMin] = this.detectedVersion.split('.').map(Number);
        if ((userMaj ?? 0) < (reqMaj ?? 0) ||
            ((userMaj ?? 0) === (reqMaj ?? 0) && (userMin ?? 0) < (reqMin ?? 0))) {
            md.appendMarkdown(
                `> $(warning) **Requires Python ${match[1]}+** — ` +
                `your runtime is Python ${this.detectedVersion}\n\n`
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // KEYWORD  (pydoc content renderer)
    // ─────────────────────────────────────────────────────────────────────────

    private renderKeywordContent(md: vscode.MarkdownString, content: string): void {
        const lines = content.split('\n');
        const bnfLines: string[] = [];
        const descLines: string[] = [];
        const exampleLines: string[] = [];
        let seeAlsoText = '';
        let section: 'start' | 'bnf' | 'desc' | 'example' | 'seealso' = 'start';
        let lastBnfIndent = 0;
        let passedTitle = false;

        for (const line of lines) {
            const trimmed = line.trim();
            const indent = line.search(/\S/);
            if (/^\*+$/.test(trimmed)) continue;
            if (!passedTitle && (trimmed.startsWith('The "') || trimmed.startsWith("The '"))) {
                passedTitle = true; continue;
            }
            if (/^Examples?:?\s*$/i.test(trimmed)) { section = 'example'; continue; }
            if (/^(?:See also|Related help topics?):?\s*/i.test(trimmed)) {
                section = 'seealso';
                const m = trimmed.match(/^(?:See also|Related help topics?):?\s*(.*)$/i);
                if (m?.[1]) seeAlsoText += m[1] + ' ';
                continue;
            }
            if (section === 'example') { exampleLines.push(line); continue; }
            if (section === 'seealso') { seeAlsoText += trimmed + ' '; continue; }

            const hasBnf = trimmed.includes('::=');
            const hasPydocBnf = !hasBnf &&
                /^[a-z][a-z0-9_]+:\s+["(\[]/.test(trimmed) &&
                /["|\[\]()]/.test(trimmed.slice(trimmed.indexOf(':') + 1));
            const looksLikeBnf = /^[\|\(\)\[\]"'\s\w.*+]+$/.test(trimmed) &&
                (trimmed.startsWith('|') || trimmed.startsWith('(') ||
                 trimmed.startsWith('"') || /^[a-z_]+\s+::=/.test(trimmed));

            if (hasBnf || hasPydocBnf) {
                section = 'bnf';
                lastBnfIndent = indent >= 0 ? indent : 0;
                bnfLines.push(trimmed); continue;
            }
            if (section === 'bnf' && trimmed) {
                const isCont = (indent >= lastBnfIndent && indent > 0) || looksLikeBnf;
                const isDesc = /^[A-Z].*[a-z]/.test(trimmed) && !looksLikeBnf && trimmed.length > 20;
                if (isCont && !isDesc) { bnfLines.push(trimmed); continue; }
                else { section = 'desc'; }
            }
            if (section === 'start' || section === 'bnf' || section === 'desc') {
                if (trimmed) section = 'desc';
                descLines.push(line);
            }
        }

        if (bnfLines.length > 0) {
            md.appendMarkdown(`**$(code) Syntax**\n\n`);
            md.appendMarkdown('```\n' + bnfLines.join('\n') + '\n```\n\n');
        }
        if (descLines.length > 0) {
            let desc = descLines.join('\n').trim();
            desc = this.enhanceContent(desc);
            const maxLen = this.config.maxContentLength;
            if (desc.length > maxLen) desc = this.smartTruncate(desc, maxLen);
            md.appendMarkdown(`${desc}\n\n`);
        }
        if (exampleLines.length > 0) {
            const ex = exampleLines.join('\n').trim();
            if (ex) {
                const exLines = ex.split('\n');
                const preview = exLines.slice(0, 5).join('\n');
                md.appendMarkdown(`**$(play) Example**\n\n`);
                md.appendMarkdown('```python\n' + preview + '\n```\n\n');
                if (exLines.length > 5) {
                    md.appendMarkdown(`*+${exLines.length - 5} more lines in docs*\n\n`);
                }
            }
        }
        if (seeAlsoText.trim()) {
            let sa = seeAlsoText.trim()
                .replace(/\b(?!PEP)[A-Z]{3,}\b/g, '')
                .replace(/\*{0,2}PEP\s*(\d+)\*{0,2}/gi, '[PEP $1](https://peps.python.org/pep-$1/)')
                .replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim()
                .replace(/^[,.\s-]+|[,.\s-]+$/g, '');
            if (sa) md.appendMarkdown(`$(link-external) **See also:** ${sa}\n\n`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────

    private renderParameters(md: vscode.MarkdownString, doc: HoverDoc): void {
        const params = doc.parameters!;
        md.appendMarkdown(`**$(list-unordered) Parameters**\n\n`);
        if (this.config.showParameterTables && params.length >= 3) {
            this.renderParameterTable(md, params);
        } else {
            this.renderParameterList(md, params);
        }
    }

    private renderParameterTable(md: vscode.MarkdownString, params: HoverDoc['parameters']): void {
        if (!params) return;
        md.appendMarkdown('| Parameter | Type | Description |\n');
        md.appendMarkdown('|:----------|:-----|:------------|\n');
        const maxRows = 8;
        params.slice(0, maxRows).forEach(p => {
            const name = p.default !== undefined ? `${p.name}=${p.default}` : p.name;
            md.appendMarkdown(`| \`${name}\` | \`${p.type || '—'}\` | ${this.escapeTableCell(p.description || '')} |\n`);
        });
        if (params.length > maxRows) md.appendMarkdown(`\n*…and ${params.length - maxRows} more*\n`);
        md.appendMarkdown('\n');
    }

    private renderParameterList(md: vscode.MarkdownString, params: HoverDoc['parameters']): void {
        if (!params) return;
        const maxItems = 6;
        params.slice(0, maxItems).forEach(p => {
            const typeStr = p.type ? `: \`${p.type}\`` : '';
            const defStr = p.default !== undefined ? ` = \`${p.default}\`` : '';
            md.appendMarkdown(`- **\`${p.name}\`**${typeStr}${defStr}`);
            if (p.description) md.appendMarkdown(` — ${p.description}`);
            md.appendMarkdown('\n');
        });
        if (params.length > maxItems) md.appendMarkdown(`\n*+${params.length - maxItems} more*\n`);
        md.appendMarkdown('\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RETURNS / RAISES / EXAMPLES
    // ─────────────────────────────────────────────────────────────────────────

    private renderReturns(md: vscode.MarkdownString, doc: HoverDoc): void {
        const ret = doc.returns!;
        md.appendMarkdown(`**$(arrow-right) Returns**`);
        if (ret.type) md.appendMarkdown(` \`${ret.type}\``);
        if (ret.description) md.appendMarkdown(` — ${ret.description}`);
        md.appendMarkdown('\n\n');
    }

    private renderRaises(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`**$(alert) Raises**\n\n`);
        doc.raises!.forEach(exc => {
            md.appendMarkdown(`- \`${exc.type}\``);
            if (exc.description) md.appendMarkdown(` — ${exc.description}`);
            md.appendMarkdown('\n');
        });
        md.appendMarkdown('\n');
    }

    private renderExamples(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`**$(play) Example**\n\n`);
        const example = doc.examples![0];
        const lines = example.split('\n');
        const maxLines = this.config.maxSnippetLines;
        if (lines.length > maxLines) {
            md.appendCodeblock(lines.slice(0, maxLines).join('\n'), 'python');
            md.appendMarkdown(`*+${lines.length - maxLines} more lines in docs*\n\n`);
        } else {
            md.appendCodeblock(example, 'python');
        }
        if (doc.examples!.length > 1) {
            md.appendMarkdown(`*+${doc.examples!.length - 1} more example${doc.examples!.length > 2 ? 's' : ''} in docs*\n\n`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MODULE EXPORTS  (import-line hover)
    // ─────────────────────────────────────────────────────────────────────────

    private renderModuleExports(md: vscode.MarkdownString, doc: HoverDoc): void {
        const exports = doc.moduleExports!;

        if (doc.installedVersion) {
            md.appendMarkdown(`$(versions) **v${doc.installedVersion}** installed\n\n`);
        }

        md.appendMarkdown(`**$(symbol-field) Key exports**\n\n`);
        md.appendMarkdown(exports.map(n => `\`${n}\``).join('  ·  ') + '\n\n');

        if (doc.exportCount && doc.exportCount > exports.length) {
            const args = encodeURIComponent(JSON.stringify(doc.module || doc.title));
            md.appendMarkdown(
                `$(info) ${doc.exportCount.toLocaleString()} indexed symbols  ·  ` +
                `[$(symbol-namespace) Browse all](command:python-hover.browseModule?${args} "Browse all symbols")\n\n`
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEE ALSO
    // ─────────────────────────────────────────────────────────────────────────

    private renderSeeAlso(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`$(link-external) **See also:** ${doc.seeAlso!.join('  ·  ')}\n\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────────────────────────────────

    private renderFooter(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown('---\n\n');

        const utils: string[] = [];

        if (doc.signature) {
            const sig = doc.signature.startsWith('(')
                ? `${doc.title}${doc.signature}` : doc.signature;
            const args = encodeURIComponent(JSON.stringify(sig));
            utils.push(`[$(clippy) Copy sig](command:python-hover.copySignature?${args} "Copy signature")`);
        }
        if (doc.url) {
            const args = encodeURIComponent(JSON.stringify(doc.url));
            utils.push(`[$(link-external) Copy URL](command:python-hover.copyUrl?${args} "Copy docs URL")`);
        }

        let version = this.config.docsVersion;
        if (version === 'auto') version = this.detectedVersion || '3';

        const info: string[] = [`$(tag) Python ${version}`];
        if (this.config.showKeyboardHints
            && doc.source !== ResolutionSource.Local
            && doc.kind !== 'keyword'
            && doc.kind !== 'constant'
            && doc.kind !== 'module') {
            info.push('`F12` Go to def');
            info.push('`Ctrl+Space` IntelliSense');
        }

        // Combine utils and version info on same line
        const footerParts = [...utils, ...info];
        md.appendMarkdown(footerParts.join('  ·  '));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // URL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Wraps an http(s) URL in the openDocsSide command so docs always open in
     * the persistent side panel (ViewColumn.Beside).
     *
     * Uses encodeURIComponent(JSON.stringify(url)) so the args are properly
     * URL-encoded JSON — no raw `"` chars that would break the markdown link
     * parser's title-attribute heuristic.
     */
    private buildDocsUrl(url: string): string {
        const sanitized = this.sanitizeUrl(url);
        if (sanitized.startsWith('http')) {
            // VS Code command URI format: ?<url-encoded-json-args>
            // JSON.stringify adds surrounding quotes; encodeURIComponent turns them
            // into %22 so the markdown `[text](url "title")` parser is not confused.
            const args = encodeURIComponent(JSON.stringify(sanitized));
            return `command:python-hover.openDocsSide?${args}`;
        }
        return sanitized;
    }

    private buildFallbackDevDocsUrl(doc: HoverDoc): string | null {
        const term = doc.title.replace(/^builtins\./, '');
        if (!term) return null;
        return `https://devdocs.io/#q=${encodeURIComponent(`python~3 ${term}`)}`;
    }

    private sanitizeUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('command:')) return url;
        if (/^[a-zA-Z]:\\/.test(url)) return vscode.Uri.file(url).toString();
        if (url.startsWith('/')) return vscode.Uri.file(url).toString();
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            return `https://${url}`;
        }
        return url;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CONTENT HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private enhanceContent(content: string): string {
        const replacements: [RegExp, string][] = [
            [/CPython implementation detail:/g, '$(alert) **CPython implementation detail:**'],
            [/\bNote:\s/g, '$(info) **Note:** '],
            [/\bWarning:\s/g, '$(warning) **Warning:** '],
            [/\bDeprecated:\s/g, '$(error) **Deprecated:** '],
            [/\bTip:\s/g, '$(lightbulb) **Tip:** '],
            [/\bImportant:\s/g, '$(megaphone) **Important:** '],
            [/Changed in version (\d+\.\d+)/g, '$(history) **Changed in $1:**'],
            [/New in version (\d+\.\d+)/g, '$(sparkle) **New in $1:**'],
            [/Deprecated since version (\d+\.\d+)/g, '$(error) **Deprecated since $1:**'],
            [/Added in version (\d+\.\d+)/g, '$(sparkle) **Added in $1:**'],
        ];
        for (const [p, r] of replacements) content = content.replace(p, r);
        return content;
    }

    private smartTruncate(content: string, maxLen: number): string {
        if (content.length <= maxLen) return content;
        let truncated = content.substring(0, maxLen).trim();
        const breakPoints = ['. ', '.\n', '! ', '?\n', '\n\n'];
        let best = -1;
        const min = maxLen * 0.6;
        for (const bp of breakPoints) {
            const idx = truncated.lastIndexOf(bp);
            if (idx > min && idx > best) best = idx + bp.length - 1;
        }
        if (best > 0) truncated = truncated.substring(0, best);
        return truncated.trimEnd() + ' …';
    }

    private cleanRstArtifacts(text: string): string {
        text = text.replace(/\.\. note::\s*/gi, '**Note:** ');
        text = text.replace(/\.\. warning::\s*/gi, '**Warning:** ');
        text = text.replace(/\.\. caution::\s*/gi, '**Caution:** ');
        text = text.replace(/\.\. important::\s*/gi, '**Important:** ');
        text = text.replace(/\.\. tip::\s*/gi, '**Tip:** ');
        text = text.replace(/\.\. deprecated::\s*(\S+)/gi, '**Deprecated since $1:** ');
        text = text.replace(/\.\. versionadded::\s*(\S+)/gi, '**New in $1:** ');
        text = text.replace(/\.\. versionchanged::\s*(\S+)/gi, '**Changed in $1:** ');
        text = text.replace(/^[ \t]*\.\.\s+[\w-]+::.*$/gm, '');
        text = text.replace(/:(?:func|class|meth|mod|attr|exc|data|const|type|obj):`([^`]+)`/g, '`$1`');
        text = text.replace(/\|([^|\n]+)\|_?/g, '$1');
        text = text.replace(/__[ \t]*$/gm, '');
        text = text.replace(/\n{3,}/g, '\n\n');
        return text.trim();
    }

    private escapeTableCell(text: string): string {
        return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').replace(/\r/g, '').trim();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ICON / LABEL MAPS
    // ─────────────────────────────────────────────────────────────────────────

    private getIconForKind(kind?: string): string {
        const m: Record<string, string> = {
            class: 'symbol-class', module: 'symbol-namespace',
            method: 'symbol-method', function: 'symbol-function',
            property: 'symbol-property', field: 'symbol-field',
            variable: 'symbol-variable', constant: 'symbol-constant',
            enum: 'symbol-enum', interface: 'symbol-interface',
            keyword: 'symbol-keyword', exception: 'warning',
            type: 'symbol-class', data: 'symbol-field',
        };
        return m[kind?.toLowerCase() ?? ''] ?? 'symbol-function';
    }

    private formatKindLabel(kind?: string): string {
        if (!kind) return 'Function';
        return kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
    }

    private getBadgeIcon(label: string): string {
        const m: Record<string, string> = {
            deprecated: 'error', async: 'sync', 'side-effects': 'edit',
            'i/o': 'file', stdlib: 'library', experimental: 'beaker',
            'thread-safe': 'lock', generator: 'debug-step-over',
        };
        return m[label.toLowerCase()] ?? 'info';
    }
}

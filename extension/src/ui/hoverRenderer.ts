import * as vscode from 'vscode';
import { HoverDoc, ResolutionSource } from '../../../shared/types';
import { Config } from '../config';

/**
 * HoverRenderer - Creates beautifully formatted hover documentation
 *
 * Design Principles:
 * - Clean visual hierarchy with consistent spacing
 * - Semantic icons that convey meaning at a glance
 * - Progressive disclosure (collapse long sections)
 * - Accessibility through clear structure
 */
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

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // HEADER: Icon + Title + Badges
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.renderHeader(md, doc);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // QUICK ACTIONS: Contextual links
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (this.config.showQuickActions) {
            this.renderQuickActions(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // SIGNATURE: Function/method signature
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (doc.signature && this.config.showSignatures) {
            this.renderSignature(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // CALLOUTS: Protocol hints, notes, warnings
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.renderCallouts(md, doc);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DESCRIPTION: Main documentation content
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.renderDescription(md, doc);

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PARAMETERS: Function parameters
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (doc.parameters && doc.parameters.length > 0) {
            this.renderParameters(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // RETURNS: Return value documentation
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (doc.returns && this.config.showReturnTypes) {
            this.renderReturns(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // RAISES: Exceptions documentation
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (doc.raises && doc.raises.length > 0) {
            this.renderRaises(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // EXAMPLES: Code examples
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (doc.examples && doc.examples.length > 0 && this.config.showPracticalExamples) {
            this.renderExamples(md, doc);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // FOOTER: Hints + Version
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.renderFooter(md, doc);

        return new vscode.Hover(md);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SECTION RENDERERS
    // ═══════════════════════════════════════════════════════════════════

    private renderHeader(md: vscode.MarkdownString, doc: HoverDoc): void {
        const icon = this.getIconForKind(doc.kind);
        const kindLabel = this.formatKindLabel(doc.kind);

        // Strip 'builtins.' prefix — users don't need to see the module implementation detail
        const displayTitle = doc.title.replace(/^builtins\./, '');

        // ### is better-proportioned than ## inside a hover panel
        md.appendMarkdown(`### $(${icon}) ${displayTitle}\n\n`);

        // Badge row with colored icons
        const badges: string[] = [];

        // Kind badge with colored icon
        const kindIcon = this.getKindBadgeIcon(doc.kind);
        badges.push(`$(${kindIcon}) \`${kindLabel}\``);

        // Source badge
        if (doc.source === ResolutionSource.Local) {
            badges.push(`$(home) Local`);
        } else if (doc.source) {
            const srcIcon = this.getSourceIcon(doc.source);
            badges.push(`$(${srcIcon}) ${this.formatSourceLabel(doc.source)}`);
        }

        // Semantic badges with meaningful icons
        if (doc.badges && doc.badges.length > 0) {
            for (const badge of doc.badges) {
                const badgeIcon = this.getBadgeIcon(badge.label);
                badges.push(`$(${badgeIcon}) ${badge.label}`);
            }
        }

        md.appendMarkdown(badges.join('  ·  ') + '\n\n');
    }

    private renderQuickActions(md: vscode.MarkdownString, doc: HoverDoc): void {
        const actions: string[] = [];

        // Go to Definition (for local symbols)
        if (doc.source === ResolutionSource.Local) {
            actions.push(`[$(link-external) Definition](command:editor.action.revealDefinition "Jump to source")`);
        }

        // Primary documentation link (Sphinx, docs.python.org, PyPI, etc.)
        if (doc.url) {
            actions.push(`[$(book) Docs](${this.sanitizeUrl(doc.url)} "Open documentation")`);
        }

        // DevDocs scoped search — always shown when available (non-local symbols).
        // The URL is pre-computed with a single-doc-set scope (e.g. #q=python str or
        // #q=numpy ndarray.mean) so it selects only the relevant doc set, not all of them.
        if (doc.devdocsUrl && doc.source !== ResolutionSource.Local) {
            actions.push(`[$(search) DevDocs](${this.sanitizeUrl(doc.devdocsUrl)} "Search DevDocs")`);
        }

        // Copy signature (useful for quickly pasting a function call template)
        if (doc.signature) {
            const sig = doc.signature.startsWith('(') ? `${doc.title}${doc.signature}` : doc.signature;
            const encoded = encodeURIComponent(sig);
            actions.push(`[$(copy) Copy sig](command:python-hover.copySignature?${JSON.stringify(encoded)} "Copy signature")`);
        }

        // Copy URL
        if (doc.url) {
            const encoded = encodeURIComponent(doc.url);
            actions.push(`[$(link) Copy URL](command:python-hover.copyUrl?${JSON.stringify(encoded)} "Copy docs URL")`);
        }

        if (actions.length > 0) {
            md.appendMarkdown(actions.join('  ｜  ') + '\n\n---\n\n');
        }
    }

    private renderSignature(md: vscode.MarkdownString, doc: HoverDoc): void {
        if (doc.overloads && doc.overloads.length > 1) {
            // VS Code hover panels don't support <details> — stack code blocks instead
            const maxShow = 3;
            doc.overloads.slice(0, maxShow).forEach(o => md.appendCodeblock(o, 'python'));
            if (doc.overloads.length > maxShow) {
                const extra = doc.overloads.length - maxShow;
                md.appendMarkdown(`*+${extra} more overload${extra > 1 ? 's' : ''} — see docs*\n\n`);
            }
        } else {
            let sig = doc.signature!;
            // Qualify bare signatures like (x, y) → MethodName(x, y)
            if (sig.startsWith('(')) {
                const displayTitle = doc.title.replace(/^builtins\./, '');
                sig = `${displayTitle}${sig}`;
            }
            md.appendCodeblock(sig, 'python');
        }
    }

    private renderCallouts(md: vscode.MarkdownString, doc: HoverDoc): void {
        // Protocol hints (e.g., "Supports context manager protocol")
        if (doc.protocolHints && doc.protocolHints.length > 0) {
            doc.protocolHints.forEach(hint => {
                md.appendMarkdown(`$(lightbulb) *${hint}*\n\n`);
            });
        }

        // Notes (e.g., source file info)
        if (doc.notes && doc.notes.length > 0) {
            doc.notes.forEach(note => {
                md.appendMarkdown(`$(info) ${note}\n\n`);
            });
        }
    }

    private renderDescription(md: vscode.MarkdownString, doc: HoverDoc): void {
        let content = doc.summary || doc.content;
        if (!content) return;

        // Special handling for keyword documentation (from pydoc.help())
        if (doc.kind?.toLowerCase() === 'keyword') {
            this.renderKeywordContent(md, content);
            return;
        }

        // Strip RST directives that may have leaked from scraped Sphinx content
        content = this.cleanRstArtifacts(content);
        if (!content.trim()) return;

        // Enhance with semantic callouts
        content = this.enhanceContent(content);

        // Smart truncation
        const maxLen = this.config.maxContentLength;
        if (content.length > maxLen) {
            content = this.smartTruncate(content, maxLen);
        }

        md.appendMarkdown(`${content}\n\n`);
    }

    /**
     * Special renderer for Python keyword documentation
     * Handles BNF grammar blocks, examples, and see-also sections
     */
    private renderKeywordContent(md: vscode.MarkdownString, content: string): void {
        const lines = content.split('\n');

        // Find all BNF lines first (lines with ::= or indented continuation lines)
        const bnfLines: string[] = [];
        const descLines: string[] = [];
        const exampleLines: string[] = [];
        let seeAlsoText = '';

        let section: 'start' | 'bnf' | 'desc' | 'example' | 'seealso' = 'start';
        let lastBnfIndent = 0;
        let passedTitle = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const indent = line.search(/\S/);

            // Skip asterisk decoration lines
            if (/^\*+$/.test(trimmed)) continue;

            // Skip title line (e.g. 'The "from" statement')
            if (!passedTitle && (trimmed.startsWith('The "') || trimmed.startsWith("The '"))) {
                passedTitle = true;
                continue;
            }

            // Detect Examples section
            if (/^Examples?:?\s*$/i.test(trimmed)) {
                section = 'example';
                continue;
            }

            // Detect See Also / Related help topics
            if (/^See also:?\s*/i.test(trimmed) || /^Related help topics?:?\s*/i.test(trimmed)) {
                section = 'seealso';
                const match = trimmed.match(/^(?:See also|Related help topics?):?\s*(.*)$/i);
                if (match && match[1]) {
                    seeAlsoText += match[1] + ' ';
                }
                continue;
            }

            // Route based on section
            if (section === 'example') {
                exampleLines.push(line);
                continue;
            }

            if (section === 'seealso') {
                seeAlsoText += trimmed + ' ';
                continue;
            }

            // BNF detection: lines with ::= or indented grammar continuations
            const hasBnfOperator = trimmed.includes('::=');
            const looksLikeBnf = /^[\|\(\)\[\]"\'\s\w\.\*\+]+$/.test(trimmed) &&
                (trimmed.startsWith('|') || trimmed.startsWith('(') ||
                    trimmed.startsWith('"') || /^[a-z_]+\s+::=/.test(trimmed));

            if (hasBnfOperator) {
                section = 'bnf';
                lastBnfIndent = indent >= 0 ? indent : 0;
                bnfLines.push(trimmed);
                continue;
            }

            // Continue BNF if we're in BNF mode and line is indented or looks like grammar
            if (section === 'bnf' && trimmed) {
                // Check if this is a BNF continuation
                const isContinuation = (indent >= lastBnfIndent && indent > 0) || looksLikeBnf;
                const startsDescription = /^[A-Z].*[a-z]/.test(trimmed) && !looksLikeBnf && trimmed.length > 20;

                if (isContinuation && !startsDescription) {
                    bnfLines.push(trimmed);
                    continue;
                } else {
                    section = 'desc';
                }
            }

            // Default to description (when in start, bnf, or desc sections)
            if (section === 'start' || section === 'bnf' || section === 'desc') {
                if (trimmed) section = 'desc';
                descLines.push(line);
            }
        }

        // Render BNF grammar in a code block
        if (bnfLines.length > 0) {
            md.appendMarkdown(`### $(code) Syntax\n\n`);
            md.appendMarkdown('```\n' + bnfLines.join('\n') + '\n```\n\n');
        }

        // Render description
        if (descLines.length > 0) {
            let desc = descLines.join('\n').trim();
            desc = this.enhanceContent(desc);

            // Smart truncation
            const maxLen = this.config.maxContentLength;
            if (desc.length > maxLen) {
                desc = this.smartTruncate(desc, maxLen);
            }

            md.appendMarkdown(`${desc}\n\n`);
        }

        // Render examples
        if (exampleLines.length > 0) {
            const exampleContent = exampleLines.join('\n').trim();
            if (exampleContent) {
                const lineCount = exampleContent.split('\n').length;
                const previewLines = exampleContent.split('\n').slice(0, 5);
                md.appendMarkdown(`---\n\n### $(play) Example\n\n`);
                md.appendMarkdown('```python\n' + previewLines.join('\n') + '\n```\n');
                if (lineCount > 5) {
                    md.appendMarkdown(`\n*+${lineCount - 5} more lines in docs*\n\n`);
                }
            }
        }

        // Render see-also with PEP links
        if (seeAlsoText.trim()) {
            let seeAlso = seeAlsoText.trim();
            // FIRST: Remove ALL CAPS words like MODULES, CLASSES (before PEP conversion)
            seeAlso = seeAlso.replace(/\b(?!PEP)[A-Z]{3,}\b/g, '');
            // THEN: Convert PEP references to markdown links
            seeAlso = seeAlso.replace(/\*{0,2}PEP\s*(\d+)\*{0,2}/gi, '[PEP $1](https://peps.python.org/pep-$1/)');
            // Clean up multiple spaces and commas
            seeAlso = seeAlso.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
            // Remove trailing/leading punctuation
            seeAlso = seeAlso.replace(/^[,.\s-]+|[,.\s-]+$/g, '');
            if (seeAlso) {
                md.appendMarkdown(`---\n\n$(link-external) **See also:** ${seeAlso}\n\n`);
            }
        }
    }

    private renderParameters(md: vscode.MarkdownString, doc: HoverDoc): void {
        const params = doc.parameters!;
        md.appendMarkdown(`### $(list-unordered) Parameters\n\n`);

        // Use table for 3+ params, list for fewer
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
            const type = p.type || '—';
            const desc = this.escapeTableCell(p.description || '');
            md.appendMarkdown(`| \`${name}\` | \`${type}\` | ${desc} |\n`);
        });

        if (params.length > maxRows) {
            md.appendMarkdown(`\n*…and ${params.length - maxRows} more*\n`);
        }
        md.appendMarkdown('\n');
    }

    private renderParameterList(md: vscode.MarkdownString, params: HoverDoc['parameters']): void {
        if (!params) return;

        const maxItems = 6;
        params.slice(0, maxItems).forEach(p => {
            const typeStr = p.type ? `: \`${p.type}\`` : '';
            const defStr = p.default !== undefined ? ` = \`${p.default}\`` : '';
            md.appendMarkdown(`- **\`${p.name}\`**${typeStr}${defStr}`);
            if (p.description) {
                md.appendMarkdown(` — ${p.description}`);
            }
            md.appendMarkdown('\n');
        });

        if (params.length > maxItems) {
            md.appendMarkdown(`\n*+${params.length - maxItems} more*\n`);
        }
        md.appendMarkdown('\n');
    }

    private renderReturns(md: vscode.MarkdownString, doc: HoverDoc): void {
        const ret = doc.returns!;
        md.appendMarkdown(`### $(arrow-right) Returns`);

        if (ret.type) {
            md.appendMarkdown(` \`${ret.type}\``);
        }
        if (ret.description) {
            md.appendMarkdown(` — ${ret.description}`);
        }
        md.appendMarkdown('\n\n');
    }

    private renderRaises(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`### $(alert) Raises\n\n`);

        doc.raises!.forEach(exc => {
            md.appendMarkdown(`- \`${exc.type}\``);
            if (exc.description) {
                md.appendMarkdown(` — ${exc.description}`);
            }
            md.appendMarkdown('\n');
        });
        md.appendMarkdown('\n');
    }

    private renderExamples(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`### $(play) Example\n\n`);

        let example = doc.examples![0];
        const lines = example.split('\n');
        const maxLines = this.config.maxSnippetLines;

        if (lines.length > maxLines) {
            md.appendCodeblock(lines.slice(0, maxLines).join('\n'), 'python');
            md.appendMarkdown(`\n*+${lines.length - maxLines} more lines in docs*\n\n`);
        } else {
            md.appendCodeblock(example, 'python');
        }

        if (doc.examples!.length > 1) {
            md.appendMarkdown(`*+${doc.examples!.length - 1} more example${doc.examples!.length > 2 ? 's' : ''} in docs*\n\n`);
        }
    }

    private renderFooter(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown('---\n\n');

        let version = this.config.docsVersion;
        if (version === 'auto') {
            version = this.detectedVersion || '3.12';
        }

        const footerParts: string[] = [];
        footerParts.push(`$(tag) Python ${version}`);

        // Skip keyboard hints for local symbols — they already have a Definition quick action
        if (this.config.showKeyboardHints && doc.source !== ResolutionSource.Local) {
            footerParts.push(`\`F12\` Definition`);
            footerParts.push(`\`Ctrl+Space\` IntelliSense`);
        }

        md.appendMarkdown(footerParts.join('  ·  '));
    }

    // ═══════════════════════════════════════════════════════════════════
    // HELPER METHODS
    // ═══════════════════════════════════════════════════════════════════

    private getIconForKind(kind?: string): string {
        if (!kind) return 'symbol-function';

        const iconMap: Record<string, string> = {
            'class': 'symbol-class',
            'module': 'symbol-module',
            'method': 'symbol-method',
            'function': 'symbol-function',
            'property': 'symbol-property',
            'field': 'symbol-field',
            'variable': 'symbol-variable',
            'constant': 'symbol-constant',
            'enum': 'symbol-enum',
            'interface': 'symbol-interface',
            'keyword': 'symbol-keyword',
            'exception': 'warning',
            'type': 'symbol-class',
            'data': 'symbol-field',
        };

        return iconMap[kind.toLowerCase()] || 'symbol-function';
    }

    private formatKindLabel(kind?: string): string {
        if (!kind) return 'Function';
        const k = kind.toLowerCase();
        return k.charAt(0).toUpperCase() + k.slice(1);
    }

    private getKindBadgeIcon(kind?: string): string {
        // Use colorful/distinctive icons for kind badges
        if (!kind) return 'symbol-method';
        const iconMap: Record<string, string> = {
            'class': 'symbol-class',
            'module': 'package',
            'method': 'symbol-method',
            'function': 'symbol-method',
            'property': 'symbol-property',
            'field': 'symbol-field',
            'variable': 'symbol-variable',
            'constant': 'symbol-constant',
            'enum': 'symbol-enum',
            'interface': 'symbol-interface',
            'keyword': 'key',
            'exception': 'warning',
            'type': 'symbol-class',
            'data': 'symbol-field',
        };
        return iconMap[kind.toLowerCase()] || 'symbol-method';
    }

    private getBadgeIcon(label: string): string {
        const iconMap: Record<string, string> = {
            'deprecated': 'error',
            'async': 'sync',
            'side-effects': 'edit',
            'i/o': 'file',
            'stdlib': 'library',
            'experimental': 'beaker',
            'thread-safe': 'lock',
            'generator': 'debug-step-over',
        };
        return iconMap[label.toLowerCase()] || 'info';
    }

    private getSourceIcon(source: ResolutionSource): string {
        const iconMap: Record<ResolutionSource, string> = {
            [ResolutionSource.LSP]: 'server',
            [ResolutionSource.Runtime]: 'debug',
            [ResolutionSource.Sphinx]: 'book',
            [ResolutionSource.RTD]: 'globe',
            [ResolutionSource.DevDocs]: 'search',
            [ResolutionSource.PyPI]: 'package',
            [ResolutionSource.GitHub]: 'github',
            [ResolutionSource.Static]: 'file-code',
            [ResolutionSource.Local]: 'file-code',
            [ResolutionSource.Fallback]: 'question',
        };
        return iconMap[source] || 'question';
    }

    private formatSourceLabel(source: ResolutionSource): string {
        const labelMap: Record<ResolutionSource, string> = {
            [ResolutionSource.LSP]: 'LSP',
            [ResolutionSource.Runtime]: 'Runtime',
            [ResolutionSource.Sphinx]: 'Sphinx',
            [ResolutionSource.RTD]: 'ReadTheDocs',
            [ResolutionSource.DevDocs]: 'DevDocs',
            [ResolutionSource.PyPI]: 'PyPI',
            [ResolutionSource.GitHub]: 'GitHub',
            [ResolutionSource.Static]: 'Static',
            [ResolutionSource.Local]: 'Local',
            [ResolutionSource.Fallback]: 'Fallback',
        };
        return labelMap[source] || String(source);
    }

    private enhanceContent(content: string): string {
        // Add visual callouts for special annotations
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

        for (const [pattern, replacement] of replacements) {
            content = content.replace(pattern, replacement);
        }

        return content;
    }

    private smartTruncate(content: string, maxLen: number): string {
        if (content.length <= maxLen) return content;

        let truncated = content.substring(0, maxLen).trim();

        // Try to end at a natural break point
        const breakPoints = ['. ', '.\n', '! ', '?\n', '\n\n'];
        let bestBreak = -1;
        const minLen = maxLen * 0.6;

        for (const bp of breakPoints) {
            const idx = truncated.lastIndexOf(bp);
            if (idx > minLen && idx > bestBreak) {
                bestBreak = idx + bp.length - 1;
            }
        }

        if (bestBreak > 0) {
            truncated = truncated.substring(0, bestBreak);
        }

        return truncated.trimEnd() + ' …';
    }

    private escapeTableCell(text: string): string {
        return text
            .replace(/\|/g, '\\|')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '')
            .trim();
    }

    /**
     * Strips RST directives and markup that may have leaked from scraped Sphinx pages.
     * Converts directives to their markdown equivalents where possible.
     */
    private cleanRstArtifacts(text: string): string {
        // Convert known directives to markdown equivalents
        text = text.replace(/\.\. note::\s*/gi, '**Note:** ');
        text = text.replace(/\.\. warning::\s*/gi, '**Warning:** ');
        text = text.replace(/\.\. caution::\s*/gi, '**Caution:** ');
        text = text.replace(/\.\. important::\s*/gi, '**Important:** ');
        text = text.replace(/\.\. tip::\s*/gi, '**Tip:** ');
        text = text.replace(/\.\. deprecated::\s*(\S+)/gi, '**Deprecated since $1:** ');
        text = text.replace(/\.\. versionadded::\s*(\S+)/gi, '**New in $1:** ');
        text = text.replace(/\.\. versionchanged::\s*(\S+)/gi, '**Changed in $1:** ');

        // Strip unrecognised block directives (.. code-block::, .. seealso::, etc.)
        text = text.replace(/^[ \t]*\.\.\s+[\w-]+::.*$/gm, '');

        // Strip RST role markup :role:`text` → `text`
        text = text.replace(/:(?:func|class|meth|mod|attr|exc|data|const|type|obj):`([^`]+)`/g, '`$1`');

        // Strip RST emphasis/strong that can look like *word* or **word** (already markdown-compatible; leave as-is)
        // Strip RST substitution references |name| → name
        text = text.replace(/\|([^|\n]+)\|_?/g, '$1');

        // Strip anonymous hyperlink markers __
        text = text.replace(/__[ \t]*$/gm, '');

        // Collapse excessive blank lines left by stripped directives
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    }

    private sanitizeUrl(url: string): string {
        if (!url) return '';
        if (url.startsWith('command:')) return url;

        // Handle Windows paths
        if (/^[a-zA-Z]:\\/.test(url)) {
            return vscode.Uri.file(url).toString();
        }

        // Handle Unix paths
        if (url.startsWith('/')) {
            return vscode.Uri.file(url).toString();
        }

        // Ensure https:// prefix
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            return `https://${url}`;
        }

        return url;
    }
}

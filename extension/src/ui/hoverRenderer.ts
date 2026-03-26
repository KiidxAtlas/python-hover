import * as vscode from 'vscode';
import { HoverDoc, ResolutionSource } from '../../../shared/types';
import { Config } from '../config';
import {
    cleanContentAnnotations as sharedCleanContentAnnotations,
    cleanPydocDump as sharedCleanPydocDump,
    cleanRstArtifacts as sharedCleanRstArtifacts,
    cleanSignature as sharedCleanSignature,
    stripAnnotatedWrappers,
} from './contentCleaner';

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

        // ### keeps tooltips readable; ## is often oversized inside hovers.
        md.appendMarkdown(`### $(${icon}) \`${rawTitle}\`\n\n`);

        // ── Badge row ──────────
        const chips: string[] = [];

        const kindLabel = this.formatKindLabel(doc.kind);
        chips.push(`\`${kindLabel}\``);

        // Source chip — any non-local doc with a URL (corpus, sphinx, static, …)
        if (doc.source === ResolutionSource.Local) {
            chips.push(`$(home) local`);
        } else if (doc.url) {
            try {
                const host = new URL(doc.url).hostname.replace(/^www\./, '');
                if (host.includes('docs.python.org')) {
                    chips.push(`$(book) Python docs`);
                } else if (host) {
                    chips.push(`$(book) ${host}`);
                }
            } catch { /* skip */ }
        }

        // Attribute badges
        if (doc.badges) {
            for (const badge of doc.badges) {
                chips.push(`$(${this.getBadgeIcon(badge.label)}) ${badge.label}`);
            }
        }

        // Installed version
        if (doc.installedVersion && doc.kind !== 'module') {
            chips.push(`$(versions) v${doc.installedVersion}`);
        }

        md.appendMarkdown(chips.join(' \u00a0·\u00a0 ') + '\n\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TOOLBAR  — actions bar, always directly under the header
    // ─────────────────────────────────────────────────────────────────────────

    private renderToolbar(md: vscode.MarkdownString, doc: HoverDoc): void {
        const primary: string[] = [];
        const secondary: string[] = [];

        primary.push(`[$(pin) Pin](command:python-hover.pinHover "Pin this hover")`);

        if (this.config.showDebugPinButton) {
            primary.push(`[$(debug-alt-small) Debug](command:python-hover.debugPinHover "Pin this hover and open a debug view")`);
        }

        if (doc.source === ResolutionSource.Local) {
            primary.push(`[$(go-to-file) Go to def](command:editor.action.revealDefinition "Jump to definition")`);
        }

        if (doc.url) {
            const docsLink = this.buildLinkUrl(doc.url, this.config.docsBrowser);
            secondary.push(`[$(book) Docs](<${docsLink}> "Open official documentation")`);
        }

        const devdocsUrl = doc.devdocsUrl ??
            (doc.source !== ResolutionSource.Local ? this.buildFallbackDevDocsUrl(doc) : null);
        if (doc.source !== ResolutionSource.Local && devdocsUrl) {
            const ddLink = this.buildLinkUrl(devdocsUrl, this.config.devdocsBrowser);
            secondary.push(`[$(search-view-icon) DevDocs](<${ddLink}> "Search DevDocs")`);
        }

        if (doc.module && doc.module !== 'builtins') {
            const args = this.encodeCommandArgs(doc.module);
            const safeModule = doc.module.replace(/[`[\]()]/g, '');
            secondary.push(
                `[$(symbol-namespace) Browse \`${safeModule}\`]` +
                `(<command:python-hover.browseModule?${args}> "Browse all symbols in ${safeModule}")`
            );
        }

        if (primary.length === 0 && secondary.length === 0) {
            return;
        }

        let block = primary.join('  ·  ');
        if (secondary.length > 0) {
            block += (primary.length > 0 ? '  \n' : '') + secondary.join('  ·  ');
        }
        md.appendMarkdown(block + '\n\n---\n\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATURE
    // ─────────────────────────────────────────────────────────────────────────

    private renderSignature(md: vscode.MarkdownString, doc: HoverDoc): void {
        if (doc.overloads && doc.overloads.length > 1) {
            const maxShow = 3;
            doc.overloads.slice(0, maxShow).forEach(o =>
                md.appendCodeblock(this.normalizeDisplaySignature(o), 'python')
            );
            if (doc.overloads.length > maxShow) {
                const extra = doc.overloads.length - maxShow;
                md.appendMarkdown(`*+${extra} more overload${extra > 1 ? 's' : ''} — see docs*\n\n`);
            }
        } else {
            let sig = this.normalizeDisplaySignature(doc.signature!);
            if (sig.startsWith('(')) {
                const title = doc.title.replace(/^builtins\./, '');
                sig = `${title}${sig}`;
            }
            const MAX_SIG_LEN = 400;
            if (sig.length > MAX_SIG_LEN) {
                sig = this.truncateSignature(sig, MAX_SIG_LEN);
            }
            md.appendCodeblock(sig, 'python');
        }
    }

    /**
     * Strip Pylance-style `(kind) ` prefixes and normalize whitespace so we never
     * render `str.upper(method) str.upper() -> str` when the title is already the qualname.
     */
    private normalizeDisplaySignature(raw: string): string {
        const withoutKind = raw.replace(/^\([a-z][a-z0-9_]*\)\s+/i, '').trim();
        return this.cleanSignature(withoutKind);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CALLOUTS  (protocol hints, notes)
    // ─────────────────────────────────────────────────────────────────────────

    private renderCallouts(md: vscode.MarkdownString, doc: HoverDoc): void {
        if (doc.protocolHints && doc.protocolHints.length > 0) {
            doc.protocolHints.forEach(h => md.appendMarkdown(`> $(lightbulb) *${h}*\n\n`));
        }
        if (doc.notes && doc.notes.length > 0) {
            doc.notes.forEach(n => md.appendMarkdown(`> $(info) ${n}\n\n`));
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

        content = this.cleanPydocDump(content);
        content = this.cleanRstArtifacts(content);
        content = this.cleanContentAnnotations(content);
        if (!content.trim()) return;

        content = this.enhanceContent(content);
        content = this.formatDescriptionParagraphs(content);
        content = this.balanceCodeFences(content);

        const maxLen = this.config.maxContentLength;
        const wasTruncated = content.length > maxLen;
        if (wasTruncated) {
            content = this.smartTruncate(content, maxLen);
        }

        md.appendMarkdown(`${content}\n\n`);

        if (wasTruncated && doc.url) {
            const moreUrl = this.buildLinkUrl(doc.url, this.config.docsBrowser);
            md.appendMarkdown(
                `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
            );
        }
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

        // ── Syntax block ──
        if (bnfLines.length > 0) {
            md.appendMarkdown(`**$(code) Syntax**\n\n`);
            md.appendMarkdown('```\n' + bnfLines.join('\n') + '\n```\n\n');
        }

        // ── Description — format with paragraph awareness ──
        if (descLines.length > 0) {
            let desc = descLines.join('\n').trim();
            desc = this.enhanceContent(desc);
            desc = this.formatKeywordDescription(desc);
            desc = this.balanceCodeFences(desc);
            const maxLen = this.config.maxContentLength;
            if (desc.length > maxLen) desc = this.smartTruncate(desc, maxLen);
            md.appendMarkdown(`${desc}\n\n`);
        }

        // ── Examples ──
        if (exampleLines.length > 0) {
            const ex = exampleLines.join('\n').trim();
            if (ex) {
                md.appendMarkdown(`---\n\n**$(play) Example**\n\n`);
                const exLines = ex.split('\n');
                const preview = exLines.slice(0, 8).join('\n');
                md.appendMarkdown('```python\n' + preview + '\n```\n\n');
                if (exLines.length > 8) {
                    md.appendMarkdown(`*+${exLines.length - 8} more lines in docs*\n\n`);
                }
            }
        }

        // ── See Also — render as inline code chips ──
        if (seeAlsoText.trim()) {
            this.renderKeywordSeeAlso(md, seeAlsoText);
        }
    }

    /**
     * Format keyword description text with visual structure:
     * - Detect inline Python code examples and wrap in code blocks
     * - Break wall-of-text into readable paragraphs
     * - Highlight key phrases
     */
    private formatKeywordDescription(text: string): string {
        const lines = text.split('\n');
        const result: string[] = [];
        let inCodeBlock = false;
        const codeBuffer: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Detect Python-like code lines (assignments, function calls, class defs, etc.)
            const isCodeLine = this.looksLikePythonCode(trimmed);

            if (isCodeLine && !inCodeBlock) {
                // Start a code block
                inCodeBlock = true;
                codeBuffer.length = 0;
                codeBuffer.push(trimmed);
            } else if (inCodeBlock && (isCodeLine || trimmed === '' || /^\s{2,}/.test(line))) {
                // Continue code block (code line, blank line within code, or indented continuation)
                if (trimmed === '' && i + 1 < lines.length && !this.looksLikePythonCode(lines[i + 1].trim())) {
                    // Blank line followed by non-code — end the code block
                    result.push('```python\n' + codeBuffer.join('\n') + '\n```');
                    inCodeBlock = false;
                    result.push('');
                } else {
                    codeBuffer.push(trimmed);
                }
            } else if (inCodeBlock) {
                // End code block
                result.push('```python\n' + codeBuffer.join('\n') + '\n```');
                inCodeBlock = false;
                result.push(trimmed);
            } else {
                result.push(line);
            }
        }

        // Flush any remaining code block
        if (inCodeBlock && codeBuffer.length > 0) {
            result.push('```python\n' + codeBuffer.join('\n') + '\n```');
        }

        return result.join('\n');
    }

    /**
     * Heuristic: does this line look like a Python code example?
     */
    private looksLikePythonCode(line: string): boolean {
        if (!line || line.length < 3) return false;
        // Python prompts
        if (/^>>>/.test(line) || /^\.\.\.\s/.test(line)) return true;
        // Common code patterns: class/def/for/if/with/import/from/try/return/raise/yield/assert + space
        if (/^(?:class|def|for|if|elif|else:|while|with|import|from|try:|except|finally:|return|raise|yield|assert|pass|break|continue|del|lambda)\s/.test(line)) return true;
        if (/^(?:else|try|finally|pass|break|continue):?\s*$/.test(line)) return true;
        // Assignment: `x = ...`, `foo.bar = ...`
        if (/^[a-zA-Z_]\w*(?:\.\w+)*\s*=[^=]/.test(line)) return true;
        // Function call on its own line: `print(...)`, `foo.bar(...)`
        if (/^[a-zA-Z_]\w*(?:\.\w+)*\(/.test(line) && line.endsWith(')')) return true;
        // Decorator
        if (/^@\w+/.test(line)) return true;
        return false;
    }

    /**
     * Render See Also as visually clean keyword chips instead of run-on text.
     */
    private renderKeywordSeeAlso(md: vscode.MarkdownString, raw: string): void {
        md.appendMarkdown(`---\n\n`);
        let sa = raw.trim()
            .replace(/\b(?!PEP)[A-Z]{3,}\b/g, '')
            .replace(/\s+/g, ' ').trim();

        // Extract PEP references
        const peps: string[] = [];
        sa = sa.replace(/\*{0,2}PEP\s*(\d+)\*{0,2}/gi, (_, n) => {
            peps.push(`[PEP ${n}](https://peps.python.org/pep-${n}/)`);
            return '';
        });

        // Split remaining into individual keyword/topic tokens
        const keywords = sa
            .replace(/[,;]+/g, ' ')
            .split(/\s+/)
            .map(s => s.replace(/^[,.\s-]+|[,.\s-]+$/g, '').trim())
            .filter(s => s.length > 0 && s !== 'and' && s !== 'the');

        const chips: string[] = [];
        for (const kw of keywords) chips.push(`\`${kw}\``);
        for (const pep of peps) chips.push(pep);

        if (chips.length > 0) {
            md.appendMarkdown(`$(link-external) **See also:** ${chips.join(' \u00a0 ')}\n\n`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────

    private renderParameters(md: vscode.MarkdownString, doc: HoverDoc): void {
        const params = doc.parameters!;
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`**$(list-unordered) Parameters**\n\n`);
        this.renderParameterList(md, params);
    }

    private renderParameterList(md: vscode.MarkdownString, params: HoverDoc['parameters']): void {
        if (!params) return;
        const maxItems = 8;
        params.slice(0, maxItems).forEach(p => {
            const typeStr = p.type ? ` \`${p.type}\`` : '';
            const defStr = p.default !== undefined ? ` = \`${p.default}\`` : '';
            md.appendMarkdown(`- **\`${p.name}\`**${typeStr}${defStr}`);
            if (p.description) md.appendMarkdown(` — ${p.description}`);
            md.appendMarkdown('\n');
        });
        if (params.length > maxItems) md.appendMarkdown(`\n*+${params.length - maxItems} more params — see docs*\n`);
        md.appendMarkdown('\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RETURNS / RAISES / EXAMPLES
    // ─────────────────────────────────────────────────────────────────────────

    private renderReturns(md: vscode.MarkdownString, doc: HoverDoc): void {
        const ret = doc.returns!;
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`**$(arrow-right) Returns** \`${ret.type || 'unspecified'}\``);
        if (ret.description) md.appendMarkdown(` — ${ret.description}`);
        md.appendMarkdown('\n\n');
    }

    private renderRaises(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`**$(alert) Raises**\n\n`);
        doc.raises!.forEach(exc => {
            md.appendMarkdown(`- \`${exc.type}\``);
            if (exc.description) md.appendMarkdown(` — ${exc.description}`);
            md.appendMarkdown('\n');
        });
        md.appendMarkdown('\n');
    }

    private renderExamples(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`---\n\n`);
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

        md.appendMarkdown(`---\n\n**$(symbol-field) Key exports**\n\n`);

        // Render exports as a clean wrapped list of code chips
        const maxShow = 20;
        const shown = exports.slice(0, maxShow);
        md.appendMarkdown(shown.map(n => `\`${n}\``).join(' \u00a0 ') + '\n\n');

        if (doc.exportCount && doc.exportCount > exports.length) {
            const args = this.encodeCommandArgs(doc.module || doc.title);
            md.appendMarkdown(
                `$(info) *${doc.exportCount.toLocaleString()} indexed symbols* \u00a0·\u00a0 ` +
                `[$(symbol-namespace) Browse all](<command:python-hover.browseModule?${args}> "Browse all symbols")\n\n`
            );
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEE ALSO
    // ─────────────────────────────────────────────────────────────────────────

    private renderSeeAlso(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown(`---\n\n`);
        const items = doc.seeAlso!.map(s => {
            // Wrap bare symbol names in backticks if not already formatted
            const trimmed = s.trim();
            if (/^[a-zA-Z_]\w*(?:\.\w+)*$/.test(trimmed) && !trimmed.startsWith('`')) {
                return `\`${trimmed}\``;
            }
            return trimmed;
        });
        md.appendMarkdown(`$(link-external) **See also:** ${items.join(' \u00a0·\u00a0 ')}\n\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────────────────────────────────

    private renderFooter(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown('---\n\n');

        const parts: string[] = [];

        if (doc.signature) {
            // Use the no-arg command variant — the handler reads the last hover's signature
            // instead of embedding the full signature in the URI (which breaks markdown for
            // long signatures like FastAPI's 30-param constructors).
            parts.push(`[$(clippy) Copy sig](command:python-hover.copySignature "Copy signature")`);
        }
        if (doc.url) {
            parts.push(`[$(link-external) Copy URL](command:python-hover.copyUrl "Copy docs URL")`);
        }

        let version = this.config.docsVersion;
        if (version === 'auto') version = this.detectedVersion || '3';
        parts.push(`$(tag) *Python ${version}*`);

        // Source indicator
        if (doc.source && doc.source !== ResolutionSource.Local) {
            const srcLabel = this.getSourceLabel(doc.source);
            if (srcLabel) parts.push(`$(cloud) *${srcLabel}*`);
        }

        md.appendMarkdown(parts.join(' \u00a0·\u00a0 '));
    }

    private getSourceLabel(source: ResolutionSource): string | null {
        switch (source) {
            case ResolutionSource.DevDocs: return 'DevDocs';
            case ResolutionSource.Runtime: return 'runtime';
            case ResolutionSource.Static: return 'static';
            case ResolutionSource.Corpus: return 'corpus';
            default: return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SIGNATURE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private cleanSignature(sig: string): string {
        return sharedCleanSignature(sig);
    }

    private stripAnnotatedWrappers(sig: string): string {
        return stripAnnotatedWrappers(sig);
    }

    /**
     * Truncate a signature at a sensible boundary (closing paren or comma).
     */
    private truncateSignature(sig: string, maxLen: number): string {
        if (sig.length <= maxLen) return sig;

        // Find the last comma before maxLen
        let cut = sig.lastIndexOf(',', maxLen);
        if (cut < maxLen * 0.5) cut = maxLen; // if comma is too early, just cut

        const truncated = sig.substring(0, cut).trimEnd();
        // Count unclosed parens/brackets and close them
        let parens = 0, brackets = 0;
        for (const ch of truncated) {
            if (ch === '(') parens++;
            else if (ch === ')') parens--;
            else if (ch === '[') brackets++;
            else if (ch === ']') brackets--;
        }
        return truncated + ', …' + ']'.repeat(Math.max(0, brackets)) + ')'.repeat(Math.max(0, parens));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // URL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Encode a value as a command URI argument string.
     *
     * `encodeURIComponent` does not encode `(`, `)`, `'`, `!`, `*`, or `~`.
     * Un-encoded `)` inside a markdown link `[text](url)` terminates the URL
     * prematurely, breaking the link and exposing raw markdown text.  This
     * helper adds the extra encoding needed for command URI args.
     */
    private encodeCommandArgs(value: unknown): string {
        return encodeURIComponent(JSON.stringify(value))
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
            .replace(/'/g, '%27');
    }

    /**
     * Build a URL that opens in integrated side panel or external browser
     * based on the specified mode.
     */
    private buildLinkUrl(url: string, mode: 'integrated' | 'external'): string {
        const sanitized = this.sanitizeUrl(url);
        if (!sanitized.startsWith('http')) return sanitized;
        if (mode === 'external') {
            return sanitized; // VS Code will open http links in external browser
        }
        return `command:python-hover.openDocsSide?${this.encodeCommandArgs(sanitized)}`;
    }

    /**
     * Wraps an http(s) URL in the openDocsSide command so docs always open in
     * the persistent side panel (ViewColumn.Beside).
     */
    private buildDocsUrl(url: string): string {
        return this.buildLinkUrl(url, this.config.docsBrowser);
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

    /**
     * Format description paragraphs for better visual structure:
     * - Wrap inline Python code references in backticks
     * - Detect embedded code examples and format as code blocks
     * - Ensure proper paragraph breaks
     */
    private formatDescriptionParagraphs(content: string): string {
        // Wrap bare Python identifiers that look like references (e.g., "None", "True", etc.)
        // but only if not already in backticks or code blocks
        const pyBuiltins = /(?<![`\w])\b(None|True|False|NotImplemented|Ellipsis|__\w+__)\b(?![`\w])/g;
        content = content.replace(pyBuiltins, '`$1`');

        // Detect lines that look like standalone code and wrap them
        const lines = content.split('\n');
        const result: string[] = [];
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip lines already inside fenced code blocks
            if (trimmed.startsWith('```')) {
                result.push(line);
                i++;
                while (i < lines.length && !lines[i].trim().startsWith('```')) {
                    result.push(lines[i]);
                    i++;
                }
                if (i < lines.length) { result.push(lines[i]); i++; }
                else { result.push('```'); } // Close unclosed code fence
                continue;
            }

            // Detect Python code examples in prose (>>> prompts, assignments, etc.)
            if (this.looksLikePythonCode(trimmed) && !trimmed.startsWith('$(') && !trimmed.startsWith('**')) {
                const codeLines: string[] = [trimmed];
                i++;
                while (i < lines.length) {
                    const next = lines[i].trim();
                    if (this.looksLikePythonCode(next) || /^\.\.\./.test(next) ||
                        (next === '' && i + 1 < lines.length && this.looksLikePythonCode(lines[i + 1]?.trim()))) {
                        codeLines.push(next);
                        i++;
                    } else break;
                }
                // Only wrap if not a single short token that might be inline
                if (codeLines.length > 1 || codeLines[0].length > 30) {
                    result.push('```python\n' + codeLines.join('\n') + '\n```');
                } else {
                    result.push(line);
                }
                continue;
            }

            result.push(line);
            i++;
        }

        return result.join('\n');
    }

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
        return sharedCleanRstArtifacts(text);
    }

    private cleanPydocDump(text: string): string {
        return sharedCleanPydocDump(text);
    }

    private cleanContentAnnotations(text: string): string {
        return sharedCleanContentAnnotations(text);
    }

    /**
     * Ensure code fences are balanced so an unclosed fence in content
     * doesn't swallow the rest of the hover (toolbar, footer, etc.).
     */
    private balanceCodeFences(text: string): string {
        const fences = text.match(/^`{3,}/gm);
        if (fences && fences.length % 2 !== 0) {
            text += '\n```\n';
        }
        return text;
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

    // ─────────────────────────────────────────────────────────────────────────
    // NOTE: VS Code hover sanitizer strips ALL style/class attributes from HTML.
    // Only standard Markdown, $(icon) codicons, and unstyled HTML tags work.
    // Do NOT add inline CSS — it will be silently removed.
    // ─────────────────────────────────────────────────────────────────────────
}

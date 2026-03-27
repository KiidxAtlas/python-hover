import * as vscode from 'vscode';
import { HoverDoc, ResolutionSource, StructuredHoverSection } from '../../../shared/types';
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

        const compact = this.config.compactMode;

        if (doc.signature && this.config.showSignatures) {
            this.renderSignature(md, doc);
        }

        this.renderCallouts(md, doc);
        this.renderDescription(md, doc);

        if (!compact) {
            if (doc.parameters && doc.parameters.length > 0 && this.config.showParameters) {
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

            if (doc.seeAlso && doc.seeAlso.length > 0 && this.config.showSeeAlso) {
                this.renderSeeAlso(md, doc);
            }
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

        md.appendMarkdown(`### $(${icon}) \`${rawTitle}\`\n\n`);

        const chips: string[] = [];
        const kindLabel = this.formatKindLabel(doc.kind);
        chips.push(`\`${kindLabel}\``);

        if (doc.source === ResolutionSource.Local) {
            chips.push(`$(home) local`);
        } else {
            const sourceLabel = this.getSourceLabel(doc.source);
            if (sourceLabel) {
                chips.push(`$(${this.getSourceIcon(doc.source)}) ${sourceLabel}`);
            }
            if (doc.url) {
                try {
                    const host = new URL(doc.url).hostname.replace(/^www\./, '');
                    if (host.includes('docs.python.org')) {
                        chips.push(`$(book) Python docs`);
                    } else if (host) {
                        chips.push(`$(book) ${host}`);
                    }
                } catch { /* skip */ }
            }
        }

        if (doc.module && doc.module !== 'builtins' && doc.kind !== 'module') {
            chips.push(`$(symbol-namespace) ${doc.module}`);
        }

        if (doc.badges) {
            if (this.config.showBadges) {
                for (const badge of doc.badges) {
                    chips.push(`$(${this.getBadgeIcon(badge.label)}) ${badge.label}`);
                }
            }
        }

        if (doc.installedVersion && doc.kind !== 'module') {
            chips.push(`$(versions) v${doc.installedVersion}`);
        }

        if (doc.license && doc.source !== ResolutionSource.Local) {
            chips.push(`$(law) ${doc.license}`);
        }
        if (doc.requiresPython && doc.source !== ResolutionSource.Local) {
            chips.push(`$(arrow-circle-up) py${doc.requiresPython}`);
        }

        md.appendMarkdown(chips.join(' \u00a0·\u00a0 ') + '\n\n');
    }
    // ─────────────────────────────────────────────────────────────────────────
    // TOOLBAR  — actions bar, always directly under the header
    // ─────────────────────────────────────────────────────────────────────────

    private renderToolbar(md: vscode.MarkdownString, doc: HoverDoc): void {
        const primary: string[] = [];
        const secondary: string[] = [];
        const commandToken = this.getCommandToken(doc);

        primary.push(this.buildCommandLink('$(pin) Pin', 'python-hover.pinHover', commandToken, 'Pin this hover'));

        if (this.config.showDebugPinButton) {
            primary.push(this.buildCommandLink('$(debug-alt-small) Debug', 'python-hover.debugPinHover', commandToken, 'Pin this hover and open a debug view'));
        }

        if (doc.source === ResolutionSource.Local) {
            primary.push(`[$(go-to-file) Go to def](command:editor.action.revealDefinition "Jump to definition")`);
        }

        if (doc.url) {
            const docsLink = this.buildLinkUrl(doc.url, this.config.docsBrowser);
            secondary.push(`[$(book) Docs](<${docsLink}> "Open official documentation")`);
        }

        const devdocsUrl = doc.devdocsUrl;
        if (devdocsUrl) {
            const ddLink = this.buildLinkUrl(devdocsUrl, this.config.devdocsBrowser);
            secondary.push(`[$(search-view-icon) DevDocs](<${ddLink}> "Search DevDocs")`);
        }

        const sourceUrl = doc.sourceUrl || doc.links?.source;
        if (sourceUrl) {
            const sourceLink = this.buildLinkUrl(sourceUrl, this.config.docsBrowser);
            secondary.push(`[$(source-control) Source](<${sourceLink}> "Open source or reference page")`);
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
        md.appendMarkdown(`**$(code) Signature**\n\n`);
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
        if (doc.badges?.some(b => /^deprecated$/i.test(b.label))) {
            md.appendMarkdown(`> $(error) **Deprecated** — check the documentation for the recommended alternative\n\n`);
        }
        if (doc.latestVersion && doc.installedVersion && this.config.showUpdateWarning && this.isOutdated(doc.installedVersion, doc.latestVersion)) {
            md.appendMarkdown(`> $(arrow-up) **Update available:** v${doc.installedVersion} → v${doc.latestVersion}\n\n`);
        }
        if (doc.protocolHints && doc.protocolHints.length > 0) {
            doc.protocolHints.forEach(h => md.appendMarkdown(`> $(lightbulb) *${h}*\n\n`));
        }
        if (doc.notes && doc.notes.length > 0) {
            doc.notes.forEach(n => md.appendMarkdown(`> $(info) ${n}\n\n`));
        }
    }

    private isOutdated(installed: string, latest: string): boolean {
        if (installed === latest) return false;
        const parse = (v: string) => v.replace(/^[^0-9]*/, '').split('.').map(Number);
        const [iMaj = 0, iMin = 0, iPatch = 0] = parse(installed);
        const [lMaj = 0, lMin = 0, lPatch = 0] = parse(latest);
        if (lMaj !== iMaj) return lMaj > iMaj;
        if (lMin !== iMin) return lMin > iMin;
        return lPatch > iPatch;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DESCRIPTION
    // ─────────────────────────────────────────────────────────────────────────

    private renderDescription(md: vscode.MarkdownString, doc: HoverDoc): void {
        let content = doc.summary || doc.content;
        if (!content) return;

        if (doc.kind?.toLowerCase() === 'keyword') {
            if (doc.structuredContent?.sections?.length) {
                if (this.renderStructuredDescription(md, doc)) {
                    return;
                }
            }
            this.renderKeywordContent(md, content);
            return;
        }

        if (doc.structuredContent?.sections?.length) {
            if (this.renderStructuredDescription(md, doc)) {
                return;
            }
        }

        this.renderVersionCompatibility(md, content);

        content = this.cleanPydocDump(content);
        content = this.cleanRstArtifacts(content);
        content = this.cleanContentAnnotations(content);
        if (!content.trim()) return;

        content = this.enhanceContent(content);
        content = this.formatDescriptionParagraphs(content);
        content = this.balanceCodeFences(content);

        // compactMode: truncate to just the first sentence (up to first `. ` or `.\n`).
        const maxLen = this.config.compactMode
            ? Math.min(200, this.config.maxContentLength)
            : this.config.maxContentLength;
        const wasTruncated = content.length > maxLen;
        if (wasTruncated) {
            content = this.smartTruncate(content, maxLen);
        }

        md.appendMarkdown(`${this.rewriteMarkdownLinks(content)}\n\n`);

        if (wasTruncated && doc.url) {
            const moreUrl = this.buildLinkUrl(doc.url, this.config.docsBrowser);
            md.appendMarkdown(
                `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
            );
        }
    }

    private renderStructuredDescription(md: vscode.MarkdownString, doc: HoverDoc): boolean {
        const sections = this.getVisibleStructuredDescriptionSections(doc);
        if (sections.length === 0) return false;

        const blocks = sections
            .filter(section => !this.isDuplicateSignatureSection(section, doc.signature))
            .map(section => this.renderStructuredSection(section))
            .filter(Boolean);
        if (blocks.length === 0) return false;
        const maxLen = this.config.maxContentLength;
        let remaining = maxLen;
        let wasTruncated = false;

        this.renderVersionCompatibility(md, blocks.join('\n\n'));

        for (let index = 0; index < blocks.length; index++) {
            const block = this.balanceCodeFences(blocks[index]);
            const separatorLength = index > 0 ? 2 : 0;
            const visibleLength = this.visibleMarkdownLength(block) + separatorLength;

            if (visibleLength > remaining) {
                wasTruncated = true;
                break;
            }

            if (index > 0) {
                md.appendMarkdown('\n\n');
            }
            md.appendMarkdown(block);
            remaining -= visibleLength;
        }

        md.appendMarkdown('\n\n');

        if (wasTruncated && doc.url) {
            const moreUrl = this.buildLinkUrl(doc.url, this.config.docsBrowser);
            md.appendMarkdown(
                `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
            );
        }

        return true;
    }

    private renderStructuredSection(section: StructuredHoverSection): string {
        const title = section.title ? `**${this.escapeMarkdown(section.title)}**\n\n` : '';

        if (section.kind === 'code') {
            const language = section.language || 'python';
            return `${title}\`\`\`${language}\n${section.content.trim()}\n\`\`\``;
        }

        if (section.kind === 'list') {
            const items = (section.items ?? [])
                .map(item => this.enhanceContent(this.cleanContentAnnotations(this.cleanRstArtifacts(item)).trim()))
                .filter(Boolean);
            if (items.length === 0) return '';
            return this.rewriteMarkdownLinks(`${title}${items.map(item => `- ${item}`).join('\n')}`);
        }

        let text = section.content;
        text = this.cleanPydocDump(text);
        text = this.cleanRstArtifacts(text);
        text = this.cleanContentAnnotations(text);
        text = this.enhanceContent(text);
        text = section.kind === 'note' ? text : this.formatDescriptionParagraphs(text);
        text = this.balanceCodeFences(text).trim();
        if (!text) return '';

        if (section.role === 'summary') {
            return this.rewriteMarkdownLinks(`> $(book) ${text.replace(/\n/g, '\n> ')}`);
        }

        return this.rewriteMarkdownLinks(section.kind === 'note'
            ? `> $(info) ${text.replace(/\n/g, '\n> ')}`
            : `${title}${text}`);
    }

    private getVisibleStructuredDescriptionSections(doc: HoverDoc): StructuredHoverSection[] {
        const sourceSections = doc.structuredContent?.sections ?? [];
        const sections: StructuredHoverSection[] = [];
        const grammarSections: StructuredHoverSection[] = [];
        let currentField: 'parameters' | 'returns' | 'raises' | undefined;

        for (const section of sourceSections) {
            if (section.role === 'example' || section.role === 'note' || section.kind === 'note') {
                continue;
            }

            const nextField = this.getStructuredFieldKind(section.title);
            if (nextField) {
                currentField = nextField;
            } else if (section.title) {
                currentField = undefined;
            }

            if (currentField === 'parameters' && doc.parameters?.length) continue;
            if (currentField === 'returns' && doc.returns) continue;
            if (currentField === 'raises' && doc.raises?.length) continue;

            // Grammar / syntax definition blocks (e.g. `yield_stmt: yield_expression`) are
            // deferred to the end so the human-readable explanation comes first.
            if (
                section.kind === 'code'
                && (section.language === 'text' || !section.language)
                && (section.content?.includes('::=') || section.title === 'Syntax')
            ) {
                grammarSections.push(section);
                continue;
            }

            sections.push(section);
        }

        return [...sections, ...grammarSections];
    }

    private getStructuredFieldKind(title?: string): 'parameters' | 'returns' | 'raises' | undefined {
        if (!title) return undefined;
        if (/^(?:Parameters|Args|Arguments)$/i.test(title)) return 'parameters';
        if (/^Returns?$/i.test(title)) return 'returns';
        if (/^Raises?$/i.test(title)) return 'raises';
        return undefined;
    }

    private isDuplicateSignatureSection(section: StructuredHoverSection, signature?: string): boolean {
        if (section.kind !== 'code' || !signature) return false;

        const sectionCode = section.content.trim();
        const normalizedSignature = this.normalizeDisplaySignature(signature).trim();
        if (!sectionCode || !normalizedSignature) return false;

        const firstLine = sectionCode.split('\n').map(line => line.trim()).find(Boolean) ?? '';
        return firstLine === normalizedSignature || sectionCode === normalizedSignature;
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
        const parsed = this.parseKeywordContent(content);
        const keywordMaxLen = Math.max(this.config.maxContentLength * 2, 1800);
        let remaining = keywordMaxLen;
        let renderedExample = false;
        let wasTruncated = false;

        for (const block of parsed.blocks) {
            if (block.kind === 'syntax') {
                md.appendMarkdown(`**$(code) Syntax**\n\n`);
                md.appendCodeblock(block.content, 'python');
                continue;
            }

            if (block.kind === 'version') {
                const versionText = this.enhanceKeywordInlineText(block.content);
                if (versionText) {
                    md.appendMarkdown(`> ${versionText}\n\n`);
                }
                continue;
            }

            if (block.kind === 'code') {
                md.appendMarkdown(`---\n\n**$(play) ${renderedExample ? 'Additional example' : 'Example'}**\n\n`);
                const lines = block.content.split('\n');
                const maxLines = Math.max(this.config.maxSnippetLines, 10);
                if (lines.length > maxLines) {
                    md.appendCodeblock(lines.slice(0, maxLines).join('\n'), 'python');
                    md.appendMarkdown(`*+${lines.length - maxLines} more lines in docs*\n\n`);
                } else {
                    md.appendCodeblock(block.content, 'python');
                }
                renderedExample = true;
                continue;
            }

            if (remaining <= 0) {
                wasTruncated = true;
                break;
            }

            let text = this.formatKeywordParagraph(block.content);
            if (!text) {
                continue;
            }

            const visibleLength = this.visibleMarkdownLength(text);

            if (visibleLength > remaining) {
                text = this.smartTruncate(this.toVisibleMarkdownText(text), remaining);
                remaining = 0;
                wasTruncated = true;
            } else {
                remaining -= visibleLength;
            }

            md.appendMarkdown(`${this.rewriteMarkdownLinks(text)}\n\n`);
        }

        if (wasTruncated && !parsed.seeAlso.length && remaining <= 0) {
            md.appendMarkdown(`*More details are available in the official docs.*\n\n`);
        }

        if (parsed.seeAlso.length > 0) {
            this.renderKeywordSeeAlso(md, parsed.seeAlso.join(', '));
        }
    }

    private parseKeywordContent(content: string): {
        blocks: Array<{ kind: 'syntax' | 'paragraph' | 'code' | 'version'; content: string }>;
        seeAlso: string[];
    } {
        const lines = content.split('\n');
        const blocks: Array<{ kind: 'syntax' | 'paragraph' | 'code' | 'version'; content: string }> = [];
        const seeAlso: string[] = [];
        let index = 0;

        while (index < lines.length) {
            const trimmed = lines[index].trim();

            if (!trimmed) {
                index += 1;
                continue;
            }

            if (this.isKeywordTitleLine(trimmed)) {
                index += 1;
                if (index < lines.length && /^\*+$/.test(lines[index].trim())) {
                    index += 1;
                }
                continue;
            }

            if (/^(?:See also|Related help topics?):?\s*/i.test(trimmed)) {
                const related = trimmed.replace(/^(?:See also|Related help topics?):?\s*/i, '');
                if (related) {
                    seeAlso.push(...related.split(',').map(item => item.trim()).filter(Boolean));
                }
                index += 1;
                continue;
            }

            if (/^Examples?:?\s*$/i.test(trimmed)) {
                index += 1;
                continue;
            }

            const indent = lines[index].search(/\S/);
            if (indent >= 3) {
                const blockLines: string[] = [];
                while (index < lines.length) {
                    const line = lines[index];
                    const currentTrimmed = line.trim();
                    const currentIndent = line.search(/\S/);
                    if (!currentTrimmed) {
                        if (blockLines.length > 0) break;
                        index += 1;
                        continue;
                    }
                    if (currentIndent < 3) break;
                    blockLines.push(line.replace(/^\s{3}/, ''));
                    index += 1;
                }

                const blockText = blockLines.join('\n').trimEnd();
                if (blockText) {
                    blocks.push({
                        kind: this.isKeywordSyntaxBlock(blockText) ? 'syntax' : 'code',
                        content: blockText,
                    });
                }
                continue;
            }

            const paragraphLines: string[] = [];
            while (index < lines.length) {
                const line = lines[index];
                const currentTrimmed = line.trim();
                const currentIndent = line.search(/\S/);
                if (!currentTrimmed) break;
                if (currentIndent >= 3) break;
                if (/^(?:See also|Related help topics?):?\s*/i.test(currentTrimmed)) break;
                paragraphLines.push(currentTrimmed);
                index += 1;
            }

            const paragraph = paragraphLines.join(' ').replace(/\s+/g, ' ').trim();
            if (!paragraph || /^\*+$/.test(paragraph)) {
                continue;
            }

            blocks.push({
                kind: /^(?:Changed|New|Added|Deprecated) in version\s+/i.test(paragraph) ? 'version' : 'paragraph',
                content: paragraph,
            });
        }

        return {
            blocks,
            seeAlso: [...new Set(seeAlso)],
        };
    }

    private isKeywordTitleLine(line: string): boolean {
        return /^The\s+["'][^"']+["']\s+(?:statement|expression|clause)$/i.test(line);
    }

    private isKeywordSyntaxBlock(block: string): boolean {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) return false;
        if (lines[0].includes('::=')) return true;
        if (/^[a-z][a-z0-9_]+:\s+["[(]/.test(lines[0])) return true;
        return lines.every(line => /^[\[\](){|}"'\s\w:.*,+-]+$/.test(line) && !this.looksLikePythonCode(line));
    }

    private formatKeywordParagraph(text: string): string {
        let formatted = this.cleanPydocDump(text);
        formatted = this.cleanRstArtifacts(formatted);
        formatted = this.cleanContentAnnotations(formatted);
        formatted = this.enhanceKeywordInlineText(formatted);
        return formatted.trim();
    }

    private enhanceKeywordInlineText(text: string): string {
        let formatted = this.enhanceContent(text);
        formatted = formatted.replace(/"([A-Za-z_][A-Za-z0-9_().-]*)"/g, (_match, inner) => `\`${inner}\``);
        formatted = formatted.replace(/'([A-Za-z_][A-Za-z0-9_().-]*)'/g, (_match, inner) => `\`${inner}\``);
        formatted = formatted.replace(/\b([A-Za-z_][A-Za-z0-9_]*_stmt)\b/g, '`$1`');
        formatted = formatted.replace(/\b([A-Za-z_][A-Za-z0-9_]*_list)\b/g, '`$1`');
        formatted = formatted.replace(/\b(range\(\d+\)|range\(\))\b/g, '`$1`');
        formatted = formatted.replace(/\s+/g, ' ');
        return formatted.trim();
    }

    /**
     * Format keyword description text with visual structure:
     * - Detect inline Python code examples and wrap in code blocks
     * - Break wall-of-text into readable paragraphs
     * - Highlight key phrases
     */
    private formatKeywordDescription(text: string): string {
        const lines = text.split('\n');
        const blocks: string[] = [];
        let paragraph: string[] = [];
        let codeBlock: string[] = [];
        let previousMeaningful = '';

        const flushParagraph = () => {
            if (paragraph.length === 0) return;
            blocks.push(paragraph.join('\n'));
            paragraph = [];
        };

        const flushCodeBlock = () => {
            if (codeBlock.length === 0) return;
            blocks.push('```python\n' + codeBlock.join('\n') + '\n```');
            codeBlock = [];
        };

        for (const line of lines) {
            const trimmed = line.trim();
            const isIndented = /^\s{2,}\S/.test(line);

            if (!trimmed) {
                flushCodeBlock();
                flushParagraph();
                continue;
            }

            if (codeBlock.length > 0) {
                if (isIndented || this.looksLikePythonCode(trimmed)) {
                    codeBlock.push(trimmed);
                    previousMeaningful = trimmed;
                    continue;
                }
                flushCodeBlock();
            }

            if (isIndented && this.isKeywordCodeIntro(previousMeaningful)) {
                flushParagraph();
                codeBlock.push(trimmed);
                previousMeaningful = trimmed;
                continue;
            }

            if (/^\d+\.\s+/.test(trimmed)) {
                flushParagraph();
                paragraph.push(trimmed);
                previousMeaningful = trimmed;
                continue;
            }

            if (isIndented && paragraph.length > 0) {
                const last = paragraph[paragraph.length - 1];
                paragraph[paragraph.length - 1] = /^\d+\.\s+/.test(last)
                    ? `${last} ${trimmed}`
                    : `${last} ${trimmed}`;
                previousMeaningful = trimmed;
                continue;
            }

            if (this.isKeywordParagraphBoundary(trimmed)) {
                flushParagraph();
                paragraph.push(trimmed);
                previousMeaningful = trimmed;
                continue;
            }

            if (paragraph.length === 0) {
                paragraph.push(trimmed);
            } else {
                paragraph[paragraph.length - 1] = `${paragraph[paragraph.length - 1]} ${trimmed}`;
            }
            previousMeaningful = trimmed;
        }

        flushCodeBlock();
        flushParagraph();
        return blocks.join('\n\n');
    }

    private isKeywordCodeIntro(line: string): boolean {
        return /(?:The following code:|is semantically equivalent to:|For example:|equivalent to:)$/.test(line);
    }

    private isKeywordParagraphBoundary(line: string): boolean {
        return /^(?:Changed|New|Added) in version\s+/i.test(line)
            || /^Note:?$/i.test(line)
            || /^With more than one item/i.test(line)
            || /^The execution of /i.test(line)
            || /^The following code:/i.test(line)
            || /^is semantically equivalent to:/i.test(line)
            || /^You can also write /i.test(line);
    }

    /**
     * Heuristic: does this line look like a Python code example?
     */
    private looksLikePythonCode(line: string): boolean {
        if (!line || line.length < 3) return false;
        // Python prompts
        if (/^>>>/.test(line) || /^\.\.\.\s/.test(line)) return true;
        // Common code patterns with enough syntax to distinguish from prose.
        if (/^(?:class|def|for|if|elif|while)\s/.test(line)) return true;
        if (/^with\s.+:\s*$/.test(line)) return true;
        if (/^import\s+[A-Za-z_]/.test(line)) return true;
        if (/^from\s+[A-Za-z_.]+\s+import\s+/.test(line)) return true;
        if (/^(?:try:|except\b.*:|finally:|assert\s|pass$|break$|continue$|del\s|lambda\b)/.test(line)) return true;
        if (/^(?:return|raise|yield)\s+[A-Za-z_([{]/.test(line)) return true;
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
        let normalized = raw.replace(/\s+/g, ' ').trim();

        const peps = [...normalized.matchAll(/\*{0,2}PEP\s*(\d+)\*{0,2}/gi)]
            .map(match => `[PEP ${match[1]}](https://peps.python.org/pep-${match[1]}/)`);

        const relatedMatch = normalized.match(/Related help topics:\s*(.+)$/i);
        const relatedTopics = relatedMatch?.[1]
            ?.split(',')
            .map(topic => topic.trim())
            .filter(Boolean)
            .map(topic => `\`${topic}\``) ?? [];

        normalized = normalized
            .replace(/^See also:\s*/i, '')
            .replace(/Related help topics:\s*.+$/i, '')
            .replace(/\*{0,2}PEP\s*\d+\*{0,2}\s*-?\s*/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        const parts: string[] = [];
        if (peps.length > 0) {
            parts.push(peps.join(' \u00a0·\u00a0 '));
        }
        if (normalized) {
            parts.push(normalized);
        }
        if (parts.length > 0) {
            md.appendMarkdown(`$(link-external) **See also:** ${this.rewriteMarkdownLinks(parts.join(' — '))}\n\n`);
        }
        if (relatedTopics.length > 0) {
            md.appendMarkdown(`$(symbol-key) **Related:** ${relatedTopics.join(' \u00a0·\u00a0 ')}\n\n`);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARAMETERS
    // ─────────────────────────────────────────────────────────────────────────

    private renderParameters(md: vscode.MarkdownString, doc: HoverDoc): void {
        const params = doc.parameters!;
        md.appendMarkdown(`---\n\n`);
        md.appendMarkdown(`**$(list-unordered) Parameters**\n\n`);
        this.renderParameterTable(md, params);
    }

    private renderParameterTable(md: vscode.MarkdownString, params: HoverDoc['parameters']): void {
        if (!params) return;
        const maxItems = this.config.maxParameters;
        const rows = params.slice(0, maxItems).map(p => {
            const name = `\`${this.escapeTableCell(p.name)}\`${p.default !== undefined ? ` = \`${this.escapeTableCell(p.default)}\`` : ''}`;
            const type = p.type ? `\`${this.escapeTableCell(this.cleanContentAnnotations(p.type))}\`` : '—';
            const description = p.description
                ? this.escapeTableCell(this.cleanContentAnnotations(this.cleanRstArtifacts(p.description)).replace(/\s+/g, ' ').trim())
                : '—';
            return `| ${name} | ${type} | ${description} |`;
        });

        md.appendMarkdown('| Name | Type | Details |\n');
        md.appendMarkdown('| --- | --- | --- |\n');
        md.appendMarkdown(rows.join('\n') + '\n\n');

        if (params.length > maxItems) {
            md.appendMarkdown(`*+${params.length - maxItems} more parameters in docs*\n\n`);
        }
    }

    private escapeTableCell(value: string): string {
        return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
    }

    private buildImportStatement(doc: HoverDoc): string | undefined {
        if (doc.source === ResolutionSource.Local) return undefined;
        const rawTitle = doc.title.replace(/^builtins\./, '');
        if (!rawTitle || /^__\w+__$/.test(rawTitle)) return undefined;
        if (doc.kind === 'module') {
            return (!rawTitle || rawTitle === 'builtins') ? undefined : `import ${rawTitle}`;
        }
        if (!doc.module || doc.module === 'builtins') return undefined;
        const shortName = rawTitle.split('.').pop() || rawTitle;
        return `from ${doc.module} import ${shortName}`;
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

        const structuredExamples = doc.structuredContent?.sections?.filter(
            section => section.role === 'example',
        ) ?? [];

        if (structuredExamples.length > 0) {
            const maxShow = 2;
            structuredExamples.slice(0, maxShow).forEach((section, index) => {
                this.renderStructuredExampleSection(md, section, index);
            });

            if (structuredExamples.length > maxShow) {
                const extra = structuredExamples.length - maxShow;
                md.appendMarkdown(`*+${extra} more example${extra > 1 ? 's' : ''} in docs*\n\n`);
            }
            return;
        }

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

    private renderStructuredExampleSection(
        md: vscode.MarkdownString,
        section: StructuredHoverSection,
        index: number,
    ): void {
        if (section.title) {
            md.appendMarkdown(`*${this.escapeMarkdown(section.title)}*\n\n`);
        } else if (index > 0) {
            md.appendMarkdown(`*Additional example*\n\n`);
        }

        if (section.kind === 'code') {
            const lines = section.content.split('\n');
            const maxLines = this.config.maxSnippetLines;
            if (lines.length > maxLines) {
                md.appendCodeblock(lines.slice(0, maxLines).join('\n'), section.language || 'python');
                md.appendMarkdown(`*+${lines.length - maxLines} more lines in docs*\n\n`);
            } else {
                md.appendCodeblock(section.content, section.language || 'python');
            }
            return;
        }

        const rendered = this.renderStructuredSection(section);
        if (rendered) {
            md.appendMarkdown(`${rendered}\n\n`);
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
        md.appendMarkdown(`$(link-external) **See also:** ${this.rewriteMarkdownLinks(items.join(' \u00a0·\u00a0 '))}\n\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FOOTER
    // ─────────────────────────────────────────────────────────────────────────

    private renderFooter(md: vscode.MarkdownString, doc: HoverDoc): void {
        md.appendMarkdown('---\n\n');

        const parts: string[] = [];
        const commandToken = this.getCommandToken(doc);

        if (doc.signature) {
            parts.push(this.buildCommandLink('$(clippy) Copy sig', 'python-hover.copySignature', commandToken, 'Copy signature'));
        }
        if (doc.url) {
            parts.push(this.buildCommandLink('$(link-external) Copy URL', 'python-hover.copyUrl', commandToken, 'Copy docs URL'));
        }
        const importStatement = this.buildImportStatement(doc);
        if (importStatement) {
            parts.push(this.buildCommandLink('$(symbol-namespace) Copy import', 'python-hover.copyImport', importStatement, `Copy: ${importStatement}`));
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

    private getSourceIcon(source: ResolutionSource): string {
        switch (source) {
            case ResolutionSource.Corpus: return 'database';
            case ResolutionSource.Static: return 'book';
            case ResolutionSource.Runtime: return 'pulse';
            case ResolutionSource.DevDocs: return 'search-view-icon';
            default: return 'book';
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

    private escapeMarkdown(text: string): string {
        return text.replace(/([\\`*_{}\[\]()#+\-.!|])/g, '\\$1');
    }

    private getCommandToken(doc: HoverDoc): string | undefined {
        return typeof doc.metadata?.commandToken === 'string'
            ? doc.metadata.commandToken
            : undefined;
    }

    private buildCommandLink(label: string, command: string, arg: unknown, title: string): string {
        if (arg === undefined || arg === null || arg === '') {
            return `[${label}](command:${command} "${title}")`;
        }
        return `[${label}](command:${command}?${this.encodeCommandArgs(arg)} "${title}")`;
    }

    private rewriteMarkdownLinks(content: string): string {
        return content.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, rawUrl: string) => {
            const linked = this.buildLinkUrl(rawUrl, this.config.docsBrowser);
            return `[${label}](<${linked}>)`;
        });
    }

    private toVisibleMarkdownText(content: string): string {
        return content
            .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
            .replace(/`([^`]+)`/g, '$1');
    }

    private visibleMarkdownLength(content: string): number {
        return this.toVisibleMarkdownText(content).length;
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

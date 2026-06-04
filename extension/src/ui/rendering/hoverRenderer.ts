import {
  HoverDoc,
  ResolutionSource,
  StructuredHoverSection,
} from "#shared/types";
import { Config } from "#src/config";
import { RegularHoverSectionId } from "#src/hover/hoverLayout";
import { isActiveParameterMatch } from "#src/hover/parameterLens";
import { Logger } from "#src/logger";
import {
  buildSavedDocEntry,
  getSavedDocModuleTarget,
} from "#src/state/savedDocs";
import {
  cleanContent as sharedCleanContent,
  cleanContentAnnotations as sharedCleanContentAnnotations,
  cleanPydocDump as sharedCleanPydocDump,
  cleanRstArtifacts as sharedCleanRstArtifacts,
  cleanSignature as sharedCleanSignature,
} from "#src/ui/rendering/contentCleaner";
import {
  buildCopyableSignature,
  buildDescriptionContent,
  buildImportStatement,
  getDisplayParameters,
  getDisplayTitle,
  getRequiredPythonVersion,
  getStructuredExampleSections,
  getVisibleStructuredDescriptionSections,
  getVisibleStructuredNoteSections,
  isMeaningfullyOutdated,
} from "#src/ui/rendering/docPresentation";
import { HOVER_MARKDOWN_COMMANDS } from "#src/ui/webview/webviewCommandAllowlist";
import * as vscode from "vscode";

export class HoverRenderer {
  private detectedVersion: string | undefined;

  constructor(private config: Config) {}

  setDetectedVersion(version: string) {
    this.detectedVersion = version;
  }

  render(doc: HoverDoc): vscode.Hover {
    const md = new vscode.MarkdownString();
    md.isTrusted = {
      enabledCommands: HOVER_MARKDOWN_COMMANDS,
    };
    md.supportThemeIcons = true;

    this.renderHeader(md, doc);
    if (this.config.showToolbar) {
      this.renderToolbar(md, doc);
    }

    const compact = this.config.compactMode;

    if (doc.kind === "module") {
      if (doc.signature && this.config.showSignatures) {
        this.renderSignature(md, doc);
      }
      if (doc.parameterLens && this.config.showParameterLens) {
        this.renderParameterLens(md, doc);
      }
      if (this.config.showCallouts) {
        this.renderCallouts(md, doc);
      }
      this.renderModuleOverview(md, doc);
      this.renderDescription(md, doc);
      if (!compact) {
        if (
          doc.moduleExports &&
          doc.moduleExports.length > 0 &&
          this.config.showModuleExports
        ) {
          this.renderModuleExports(md, doc);
        }

        if (doc.seeAlso && doc.seeAlso.length > 0 && this.config.showSeeAlso) {
          this.renderSeeAlso(md, doc);
        }

        if (this.config.showNotes) {
          this.renderNotes(md, doc);
        }
      }
    } else if (doc.kind?.toLowerCase() === "keyword") {
      this.renderDescription(md, doc);
    } else {
      this.renderRegularHoverSections(md, doc, compact);
    }

    if (this.config.showFooter) {
      if (doc.kind === "module" || doc.kind?.toLowerCase() === "keyword") {
        this.renderFooter(md, doc);
      }
    }
    return new vscode.Hover(md);
  }

  private renderRegularHoverSections(
    md: vscode.MarkdownString,
    doc: HoverDoc,
    compact: boolean,
  ): void {
    const order = this.config.hoverSectionOrder;
    let hasRenderedSection = false;

    for (const sectionId of order) {
      if (!this.shouldRenderRegularHoverSection(sectionId, doc, compact)) {
        continue;
      }

      const fragment = this.buildRegularHoverSectionFragment(sectionId, doc);
      if (!fragment) {
        continue;
      }

      md.appendMarkdown(
        this.normalizeRegularHoverSectionFragment(
          fragment,
          !hasRenderedSection,
        ),
      );
      hasRenderedSection = true;
    }
  }

  private shouldRenderRegularHoverSection(
    sectionId: RegularHoverSectionId,
    doc: HoverDoc,
    compact: boolean,
  ): boolean {
    switch (sectionId) {
      case "signature":
        return !!doc.signature && this.config.showSignatures;
      case "parameterLens":
        return !!doc.parameterLens && this.config.showParameterLens;
      case "callouts":
        return this.config.showCallouts && this.hasRenderableCallouts(doc);
      case "description":
        return this.config.showDescription && !!buildDescriptionContent(doc);
      case "parameters":
        return (
          !compact &&
          this.config.showParameters &&
          (doc.parameters?.length ?? 0) > 0
        );
      case "returns":
        return !compact && this.config.showReturnTypes && !!doc.returns;
      case "raises":
        return (
          !compact && this.config.showRaises && (doc.raises?.length ?? 0) > 0
        );
      case "examples":
        return (
          !compact &&
          this.config.showPracticalExamples &&
          ((doc.examples?.length ?? 0) > 0 ||
            getStructuredExampleSections(doc).length > 0)
        );
      case "seeAlso":
        return (
          !compact && this.config.showSeeAlso && (doc.seeAlso?.length ?? 0) > 0
        );
      case "notes":
        return (
          !compact &&
          this.config.showNotes &&
          getVisibleStructuredNoteSections(doc).length > 0
        );
      case "footer":
        return (
          this.config.showFooter &&
          doc.kind !== "module" &&
          doc.kind?.toLowerCase() !== "keyword"
        );
    }
  }

  private buildRegularHoverSectionFragment(
    sectionId: RegularHoverSectionId,
    doc: HoverDoc,
  ): string | undefined {
    const temp = new vscode.MarkdownString();
    temp.isTrusted = {
      enabledCommands: HOVER_MARKDOWN_COMMANDS,
    };
    temp.supportThemeIcons = true;

    switch (sectionId) {
      case "signature":
        this.renderSignature(temp, doc);
        break;
      case "parameterLens":
        this.renderParameterLens(temp, doc);
        break;
      case "callouts":
        this.renderCallouts(temp, doc);
        break;
      case "description":
        this.renderDescription(temp, doc);
        break;
      case "parameters":
        this.renderParameters(temp, doc);
        break;
      case "returns":
        this.renderReturns(temp, doc);
        break;
      case "raises":
        this.renderRaises(temp, doc);
        break;
      case "examples":
        this.renderExamples(temp, doc);
        break;
      case "seeAlso":
        this.renderSeeAlso(temp, doc);
        break;
      case "notes":
        this.renderNotes(temp, doc);
        break;
      case "footer":
        this.renderFooter(temp, doc);
        break;
    }

    const fragment = temp.value.trim();
    return fragment ? `${fragment}\n\n` : undefined;
  }

  private normalizeRegularHoverSectionFragment(
    fragment: string,
    isFirst: boolean,
  ): string {
    if (!isFirst) {
      return fragment;
    }

    return fragment.replace(/^(?:---\n\n)+/, "");
  }

  private hasRenderableCallouts(doc: HoverDoc): boolean {
    return Boolean(
      doc.badges?.some((b) => /^deprecated$/i.test(b.label)) ||
      (doc.latestVersion &&
        doc.installedVersion &&
        this.config.showUpdateWarning &&
        isMeaningfullyOutdated(doc.installedVersion, doc.latestVersion)) ||
      (getRequiredPythonVersion(doc) && this.detectedVersion) ||
      (doc.protocolHints?.length ?? 0) > 0,
    );
  }
  // ─────────────────────────────────────────────────────────────────────────
  // HEADER  — title + compact badge row
  // ─────────────────────────────────────────────────────────────────────────

  private renderHeader(md: vscode.MarkdownString, doc: HoverDoc): void {
    const icon = this.getIconForKind(doc.kind);
    const rawTitle = getDisplayTitle(doc.title);

    // If we have a signature for a method, prefer showing the method name
    // qualified by its owner type/module (e.g. `str.split`) instead of only
    // showing the owner (`str`). This improves clarity when hovering on
    // built-in methods where the HoverDoc title is the owner type.
    let displayTitle = rawTitle;
    if (doc.signature) {
      const m = doc.signature.match(
        /^\s*(?:def\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
      );
      if (m) {
        const fn = m[1];
        if (rawTitle && rawTitle !== fn) {
          displayTitle = `${rawTitle}.${fn}`;
        } else {
          displayTitle = fn;
        }
      }
    }

    md.appendMarkdown(`### $(${icon}) \`${displayTitle}\`\n\n`);

    const breadcrumb = this.buildBreadcrumb(doc);
    if (breadcrumb) {
      md.appendMarkdown(`$(symbol-namespace) ${breadcrumb}\n\n`);
    }

    if (doc.contextHints?.tags?.length) {
      md.appendMarkdown(
        `$(sparkle) Context: ${doc.contextHints.tags
          .map((tag) => `\`${this.escapeMarkdown(tag)}\``)
          .join(" · ")}\n\n`,
      );
    }

    const headerDetails = [
      ...(this.config.showProvenance ? this.getProvenanceItems(doc) : []),
      ...(this.config.showMetadataChips ? this.buildMetadataChips(doc) : []),
    ];

    if (headerDetails.length > 0) {
      md.appendMarkdown(headerDetails.join(" \u00a0·\u00a0 ") + "\n\n");
    }
  }
  // ─────────────────────────────────────────────────────────────────────────
  // TOOLBAR  — actions bar, always directly under the header
  // ─────────────────────────────────────────────────────────────────────────

  private renderToolbar(md: vscode.MarkdownString, doc: HoverDoc): void {
    const { primaryActions } = this.buildActionGroups(doc);

    if (primaryActions.length === 0) {
      return;
    }

    md.appendMarkdown(`*Quick actions:* ${primaryActions.join("  ·  ")}\n\n`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNATURE
  // ─────────────────────────────────────────────────────────────────────────

  private renderSignature(md: vscode.MarkdownString, doc: HoverDoc): void {
    const inferredOverloads = this.extractInlineOverloads(doc.signature);
    const overloads =
      doc.overloads && doc.overloads.length > 1
        ? doc.overloads
        : inferredOverloads.length > 1
          ? inferredOverloads
          : undefined;

    if (overloads && overloads.length > 1) {
      md.appendMarkdown(`**$(symbol-method) Overloads**\n\n`);
      const maxShow = 3;
      overloads
        .slice(0, maxShow)
        .forEach((o) =>
          this.renderSignatureEntry(
            md,
            this.normalizeDisplaySignature(o),
            true,
          ),
        );
      if (overloads.length > maxShow) {
        const extra = overloads.length - maxShow;
        md.appendMarkdown(
          `*+${extra} more overload${extra > 1 ? "s" : ""} — see docs*\n\n`,
        );
      } else {
        md.appendMarkdown("\n");
      }
    } else {
      let sig = this.normalizeDisplaySignature(doc.signature!);
      if (sig.startsWith("(")) {
        const title = getDisplayTitle(doc.title);
        sig = `${title}${sig}`;
      }
      const MAX_SIG_LEN = 400;
      if (sig.length > MAX_SIG_LEN) {
        sig = this.truncateSignature(sig, MAX_SIG_LEN);
      }
      md.appendMarkdown(`**$(symbol-method) Signature**\n\n`);
      this.renderSignatureEntry(md, sig, false);
    }
  }

  private extractInlineOverloads(signature: string | undefined): string[] {
    if (!signature) {
      return [];
    }

    const trimmed = signature.trim();
    if (!trimmed) {
      return [];
    }

    const split = trimmed
      .split(/\n\s*\n(?=(?:async\s+def|def|class)\s+[A-Za-z_][A-Za-z0-9_]*)/)
      .map((part) => part.trim())
      .filter(Boolean);

    return split;
  }

  private renderSignatureEntry(
    md: vscode.MarkdownString,
    signature: string,
    asListItem: boolean,
  ): void {
    if (asListItem) {
      md.appendMarkdown(`*Variant*\n\n`);
    }
    md.appendCodeblock(signature, "python");
    md.appendMarkdown("\n");
  }

  /**
   * Strip Pylance-style `(kind) ` prefixes and normalize whitespace so we never
   * render `str.upper(method) str.upper() -> str` when the title is already the qualname.
   */
  private normalizeDisplaySignature(raw: string): string {
    const withoutKind = raw.replace(/^\([a-z][a-z0-9_]*\)\s+/i, "").trim();
    return this.cleanSignature(withoutKind);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CALLOUTS  (protocol hints, notes)
  // ─────────────────────────────────────────────────────────────────────────

  private renderCallouts(md: vscode.MarkdownString, doc: HoverDoc): void {
    if (doc.badges?.some((b) => /^deprecated$/i.test(b.label))) {
      md.appendMarkdown(
        `$(error) **Deprecated** — check the documentation for the recommended alternative\n\n`,
      );
    }
    if (
      doc.latestVersion &&
      doc.installedVersion &&
      this.config.showUpdateWarning &&
      isMeaningfullyOutdated(doc.installedVersion, doc.latestVersion)
    ) {
      md.appendMarkdown(
        `$(arrow-up) **Update available:** v${doc.installedVersion} → v${doc.latestVersion}\n\n`,
      );
      md.appendMarkdown(
        `$(diff) **Version diff hint:** behavior or parameter semantics may differ across these versions; check release notes before copying examples unchanged.\n\n`,
      );
    }
    const requiredVersion = getRequiredPythonVersion(doc);
    if (
      requiredVersion &&
      this.detectedVersion &&
      this.isVersionBelow(this.detectedVersion, requiredVersion)
    ) {
      md.appendMarkdown(
        `$(warning) **Requires Python ${requiredVersion}+** — your runtime is Python ${this.detectedVersion}\n\n`,
      );
    }
    if (doc.protocolHints && doc.protocolHints.length > 0) {
      doc.protocolHints.forEach((h) =>
        md.appendMarkdown(`$(lightbulb) *${h}*\n\n`),
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DESCRIPTION
  // ─────────────────────────────────────────────────────────────────────────

  private renderDescription(md: vscode.MarkdownString, doc: HoverDoc): void {
    let content = buildDescriptionContent(doc);
    if (!content) {
      // No combined summary/content available — if we have a docs URL, at least
      // offer a quick link so the user can jump to the canonical docs page.
      if (doc.url) {
        const moreUrl = this.buildPreferredDocsLink(doc);
        md.appendMarkdown(`**$(book) Overview**\n\n`);
        md.appendMarkdown(
          `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
        );
        Logger.debug(
          "HoverRenderer: no description content; showing docs link",
          { title: doc.title, url: doc.url },
        );
      }
      return;
    }

    if (doc.kind?.toLowerCase() !== "keyword") {
      md.appendMarkdown(`**$(book) Overview**\n\n`);
    }

    if (doc.kind?.toLowerCase() === "keyword") {
      // Use a single renderer path for keyword content to avoid duplicated
      // section headings and repeated grammar blocks from mixed structured/raw docs.
      this.renderKeywordContent(md, content, doc);
      return;
    }

    if (doc.structuredContent?.sections?.length) {
      if (this.renderStructuredDescription(md, doc)) {
        return;
      }
    }

    this.renderVersionCompatibility(md, content);

    content = this.cleanContent(content);
    if (!content.trim()) {
      return;
    }

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
      const moreUrl = this.buildPreferredDocsLink(doc);
      md.appendMarkdown(
        `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
      );
    }
  }

  private renderStructuredDescription(
    md: vscode.MarkdownString,
    doc: HoverDoc,
  ): boolean {
    const sections = getVisibleStructuredDescriptionSections(doc);
    if (sections.length === 0) {
      return false;
    }

    const blocks = sections
      .filter(
        (section) => !this.isDuplicateSignatureSection(section, doc.signature),
      )
      .map((section) => this.renderStructuredSection(section))
      .filter(Boolean);
    if (blocks.length === 0) {
      return false;
    }
    const maxLen = this.config.maxContentLength;
    let remaining = maxLen;
    let wasTruncated = false;

    this.renderVersionCompatibility(md, blocks.join("\n\n"));

    for (let index = 0; index < blocks.length; index++) {
      const block = this.balanceCodeFences(blocks[index]);
      const separatorLength = index > 0 ? 2 : 0;
      const visibleLength = this.visibleMarkdownLength(block) + separatorLength;

      if (visibleLength > remaining) {
        if (index === 0) {
          const truncated = this.smartTruncate(
            this.toVisibleMarkdownText(block),
            remaining,
          );
          if (truncated.trim()) {
            md.appendMarkdown(truncated);
            md.appendMarkdown("\n\n");
          }
        }
        wasTruncated = true;
        break;
      }

      if (index > 0) {
        md.appendMarkdown("\n\n");
      }
      md.appendMarkdown(block);
      remaining -= visibleLength;
    }

    md.appendMarkdown("\n\n");

    if (wasTruncated && doc.url) {
      const moreUrl = this.buildPreferredDocsLink(doc);
      md.appendMarkdown(
        `[$(book) Continue reading in documentation…](<${moreUrl}> "Open full documentation")\n\n`,
      );
    }

    return true;
  }

  private renderStructuredSection(section: StructuredHoverSection): string {
    const displayTitle = this.getStructuredSectionDisplayTitle(section);
    const title = displayTitle
      ? `**${this.escapeMarkdown(displayTitle)}**\n\n`
      : "";
    const isNoteSection = section.kind === "note" || section.role === "note";

    if (section.kind === "code") {
      const language = section.language || "python";
      const codeBlock = `\`\`\`${language}\n${section.content.trim()}\n\`\`\``;
      if (isNoteSection) {
        const label = displayTitle
          ? `$(info) **${this.escapeMarkdown(displayTitle)}**\n\n`
          : "$(info) **Note**\n\n";
        return `${label}${codeBlock}`;
      }
      return `${title}${codeBlock}`;
    }

    if (section.kind === "list") {
      const items = (section.items ?? [])
        .map((item) =>
          this.enhanceContent(
            this.cleanContentAnnotations(this.cleanRstArtifacts(item)).trim(),
          ),
        )
        .filter(Boolean);
      if (items.length === 0) {
        return "";
      }
      const listBody = items.map((item) => `- ${item}`).join("\n");
      if (isNoteSection) {
        const label = displayTitle
          ? `$(info) **${this.escapeMarkdown(displayTitle)}**\n\n`
          : "$(info) **Note**\n\n";
        return this.rewriteMarkdownLinks(`${label}${listBody}`);
      }
      return this.rewriteMarkdownLinks(`${title}${listBody}`);
    }

    let text = section.content;
    text = this.cleanPydocDump(text);
    text = this.cleanRstArtifacts(text);
    text = this.cleanContentAnnotations(text);
    text = this.enhanceContent(text);
    text =
      section.kind === "note" ? text : this.formatDescriptionParagraphs(text);
    text = this.balanceCodeFences(text).trim();
    if (!text) {
      return "";
    }

    if (section.role === "summary") {
      return this.rewriteMarkdownLinks(text);
    }

    if (isNoteSection) {
      const label = displayTitle
        ? `**${this.escapeMarkdown(displayTitle)}** — `
        : "$(info) **Note** — ";
      return this.rewriteMarkdownLinks(`${label}${text}`);
    }

    return this.rewriteMarkdownLinks(`${title}${text}`);
  }

  private getStructuredSectionDisplayTitle(
    section: StructuredHoverSection,
  ): string | undefined {
    if (!section.title) {
      return undefined;
    }
    if (section.role === "summary") {
      return undefined;
    }
    if (
      /^(?:overview|summary|description|details?)$/i.test(section.title.trim())
    ) {
      return undefined;
    }
    return section.title;
  }

  private isDuplicateSignatureSection(
    section: StructuredHoverSection,
    signature?: string,
  ): boolean {
    if (section.kind !== "code" || !signature) {
      return false;
    }

    const sectionCode = section.content.trim();
    const normalizedSignature =
      this.normalizeDisplaySignature(signature).trim();
    if (!sectionCode || !normalizedSignature) {
      return false;
    }

    const firstLine =
      sectionCode
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean) ?? "";
    return (
      firstLine === normalizedSignature || sectionCode === normalizedSignature
    );
  }

  private renderVersionCompatibility(
    md: vscode.MarkdownString,
    content: string,
  ): void {
    if (!this.detectedVersion) {
      return;
    }
    const match = content.match(/(?:New|Added) in version (\d+\.\d+)/i);
    if (!match) {
      return;
    }
    const [reqMaj, reqMin] = match[1].split(".").map(Number);
    const [userMaj, userMin] = this.detectedVersion.split(".").map(Number);
    if (
      (userMaj ?? 0) < (reqMaj ?? 0) ||
      ((userMaj ?? 0) === (reqMaj ?? 0) && (userMin ?? 0) < (reqMin ?? 0))
    ) {
      md.appendMarkdown(
        `$(warning) **Requires Python ${match[1]}+** — ` +
          `your runtime is Python ${this.detectedVersion}\n\n`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // KEYWORD  (pydoc content renderer)
  // ─────────────────────────────────────────────────────────────────────────

  private renderKeywordContent(
    md: vscode.MarkdownString,
    content: string,
    doc: HoverDoc,
  ): void {
    const parsed = this.parseKeywordContent(content);
    const keywordMaxLen = Math.max(this.config.maxContentLength * 2, 1800);
    let remaining = keywordMaxLen;
    let wasTruncated = false;
    const overviewBlocks: string[] = [];
    const versionBlocks: string[] = [];
    const syntaxBlocks: string[] = [];
    const exampleBlocks: string[] = [];

    for (const block of parsed.blocks) {
      if (block.kind === "syntax") {
        syntaxBlocks.push(this.normalizeKeywordSyntaxBlock(block.content));
        continue;
      }

      if (block.kind === "version") {
        const versionText = this.enhanceKeywordInlineText(block.content);
        if (versionText) {
          versionBlocks.push(versionText);
        }
        continue;
      }

      if (block.kind === "code") {
        exampleBlocks.push(block.content);
        continue;
      }

      if (remaining <= 0) {
        wasTruncated = true;
        break;
      }

      // Run grammar extraction on raw content before formatting so that
      // "funcdef: ..." isn't already bold-escaped into "**funcdef**:" when we
      // try to detect it.
      const inlineExtracted = this.extractInlineKeywordSyntax(block.content);
      if (inlineExtracted) {
        if (inlineExtracted.overviewPrefix) {
          const prefixText = this.formatKeywordParagraph(
            inlineExtracted.overviewPrefix,
          );
          if (prefixText) {
            overviewBlocks.push(this.rewriteMarkdownLinks(prefixText));
          }
        }
        syntaxBlocks.push(
          this.normalizeKeywordSyntaxBlock(inlineExtracted.syntax),
        );
        if (inlineExtracted.overviewSuffix) {
          const suffixText = this.formatKeywordParagraph(
            inlineExtracted.overviewSuffix,
          );
          if (suffixText) {
            overviewBlocks.push(this.rewriteMarkdownLinks(suffixText));
          }
        }
        continue;
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

      overviewBlocks.push(this.rewriteMarkdownLinks(text));
    }

    if (overviewBlocks.length > 0) {
      md.appendMarkdown(`**$(book) Overview**\n\n`);
      md.appendMarkdown(`${overviewBlocks.join("\n\n")}\n\n`);
    }

    if (versionBlocks.length > 0) {
      md.appendMarkdown(`---\n\n`);
      for (const line of versionBlocks) {
        md.appendMarkdown(`> ${line}\n\n`);
      }
    }

    if (syntaxBlocks.length > 0) {
      md.appendMarkdown(`---\n\n**$(code) Syntax**\n\n`);
      const maxSyntaxLines = Math.max(this.config.maxSnippetLines, 12);
      syntaxBlocks.forEach((syntax, index) => {
        const lines = syntax.split("\n");
        if (lines.length > maxSyntaxLines) {
          md.appendCodeblock(
            lines.slice(0, maxSyntaxLines).join("\n"),
            "python",
          );
          md.appendMarkdown(
            `*+${lines.length - maxSyntaxLines} more grammar lines in docs*\n\n`,
          );
        } else {
          md.appendCodeblock(syntax, "python");
          md.appendMarkdown("\n");
        }
        if (index < syntaxBlocks.length - 1) {
          md.appendMarkdown(`*Additional grammar block*\n\n`);
        }
      });
    }

    if (exampleBlocks.length > 0) {
      exampleBlocks.forEach((example, index) => {
        md.appendMarkdown(
          `---\n\n**$(play) ${index === 0 ? "Example" : "Additional example"}**\n\n`,
        );
        const lines = example.split("\n");
        const maxLines = Math.max(this.config.maxSnippetLines, 10);
        if (lines.length > maxLines) {
          md.appendCodeblock(lines.slice(0, maxLines).join("\n"), "python");
          md.appendMarkdown(
            `*+${lines.length - maxLines} more lines in docs*\n\n`,
          );
        } else {
          md.appendCodeblock(example, "python");
          md.appendMarkdown("\n");
        }
      });
    }

    if (wasTruncated && !parsed.seeAlso.length && remaining <= 0) {
      md.appendMarkdown(
        `*More details are available in the official docs.*\n\n`,
      );
    }

    if (parsed.seeAlso.length > 0) {
      this.renderKeywordSeeAlso(md, parsed.seeAlso.join(", "), doc);
    }
  }

  private parseKeywordContent(content: string): {
    blocks: Array<{
      kind: "syntax" | "paragraph" | "code" | "version";
      content: string;
    }>;
    seeAlso: string[];
  } {
    const lines = content.split("\n");
    const blocks: Array<{
      kind: "syntax" | "paragraph" | "code" | "version";
      content: string;
    }> = [];
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
        const related = trimmed.replace(
          /^(?:See also|Related help topics?):?\s*/i,
          "",
        );
        if (related) {
          const parts = related.includes(",")
            ? related.split(",")
            : related.split(/\s+/);
          seeAlso.push(...parts.map((item) => item.trim()).filter(Boolean));
        }
        index += 1;
        continue;
      }

      if (/^Examples?:?\s*$/i.test(trimmed)) {
        index += 1;
        continue;
      }

      if (this.isKeywordSyntaxStart(trimmed)) {
        const blockLines: string[] = [trimmed];
        index += 1;

        while (index < lines.length) {
          const nextLine = lines[index];
          const nextTrimmed = nextLine.trim();
          if (!nextTrimmed) {
            break;
          }
          // Keep collecting consecutive grammar rules even when they are
          // left-aligned (e.g. funcdef:, decorators:, parameter_list: ...)
          if (
            !this.isKeywordSyntaxContinuation(nextLine) &&
            !this.isKeywordSyntaxStart(nextTrimmed)
          ) {
            break;
          }
          blockLines.push(nextLine.replace(/^\s+/, ""));
          index += 1;
        }

        blocks.push({ kind: "syntax", content: blockLines.join("\n") });
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
            if (blockLines.length > 0) {
              break;
            }
            index += 1;
            continue;
          }
          if (currentIndent < 3) {
            break;
          }
          blockLines.push(line.replace(/^\s{3}/, ""));
          index += 1;
        }

        const blockText = blockLines.join("\n").trimEnd();
        if (blockText) {
          blocks.push({
            kind: this.isKeywordSyntaxBlock(blockText) ? "syntax" : "code",
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
        if (!currentTrimmed) {
          break;
        }
        if (currentIndent >= 3) {
          break;
        }
        if (/^(?:See also|Related help topics?):?\s*/i.test(currentTrimmed)) {
          break;
        }
        // Stop prose capture when a grammar rule starts so it can be rendered
        // as a syntax block on the next outer iteration.
        if (this.isKeywordSyntaxStart(currentTrimmed)) {
          break;
        }
        paragraphLines.push(currentTrimmed);
        index += 1;
      }

      const paragraph = paragraphLines.join(" ").replace(/\s+/g, " ").trim();
      if (!paragraph || /^\*+$/.test(paragraph)) {
        continue;
      }

      const inlineSyntax = this.extractInlineKeywordSyntax(paragraph);
      if (inlineSyntax) {
        if (inlineSyntax.overviewPrefix) {
          blocks.push({
            kind: /^(?:(?:Changed|New|Added|Deprecated) in version|Deprecated since version)\s+/i.test(
              inlineSyntax.overviewPrefix,
            )
              ? "version"
              : "paragraph",
            content: inlineSyntax.overviewPrefix,
          });
        }

        blocks.push({
          kind: "syntax",
          content: inlineSyntax.syntax,
        });

        if (inlineSyntax.overviewSuffix) {
          blocks.push({
            kind: "paragraph",
            content: inlineSyntax.overviewSuffix,
          });
        }
        continue;
      }

      blocks.push({
        kind: /^(?:(?:Changed|New|Added|Deprecated) in version|Deprecated since version)\s+/i.test(
          paragraph,
        )
          ? "version"
          : "paragraph",
        content: paragraph,
      });
    }

    return {
      blocks,
      seeAlso: [...new Set(seeAlso)],
    };
  }

  private isKeywordTitleLine(line: string): boolean {
    return /^The\s+["'][^"']+["']\s+(?:statement|expression|clause)$/i.test(
      line,
    );
  }

  private isKeywordSyntaxStart(line: string): boolean {
    return (
      line.includes("::=") ||
      /^`?[a-z][a-z0-9_]*(?:_stmt|_expr|_clause|_list)?`?\s*:\s*/.test(line)
    );
  }

  private extractInlineKeywordSyntax(paragraph: string): {
    overviewPrefix?: string;
    syntax: string;
    overviewSuffix?: string;
  } | null {
    const startIndex = this.findInlineRuleStart(paragraph);
    if (startIndex === -1) {
      return null;
    }

    const prefix = paragraph.slice(0, startIndex).trim();
    let fragment = paragraph.slice(startIndex).trim();

    // Avoid hijacking ordinary prose with colon usage.
    if (!this.looksLikeGrammarRuleFragment(fragment)) {
      return null;
    }

    // Normalize backticked rule names and split consecutive inline rules onto
    // separate lines so code blocks are readable.
    fragment = fragment
      .replace(/`([a-z][a-z0-9_]*(?:_[a-z0-9_]+)*)`\s*:/g, "$1:")
      .replace(/\s+(?=`?[a-z][a-z0-9_]*(?:_[a-z0-9_]+)*`?\s*:)/g, "\n")
      .trim();

    const lines = fragment
      .split("\n")
      .map((line) => this.normalizeInlineKeywordSyntaxLine(line.trim()))
      .filter(Boolean);

    const syntaxLines: string[] = [];
    const suffixLines: string[] = [];
    let inSuffix = false;

    for (const line of lines) {
      const looksRule = this.looksLikeGrammarRuleLine(line);
      if (!inSuffix && looksRule) {
        syntaxLines.push(this.stripRuleNameBackticks(line));
        continue;
      }
      inSuffix = true;
      suffixLines.push(line);
    }

    const syntax = syntaxLines.join("\n").trim();
    if (!syntax) {
      return null;
    }

    return {
      overviewPrefix: prefix || undefined,
      syntax,
      overviewSuffix: suffixLines.join(" ").trim() || undefined,
    };
  }

  private isKeywordSyntaxContinuation(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed) {
      return false;
    }
    if (trimmed.includes("::=")) {
      return true;
    }
    // Accept indented continuation lines
    if (line.search(/\S/) >= 1) {
      return (
        this.isGrammarTokenLine(trimmed) && !this.looksLikePythonCode(trimmed)
      );
    }
    // Also accept unindented lines that look like grammar tokens (no Python code patterns,
    // only grammar characters — brackets, quotes, identifiers, pipes, colons)
    // This catches lines like: defparameter ("," defparameter)* ["," ["/"] ...]
    return (
      this.isGrammarTokenLine(trimmed) &&
      !this.looksLikePythonCode(trimmed) &&
      // Must contain grammar-like tokens (brackets or quotes or pipes) to avoid capturing prose
      /[()[\]{}|"']/.test(trimmed)
    );
  }

  private isKeywordSyntaxBlock(block: string): boolean {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      return false;
    }
    if (lines[0].includes("::=")) {
      return true;
    }
    if (/^[a-z][a-z0-9_]+:\s+["[(]/.test(lines[0])) {
      return true;
    }
    return lines.every(
      (line) =>
        this.isGrammarTokenLine(line) && !this.looksLikePythonCode(line),
    );
  }

  private findInlineRuleStart(paragraph: string): number {
    for (let i = 0; i < paragraph.length; i++) {
      if (paragraph[i] !== ":") {
        continue;
      }

      let j = i - 1;
      while (j >= 0 && /\s/.test(paragraph[j])) {
        j--;
      }
      if (j < 0) {
        continue;
      }

      const endsBacktick = paragraph[j] === "`";
      if (endsBacktick) {
        j--;
      }

      let start = j;
      while (start >= 0 && /[a-z0-9_]/.test(paragraph[start])) {
        start--;
      }
      start++;

      if (start > j) {
        continue;
      }

      const token = paragraph.slice(start, j + 1);
      if (!this.isRuleToken(token)) {
        continue;
      }

      const boundary = start === 0 || /\s/.test(paragraph[start - 1]);
      if (!boundary) {
        continue;
      }

      if (endsBacktick && (start - 1 < 0 || paragraph[start - 1] !== "`")) {
        continue;
      }

      return endsBacktick ? start - 1 : start;
    }

    return -1;
  }

  private looksLikeGrammarRuleFragment(fragment: string): boolean {
    if (fragment.includes("::=")) {
      return true;
    }
    const colon = fragment.indexOf(":");
    if (colon <= 0) {
      return false;
    }
    const left = this.stripRuleNameBackticks(fragment.slice(0, colon)).trim();
    return this.isRuleToken(left);
  }

  private looksLikeGrammarRuleLine(line: string): boolean {
    if (line.includes("::=")) {
      return true;
    }
    const colon = line.indexOf(":");
    if (colon <= 0) {
      return false;
    }
    const left = this.stripRuleNameBackticks(line.slice(0, colon)).trim();
    return this.isRuleToken(left);
  }

  private stripRuleNameBackticks(line: string): string {
    return line.replace(/`([^`]+)`\s*:/g, "$1:");
  }

  private normalizeInlineKeywordSyntaxLine(line: string): string {
    // Some pydoc dumps include prose labels before grammar rules, e.g.
    // "object: for_stmt: ...". Preserve the actual grammar rule.
    const match = /^([a-z][a-z0-9_]*)\s*:\s*(`?[a-z][a-z0-9_]*`?\s*:.*)$/.exec(
      line,
    );
    if (!match) {
      return line;
    }

    const [, left, rest] = match;
    const restRuleMatch = /^`?([a-z][a-z0-9_]*)`?\s*:/.exec(rest);
    const restRule = restRuleMatch?.[1];
    const isLikelyProseLabel =
      !left.includes("_") &&
      Boolean(restRule) &&
      (restRule!.includes("_") ||
        /(?:stmt|expr|clause|list|def|item)$/.test(restRule!));

    return isLikelyProseLabel ? rest : line;
  }

  private normalizeKeywordSyntaxBlock(syntax: string): string {
    const lines = syntax
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return syntax;
    }

    // Drop a leading prose label line like "object:" when a real grammar rule follows.
    const first = lines[0];
    if (
      lines.length > 1 &&
      /^[a-z][a-z0-9_]*:\s*$/.test(first) &&
      !first.includes("_") &&
      this.looksLikeGrammarRuleLine(lines[1])
    ) {
      lines.shift();
    }

    return lines.join("\n");
  }

  private isRuleToken(token: string): boolean {
    if (!token || token[0] < "a" || token[0] > "z") {
      return false;
    }

    for (let i = 1; i < token.length; i++) {
      const ch = token[i];
      const isLower = ch >= "a" && ch <= "z";
      const isDigit = ch >= "0" && ch <= "9";
      if (!isLower && !isDigit && ch !== "_") {
        return false;
      }
    }

    return true;
  }

  private isGrammarTokenLine(line: string): boolean {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const isAlphaNum =
        (ch >= "a" && ch <= "z") ||
        (ch >= "A" && ch <= "Z") ||
        (ch >= "0" && ch <= "9");
      if (isAlphaNum || ch === "_" || ch === " " || ch === "\t") {
        continue;
      }
      if ("()[]{}|\"':.+*,-".includes(ch)) {
        continue;
      }
      return false;
    }
    return true;
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
    formatted = formatted.replace(
      /"([A-Za-z_][A-Za-z0-9_().-]*)"/g,
      (_match, inner) => `\`${inner}\``,
    );
    formatted = formatted.replace(
      /'([A-Za-z_][A-Za-z0-9_().-]*)'/g,
      (_match, inner) => `\`${inner}\``,
    );
    formatted = formatted.replace(/\b([A-Za-z_][A-Za-z0-9_]*_stmt)\b/g, "`$1`");
    formatted = formatted.replace(/\b([A-Za-z_][A-Za-z0-9_]*_list)\b/g, "`$1`");
    formatted = formatted.replace(/\b(range\(\d+\)|range\(\))\b/g, "`$1`");
    formatted = formatted.replace(/\s+/g, " ");
    return formatted.trim();
  }

  /**
   * Heuristic: does this line look like a Python code example?
   */
  private looksLikePythonCode(line: string): boolean {
    if (!line || line.length < 3) {
      return false;
    }
    // Python prompts
    if (/^>>>/.test(line) || /^\.\.\.\s/.test(line)) {
      return true;
    }
    // Common code patterns with enough syntax to distinguish from prose.
    if (/^(?:class|def|for|if|elif|while)\s/.test(line)) {
      return true;
    }
    if (/^with\s.+:\s*$/.test(line)) {
      return true;
    }
    if (/^import\s+[A-Za-z_]/.test(line)) {
      return true;
    }
    if (/^from\s+[A-Za-z_.]+\s+import\s+/.test(line)) {
      return true;
    }
    if (
      /^(?:try:|except\b.*:|finally:|assert\s|pass$|break$|continue$|del\s|lambda\b)/.test(
        line,
      )
    ) {
      return true;
    }
    if (/^(?:return|raise|yield)\s+[A-Za-z_([{]/.test(line)) {
      return true;
    }
    if (/^(?:else|try|finally|pass|break|continue):?\s*$/.test(line)) {
      return true;
    }
    // Assignment: `x = ...`, `foo.bar = ...`
    if (/^[a-zA-Z_]\w*(?:\.\w+)*\s*=[^=]/.test(line)) {
      return true;
    }
    // Function call on its own line: `print(...)`, `foo.bar(...)`
    if (/^[a-zA-Z_]\w*(?:\.\w+)*\(/.test(line) && line.endsWith(")")) {
      return true;
    }
    // Decorator
    if (/^@\w+/.test(line)) {
      return true;
    }
    return false;
  }

  /**
   * Render See Also as visually clean keyword chips instead of run-on text.
   */
  private renderKeywordSeeAlso(
    md: vscode.MarkdownString,
    raw: string,
    doc: HoverDoc,
  ): void {
    md.appendMarkdown(`---\n\n`);
    let normalized = raw.replace(/\s+/g, " ").trim();

    const peps = [...normalized.matchAll(/\*{0,2}PEP\s*(\d+)\*{0,2}/gi)].map(
      (match) =>
        this.renderInlineReferenceItem(
          `[PEP ${match[1]}](https://peps.python.org/pep-${match[1]}/)`,
          doc,
        ),
    );

    const relatedMatch = normalized.match(/Related help topics:\s*(.+)$/i);
    const relatedTopics =
      relatedMatch?.[1]
        ?.split(",")
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => this.renderInlineReferenceItem(topic, doc)) ?? [];

    normalized = normalized
      .replace(/^See also:\s*/i, "")
      .replace(/Related help topics:\s*.+$/i, "")
      .replace(/\*{0,2}PEP\s*\d+\*{0,2}\s*-?\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const parts: string[] = [];
    if (peps.length > 0) {
      parts.push(peps.join(" \u00a0·\u00a0 "));
    }
    if (normalized) {
      const tokens = normalized.split(/[,\s]+/).filter(Boolean);
      if (
        tokens.length > 0 &&
        tokens.every((token) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(token))
      ) {
        parts.push(
          tokens
            .map((token) => this.renderInlineReferenceItem(token, doc))
            .join(" \u00a0·\u00a0 "),
        );
      } else {
        parts.push(normalized);
      }
    }
    if (parts.length > 0) {
      md.appendMarkdown(
        `$(link-external) **See also:** ${this.rewriteMarkdownLinks(parts.join(" — "))}\n\n`,
      );
    }
    if (relatedTopics.length > 0) {
      md.appendMarkdown(
        `$(symbol-key) **Related:** ${relatedTopics.join(" \u00a0·\u00a0 ")}\n\n`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PARAMETERS
  // ─────────────────────────────────────────────────────────────────────────

  private renderParameters(md: vscode.MarkdownString, doc: HoverDoc): void {
    const params = getDisplayParameters(doc);
    if (params.length === 0) {
      return;
    }
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`**$(list-unordered) Parameters**\n\n`);
    this.renderParameterTable(md, params, doc);
  }

  private renderParameterTable(
    md: vscode.MarkdownString,
    params: HoverDoc["parameters"],
    doc: HoverDoc,
  ): void {
    if (!params) {
      return;
    }
    const maxItems = this.config.maxParameters;
    const rows = params.slice(0, maxItems).map((p, index) => {
      const active = isActiveParameterMatch(doc.parameterLens, p, index);
      const name = `\`${this.escapeTableCell(p.name)}\`${p.default !== undefined ? ` = \`${this.escapeTableCell(p.default)}\`` : ""}`;
      const type = p.type
        ? `\`${this.escapeTableCell(this.cleanContentAnnotations(p.type))}\``
        : "—";
      const baseDescription = p.description
        ? this.escapeTableCell(
            this.cleanContentAnnotations(this.cleanRstArtifacts(p.description))
              .replace(/\s+/g, " ")
              .trim(),
          )
        : "—";
      const description = active
        ? this.escapeTableCell(
            `Current argument${baseDescription !== "—" ? `. ${baseDescription}` : ""}`,
          )
        : baseDescription;
      return `| ${active ? `**${name}**` : name} | ${type} | ${description} |`;
    });

    md.appendMarkdown("| Name | Type | Details |\n");
    md.appendMarkdown("| --- | --- | --- |\n");
    md.appendMarkdown(rows.join("\n") + "\n\n");

    if (params.length > maxItems) {
      md.appendMarkdown(
        `*+${params.length - maxItems} more parameters in docs*\n\n`,
      );
    }
  }

  private renderParameterLens(md: vscode.MarkdownString, doc: HoverDoc): void {
    const lens = doc.parameterLens;
    if (!lens) {
      return;
    }

    const details: string[] = [
      `slot ${lens.parameterIndex + 1}/${lens.parameterCount}`,
    ];
    if (lens.parameter.type) {
      details.push(
        `type \`${this.escapeInlineCode(this.cleanContentAnnotations(lens.parameter.type))}\``,
      );
    }
    if (lens.parameter.default !== undefined) {
      details.push(
        `default \`${this.escapeInlineCode(lens.parameter.default)}\``,
      );
    }

    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(
      `**$(target) Active parameter** \`${this.escapeInlineCode(lens.parameter.name || lens.parameterLabel)}\``,
    );
    if (details.length > 0) {
      md.appendMarkdown(` — ${details.join(" \u00a0·\u00a0 ")}`);
    }
    md.appendMarkdown("\n\n");

    const lensSignature = this.normalizeDisplaySignature(lens.signature);
    const docSignature = doc.signature
      ? this.normalizeDisplaySignature(doc.signature)
      : undefined;
    if (!docSignature || docSignature !== lensSignature) {
      md.appendCodeblock(lensSignature, "python");
      md.appendMarkdown("\n");
    }

    const description = lens.parameter.description
      ? this.rewriteMarkdownLinks(
          this.enhanceContent(
            this.cleanContentAnnotations(
              this.cleanRstArtifacts(lens.parameter.description),
            )
              .replace(/\s+/g, " ")
              .trim(),
          ),
        )
      : undefined;
    if (description) {
      md.appendMarkdown(`${description}\n\n`);
    }

    if (lens.validation) {
      const icon =
        lens.validation.status === "valid"
          ? "check"
          : lens.validation.status === "warning"
            ? "warning"
            : "question";
      md.appendMarkdown(
        `$(${icon}) ${this.escapeMarkdown(lens.validation.message)}\n\n`,
      );
    }
  }

  private buildBreadcrumb(doc: HoverDoc): string | undefined {
    const title = getDisplayTitle(doc.title).trim();
    const modulePath = doc.module?.trim() || title;
    if (!modulePath.includes(".")) {
      return undefined;
    }

    const segments = modulePath.split(".").filter(Boolean);
    if (segments.length < 2) {
      return undefined;
    }

    const crumbs: string[] = [];
    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      const target = segments.slice(0, index + 1).join(".");
      const args = this.encodeCommandArgs(target);
      crumbs.push(
        `[${this.escapeMarkdown(segment)}](<command:python-hover.browseModule?${args}> "Browse ${this.escapeMarkdown(target)}")`,
      );
    }

    return crumbs.join(" → ");
  }

  private renderModuleOverview(md: vscode.MarkdownString, doc: HoverDoc): void {
    const importStatement = this.buildImportStatement(doc);
    const browseTarget = this.getModuleBrowseTarget(doc);

    if (importStatement) {
      md.appendMarkdown(
        `$(symbol-namespace) Import: \`${this.escapeMarkdown(importStatement)}\`\n\n`,
      );
    }

    if (
      (this.config.compactMode || !this.config.showModuleExports) &&
      doc.moduleExports &&
      doc.moduleExports.length > 0
    ) {
      const preview = doc.moduleExports
        .slice(0, 4)
        .map((name) => `\`${name}\``)
        .join(" \u00a0·\u00a0 ");
      const suffix =
        doc.moduleExports.length > 4
          ? ` \u00a0·\u00a0 +${doc.moduleExports.length - 4} more`
          : "";
      md.appendMarkdown(`$(symbol-field) ${preview}${suffix}\n\n`);
    }

    if (browseTarget) {
      const args = this.encodeCommandArgs(browseTarget);
      const countLabel = doc.exportCount
        ? ` ${doc.exportCount.toLocaleString()} indexed symbols`
        : " indexed symbols";
      md.appendMarkdown(
        `[$(symbol-namespace) Browse${countLabel}](<command:python-hover.browseModule?${args}> "Browse module symbols")\n\n`,
      );
    }
  }

  private escapeTableCell(value: string): string {
    return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
  }

  private buildImportStatement(doc: HoverDoc): string | undefined {
    return buildImportStatement(doc);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RETURNS / RAISES / EXAMPLES
  // ─────────────────────────────────────────────────────────────────────────

  private renderReturns(md: vscode.MarkdownString, doc: HoverDoc): void {
    const ret = doc.returns!;
    const cleanedDescription = ret.description
      ? this.rewriteMarkdownLinks(
          this.enhanceContent(
            this.cleanContentAnnotations(
              this.cleanRstArtifacts(ret.description),
            )
              .replace(/\s+/g, " ")
              .trim(),
          ),
        )
      : undefined;
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(
      `**$(arrow-right) Returns** \`${ret.type || "unspecified"}\``,
    );
    if (cleanedDescription) {
      md.appendMarkdown(` — ${cleanedDescription}`);
    }
    md.appendMarkdown("\n\n");
  }

  private renderRaises(md: vscode.MarkdownString, doc: HoverDoc): void {
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(`**$(alert) Raises**\n\n`);
    doc.raises!.forEach((exc) => {
      const cleanedDescription = exc.description
        ? this.rewriteMarkdownLinks(
            this.enhanceContent(
              this.cleanContentAnnotations(
                this.cleanRstArtifacts(exc.description),
              )
                .replace(/\s+/g, " ")
                .trim(),
            ),
          )
        : undefined;
      md.appendMarkdown(`- \`${exc.type}\``);
      if (cleanedDescription) {
        md.appendMarkdown(` — ${cleanedDescription}`);
      }
      md.appendMarkdown("\n");
    });
    md.appendMarkdown("\n");
  }

  private renderExamples(md: vscode.MarkdownString, doc: HoverDoc): void {
    md.appendMarkdown(`---\n\n`);
    md.appendMarkdown(
      `**$(play) Example${this.config.maxExamples > 1 ? "s" : ""}**\n\n`,
    );
    if (doc.contextHints?.tags?.length) {
      md.appendMarkdown(
        `*Context matched:* ${doc.contextHints.tags
          .map((tag) => `\`${this.escapeMarkdown(tag)}\``)
          .join(" · ")}\n\n`,
      );
    }

    const structuredExamples = getStructuredExampleSections(doc);
    const maxShow = this.config.maxExamples;

    if (structuredExamples.length > 0) {
      structuredExamples.slice(0, maxShow).forEach((section, index) => {
        this.renderStructuredExampleSection(md, section, index);
      });

      if (structuredExamples.length > maxShow) {
        const extra = structuredExamples.length - maxShow;
        md.appendMarkdown(
          `*+${extra} more example${extra > 1 ? "s" : ""} in docs*\n\n`,
        );
      }
      return;
    }

    doc.examples!.slice(0, maxShow).forEach((example, index) => {
      if (index > 0) {
        md.appendMarkdown(`*Additional example*\n\n`);
      }

      const lines = example.split("\n");
      const maxLines = this.config.maxSnippetLines;
      if (lines.length > maxLines) {
        md.appendCodeblock(lines.slice(0, maxLines).join("\n"), "python");
        md.appendMarkdown(
          `*+${lines.length - maxLines} more lines in docs*\n\n`,
        );
      } else {
        md.appendCodeblock(example, "python");
      }
    });

    if (doc.examples!.length > maxShow) {
      const extra = doc.examples!.length - maxShow;
      md.appendMarkdown(
        `*+${extra} more example${extra > 1 ? "s" : ""} in docs*\n\n`,
      );
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

    if (section.kind === "code") {
      const lines = section.content.split("\n");
      const maxLines = this.config.maxSnippetLines;
      if (lines.length > maxLines) {
        md.appendCodeblock(
          lines.slice(0, maxLines).join("\n"),
          section.language || "python",
        );
        md.appendMarkdown(
          `*+${lines.length - maxLines} more lines in docs*\n\n`,
        );
      } else {
        md.appendCodeblock(section.content, section.language || "python");
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

    md.appendMarkdown(`---\n\n**$(symbol-field) Key exports**\n\n`);

    const maxShow = this.config.maxModuleExports;
    const shown = exports.slice(0, maxShow);
    md.appendMarkdown(
      shown.map((name) => `\`${name}\``).join(" \u00a0 ") + "\n\n",
    );

    if (exports.length > maxShow) {
      const extra = exports.length - maxShow;
      md.appendMarkdown(
        `*+${extra} more export${extra > 1 ? "s" : ""} hidden*\n\n`,
      );
    }

    if (
      doc.kind !== "module" &&
      doc.exportCount &&
      doc.exportCount > exports.length
    ) {
      const browseTarget = this.getModuleBrowseTarget(doc);
      if (!browseTarget) {
        return;
      }
      const args = this.encodeCommandArgs(browseTarget);
      md.appendMarkdown(
        `[$(symbol-namespace) Browse all ${doc.exportCount.toLocaleString()} indexed symbols](<command:python-hover.browseModule?${args}> "Browse all symbols")\n\n`,
      );
    }
  }

  private getProvenanceItems(doc: HoverDoc): string[] {
    if (doc.source === ResolutionSource.Local) {
      return ["$(home) **Local symbol**"];
    }

    const sourceLabel = this.getSourceLabel(doc);
    const hostLabel = this.getDocHostLabel(doc);
    if (!sourceLabel && !hostLabel) {
      return [];
    }

    const parts: string[] = [];
    if (sourceLabel) {
      parts.push(`$(${this.getSourceIcon(doc)}) **${sourceLabel}**`);
    }
    if (hostLabel) {
      parts.push(`$(book) ${hostLabel}`);
    }
    return parts;
  }

  private getDocHostLabel(doc: HoverDoc): string | null {
    const candidateUrl = doc.url || doc.sourceUrl || doc.links?.source;
    if (!candidateUrl) {
      return null;
    }

    try {
      const host = new URL(candidateUrl).hostname.replace(/^www\./, "");
      if (!host) {
        return null;
      }
      return host === "docs.python.org" ? "Python docs" : host;
    } catch {
      return null;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  private renderSeeAlso(md: vscode.MarkdownString, doc: HoverDoc): void {
    md.appendMarkdown(`---\n\n`);
    const items = doc
      .seeAlso!.map((item) => this.renderInlineReferenceItem(item, doc))
      .filter(Boolean);
    const maxItems = this.config.maxSeeAlsoItems;
    const shown = items.slice(0, maxItems);
    if (shown.length > 0) {
      md.appendMarkdown(
        `$(link-external) **See also:** ${shown.join(" \u00a0·\u00a0 ")}\n\n`,
      );
    }

    if (items.length > maxItems) {
      const extra = items.length - maxItems;
      md.appendMarkdown(
        `*+${extra} more related item${extra > 1 ? "s" : ""} in docs*\n\n`,
      );
    }
  }

  private renderInlineReferenceItem(item: string, doc: HoverDoc): string {
    const trimmed = item.trim();
    const markdownLink = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(trimmed);
    if (markdownLink) {
      const [, label, url] = markdownLink;
      return this.buildCommandLink(
        this.escapeMarkdown(label),
        "python-hover.pinDocReference",
        this.buildPinnedReferenceArg(doc, label, url),
        `Open related reference: ${label}`,
      );
    }

    const cleaned = this.cleanContent(trimmed).trim();
    if (!cleaned) {
      return "";
    }

    if (/^[A-Za-z_]\w*(?:\.\w+)*$/.test(cleaned)) {
      return this.buildCommandLink(
        `\`${this.escapeMarkdown(cleaned)}\``,
        "python-hover.pinDocReference",
        this.buildPinnedReferenceArg(doc, cleaned),
        `Open related reference: ${cleaned}`,
      );
    }

    return this.escapeMarkdown(cleaned);
  }

  private buildPinnedReferenceArg(
    doc: HoverDoc,
    label: string,
    url?: string,
  ): {
    label: string;
    url?: string;
    currentModule?: string;
    currentPackage?: string;
    currentTitle: string;
  } {
    return {
      label,
      url,
      currentModule: doc.module,
      currentPackage:
        typeof doc.metadata?.indexedPackage === "string"
          ? doc.metadata.indexedPackage
          : undefined,
      currentTitle: doc.title,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FOOTER
  // ─────────────────────────────────────────────────────────────────────────

  private renderFooter(md: vscode.MarkdownString, doc: HoverDoc): void {
    const { secondaryActions } = this.buildActionGroups(doc);
    const importStatement =
      this.config.showImportHints && doc.kind !== "module"
        ? this.buildImportStatement(doc)
        : undefined;

    if (!importStatement && secondaryActions.length === 0) {
      return;
    }

    md.appendMarkdown("---\n\n");
    if (importStatement) {
      md.appendMarkdown(
        `$(symbol-namespace) Import: \`${this.escapeMarkdown(importStatement)}\`\n\n`,
      );
    }
    if (secondaryActions.length > 0) {
      md.appendMarkdown(`*Tools:* ${secondaryActions.join("  ·  ")}\n\n`);
    }
  }

  private buildActionGroups(doc: HoverDoc): {
    primaryActions: string[];
    secondaryActions: string[];
  } {
    const primaryActions: string[] = [];
    const secondaryActions: string[] = [];
    const commandToken = this.getCommandToken(doc);
    const importStatement = this.buildImportStatement(doc);
    const copyableSignature = doc.signature
      ? this.getCopyableSignature(doc)
      : undefined;
    const moduleBrowseTarget = this.getModuleBrowseTarget(doc);
    const savedDocEntry = buildSavedDocEntry(doc);

    if (doc.url) {
      const docsLink = this.buildLinkUrl(
        doc.url,
        this.config.docsBrowser,
        "docs",
      );
      primaryActions.push(
        `[$(book) Docs](<${docsLink}> "Open official documentation in your preferred browser")`,
      );
    }

    if (this.config.showDebugPinButton) {
      secondaryActions.push(
        this.buildCommandLink(
          "$(debug-alt-small) Debug",
          "python-hover.debugPinHover",
          commandToken,
          "Pin this hover and open a debug view",
        ),
      );
    }

    if (doc.source === ResolutionSource.Local) {
      primaryActions.push(
        `[$(go-to-file) Definition](command:editor.action.revealDefinition "Jump to definition")`,
      );
    }

    const sourceUrl = doc.sourceUrl || doc.links?.source;
    if (sourceUrl && sourceUrl !== doc.url) {
      secondaryActions.push(
        this.buildCommandLink(
          "$(source-control) Source",
          "python-hover.openHoverSource",
          { token: commandToken, target: sourceUrl },
          "Open source or reference page",
        ),
      );
    }

    if (moduleBrowseTarget && doc.kind !== "module") {
      primaryActions.push(
        this.buildCommandLink(
          "$(symbol-namespace) Browse",
          "python-hover.browseModule",
          moduleBrowseTarget,
          "Browse module symbols",
        ),
      );
    }

    const devdocsUrl = doc.devdocsUrl;
    if (devdocsUrl) {
      const ddLink = this.buildLinkUrl(
        devdocsUrl,
        this.config.devdocsBrowser,
        "devdocs",
      );
      secondaryActions.push(
        `[$(search-view-icon) DevDocs](<${ddLink}> "Search DevDocs")`,
      );
    }

    secondaryActions.push(
      this.buildCommandLink(
        "$(pin) Pin",
        "python-hover.pinHover",
        commandToken,
        "Pin this hover",
      ),
    );

    if (importStatement) {
      secondaryActions.push(
        this.buildCommandLink(
          "$(copy) Import",
          "python-hover.copyImport",
          importStatement,
          "Copy import statement",
        ),
      );
    }

    if (copyableSignature) {
      secondaryActions.push(
        this.buildCommandLink(
          "$(symbol-method) Signature",
          "python-hover.copySignature",
          copyableSignature,
          "Copy signature",
        ),
      );
    }

    if (savedDocEntry) {
      secondaryActions.push(
        this.buildCommandLink(
          "$(bookmark) Save",
          "python-hover.toggleSavedHover",
          savedDocEntry,
          "Save this doc to the PyHover reading list",
        ),
      );
    }

    secondaryActions.push(
      this.buildCommandLink(
        "$(history) History",
        "python-hover.showHistory",
        undefined,
        "Open recent hover history",
      ),
    );

    return { primaryActions, secondaryActions };
  }

  private buildMetadataChips(doc: HoverDoc): string[] {
    const chips: string[] = [];
    const showModuleStats = this.config.showModuleStats;

    if (doc.kind && doc.kind.toLowerCase() !== "module") {
      chips.push(`\`${this.formatKindLabel(doc.kind)}\``);
    }

    if (doc.module && doc.module !== "builtins" && doc.kind !== "module") {
      chips.push(`$(symbol-namespace) ${doc.module}`);
    }

    if (doc.kind === "module") {
      if (showModuleStats && doc.exportCount) {
        chips.push(
          `$(symbol-field) ${doc.exportCount.toLocaleString()} indexed`,
        );
      }
      if (showModuleStats && doc.installedVersion) {
        chips.push(`$(versions) v${doc.installedVersion}`);
      } else if (showModuleStats && doc.latestVersion) {
        chips.push(`$(versions) latest ${doc.latestVersion}`);
      }
      if (showModuleStats && doc.requiresPython) {
        chips.push(`$(arrow-circle-up) py${doc.requiresPython}`);
      }
    } else if (doc.installedVersion) {
      chips.push(`$(versions) v${doc.installedVersion}`);
    }

    if (doc.badges && this.config.showBadges) {
      for (const badge of doc.badges) {
        chips.push(`$(${this.getBadgeIcon(badge.label)}) ${badge.label}`);
      }
    }

    return chips;
  }

  private getModuleBrowseTarget(doc: HoverDoc): string | undefined {
    const moduleName = getSavedDocModuleTarget(doc);
    return moduleName && moduleName !== "builtins" ? moduleName : undefined;
  }

  private isVersionBelow(current: string, required: string): boolean {
    const parse = (value: string) =>
      value.split(".").map((part) => Number(part));
    const [currentMajor = 0, currentMinor = 0] = parse(current);
    const [requiredMajor = 0, requiredMinor = 0] = parse(required);

    if (currentMajor !== requiredMajor) {
      return currentMajor < requiredMajor;
    }

    return currentMinor < requiredMinor;
  }

  private getSourceLabel(doc: HoverDoc): string | null {
    const provider =
      typeof doc.metadata?.docsProvider === "string"
        ? doc.metadata.docsProvider.toLowerCase()
        : undefined;

    switch (doc.source) {
      case ResolutionSource.DevDocs:
        return "DevDocs";
      case ResolutionSource.Runtime:
        return "Runtime";
      case ResolutionSource.Static:
        return "Static docs";
      case ResolutionSource.SearchIndex:
        if (provider === "mkdocs") {
          return "MkDocs index";
        }
        if (provider === "sphinx") {
          return "Sphinx index";
        }
        return "Site index";
      case ResolutionSource.Corpus:
        if (provider === "mkdocs") {
          return "MkDocs docs";
        }
        if (provider === "sphinx") {
          return "Sphinx docs";
        }
        return "Library docs";
      default:
        return null;
    }
  }

  private getSourceIcon(doc: HoverDoc): string {
    switch (doc.source) {
      case ResolutionSource.Corpus:
        return "database";
      case ResolutionSource.Static:
        return "book";
      case ResolutionSource.Runtime:
        return "pulse";
      case ResolutionSource.SearchIndex:
        return "search";
      case ResolutionSource.DevDocs:
        return "search-view-icon";
      default:
        return "book";
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SIGNATURE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private cleanSignature(sig: string): string {
    return sharedCleanSignature(sig);
  }

  private getCopyableSignature(doc: HoverDoc): string | undefined {
    return doc.signature
      ? buildCopyableSignature(
          doc.title,
          this.normalizeDisplaySignature(doc.signature),
        )
      : undefined;
  }

  /**
   * Truncate a signature at a sensible boundary (closing paren or comma).
   */
  private truncateSignature(sig: string, maxLen: number): string {
    if (sig.length <= maxLen) {
      return sig;
    }

    // Find the last comma before maxLen
    let cut = sig.lastIndexOf(",", maxLen);
    if (cut < maxLen * 0.5) {
      cut = maxLen;
    } // if comma is too early, just cut

    const truncated = sig.substring(0, cut).trimEnd();
    // Count unclosed parens/brackets and close them
    let parens = 0,
      brackets = 0;
    for (const ch of truncated) {
      if (ch === "(") {
        parens++;
      } else if (ch === ")") {
        parens--;
      } else if (ch === "[") {
        brackets++;
      } else if (ch === "]") {
        brackets--;
      }
    }
    return (
      truncated +
      ", …" +
      "]".repeat(Math.max(0, brackets)) +
      ")".repeat(Math.max(0, parens))
    );
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
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/'/g, "%27");
  }

  /**
   * Build a URL that opens in integrated side panel or external browser
   * based on the specified mode.
   */
  private buildLinkUrl(
    url: string,
    mode: "integrated" | "external",
    kind: "docs" | "devdocs" = "docs",
  ): string {
    const sanitized = this.sanitizeUrl(url);
    if (!sanitized.startsWith("http")) {
      return sanitized;
    }
    if (mode === "external") {
      return sanitized; // VS Code will open http links in external browser
    }
    return `command:python-hover.openDocLink?${this.encodeCommandArgs({ url: sanitized, kind })}`;
  }

  private buildPreferredDocsLink(doc: HoverDoc): string {
    const docsUrl = doc.url;
    if (!docsUrl) {
      return "";
    }

    if (this.config.docsBrowser === "external") {
      return this.sanitizeUrl(docsUrl);
    }

    return `command:python-hover.openPreferredDocs?${this.encodeCommandArgs({
      url: docsUrl,
      token: this.getCommandToken(doc),
      kind: "docs",
    })}`;
  }

  private sanitizeUrl(url: string): string {
    if (!url) {
      return "";
    }
    if (/^[a-zA-Z]:\\/.test(url)) {
      return vscode.Uri.file(url).toString();
    }
    if (url.startsWith("/")) {
      return vscode.Uri.file(url).toString();
    }
    if (
      !url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("file://")
    ) {
      return `https://${url}`;
    }
    return url;
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, "\\$1");
  }

  private escapeInlineCode(text: string): string {
    return text.replace(/`/g, "\\`");
  }

  private getCommandToken(doc: HoverDoc): string | undefined {
    return typeof doc.metadata?.commandToken === "string"
      ? doc.metadata.commandToken
      : undefined;
  }

  private buildCommandLink(
    label: string,
    command: string,
    arg: unknown,
    title: string,
  ): string {
    if (arg === undefined || arg === null || arg === "") {
      return `[${label}](command:${command} "${title}")`;
    }
    return `[${label}](command:${command}?${this.encodeCommandArgs(arg)} "${title}")`;
  }

  private rewriteMarkdownLinks(content: string): string {
    return content.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (_match, label: string, rawUrl: string) => {
        const linked = this.buildLinkUrl(
          rawUrl,
          this.config.docsBrowser,
          "docs",
        );
        return `[${label}](<${linked}>)`;
      },
    );
  }

  private toVisibleMarkdownText(content: string): string {
    return content
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
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
    const pyBuiltins =
      /(?<![`\w])\b(None|True|False|NotImplemented|Ellipsis|__\w+__)\b(?![`\w])/g;
    content = content.replace(pyBuiltins, "`$1`");

    // Detect lines that look like standalone code and wrap them
    const lines = content.split("\n");
    const result: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip lines already inside fenced code blocks
      if (trimmed.startsWith("```")) {
        result.push(line);
        i++;
        while (i < lines.length && !lines[i].trim().startsWith("```")) {
          result.push(lines[i]);
          i++;
        }
        if (i < lines.length) {
          result.push(lines[i]);
          i++;
        } else {
          result.push("```");
        } // Close unclosed code fence
        continue;
      }

      // Detect Python code examples in prose (>>> prompts, assignments, etc.)
      if (
        this.looksLikePythonCode(trimmed) &&
        !trimmed.startsWith("$(") &&
        !trimmed.startsWith("**")
      ) {
        const codeLines: string[] = [trimmed];
        i++;
        while (i < lines.length) {
          const next = lines[i].trim();
          if (
            this.looksLikePythonCode(next) ||
            /^\.\.\./.test(next) ||
            (next === "" &&
              i + 1 < lines.length &&
              this.looksLikePythonCode(lines[i + 1]?.trim()))
          ) {
            codeLines.push(next);
            i++;
          } else {
            break;
          }
        }
        // Only wrap if not a single short token that might be inline
        if (codeLines.length > 1 || codeLines[0].length > 30) {
          result.push("```python\n" + codeLines.join("\n") + "\n```");
        } else {
          result.push(line);
        }
        continue;
      }

      result.push(line);
      i++;
    }

    return result.join("\n");
  }

  private enhanceContent(content: string): string {
    const replacements: [RegExp, string][] = [
      [
        /CPython implementation detail:/g,
        "$(alert) **CPython implementation detail:**",
      ],
      [/\bNote:\s/g, "$(info) **Note:** "],
      [/\bWarning:\s/g, "$(warning) **Warning:** "],
      [/\bDeprecated:\s/g, "$(error) **Deprecated:** "],
      [/\bTip:\s/g, "$(lightbulb) **Tip:** "],
      [/\bImportant:\s/g, "$(megaphone) **Important:** "],
      [/Changed in version (\d+\.\d+)/g, "$(history) **Changed in $1:**"],
      [/New in version (\d+\.\d+)/g, "$(sparkle) **New in $1:**"],
      [
        /Deprecated since version (\d+\.\d+)/g,
        "$(error) **Deprecated since $1:**",
      ],
      [/Added in version (\d+\.\d+)/g, "$(sparkle) **Added in $1:**"],
    ];
    for (const [p, r] of replacements) {
      content = content.replace(p, r);
    }
    return content;
  }

  private smartTruncate(content: string, maxLen: number): string {
    if (content.length <= maxLen) {
      return content;
    }
    let truncated = content.substring(0, maxLen).trim();
    const breakPoints = [". ", ".\n", "! ", "?\n", "\n\n"];
    let best = -1;
    const min = maxLen * 0.6;
    for (const bp of breakPoints) {
      const idx = truncated.lastIndexOf(bp);
      if (idx > min && idx > best) {
        best = idx + bp.length - 1;
      }
    }
    if (best > 0) {
      truncated = truncated.substring(0, best);
    }
    return truncated.trimEnd() + " …";
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

  private cleanContent(text: string): string {
    return sharedCleanContent(text);
  }

  /**
   * Ensure code fences are balanced so an unclosed fence in content
   * doesn't swallow the rest of the hover (toolbar, footer, etc.).
   */
  private balanceCodeFences(text: string): string {
    const fences = text.match(/^`{3,}/gm);
    if (fences && fences.length % 2 !== 0) {
      text += "\n```\n";
    }
    return text;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ICON / LABEL MAPS
  // ─────────────────────────────────────────────────────────────────────────

  private getIconForKind(kind?: string): string {
    const m: Record<string, string> = {
      class: "symbol-class",
      module: "symbol-namespace",
      method: "symbol-method",
      function: "symbol-function",
      property: "symbol-property",
      field: "symbol-field",
      variable: "symbol-variable",
      constant: "symbol-constant",
      enum: "symbol-enum",
      interface: "symbol-interface",
      keyword: "symbol-keyword",
      exception: "warning",
      type: "symbol-class",
      data: "symbol-field",
    };
    return m[kind?.toLowerCase() ?? ""] ?? "symbol-function";
  }

  private formatKindLabel(kind?: string): string {
    if (!kind) {
      return "Function";
    }
    return kind.charAt(0).toUpperCase() + kind.slice(1).toLowerCase();
  }

  private getBadgeIcon(label: string): string {
    const m: Record<string, string> = {
      deprecated: "error",
      async: "sync",
      "side-effects": "edit",
      "i/o": "file",
      stdlib: "library",
      experimental: "beaker",
      "thread-safe": "lock",
      generator: "debug-step-over",
    };
    return m[label.toLowerCase()] ?? "info";
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTES  (rendered at the bottom, after see-also)
  // ─────────────────────────────────────────────────────────────────────────

  private renderNotes(md: vscode.MarkdownString, doc: HoverDoc): void {
    for (const section of getVisibleStructuredNoteSections(doc)) {
      const rendered = this.renderStructuredSection(section);
      if (!rendered) {
        continue;
      }
      md.appendMarkdown(`${rendered}\n\n`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // NOTE: VS Code hover sanitizer strips ALL style/class attributes from HTML.
  // Only standard Markdown, $(icon) codicons, and unstyled HTML tags work.
  // Do NOT add inline CSS — it will be silently removed.
  // ─────────────────────────────────────────────────────────────────────────
}

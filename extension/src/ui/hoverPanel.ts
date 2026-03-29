import * as vscode from 'vscode';
import { HoverDoc, StructuredHoverSection } from '../../../shared/types';
import { cleanContent, cleanSignature } from './contentCleaner';

export class HoverPanel {
    static currentPanel: HoverPanel | undefined;

    private readonly panel: vscode.WebviewPanel;
  private navigationStack: HoverDoc[] = [];
  private navigationIndex = 0;

    private constructor(doc: HoverDoc) {
        this.panel = vscode.window.createWebviewPanel(
            'pythonHoverPanel',
            doc.title,
            { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
          { enableScripts: false, enableCommandUris: true, retainContextWhenHidden: false },
        );
      this.resetHistory(doc);
        this.panel.onDidDispose(() => {
            HoverPanel.currentPanel = undefined;
        });
    }

    static show(doc: HoverDoc): void {
        if (HoverPanel.currentPanel) {
      HoverPanel.currentPanel.resetHistory(doc);
    } else {
      HoverPanel.currentPanel = new HoverPanel(doc);
    }
  }

  static push(doc: HoverDoc): void {
    if (HoverPanel.currentPanel) {
      HoverPanel.currentPanel.pushHistory(doc);
    } else {
      HoverPanel.currentPanel = new HoverPanel(doc);
    }
  }

  static goBack(): boolean {
    if (!HoverPanel.currentPanel) return false;
    return HoverPanel.currentPanel.moveHistory(-1);
  }

  static goForward(): boolean {
    if (!HoverPanel.currentPanel) return false;
    return HoverPanel.currentPanel.moveHistory(1);
  }

  static jumpTo(index: number): boolean {
    if (!HoverPanel.currentPanel) return false;
    return HoverPanel.currentPanel.jumpToHistory(index);
  }

    update(doc: HoverDoc): void {
        this.panel.title = doc.title;
        this.panel.webview.html = this.renderHtml(doc);
        this.panel.reveal(vscode.ViewColumn.Beside, true);
    }

  private resetHistory(doc: HoverDoc): void {
    this.navigationStack = [doc];
    this.navigationIndex = 0;
    this.update(doc);
  }

  private pushHistory(doc: HoverDoc): void {
    const current = this.currentDoc();
    if (current && this.isSameDoc(current, doc)) {
      this.update(doc);
      return;
    }

    this.navigationStack = [
      ...this.navigationStack.slice(0, this.navigationIndex + 1),
      doc,
    ];
    this.navigationIndex = this.navigationStack.length - 1;
    this.update(doc);
  }

  private moveHistory(direction: -1 | 1): boolean {
    const nextIndex = this.navigationIndex + direction;
    if (nextIndex < 0 || nextIndex >= this.navigationStack.length) {
      return false;
    }

    this.navigationIndex = nextIndex;
    const doc = this.currentDoc();
    if (!doc) return false;
    this.update(doc);
    return true;
  }

  private jumpToHistory(index: number): boolean {
    if (index < 0 || index >= this.navigationStack.length) {
      return false;
    }

    this.navigationIndex = index;
    const doc = this.currentDoc();
    if (!doc) return false;
    this.update(doc);
    return true;
  }

  private currentDoc(): HoverDoc | undefined {
    return this.navigationStack[this.navigationIndex];
  }

  private isSameDoc(left: HoverDoc, right: HoverDoc): boolean {
    return left.title === right.title
      && left.url === right.url
      && left.sourceUrl === right.sourceUrl;
  }

    private escape(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    private markdownish(s: string): string {
      s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
        const link = this.buildDocsHref(href);
        return `<a href="${this.escape(link)}">${label}</a>`;
      });
      s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\n\n/g, '</p><p>');
        return s;
    }

  private encodeCommandArgs(value: unknown): string {
    return encodeURIComponent(JSON.stringify(value))
      .replace(/\(/g, '%28')
      .replace(/\)/g, '%29')
      .replace(/'/g, '%27');
  }

  private buildCommandHref(command: string, args?: unknown): string {
    if (args === undefined) {
      return `command:${command}`;
    }

    return `command:${command}?${this.encodeCommandArgs(args)}`;
  }

  private buildDocsHref(url: string, kind: 'docs' | 'devdocs' = 'docs'): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `command:python-hover.openDocLink?${this.encodeCommandArgs({ url: trimmed, kind })}`;
    }
    if (trimmed.startsWith('file://') || trimmed.startsWith('/')) {
      return trimmed;
    }
    return trimmed;
  }

  private renderStructuredSection(section: StructuredHoverSection): string {
    const roleClass = section.role ? ` role-${section.role}` : '';
    const title = section.title ? `<h3>${this.escape(section.title)}</h3>` : '';

    if (section.kind === 'code') {
      return `<div class="structured-block kind-code${roleClass}">${title}<pre><code>${this.escape(section.content.trim())}</code></pre></div>`;
    }

    if (section.kind === 'list' && section.items && section.items.length > 0) {
      const items = section.items
        .map(item => `<li>${this.markdownish(this.escape(cleanContent(item)))}</li>`)
        .join('');
      return `<div class="structured-block kind-list${roleClass}">${title}<ul>${items}</ul></div>`;
    }

    const text = this.markdownish(this.escape(cleanContent(section.content)));
    if (!text.trim()) return '';

    if (section.kind === 'note') {
      return `<div class="structured-block kind-note${roleClass}">${title}<div class="callout">${text}</div></div>`;
    }

    return `<div class="structured-block kind-paragraph${roleClass}">${title}<p>${text}</p></div>`;
  }

  private renderChip(label: string, tone: string = 'neutral'): string {
    return `<span class="chip chip-${tone}">${this.escape(label)}</span>`;
  }

  private getBadgeTone(color?: string): string {
    switch (color) {
      case 'red': return 'warn';
      case 'blue': return 'info';
      case 'purple': return 'accent';
      case 'teal': return 'success';
      default: return 'neutral';
    }
  }

  private getSourceLabel(doc: HoverDoc): string {
    const provider = typeof doc.metadata?.docsProvider === 'string'
      ? doc.metadata.docsProvider.toLowerCase()
      : undefined;

    switch (doc.source) {
      case 'SearchIndex':
        if (provider === 'mkdocs') return 'MkDocs index';
        if (provider === 'sphinx') return 'Sphinx index';
        return 'Site index';
      case 'Corpus': return 'Corpus';
      case 'Static': return 'Static docs';
      case 'Runtime': return 'Runtime';
      case 'Local': return 'Local';
      case 'DevDocs': return 'DevDocs';
      case 'LSP': return 'Language server';
      default: return doc.source;
    }
  }

  private getSourceTone(doc: HoverDoc): string {
    switch (doc.source) {
      case 'Corpus': return 'accent';
      case 'Static': return 'info';
      case 'Runtime': return 'success';
      case 'SearchIndex': return 'info';
      case 'DevDocs': return 'accent';
      case 'Local': return 'neutral';
      default: return 'neutral';
    }
  }

  private getDocHostLabel(doc: HoverDoc): string | undefined {
    const candidateUrl = doc.url || doc.sourceUrl || doc.links?.source;
    if (!candidateUrl || !/^https?:\/\//i.test(candidateUrl)) {
      return undefined;
    }

    try {
      const host = new URL(candidateUrl).hostname.replace(/^www\./, '');
      if (!host) return undefined;
      return host.includes('docs.python.org') ? 'Python docs' : host;
    } catch {
      return undefined;
    }
  }

  private renderProvenance(doc: HoverDoc): string {
    const parts = [
      this.renderChip(this.getSourceLabel(doc), this.getSourceTone(doc)),
    ];
    const host = this.getDocHostLabel(doc);
    if (host) {
      parts.push(this.renderChip(host, 'neutral'));
    }
    return `<div class="provenance-row">${parts.join('')}</div>`;
  }

  private buildImportStatement(doc: HoverDoc): string | undefined {
    if (doc.source === 'Local') return undefined;
    const rawTitle = doc.title.replace(/^builtins\./, '');
    if (!rawTitle || /^__\w+__$/.test(rawTitle)) return undefined;
    if (doc.kind === 'module') {
      return rawTitle === 'builtins' ? undefined : `import ${rawTitle}`;
    }
    if (!doc.module || doc.module === 'builtins') return undefined;
    const segments = rawTitle.split('.').filter(Boolean);
    let shortName = segments[segments.length - 1] || rawTitle;
    if (segments.length > 1 && /^(?:method|property|field)$/i.test(doc.kind ?? '')) {
      shortName = segments[0];
    }
    return `from ${doc.module} import ${shortName}`;
  }

  private buildSourceHref(doc: HoverDoc): string | undefined {
    const sourceTarget = doc.sourceUrl || doc.links?.source;
    if (!sourceTarget) {
      return undefined;
    }
    return this.buildCommandHref('python-hover.openHoverSource', { target: sourceTarget });
  }

  private renderHeroActions(doc: HoverDoc, importStatement?: string): string[] {
    const actions: string[] = [];

    if (doc.url) {
      actions.push(`<a class="chip chip-link" href="${this.escape(this.buildDocsHref(doc.url, 'docs'))}">Docs</a>`);
    }
    if (doc.devdocsUrl && !doc.url) {
      actions.push(`<a class="chip chip-link" href="${this.escape(this.buildDocsHref(doc.devdocsUrl, 'devdocs'))}">DevDocs</a>`);
    }
    const sourceHref = this.buildSourceHref(doc);
    if (sourceHref) {
      actions.push(`<a class="chip chip-link" href="${this.escape(sourceHref)}">Source</a>`);
    }
    if (doc.module && doc.module !== 'builtins') {
      actions.push(`<a class="chip chip-link" href="${this.escape(this.buildCommandHref('python-hover.browseModule', doc.module))}">Browse</a>`);
    }
    if (importStatement) {
      actions.push(`<a class="chip chip-link" href="${this.escape(this.buildCommandHref('python-hover.copyImport', importStatement))}">Copy import</a>`);
    }
    actions.push(`<a class="chip chip-link" href="command:python-hover.openStudio">Studio</a>`);

    return actions;
  }

  private renderSeeAlsoItem(item: string, doc: HoverDoc): string {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(item.trim());
    if (match) {
      const href = this.buildCommandHref('python-hover.pinDocReference', {
        label: match[1],
        url: match[2],
        currentModule: doc.module,
        currentPackage: typeof doc.metadata?.indexedPackage === 'string' ? doc.metadata.indexedPackage : undefined,
        currentTitle: doc.title,
      });
      return `<a class="chip chip-link" href="${this.escape(href)}">${this.escape(match[1])}</a>`;
    }

    const cleaned = cleanContent(item).trim();
    if (!cleaned) {
      return '';
    }

    if (!/^[A-Za-z_][\w.]*$/.test(cleaned)) {
      return `<span class="chip chip-soft"><code>${this.escape(cleaned)}</code></span>`;
    }

    const href = this.buildCommandHref('python-hover.pinDocReference', {
      label: cleaned,
      currentModule: doc.module,
      currentPackage: typeof doc.metadata?.indexedPackage === 'string' ? doc.metadata.indexedPackage : undefined,
      currentTitle: doc.title,
    });
    return `<a class="chip chip-soft" href="${this.escape(href)}"><code>${this.escape(cleaned)}</code></a>`;
  }

  private renderNavigation(): string {
    if (this.navigationStack.length <= 1) {
      return '';
    }

    const crumbs = this.navigationStack.map((entry, index) => {
      const label = this.escape(entry.title.replace(/^builtins\./, ''));
      if (index === this.navigationIndex) {
        return `<span class="crumb current">${label}</span>`;
      }

      return `<a class="crumb" href="${this.escape(this.buildCommandHref('python-hover.pinPanelJump', index))}">${label}</a>`;
    }).join('<span class="crumb-sep">/</span>');

    const backHref = this.navigationIndex > 0 ? this.buildCommandHref('python-hover.pinPanelBack') : '';
    const forwardHref = this.navigationIndex < this.navigationStack.length - 1 ? this.buildCommandHref('python-hover.pinPanelForward') : '';

    return `
      <div class="nav-row">
        ${backHref ? `<a class="nav-chip" href="${this.escape(backHref)}">Back</a>` : '<span class="nav-chip disabled">Back</span>'}
        ${forwardHref ? `<a class="nav-chip" href="${this.escape(forwardHref)}">Forward</a>` : '<span class="nav-chip disabled">Forward</span>'}
      </div>
      <div class="breadcrumb-row">${crumbs}</div>
    `;
  }

    private renderHtml(doc: HoverDoc): string {
        const e = (s: string) => this.escape(s);
        const m = (s: string) => this.markdownish(e(s));

      const metaChips: string[] = [];
      if (doc.kind) {
        metaChips.push(this.renderChip(doc.kind, 'info'));
      }
      if (doc.module && doc.module !== 'builtins') {
        metaChips.push(this.renderChip(doc.module, 'neutral'));
      }
      if (doc.installedVersion) {
        metaChips.push(this.renderChip(`v${doc.installedVersion}`, 'success'));
      }
      if (doc.badges) {
        for (const badge of doc.badges) {
          metaChips.push(this.renderChip(badge.label, this.getBadgeTone(badge.color)));
        }
      }
      const metaHtml = metaChips.length > 0
        ? `<div class="meta-row">${metaChips.join('')}</div>`
            : '';
      const provenanceHtml = this.renderProvenance(doc);
      const importStatement = this.buildImportStatement(doc);

        let signatureHtml = '';
        if (doc.signature) {
            let sig = cleanSignature(doc.signature);
            if (sig.startsWith('(')) sig = `${doc.title}${sig}`;
          signatureHtml = `<section class="card signature-card"><div class="section-kicker">Signature</div><pre class="sig"><code>${e(sig)}</code></pre></section>`;
        } else if (doc.overloads && doc.overloads.length > 0) {
          signatureHtml = `<section class="card signature-card"><div class="section-kicker">Overloads</div>${doc.overloads
                .map(o => `<pre class="sig"><code>${e(cleanSignature(o))}</code></pre>`)
              .join('\n')}</section>`;
        }

      const structuredSections = doc.structuredContent?.sections
        ?.filter(section => section.role !== 'example' && section.role !== 'note' && section.kind !== 'note') ?? [];
      const descBody = structuredSections.length > 0
        ? structuredSections.map(section => this.renderStructuredSection(section)).filter(Boolean).join('\n')
        : (() => {
          const rawDesc = doc.summary || doc.content || '';
          const desc = cleanContent(rawDesc);
          return desc ? `<div class="structured-block kind-paragraph role-summary"><p>${m(desc)}</p></div>` : '';
        })();
      const descHtml = descBody
        ? `<section class="card lead-card"><div class="section-kicker">Overview</div>${descBody}</section>`
            : '';

      const notesHtml = doc.notes && doc.notes.length > 0
        ? `<section class="card"><h2>Notes</h2>${doc.notes.map(note => `<div class="callout note-callout">${m(cleanContent(note))}</div>`).join('')}</section>`
        : '';

        let paramsHtml = '';
        if (doc.parameters && doc.parameters.length > 0) {
            const rows = doc.parameters.map(p => {
                const name = p.default !== undefined ? `${e(p.name)}=${e(p.default)}` : e(p.name);
                const type = p.type ? e(p.type) : '—';
                const pdesc = p.description ? m(p.description) : '';
                return `<tr><td><code>${name}</code></td><td><code>${type}</code></td><td>${pdesc}</td></tr>`;
            }).join('\n');
            paramsHtml = `
<section class="card">
  <h2>Parameters</h2>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</section>`;
        }

        let returnsHtml = '';
        if (doc.returns) {
            const rtype = doc.returns.type ? `<code>${e(doc.returns.type)}</code> ` : '';
            const rdesc = doc.returns.description ? `— ${m(doc.returns.description)}` : '';
          returnsHtml = `<section class="card"><h2>Returns</h2><p>${rtype}${rdesc}</p></section>`;
        }

        let raisesHtml = '';
        if (doc.raises && doc.raises.length > 0) {
            const items = doc.raises.map(exc => {
                const edesc = exc.description ? ` — ${m(exc.description)}` : '';
                return `<li><code>${e(exc.type)}</code>${edesc}</li>`;
            }).join('\n');
          raisesHtml = `<section class="card"><h2>Raises</h2><ul>${items}</ul></section>`;
        }

      const structuredExamples = doc.structuredContent?.sections?.filter(
        section => section.role === 'example',
      ) ?? [];
        let examplesHtml = '';
      if (structuredExamples.length > 0 || (doc.examples && doc.examples.length > 0)) {
        const blocks = structuredExamples.length > 0
          ? structuredExamples.map(section => `<div class="example-card">${this.renderStructuredSection(section)}</div>`).join('\n')
          : doc.examples!.map(ex => `<div class="example-card"><pre><code>${e(ex)}</code></pre></div>`).join('\n');
        examplesHtml = `<section class="card"><h2>Examples</h2>${blocks}</section>`;
        }

      const seeAlsoHtml = doc.seeAlso && doc.seeAlso.length > 0
        ? `<section class="card"><h2>See also</h2><div class="chip-cloud">${doc.seeAlso.map(item => this.renderSeeAlsoItem(item, doc)).filter(Boolean).join('')}</div></section>`
        : '';

      const exportsHtml = doc.moduleExports && doc.moduleExports.length > 0
        ? `<section class="card"><h2>Key exports</h2><div class="chip-cloud">${doc.moduleExports.map(name => `<span class="chip chip-soft"><code>${e(name)}</code></span>`).join('')}</div></section>`
        : '';

        const links: string[] = [];
      const actionLinks = this.renderHeroActions(doc, importStatement);
        if (doc.url) {
          links.push(`<a href="${e(this.buildDocsHref(doc.url, 'docs'))}">Official Docs</a>`);
        }
        if (doc.devdocsUrl) {
          links.push(`<a href="${e(this.buildDocsHref(doc.devdocsUrl, 'devdocs'))}">DevDocs</a>`);
      }
      const sourceUrl = doc.sourceUrl || doc.links?.source;
      if (sourceUrl) {
        links.push(`<a href="${e(this.buildDocsHref(sourceUrl, 'docs'))}">Source</a>`);
      }
      if (importStatement) {
        links.push(`<code>${e(importStatement)}</code>`);
      }
        const footerHtml = links.length > 0
          ? `<footer class="footer card"><div class="section-kicker">Links And Import</div><div class="footer-links">${links.join('<span class="footer-sep">·</span>')}</div></footer>`
            : '';

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${e(doc.title)}</title>
<style>
  :root {
    --panel-border: color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
    --panel-accent: var(--vscode-textLink-foreground);
    --panel-success: var(--vscode-testing-iconPassed, #2ea043);
    --panel-warn: var(--vscode-editorWarning-foreground, #d29922);
    --panel-info: var(--vscode-symbolIcon-functionForeground, var(--vscode-textLink-foreground));
  }
  body {
    font-family: var(--vscode-font-family);
    font-size: 13px;
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    margin: 0;
    line-height: 1.5;
  }
  .shell {
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .hero {
    background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-foreground) 6%);
    border: 1px solid var(--panel-border);
    border-radius: 7px;
    padding: 12px 14px;
  }
  .eyebrow {
    display: none;
  }
  h1 {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.3;
    margin: 0;
  }
  h2 {
    font-size: 11px;
    margin: 0 0 8px;
    color: var(--vscode-descriptionForeground);
  }
  h3 {
    font-size: 12px;
    margin: 0 0 6px;
    color: var(--vscode-foreground);
  }
  .meta-row, .chip-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .provenance-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .nav-row, .breadcrumb-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    align-items: center;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
  }
  .chip-neutral {
    background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-foreground) 12%);
    border-color: var(--panel-border);
    color: var(--vscode-foreground);
  }
  .chip-info {
    background: color-mix(in srgb, var(--panel-info) 12%, transparent);
    border-color: color-mix(in srgb, var(--panel-info) 32%, transparent);
    color: var(--panel-info);
  }
  .chip-accent {
    background: color-mix(in srgb, var(--panel-accent) 12%, transparent);
    border-color: color-mix(in srgb, var(--panel-accent) 36%, transparent);
    color: var(--panel-accent);
  }
  .chip-success {
    background: color-mix(in srgb, var(--panel-success) 12%, transparent);
    border-color: color-mix(in srgb, var(--panel-success) 34%, transparent);
    color: var(--panel-success);
  }
  .chip-warn {
    background: color-mix(in srgb, var(--panel-warn) 12%, transparent);
    border-color: color-mix(in srgb, var(--panel-warn) 34%, transparent);
    color: var(--panel-warn);
  }
  .chip-link, .chip-soft {
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, transparent);
    border-color: var(--panel-border);
    color: var(--vscode-textLink-foreground);
  }
  .chip-soft code {
    color: inherit;
  }
  .nav-chip, .crumb {
    display: inline-flex;
    align-items: center;
    border-radius: 4px;
    padding: 2px 7px;
    font-size: 11px;
    border: 1px solid var(--panel-border);
    text-decoration: none;
    white-space: nowrap;
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, transparent);
    color: var(--vscode-textLink-foreground);
  }
  .crumb.current, .nav-chip.disabled {
    color: var(--vscode-descriptionForeground);
    text-decoration: none;
    background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-foreground) 12%);
  }
  .nav-chip.disabled {
    cursor: default;
  }
  .crumb-sep {
    color: var(--vscode-descriptionForeground);
  }
  .card {
    background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-foreground) 4%);
    border: 1px solid var(--panel-border);
    border-radius: 7px;
    padding: 10px 12px;
  }
  .lead-card {
    border-color: color-mix(in srgb, var(--panel-accent) 30%, var(--panel-border));
  }
  .signature-card {
    padding-top: 10px;
  }
  .section-kicker {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
  }
  .structured-block + .structured-block {
    margin-top: 10px;
  }
  .structured-block.role-summary p {
    line-height: 1.55;
  }
  .structured-block.role-example:not(.kind-code) {
    border-left: 2px solid color-mix(in srgb, var(--panel-success) 60%, transparent);
    padding-left: 10px;
  }
  .example-card + .example-card {
    margin-top: 8px;
  }
  .example-card {
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 86%, transparent);
    border: 1px solid color-mix(in srgb, var(--panel-success) 24%, var(--panel-border));
    border-radius: 5px;
    padding: 8px 10px;
  }
  .callout {
    border-left: 2px solid var(--panel-accent);
    background: color-mix(in srgb, var(--panel-accent) 8%, var(--vscode-textCodeBlock-background));
    padding: 8px 10px;
    border-radius: 5px;
  }
  .note-callout + .note-callout {
    margin-top: 8px;
  }
  pre, pre.sig {
    margin: 0;
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 92%, transparent);
    padding: 8px 10px;
    border-radius: 5px;
    overflow-x: auto;
    border: 1px solid color-mix(in srgb, var(--panel-border) 70%, transparent);
  }
  pre code, code {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.95em;
  }
  p { margin: 0; }
  p + p { margin-top: 8px; }
  ul { margin: 0; padding-left: 18px; }
  li + li { margin-top: 4px; }
  table {
    border-collapse: collapse;
    width: 100%;
    border: 1px solid var(--panel-border);
  }
  th, td {
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid color-mix(in srgb, var(--panel-border) 55%, transparent);
    vertical-align: top;
  }
  tr:last-child td { border-bottom: none; }
  th {
    background: color-mix(in srgb, var(--vscode-textCodeBlock-background) 80%, transparent);
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }
  a {
    color: var(--vscode-textLink-foreground);
    text-decoration: none;
  }
  a:hover { text-decoration: underline; }
  .footer {
    display: grid;
    gap: 6px;
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
  }
  .footer-links {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    font-size: 12px;
  }
  .footer-sep {
    color: var(--vscode-descriptionForeground);
  }
  @media (max-width: 640px) {
    .shell {
      padding: 10px;
    }
  }
</style>
</head>
<body>
<div class="shell">
  <header class="hero">
    <h1>${e(doc.title)}</h1>
    ${metaHtml}
    ${provenanceHtml}
    ${this.renderNavigation()}
    <div class="hero-actions">${actionLinks.join('')}</div>
  </header>
  ${signatureHtml}
  ${descHtml}
  ${notesHtml}
  ${paramsHtml}
  ${returnsHtml}
  ${raisesHtml}
  ${examplesHtml}
  ${seeAlsoHtml}
  ${exportsHtml}
  ${footerHtml}
</div>
</body>
</html>`;
    }
}

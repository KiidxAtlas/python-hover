import { DocResolver } from "#docs-engine/docResolver";
import { DocKey, HoverDoc, ResolutionSource } from "#shared/types";
import { PythonHelper } from "#src/core/pythonHelper";
import { Logger } from "#src/logger";

export class HoverResolutionManager {
  private installedVersionCache = new Map<string, string | null>();
  private runtimeDocCache = new Map<string, HoverDoc | null>();

  constructor(
    private docResolver: DocResolver,
    private pythonHelper: PythonHelper | null,
  ) {}

  async resolveDoc(
    key: DocKey,
    fetchInstalledVersionForPkg?: string,
  ): Promise<HoverDoc | null> {
    try {
      const doc = await this.docResolver.resolve(key);

      // If resolver returned nothing, attempt runtime fallback for certain cases
      if (!doc) {
        if (
          this.pythonHelper &&
          (key.package === "builtins" ||
            key.module === "builtins" ||
            key.isStdlib)
        ) {
          const runtime = await this.tryRuntimeFallback(key);
          if (runtime) return runtime;
        }
        return null;
      }

      // If the resolved doc is missing useful text, try runtime fallback for builtins/stdlib
      const isUsefulText = (value?: string, minLen = 8) => {
        const t = value?.trim();
        if (!t) return false;
        if (t.length < minLen) return false;
        // Common placeholder snippets produced by inventory/scrapers
        const placeholders = [
          "Documentation for",
          "Documentation from",
          "No documentation found.",
          "Documentation lookup failed.",
        ];
        for (const p of placeholders) {
          if (t.startsWith(p)) return false;
        }
        return true;
      };

      const hasStructured = Boolean(
        doc.structuredContent &&
        (doc.structuredContent.sections?.length ?? 0) > 0,
      );
      const hasSummary = Boolean(doc.summary && isUsefulText(doc.summary));
      const hasContent = Boolean(doc.content && isUsefulText(doc.content));
      const hasText = hasStructured || hasSummary || hasContent;

      Logger.debug("HoverResolutionManager: resolveDoc text checks", {
        key: `${key.package || ""}::${key.module || ""}::${key.qualname || key.name}`,
        hasStructured,
        hasSummary: Boolean(doc.summary),
        hasSummaryUseful: hasSummary,
        hasContent: Boolean(doc.content),
        hasContentUseful: hasContent,
      });

      if (
        !hasText &&
        this.pythonHelper &&
        (key.package === "builtins" ||
          key.module === "builtins" ||
          key.isStdlib)
      ) {
        Logger.debug(
          "HoverResolutionManager: attempting runtime fallback (no useful resolver text)",
          {
            key: `${key.package || ""}::${key.module || ""}::${key.qualname || key.name}`,
          },
        );
        const runtime = await this.tryRuntimeFallback(key);
        if (runtime) {
          // Merge runtime doc into resolver doc for richer hover
          doc.summary = doc.summary || runtime.summary;
          doc.content = doc.content || runtime.content;
          doc.signature = doc.signature || runtime.signature;
          doc.source = runtime.source || doc.source;
          Logger.debug(
            "HoverResolutionManager: merged runtime fallback into resolver doc",
            {
              key: `${key.package || ""}::${key.module || ""}::${key.qualname || key.name}`,
            },
          );
        }
      }

      if (fetchInstalledVersionForPkg && this.pythonHelper) {
        const cacheKey = `${fetchInstalledVersionForPkg}`;
        if (this.installedVersionCache.has(cacheKey)) {
          doc.installedVersion =
            this.installedVersionCache.get(cacheKey) ?? undefined;
        } else {
          try {
            const v = await this.pythonHelper.getInstalledVersion(
              fetchInstalledVersionForPkg,
            );
            this.installedVersionCache.set(cacheKey, v);
            if (v) doc.installedVersion = v;
          } catch {
            this.installedVersionCache.set(cacheKey, null);
          }
        }
      }

      return doc;
    } catch (e) {
      // Error isolation: failures in remote fetching shouldn't crash hover.
      // Log at debug level so users can troubleshoot without spamming the output.
      Logger.debug(`DocResolver failed for key ${key.name || "unknown"}`, e);
      return null;
    }
  }

  async resolveModuleOverview(
    moduleName: string,
    isStdlib: boolean,
  ): Promise<HoverDoc | null> {
    try {
      const doc = await this.docResolver.resolveModuleOverview(
        moduleName,
        isStdlib,
      );
      if (!doc) return null;
      // Inventory entries are excellent for navigation but often contain no prose,
      // and the first background page scrape may not have completed yet. The
      // installed module's own docstring is the fastest authoritative explanation
      // of what the library does, so use its opening paragraph when remote/indexed
      // sources have not supplied a summary.
      const existingSummaryIsUseful = this.hasUsefulModuleSummary(doc);
      const shouldEnrichSummary =
        moduleName.includes('.') ||
        !existingSummaryIsUseful ||
        (doc.summary?.trim().length ?? 0) < 120;
      if (shouldEnrichSummary && this.pythonHelper) {
        const runtime = await this.tryRuntimeFallback({
          name: moduleName,
          qualname: moduleName,
          package: moduleName.split('.')[0] || moduleName,
          module: moduleName,
          isStdlib,
        });
        if (runtime) {
          doc.summary = this.buildModuleSummary(
            existingSummaryIsUseful ? doc.summary : undefined,
            runtime.summary || runtime.content,
            moduleName.includes('.'),
          );
          doc.content = doc.content || runtime.content;
        }
      }
      doc.summary = this.normalizeModuleSummary(doc.summary);
      if (!isStdlib && this.pythonHelper) {
        const topModule = moduleName.split(".")[0];
        const cacheKey = `${topModule}`;
        if (this.installedVersionCache.has(cacheKey)) {
          doc.installedVersion =
            this.installedVersionCache.get(cacheKey) ?? undefined;
        } else {
          try {
            const v = await this.pythonHelper.getInstalledVersion(topModule);
            this.installedVersionCache.set(cacheKey, v);
            if (v) doc.installedVersion = v;
          } catch {
            this.installedVersionCache.set(cacheKey, null);
          }
        }
      }
      return doc;
    } catch {
      return null;
    }
  }

  private hasUsefulModuleSummary(doc: HoverDoc): boolean {
    const text =
      doc.summary ||
      doc.structuredContent?.summary ||
      doc.structuredContent?.description ||
      doc.content;
    if (!text || text.trim().length < 12) return false;
    return !/^(?:\*\*)?source code:|^(?:documentation (?:for|from)|no documentation found|documentation lookup failed)/i.test(
      text.trim(),
    );
  }

  private buildModuleSummary(
    indexedSummary: string | undefined,
    runtimeSummary: string | undefined,
    preferRuntime: boolean,
  ): string | undefined {
    const indexed = this.normalizeModuleSummary(indexedSummary);
    const runtime = this.normalizeModuleSummary(runtimeSummary);
    if (preferRuntime && runtime) return runtime;
    if (!indexed) return runtime;
    if (!runtime) return indexed;

    if (
      /^(?:this (?:section|chapter)|the .+ module defines the following)/i.test(indexed) &&
      runtime.length >= 60
    ) {
      return runtime;
    }
    if (runtime.length < 60) return indexed;

    const comparableIndexed = indexed.toLowerCase();
    const comparableRuntime = runtime.toLowerCase();
    if (
      comparableIndexed.includes(comparableRuntime) ||
      comparableRuntime.includes(comparableIndexed)
    ) {
      return indexed.length >= runtime.length ? indexed : runtime;
    }

    const punctuatedIndexed = /[.!?]$/.test(indexed) ? indexed : `${indexed}.`;
    const sentenceRuntime = runtime.replace(/^Provides\s+/, 'It provides ');
    return this.normalizeModuleSummary(`${punctuatedIndexed} ${sentenceRuntime}`);
  }

  private normalizeModuleSummary(summary: string | undefined): string | undefined {
    if (!summary?.trim()) return undefined;

    const cleaned = summary
      .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, '$1')
      .replace(/<https?:\/\/[^>]+>/g, '')
      .replace(/\bhttps?:\/\/\S+/g, '')
      .replace(/^This section outlines\s+/i, 'Provides ')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^\s*[=~`^#*_-]{3,}\s*$/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .trim();
    if (!cleaned) return undefined;

    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    let result = '';
    for (const sentence of sentences.slice(0, 3)) {
      const candidate = result ? `${result} ${sentence}` : sentence;
      if (candidate.length > 420 && result) break;
      result = candidate;
      if (result.length >= 180) break;
    }

    if (result.length > 420) {
      const clipped = result.slice(0, 417);
      result = `${clipped.slice(0, Math.max(clipped.lastIndexOf(' '), 1)).trimEnd()}…`;
    }
    return result || undefined;
  }

  private async tryRuntimeFallback(key: DocKey): Promise<HoverDoc | null> {
    if (!this.pythonHelper) return null;
    const symbol = (key.qualname || key.name || "").replace(/^builtins\./, "");
    if (!symbol) return null;

    const cacheKey = `${key.package || ""}::${key.module || ""}::${symbol}`;
    if (this.runtimeDocCache.has(cacheKey)) {
      return this.runtimeDocCache.get(cacheKey) ?? null;
    }

    try {
      const info = await this.pythonHelper.resolveRuntime(symbol);
      if (!info) {
        this.runtimeDocCache.set(cacheKey, null);
        return null;
      }

      const summary = this.extractRuntimeSummary(info.docstring, symbol);
      const runtimeDoc: HoverDoc = {
        title: info.qualname || symbol,
        kind: (info.kind as any) || undefined,
        signature: info.signature ?? undefined,
        summary: summary,
        content: info.docstring ?? undefined,
        url: (info as any).url ?? undefined,
        source: ResolutionSource.Runtime,
        confidence: 0.95,
        module: info.module ?? key.module,
      };

      this.runtimeDocCache.set(cacheKey, runtimeDoc);
      return runtimeDoc;
    } catch (e) {
      // Runtime fallback failure is expected for many symbols — log at debug.
      Logger.debug(`Runtime fallback failed for ${symbol}`, e);
      this.runtimeDocCache.set(cacheKey, null);
      return null;
    }
  }

  private extractRuntimeSummary(
    docstring: string | null | undefined,
    symbol: string,
  ): string | undefined {
    if (!docstring?.trim()) return undefined;

    const normalizedSymbol = symbol.replace(/`/g, '').toLowerCase();
    const paragraphs = docstring
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)
      .map(paragraph => paragraph.trim())
      .filter(Boolean);

    const candidates: string[] = [];
    for (const paragraph of paragraphs) {
      const meaningfulLines = paragraph
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !/^[=~`^#*_-]{3,}$/.test(line));
      if (meaningfulLines.length === 0) continue;

      let candidate: string;
      if (/^provides:?$/i.test(meaningfulLines[0]) && meaningfulLines.length > 1) {
        const capabilities = meaningfulLines
          .slice(1)
          .map(line => line.replace(/^\d+[.)]\s*/, '').replace(/[.;]$/, ''))
          .filter(Boolean);
        const [firstCapability, ...remainingCapabilities] = capabilities;
        const normalizedFirst = firstCapability
          ? firstCapability.charAt(0).toLowerCase() + firstCapability.slice(1)
          : '';
        candidate = `It provides ${[normalizedFirst, ...remainingCapabilities].filter(Boolean).join(', ')}.`;
      } else {
        candidate = meaningfulLines.join(' ').replace(/\s+/g, ' ').trim();
      }
      const normalizedCandidate = candidate.replace(/`/g, '').toLowerCase();
      if (
        normalizedCandidate === normalizedSymbol ||
        normalizedCandidate === normalizedSymbol.split('.').pop()
      ) {
        continue;
      }
      if (/^(?:module|package)\s+[`'"]?[^ ]+[`'"]?\.?$/i.test(candidate)) {
        continue;
      }
      const looksLikeHeading =
        candidate.length <= 70 &&
        !/[.!?]$/.test(candidate) &&
        !/\b(?:is|are|provides?|supports?|parses?|creates?|implements?|works?|uses?)\b/i.test(
          candidate,
        );
      if (looksLikeHeading) continue;
      candidates.push(candidate);
    }

    if (candidates.length === 0) return undefined;
    if (candidates[0].length < 55 && candidates[1]) {
      return `${candidates[0]} ${candidates[1]}`;
    }
    return candidates[0];
  }
}

export default HoverResolutionManager;

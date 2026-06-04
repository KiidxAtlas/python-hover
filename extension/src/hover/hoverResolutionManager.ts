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
      // Error isolation: failures in remote fetching shouldn't crash hover
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

      const summary = info.docstring
        ? info.docstring.split("\n\n")[0].trim()
        : undefined;
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
    } catch {
      this.runtimeDocCache.set(cacheKey, null);
      return null;
    }
  }
}

export default HoverResolutionManager;

import { LspSymbol } from "#shared/types";
import type * as vscode from "vscode";
import { DocKeyBuilder } from "../../../shared/docKey";

export class ResolutionService {
  private envCacheId: string;

  constructor(envCacheId: string) {
    this.envCacheId = envCacheId;
  }

  /**
   * Build a canonical cache key for a hover symbol. `isLibrary` must come from the
   * same classification (`classifyHoverSymbol`) used to pick the render branch —
   * previously this method re-derived local-vs-library from `!lspSymbol.path` alone,
   * which disagreed with the richer classifier for path-less local symbols (e.g. two
   * different local functions with the same bare name in different files would both
   * fall back to "library" here, collide on the same global cache key derived only
   * from the identifier text, and one file's rendered content would leak into the
   * other's hover). Scoping the key to the document path whenever the symbol isn't
   * library-scoped closes that collision.
   */
  buildCacheKey(
    lspSymbol: LspSymbol,
    isLibrary: boolean,
    document?: vscode.TextDocument,
  ) {
    const symbolInfo = { ...lspSymbol };
    const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
    const canonical = DocKeyBuilder.toCacheKey(docKey);
    const cacheKey = isLibrary
      ? `${this.envCacheId}::${canonical}`
      : `${this.envCacheId}::${document?.uri.fsPath || "<unknown>"}::v${document?.version ?? "unknown"}::${canonical}`;
    return { cacheKey, docKey, isLibrary };
  }
}

export default ResolutionService;

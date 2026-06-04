import { LspSymbol } from "#shared/types";
import { isLibraryPath } from "#src/symbols/symbolClassifier";
import * as vscode from "vscode";
import { DocKeyBuilder } from "../../../shared/docKey";

export class ResolutionService {
  private envCacheId: string;

  constructor(envCacheId: string) {
    this.envCacheId = envCacheId;
  }

  /**
   * Build a canonical cache key for a hover symbol. If `document` is provided
   * and symbol is local, the key will be scoped to the document path.
   */
  buildCacheKey(lspSymbol: LspSymbol, document?: vscode.TextDocument) {
    const symbolInfo = { ...lspSymbol } as any;
    const docKey = DocKeyBuilder.fromSymbol(symbolInfo);
    const canonical = DocKeyBuilder.toCacheKey(docKey);
    const isLibrary = !lspSymbol.path || isLibraryPath(lspSymbol.path);
    const cacheKey = isLibrary
      ? `${this.envCacheId}::${canonical}`
      : `${this.envCacheId}::${document?.uri.fsPath || "<unknown>"}::${canonical}`;
    return { cacheKey, docKey, isLibrary };
  }
}

export default ResolutionService;

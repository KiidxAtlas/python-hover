import { describe, expect, it } from "vitest";
import ResolutionService from "../src/hover/resolutionService";

describe("ResolutionService", () => {
  it("builds canonical cache key for library symbols", () => {
    const svc = new ResolutionService("env1");
    const lspSymbol: any = {
      name: "pandas.DataFrame",
      module: "pandas.core.frame",
      package: "pandas",
      qualname: "DataFrame",
      path: "/usr/lib/python3.11/site-packages/pandas/__init__.py",
      kind: "class",
    };
    const res = svc.buildCacheKey(lspSymbol, undefined as any);
    // Ensure canonicalization doesn't accidentally prefix qualname with package
    expect(res.cacheKey).toContain(
      "env1::pandas::pandas.core.frame::DataFrame",
    );
    expect(res.isLibrary).toBeTruthy();
  });

  it("scopes local symbols to document path when not library", () => {
    const svc = new ResolutionService("envX");
    const lspSymbol: any = {
      name: "MyClass.method",
      module: "my_module",
      package: undefined,
      path: "/workspace/project/src/my_module.py",
      kind: "method",
    };
    const fakeDoc: any = {
      uri: {
        fsPath: "/workspace/project/src/my_module.py",
        toString: () => "file:///workspace/project/src/my_module.py",
      },
    };
    const res = svc.buildCacheKey(lspSymbol, fakeDoc);
    expect(res.cacheKey).toContain(
      "envX::/workspace/project/src/my_module.py::",
    );
    expect(res.isLibrary).toBeFalsy();
  });
});

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
    const res = svc.buildCacheKey(lspSymbol, true, undefined as any);
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
    const res = svc.buildCacheKey(lspSymbol, false, fakeDoc);
    expect(res.cacheKey).toContain(
      "envX::/workspace/project/src/my_module.py::",
    );
    expect(res.isLibrary).toBeFalsy();
  });

  it("scopes a path-less local symbol to the document instead of colliding globally", () => {
    // Regression test: a bare-name symbol with no LSP definition path (common when
    // Pylance can't resolve a local's definition location) must not be treated as
    // library-scoped just because `path` is missing — that used to let two unrelated
    // local symbols with the same name in different files collide on one cache key.
    const svc = new ResolutionService("envY");
    const lspSymbol: any = { name: "helper", module: undefined, path: undefined };
    const fakeDocA: any = {
      uri: { fsPath: "/workspace/a.py", toString: () => "file:///workspace/a.py" },
    };
    const fakeDocB: any = {
      uri: { fsPath: "/workspace/b.py", toString: () => "file:///workspace/b.py" },
    };
    const resA = svc.buildCacheKey(lspSymbol, false, fakeDocA);
    const resB = svc.buildCacheKey(lspSymbol, false, fakeDocB);
    expect(resA.cacheKey).not.toEqual(resB.cacheKey);
  });
});

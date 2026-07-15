import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DocKeyBuilder } from "../../shared/docKey";

describe("DocKeyBuilder", () => {
  it("serializes basic doc key consistently", () => {
    const symbol = {
      name: "pandas.DataFrame",
      module: "pandas.core.frame",
      package: "pandas",
      qualname: "DataFrame",
      isStdlib: false,
    } as any;
    const dk = DocKeyBuilder.fromSymbol(symbol);
    const key = DocKeyBuilder.toCacheKey(dk);
    assert.equal(key, "pandas::pandas.core.frame::DataFrame");
  });
});

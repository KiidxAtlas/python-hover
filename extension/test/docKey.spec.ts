import { describe, expect, it } from "vitest";
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
    expect(key).toBe("pandas::pandas.core.frame::DataFrame");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectHoverContext } from "../src/hover/hoverContext";

function fakeDocument(lines: string[]) {
  return {
    lineCount: lines.length,
    lineAt: (line: number) => ({ text: lines[line] }),
  } as any;
}

describe("detectHoverContext", () => {
  it("ignores unrelated async and comprehension code farther away", () => {
    const lines = [
      "async def fetch():",
      "    await request()",
      "values = [item for item in source]",
      ...Array.from({ length: 8 }, () => ""),
      'df = pd.DataFrame({"a": [1]})',
      'result = df.groupby("a").agg("sum")',
    ];
    const context = detectHoverContext(fakeDocument(lines), {
      line: 11,
      character: 8,
    } as any);

    assert.deepEqual(context.tags, ["dataframe"]);
  });

  it("keeps context from nearby multiline code", () => {
    const lines = [
      "async def fetch():",
      "    return await requests.get(",
      '        "https://example.com",',
      "        timeout=5,",
      "    )",
    ];
    const context = detectHoverContext(fakeDocument(lines), {
      line: 3,
      character: 10,
    } as any);

    assert.deepEqual(context.tags, ["async", "requests"]);
  });
});

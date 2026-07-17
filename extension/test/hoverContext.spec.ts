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

  it("handles long unmatched brackets without regex backtracking", () => {
    const crafted = `${"[a".repeat(50_000)} for value`;
    const context = detectHoverContext(fakeDocument([crafted]), {
      line: 0,
      character: 0,
    } as any);

    assert.deepEqual(context.tags, []);
  });

  it("detects a comprehension inside nested brackets", () => {
    const context = detectHoverContext(
      fakeDocument(["values = [[item] for item in source]"]),
      { line: 0, character: 10 } as any,
    );

    assert.deepEqual(context.tags, ["comprehension"]);
  });

  it("ignores comprehension-like text in comments and strings", () => {
    const context = detectHoverContext(
      fakeDocument([
        "# example: [item for item in values]",
        'message = "{value for value in values}"',
        "'''[entry for entry in entries]'''",
        "result = []",
      ]),
      { line: 2, character: 10 } as any,
    );

    assert.deepEqual(context.tags, []);
  });
});

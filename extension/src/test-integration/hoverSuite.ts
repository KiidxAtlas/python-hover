import * as fs from "fs";
import * as vscode from "vscode";
import { PythonHoverApi } from "#src/activate";

/**
 * Runs inside a real VS Code extension host (launched by scripts/testHovers.ts via
 * @vscode/test-electron) — NOT a mock. `vscode.executeHoverProvider` here invokes the
 * real, registered hover providers for the open document: PyHover's own HoverProvider
 * *and* Pylance, side by side, exactly as they'd run in the actual editor. This is
 * deliberately not a `vscode`-mocking approach (see git history for the abandoned
 * mock-vscode/scripts/debug-hover.ts draft) — mocking `vscode` can't produce a real
 * Pylance response, which is a large share of what actually resolves a hover.
 *
 * Config (via environment variables, set by the orchestrator):
 *   HOVER_TEST_FILE         — absolute path to the .py file to scan (required)
 *   HOVER_TEST_REPORT_PATH  — where to write the JSON results (required)
 *   HOVER_TEST_LINE         — optional 1-based line number to restrict to
 *   HOVER_TEST_WORD         — optional identifier text to restrict to
 */

export type HoverTestResult = {
  line: number; // 1-based
  character: number;
  word: string;
  /** What PyHover's own pipeline actually extracted for this position, if anything —
   *  the structured HoverDoc, not just rendered markdown. Null if PyHover didn't
   *  produce (or didn't cache as "last") a result for this exact call. */
  extracted: unknown | null;
  /** The combined rendered content of every hover provider's result for this position
   *  (PyHover + Pylance + any other registered provider) — this is what the editor's
   *  hover tooltip would actually show the user. */
  combinedHoverText: string;
  providerCount: number;
  error?: string;
};

const IDENTIFIER_RE = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
const PYTHON_KEYWORDS = new Set([
  "and", "as", "assert", "async", "await", "break", "class", "continue", "def",
  "del", "elif", "else", "except", "finally", "for", "from", "global", "if",
  "import", "in", "is", "lambda", "nonlocal", "not", "or", "pass", "raise",
  "return", "try", "while", "with", "yield", "None", "True", "False",
]);

function collectIdentifierPositions(
  document: vscode.TextDocument,
  lineRange?: { start: number; end: number },
  onlyWord?: string,
): Array<{ line: number; character: number; word: string }> {
  const positions: Array<{ line: number; character: number; word: string }> = [];
  for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
    if (
      lineRange !== undefined &&
      (lineNum + 1 < lineRange.start || lineNum + 1 > lineRange.end)
    ) {
      continue;
    }
    const lineText = document.lineAt(lineNum).text;
    const commentIdx = lineText.indexOf("#");
    const scannable = commentIdx >= 0 ? lineText.slice(0, commentIdx) : lineText;

    let match: RegExpExecArray | null;
    IDENTIFIER_RE.lastIndex = 0;
    while ((match = IDENTIFIER_RE.exec(scannable)) !== null) {
      const word = match[0];
      if (PYTHON_KEYWORDS.has(word)) {
        continue;
      }
      if (onlyWord && word !== onlyWord) {
        continue;
      }
      positions.push({ line: lineNum + 1, character: match.index, word });
    }
  }
  return positions;
}

function renderHoverContents(hover: vscode.Hover): string {
  return hover.contents
    .map((c) => {
      if (typeof c === "string") return c;
      if ("value" in c) return c.value; // MarkdownString
      return String(c);
    })
    .join("\n---\n");
}

async function waitUntil(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 500,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return predicate();
}

export async function run(): Promise<void> {
  const filePath = process.env.HOVER_TEST_FILE;
  const reportPath = process.env.HOVER_TEST_REPORT_PATH;
  const lineStart = process.env.HOVER_TEST_LINE_START
    ? parseInt(process.env.HOVER_TEST_LINE_START, 10)
    : undefined;
  const lineEnd = process.env.HOVER_TEST_LINE_END
    ? parseInt(process.env.HOVER_TEST_LINE_END, 10)
    : lineStart;
  const lineRange =
    lineStart !== undefined ? { start: lineStart, end: lineEnd! } : undefined;
  const onlyWord = process.env.HOVER_TEST_WORD || undefined;

  if (!filePath || !reportPath) {
    throw new Error(
      "hoverSuite: HOVER_TEST_FILE and HOVER_TEST_REPORT_PATH must be set",
    );
  }

  console.log("[hoverSuite] locating kiidxatlas.python-hover extension...");
  const pyHoverExt = vscode.extensions.getExtension<PythonHoverApi>(
    "kiidxatlas.python-hover",
  );
  if (!pyHoverExt) {
    throw new Error(
      "hoverSuite: kiidxatlas.python-hover extension not found — check --extensionDevelopmentPath",
    );
  }
  console.log("[hoverSuite] activating python-hover...");
  const api = await pyHoverExt.activate();
  console.log("[hoverSuite] python-hover activated, api present:", !!api);

  const pylanceExt = vscode.extensions.getExtension("ms-python.vscode-pylance");
  console.log("[hoverSuite] pylance extension found:", !!pylanceExt);
  if (pylanceExt && !pylanceExt.isActive) {
    console.log("[hoverSuite] activating pylance...");
    await pylanceExt.activate();
    console.log("[hoverSuite] pylance activated");
  }

  console.log(`[hoverSuite] opening document: ${filePath}`);
  const document = await vscode.workspace.openTextDocument(filePath);
  console.log(`[hoverSuite] document opened, ${document.lineCount} lines`);
  await vscode.window.showTextDocument(document);
  console.log("[hoverSuite] document shown");

  const targets = collectIdentifierPositions(document, lineRange, onlyWord);
  console.log(`[hoverSuite] ${targets.length} target position(s) to test`);

  // Give Pylance a moment to index the file — its first hover on a fresh document is
  // frequently empty while it's still parsing. Poll a cheap hover at the first *target*
  // position until it returns something, rather than a fixed blind delay. Deliberately
  // probing a target position (not just "the first identifier in the whole file", which
  // is very often inside the module docstring and will never resolve, burning the full
  // timeout for nothing) means the warmup either succeeds fast on real code or times out
  // on the same content we're about to test anyway — no wasted probe.
  if (targets.length > 0) {
    const probe = targets[0];
    const probePosition = new vscode.Position(probe.line - 1, probe.character);
    console.log(
      `[hoverSuite] warmup probe at ${probe.line}:${probe.character} ("${probe.word}")...`,
    );
    const warmed = await waitUntil(async () => {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        document.uri,
        probePosition,
      );
      return !!hovers && hovers.length > 0;
    }, 15_000);
    console.log(`[hoverSuite] warmup ${warmed ? "succeeded" : "timed out"}`);
  }
  const results: HoverTestResult[] = [];

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(
      `[hoverSuite] (${i + 1}/${targets.length}) ${target.word} @ ${target.line}:${target.character}`,
    );
    const position = new vscode.Position(target.line - 1, target.character);
    try {
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        document.uri,
        position,
      );
      const extracted = api?.getLastResolvedDoc() ?? null;
      results.push({
        line: target.line,
        character: target.character,
        word: target.word,
        extracted,
        combinedHoverText: (hovers ?? []).map(renderHoverContents).join("\n===\n"),
        providerCount: hovers?.length ?? 0,
      });
      // Write incrementally so a killed/timed-out run still leaves partial,
      // inspectable results instead of nothing at all.
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
    } catch (e) {
      results.push({
        line: target.line,
        character: target.character,
        word: target.word,
        extracted: null,
        combinedHoverText: "",
        providerCount: 0,
        error: e instanceof Error ? e.message : String(e),
      });
      fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
    }
  }
  console.log("[hoverSuite] all targets processed, writing final report");

  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf8");
}

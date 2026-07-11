#!/usr/bin/env npx tsx
/**
 * Test every hoverable identifier in a Python file against the REAL extension pipeline —
 * not a mock. This launches an actual VS Code instance (reusing your installed copy, no
 * download) with python-hover loaded via --extensionDevelopmentPath, plus your real
 * Pylance install, and calls the same `vscode.executeHoverProvider` command VS Code
 * itself uses. For each identifier it shows what python-hover actually extracted
 * internally (source, confidence, signature, summary, url — see HoverProvider.getLastDoc())
 * and the combined hover text every registered provider (PyHover + Pylance) would show.
 *
 * A pure Node-side mock of `vscode` can't do this faithfully: Pylance itself can't be
 * mocked, and Pylance's LSP output drives a large share of real hover resolution.
 *
 * Usage (run from extension/):
 *   npx tsx scripts/testHovers.ts path/to/file.py
 *   npx tsx scripts/testHovers.ts path/to/file.py --line 12
 *   npx tsx scripts/testHovers.ts path/to/file.py --word DataFrame
 *
 * Requires the extension to be compiled first (npm run compile).
 * Override the VS Code binary with VSCODE_EXECUTABLE_PATH if not on the default macOS path.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runTests } from "@vscode/test-electron";
import type { HoverTestResult } from "../src/test-integration/hoverSuite";

const EXTENSION_DIR = path.resolve(__dirname, "..");
const DEFAULT_VSCODE_PATH =
  "/Applications/Visual Studio Code.app/Contents/MacOS/Electron";

function parseArgs(argv: string[]): {
  file: string;
  lineStart?: number;
  lineEnd?: number;
  word?: string;
} {
  const positional: string[] = [];
  let lineStart: number | undefined;
  let lineEnd: number | undefined;
  let word: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--line" || argv[i] === "--lines") {
      // Accepts "N" (single line) or "N:M" / "N-M" (inclusive range).
      const raw = argv[++i];
      const rangeMatch = raw.match(/^(\d+)[:\-](\d+)$/);
      if (rangeMatch) {
        lineStart = parseInt(rangeMatch[1], 10);
        lineEnd = parseInt(rangeMatch[2], 10);
      } else {
        lineStart = lineEnd = parseInt(raw, 10);
      }
    } else if (argv[i] === "--word") {
      word = argv[++i];
    } else {
      positional.push(argv[i]);
    }
  }

  if (positional.length !== 1) {
    console.error(
      "Usage: npx tsx scripts/testHovers.ts <file.py> [--line N | --line N:M] [--word text]",
    );
    process.exit(1);
  }

  return {
    file: path.resolve(process.cwd(), positional[0]),
    lineStart,
    lineEnd,
    word,
  };
}

function formatExtracted(extracted: unknown): string {
  if (!extracted || typeof extracted !== "object") {
    return "  (nothing — PyHover did not resolve this position)";
  }
  const doc = extracted as Record<string, unknown>;
  const lines: string[] = [];
  if (doc.title) lines.push(`  title:      ${doc.title}`);
  if (doc.source) lines.push(`  source:     ${doc.source}`);
  if (typeof doc.confidence === "number")
    lines.push(`  confidence: ${doc.confidence}`);
  if (doc.signature) lines.push(`  signature:  ${doc.signature}`);
  if (doc.summary)
    lines.push(`  summary:    ${String(doc.summary).slice(0, 200)}`);
  if (doc.url) lines.push(`  url:        ${doc.url}`);
  return lines.length > 0 ? lines.join("\n") : "  (empty doc)";
}

function printReport(results: HoverTestResult[]): void {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`Hover test results — ${results.length} identifier(s) checked`);
  console.log("=".repeat(70));

  for (const r of results) {
    console.log(`\n${r.word}  (${r.line}:${r.character + 1})`);
    console.log("-".repeat(50));
    if (r.error) {
      console.log(`  ERROR: ${r.error}`);
      continue;
    }
    console.log("PyHover extracted:");
    console.log(formatExtracted(r.extracted));
    console.log(
      `\nCombined hover shown in editor (${r.providerCount} provider(s)):`,
    );
    console.log(
      r.combinedHoverText
        ? r.combinedHoverText
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n")
        : "  (no hover — nothing to show)",
    );
  }

  const resolvedCount = results.filter((r) => r.extracted).length;
  console.log(`\n${"=".repeat(70)}`);
  console.log(
    `${resolvedCount}/${results.length} positions resolved by PyHover.`,
  );
  console.log("=".repeat(70));
}

async function main() {
  const { file, lineStart, lineEnd, word } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const extensionTestsPath = path.join(
    EXTENSION_DIR,
    "out",
    "extension",
    "src",
    "test-integration",
    "hoverSuite.js",
  );
  if (!fs.existsSync(extensionTestsPath)) {
    console.error(
      `Compiled test suite not found at ${extensionTestsPath}.\n` +
        "Run `npm run compile` first.",
    );
    process.exit(1);
  }

  const vscodeExecutablePath =
    process.env.VSCODE_EXECUTABLE_PATH || DEFAULT_VSCODE_PATH;
  if (!fs.existsSync(vscodeExecutablePath)) {
    console.error(
      `VS Code executable not found at ${vscodeExecutablePath}.\n` +
        "Set VSCODE_EXECUTABLE_PATH to your VS Code binary.",
    );
    process.exit(1);
  }

  const realExtensionsDir = path.join(os.homedir(), ".vscode", "extensions");
  const tempUserDataDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "pyhover-test-userdata-"),
  );
  const reportPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "pyhover-test-report-")),
    "results.json",
  );

  console.log(`Testing hovers in: ${file}`);
  console.log(`Using VS Code:     ${vscodeExecutablePath}`);
  console.log(`Using extensions:  ${realExtensionsDir} (read-only, for Pylance)`);

  let runError: unknown;
  try {
    await runTests({
      vscodeExecutablePath,
      extensionDevelopmentPath: EXTENSION_DIR,
      extensionTestsPath,
      launchArgs: [
        "--extensions-dir",
        realExtensionsDir,
        "--user-data-dir",
        tempUserDataDir,
      ],
      extensionTestsEnv: {
        HOVER_TEST_FILE: file,
        HOVER_TEST_REPORT_PATH: reportPath,
        ...(lineStart !== undefined
          ? { HOVER_TEST_LINE_START: String(lineStart) }
          : {}),
        ...(lineEnd !== undefined
          ? { HOVER_TEST_LINE_END: String(lineEnd) }
          : {}),
        ...(word !== undefined ? { HOVER_TEST_WORD: word } : {}),
      },
    });
  } catch (e) {
    // The VS Code process can exit non-zero for reasons unrelated to our own
    // per-position error handling (e.g. it got killed after taking too long).
    // hoverSuite.ts writes the report incrementally after every position, so
    // there's often still a usable partial report worth reading even then —
    // don't throw the results away just because the process exit code was bad.
    runError = e;
  }

  if (!fs.existsSync(reportPath)) {
    console.error(
      "No report was written — the test host crashed before hoverSuite.run() reached its first position.",
    );
    if (runError) console.error(runError);
    process.exit(1);
  }

  if (runError) {
    console.warn(
      "\nWarning: the VS Code test process exited abnormally, but a report was written — showing partial results.",
    );
    console.warn(runError instanceof Error ? runError.message : String(runError));
  }

  const results: HoverTestResult[] = JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  );
  printReport(results);

  try {
    execSync(`rm -rf "${tempUserDataDir}" "${path.dirname(reportPath)}"`);
  } catch {
    /* best-effort cleanup */
  }
}

main().catch((e) => {
  console.error("testHovers failed:", e);
  process.exit(1);
});

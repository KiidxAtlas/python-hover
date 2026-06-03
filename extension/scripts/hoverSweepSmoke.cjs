"use strict";

const assert = require("assert");
const Module = require("module");
const path = require("path");
const cp = require("child_process");
const fs = require("fs");

const origResolve = Module._resolveFilename;
const stubPath = path.join(__dirname, "vscode-stub.cjs");
Module._resolveFilename = function (request, parent, isMain) {
  if (request === "vscode") {
    return stubPath;
  }
  return origResolve.call(this, request, parent, isMain);
};

const {
  HoverDocBuilder,
} = require("../out/docs-engine/src/builder/hoverDocBuilder");
const {
  StaticDocResolver,
} = require("../out/docs-engine/src/resolvers/staticDocResolver");
const { DocKeyBuilder } = require("../out/shared/docKey");
const { ResolutionSource } = require("../out/shared/types");
const {
  HoverRenderer,
} = require("../out/extension/src/ui/rendering/hoverRenderer");

const baseConfig = {
  showSignatures: true,
  showDescription: true,
  showReturnTypes: true,
  showPracticalExamples: true,
  showBadges: true,
  showMetadataChips: true,
  showProvenance: true,
  showToolbar: true,
  showCallouts: true,
  showParameterLens: true,
  showParameters: true,
  maxParameters: 8,
  showSeeAlso: true,
  showRaises: true,
  showNotes: true,
  showModuleExports: true,
  showModuleStats: true,
  showFooter: true,
  showImportHints: true,
  showUpdateWarning: true,
  compactMode: false,
  hoverSectionOrder: [
    "signature",
    "parameterLens",
    "callouts",
    "description",
    "parameters",
    "returns",
    "raises",
    "examples",
    "seeAlso",
    "notes",
    "footer",
  ],
  maxExamples: 2,
  maxModuleExports: 20,
  maxSeeAlsoItems: 8,
  maxSnippetLines: 12,
  maxContentLength: 1200,
  docsBrowser: "integrated",
  devdocsBrowser: "external",
  showDebugPinButton: false,
  docsVersion: "3.14",
};

function markdownFromHover(hover) {
  const contents = Array.isArray(hover.contents)
    ? hover.contents
    : [hover.contents];
  return contents
    .map((content) => {
      if (typeof content === "string") {
        return content;
      }
      if (content && typeof content.value === "string") {
        return content.value;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function normalizeResolved(resolved) {
  if (!resolved || typeof resolved !== "object") {
    return null;
  }
  return resolved.error ? null : resolved;
}

function buildSymbolInfo(caseResult, resolved) {
  if (caseResult.ident === "f-string") {
    return {
      name: "f-string",
      qualname: "f-string",
      module: "builtins",
      kind: "keyword",
      isStdlib: true,
    };
  }

  if (
    resolved &&
    (resolved.kind === "keyword" ||
      resolved.kind === "constant" ||
      resolved.kind === "module" ||
      resolved.module === "builtins")
  ) {
    return {
      name: caseResult.ident || resolved.qualname,
      qualname: resolved.qualname || caseResult.ident,
      module: resolved.module || "builtins",
      kind: resolved.kind || "keyword",
      isStdlib: true,
      docstring: resolved.docstring || undefined,
      signature: resolved.signature || undefined,
    };
  }

  return {
    name: caseResult.ident || resolved?.qualname,
    qualname: resolved?.qualname || caseResult.ident,
    module: resolved?.module,
    kind: resolved?.kind,
    isStdlib: !!resolved?.is_stdlib,
    docstring: resolved?.docstring || undefined,
    signature: resolved?.signature || undefined,
  };
}

function buildDocs(caseResult, resolved, staticResolver, symbolInfo) {
  if (!symbolInfo || !symbolInfo.name) {
    return { doc: null, source: "unresolved" };
  }

  const staticDoc = staticResolver.resolve(
    DocKeyBuilder.fromSymbol(symbolInfo),
  );
  if (staticDoc) {
    return { doc: staticDoc, source: "static" };
  }

  if (!resolved) {
    return { doc: null, source: "unresolved" };
  }

  const source = resolved.module
    ? ResolutionSource.Runtime
    : ResolutionSource.Local;
  return {
    doc: {
      title: resolved.qualname || caseResult.ident,
      kind: resolved.kind,
      signature: resolved.signature || undefined,
      summary: resolved.docstring || undefined,
      content: resolved.docstring || undefined,
      url: resolved.url || undefined,
      source,
      confidence: 1,
      module: resolved.module || undefined,
      sourceUrl: resolved.url || undefined,
      seeAlso: resolved.seeAlso || undefined,
    },
    source: source === ResolutionSource.Local ? "local" : "runtime",
  };
}

function printCase(caseResult, hoverDoc, markdown, sourceLabel) {
  const title = hoverDoc.title || caseResult.ident || caseResult.token;
  const signature = hoverDoc.signature
    ? ` sig=${JSON.stringify(hoverDoc.signature)}`
    : "";
  const moduleText = hoverDoc.module ? ` module=${hoverDoc.module}` : "";
  const sourceText = hoverDoc.source ? ` source=${hoverDoc.source}` : "";
  const line = `[${sourceLabel}] ${caseResult.line}:${caseResult.col} ${JSON.stringify(caseResult.token)} -> ${JSON.stringify(caseResult.ident)} | ${title} | ${hoverDoc.kind || "n/a"}${moduleText}${sourceText}${signature}`;
  console.log(line);

  const shouldDump =
    caseResult.ident === "f-string" ||
    caseResult.ident === "for" ||
    caseResult.ident === "match" ||
    caseResult.ident === "case" ||
    caseResult.ident === "join" ||
    caseResult.ident === "upper" ||
    caseResult.ident === "__str__" ||
    !markdown;

  if (shouldDump) {
    console.log("--- hover markdown ---");
    console.log(markdown || "<empty>");
    console.log("----------------------");
  }
}

async function main() {
  const sourceFile = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(__dirname, "../..", "test_hover.py");
  const matchPattern = process.argv[3] ? new RegExp(process.argv[3]) : null;

  const repoPython = path.resolve(
    __dirname,
    "..",
    "..",
    ".venv",
    "bin",
    "python",
  );
  const python =
    process.env.PYHOVER_PYTHON ||
    process.env.PYTHON ||
    (fs.existsSync(repoPython) ? repoPython : "python");
  const helperScript = path.join(
    __dirname,
    "..",
    "python-helper",
    "hover_sweep.py",
  );
  const helperArgs = ["--file", sourceFile];
  if (process.argv[3]) {
    helperArgs.push("--match", process.argv[3]);
  }
  const raw = cp.execFileSync(python, [helperScript, ...helperArgs], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: "1",
    },
  });
  const sweep = JSON.parse(raw);

  const staticResolver = new StaticDocResolver(sweep.python_version);
  const builder = new HoverDocBuilder();
  const renderer = new HoverRenderer(baseConfig);
  renderer.setDetectedVersion(sweep.python_version);

  let docsCount = 0;
  let unresolvedCount = 0;

  for (const caseResult of sweep.cases) {
    const resolved = normalizeResolved(caseResult.resolved);
    const symbolInfo = buildSymbolInfo(caseResult, resolved);
    if (!symbolInfo || !symbolInfo.name) {
      unresolvedCount += 1;
      const unresolvedLine = `[unresolved] ${caseResult.line}:${caseResult.col} ${JSON.stringify(caseResult.token)} -> ${JSON.stringify(caseResult.ident)} | <no symbol>`;
      if (!matchPattern || matchPattern.test(unresolvedLine)) {
        console.log(unresolvedLine);
      }
      continue;
    }
    const { doc, source } = buildDocs(
      caseResult,
      resolved,
      staticResolver,
      symbolInfo,
    );
    const hoverDoc = builder.build(symbolInfo, doc);
    const hover = renderer.render(hoverDoc);
    const markdown = markdownFromHover(hover);

    if (doc) {
      docsCount += 1;
    } else {
      unresolvedCount += 1;
    }

    const rendered = [];
    const title = hoverDoc.title || caseResult.ident || caseResult.token;
    const signature = hoverDoc.signature
      ? ` sig=${JSON.stringify(hoverDoc.signature)}`
      : "";
    const moduleText = hoverDoc.module ? ` module=${hoverDoc.module}` : "";
    const sourceText = hoverDoc.source ? ` source=${hoverDoc.source}` : "";
    rendered.push(
      `[${source}] ${caseResult.line}:${caseResult.col} ${JSON.stringify(caseResult.token)} -> ${JSON.stringify(caseResult.ident)} | ${title} | ${hoverDoc.kind || "n/a"}${moduleText}${sourceText}${signature}`,
    );
    if (
      caseResult.ident === "f-string" ||
      caseResult.ident === "for" ||
      caseResult.ident === "match" ||
      caseResult.ident === "case" ||
      caseResult.ident === "join" ||
      caseResult.ident === "upper" ||
      caseResult.ident === "__str__" ||
      !markdown
    ) {
      rendered.push("--- hover markdown ---");
      rendered.push(markdown || "<empty>");
      rendered.push("----------------------");
    }
    const combined = rendered.join("\n");
    if (!matchPattern || matchPattern.test(combined)) {
      console.log(combined);
    }
  }

  console.log(
    `\nSummary: ${docsCount} rendered hovers, ${unresolvedCount} unresolved tokens, ${sweep.cases.length} total probes.`,
  );

  assert.ok(
    sweep.cases.length > 0,
    "expected the sweep to collect hover cases",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

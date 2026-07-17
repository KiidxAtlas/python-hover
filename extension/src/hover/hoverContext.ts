import { HoverContextHints } from "#shared/types";
import type * as vscode from "vscode";

type ContextRule = {
  tag: string;
  summary: string;
  test: (text: string) => boolean;
};

function hasComprehension(text: string): boolean {
  const stack: Array<{ opener: "[" | "{"; sawFor: boolean }> = [];
  let quote: "'" | '"' | "'''" | '"""' | undefined;
  let inComment = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inComment) {
      if (char === "\n") inComment = false;
      continue;
    }
    if (quote) {
      if ((quote === "'" || quote === '"') && char === "\\") {
        i++;
        continue;
      }
      if (text.startsWith(quote, i)) {
        i += quote.length - 1;
        quote = undefined;
      } else if ((quote === "'" || quote === '"') && char === "\n") {
        quote = undefined;
      }
      continue;
    }
    if (char === "#") {
      inComment = true;
      continue;
    }
    if (text.startsWith("'''", i) || text.startsWith('"""', i)) {
      quote = text.slice(i, i + 3) as "'''" | '"""';
      i += 2;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "[" || char === "{") {
      stack.push({ opener: char, sawFor: false });
      continue;
    }
    if (char === "]" || char === "}") {
      const opener = char === "]" ? "[" : "{";
      const frame = stack[stack.length - 1];
      if (frame?.opener === opener) {
        stack.pop();
        if (frame.sawFor) return true;
      }
      continue;
    }
    if (
      stack.length > 0 &&
      text.startsWith("for", i) &&
      !/[A-Za-z0-9_]/.test(text[i - 1] ?? "") &&
      !/[A-Za-z0-9_]/.test(text[i + 3] ?? "")
    ) {
      stack[stack.length - 1].sawFor = true;
    }
  }
  return false;
}

const CONTEXT_RULES: ContextRule[] = [
  {
    tag: "async",
    summary: "Async call path detected",
    test: (text) =>
      /\basync\s+def\b|\bawait\b|\basync\s+with\b|\basync\s+for\b/.test(text),
  },
  {
    tag: "dataframe",
    summary: "DataFrame pipeline nearby",
    test: (text) =>
      /\b(?:df|dataframe|pandas|pd)\b/.test(text) &&
      /\.(?:groupby|agg|apply|merge|join|pivot|assign|pipe)\b/.test(text),
  },
  {
    tag: "dataclass",
    summary: "Dataclass scope detected",
    test: (text) => /@dataclass\b|\bfrom\s+dataclasses\s+import\b/.test(text),
  },
  {
    tag: "comprehension",
    summary: "Comprehension expression nearby",
    test: hasComprehension,
  },
  {
    tag: "requests",
    summary: "HTTP requests usage nearby",
    test: (text) =>
      /\brequests\.(?:get|post|put|patch|delete|request)\b/.test(text),
  },
];

const EXAMPLE_HINTS: Record<string, RegExp[]> = {
  async: [/\basync\b|\bawait\b|asyncio|timeout\(/i],
  dataframe: [/groupby|agg\(|merge\(|apply\(|dataframe|series|pd\./i],
  dataclass: [/@dataclass|field\(|asdict\(|replace\(/i],
  comprehension: [/\bfor\b.+\bin\b|\[.+\]|\{.+\}/i],
  requests: [/requests\.|timeout|headers|params|json=/i],
};

export function detectHoverContext(
  document: vscode.TextDocument,
  position: vscode.Position,
): HoverContextHints {
  // Context should describe the statement the user is looking at, not unrelated
  // constructs elsewhere in the file. Four lines in either direction still covers
  // common chained/multiline calls without allowing a distant comprehension or async
  // function to reorder examples for the current symbol.
  const start = Math.max(0, position.line - 4);
  const end = Math.min(document.lineCount - 1, position.line + 4);
  const slice: string[] = [];

  for (let line = start; line <= end; line++) {
    slice.push(document.lineAt(line).text);
  }

  const text = slice.join("\n");
  const tags: string[] = [];
  const summaries: string[] = [];

  for (const rule of CONTEXT_RULES) {
    if (!rule.test(text)) {
      continue;
    }
    tags.push(rule.tag);
    summaries.push(rule.summary);
  }

  return {
    tags,
    summary:
      summaries.length > 0 ? summaries.join(" · ") : "General Python context",
  };
}

export function prioritizeExamplesForContext(
  examples: string[] | undefined,
  context: HoverContextHints,
): string[] | undefined {
  if (!examples || examples.length <= 1 || context.tags.length === 0) {
    return examples;
  }

  const scored = examples.map((example, index) => {
    const score = scoreExample(example, context.tags);
    return { example, index, score };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.index - right.index;
  });

  return scored.map((item) => item.example);
}

function scoreExample(example: string, tags: string[]): number {
  let score = 0;
  for (const tag of tags) {
    const hints = EXAMPLE_HINTS[tag] ?? [];
    for (const hint of hints) {
      if (hint.test(example)) {
        score += 2;
      }
    }
  }

  if (/\bexample\b/i.test(example)) {
    score += 1;
  }

  return score;
}

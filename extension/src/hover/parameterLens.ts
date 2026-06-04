import {
  ActiveParameterLens,
  HoverDoc,
  ParameterInfo,
  ParameterValidation,
} from "#shared/types";
import * as vscode from "vscode";

export async function resolveActiveParameterLens(
  document: vscode.TextDocument,
  position: vscode.Position,
): Promise<ActiveParameterLens | null> {
  const signatureHelp =
    await vscode.commands.executeCommand<vscode.SignatureHelp | null>(
      "vscode.executeSignatureHelpProvider",
      document.uri,
      position,
    );

  if (!signatureHelp || signatureHelp.signatures.length === 0) {
    return null;
  }

  const activeSignatureIndex = clampIndex(
    signatureHelp.activeSignature ?? 0,
    signatureHelp.signatures.length,
  );
  const activeSignature = signatureHelp.signatures[activeSignatureIndex];
  const parameters = activeSignature.parameters ?? [];
  if (parameters.length === 0) {
    return null;
  }

  const rawParameterIndex =
    activeSignature.activeParameter ?? signatureHelp.activeParameter ?? 0;
  const parameterIndex = clampIndex(rawParameterIndex, parameters.length);
  const activeParameter = parameters[parameterIndex];
  if (!activeParameter) {
    return null;
  }

  const parameterLabel = getParameterLabel(
    activeSignature.label,
    activeParameter.label,
  );
  const documentation = documentationToString(activeParameter.documentation);
  const callableDocumentation = documentationToString(
    activeSignature.documentation,
  );
  const signatureParameters = parameters.map((parameter) => {
    const label = getParameterLabel(activeSignature.label, parameter.label);
    return parseParameterInfo(
      label,
      documentationToString(parameter.documentation),
    );
  });

  const callableExpression = extractActiveCallExpression(document, position);
  const argumentExpression = extractActiveArgumentExpression(
    document,
    position,
    parameterIndex,
  );
  const mergedParameter = parseParameterInfo(parameterLabel, documentation);
  const validation = validateActiveArgument(
    mergedParameter,
    argumentExpression,
  );

  return {
    callable: callableExpression || extractCallableLabel(activeSignature.label),
    signature: activeSignature.label.trim(),
    callableDocumentation,
    parameters: signatureParameters,
    parameterLabel,
    parameter: mergedParameter,
    parameterIndex,
    parameterCount: parameters.length,
    source: "signatureHelp",
    argumentExpression,
    validation,
  };
}

export function mergeActiveParameterLensWithDoc(
  lens: ActiveParameterLens,
  doc: HoverDoc,
): ActiveParameterLens {
  const parameters = doc.parameters ?? [];
  if (parameters.length === 0) {
    return lens;
  }

  const normalizedLensName = normalizeParameterName(lens.parameter.name);
  const matchedParameter =
    parameters.find(
      (parameter) =>
        normalizeParameterName(parameter.name) === normalizedLensName,
    ) ?? parameters[lens.parameterIndex];

  if (!matchedParameter) {
    return lens;
  }

  return {
    ...lens,
    parameter: {
      name: matchedParameter.name || lens.parameter.name,
      type: matchedParameter.type || lens.parameter.type,
      default: matchedParameter.default ?? lens.parameter.default,
      description: matchedParameter.description || lens.parameter.description,
      isRequired: matchedParameter.isRequired ?? lens.parameter.isRequired,
    },
    source: "merged",
    validation: validateActiveArgument(
      {
        name: matchedParameter.name || lens.parameter.name,
        type: matchedParameter.type || lens.parameter.type,
        default: matchedParameter.default ?? lens.parameter.default,
        description: matchedParameter.description || lens.parameter.description,
        isRequired: matchedParameter.isRequired ?? lens.parameter.isRequired,
      },
      lens.argumentExpression,
    ),
  };
}

export function isActiveParameterMatch(
  lens: ActiveParameterLens | undefined,
  parameter: ParameterInfo,
  index: number,
): boolean {
  if (!lens) {
    return false;
  }

  const lensName = normalizeParameterName(lens.parameter.name);
  const parameterName = normalizeParameterName(parameter.name);
  if (lensName && parameterName && lensName === parameterName) {
    return true;
  }

  return lens.parameterIndex === index;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(index, length - 1));
}

function getParameterLabel(
  signatureLabel: string,
  label: string | [number, number],
): string {
  if (typeof label === "string") {
    return label.trim();
  }

  const [start, end] = label;
  return signatureLabel.slice(start, end).trim();
}

function documentationToString(
  documentation: string | vscode.MarkdownString | undefined,
): string | undefined {
  if (!documentation) {
    return undefined;
  }

  if (typeof documentation === "string") {
    return documentation.trim() || undefined;
  }

  return documentation.value.trim() || undefined;
}

function extractCallableLabel(signature: string): string {
  const cleaned = signature.replace(/^\([a-z][a-z0-9_]*\)\s+/i, "").trim();
  const match = /^([A-Za-z_][\w.]*)\s*[[(]/.exec(cleaned);
  if (match) {
    return match[1];
  }
  return cleaned.split(/[[(]/)[0]?.trim() || cleaned;
}

export function extractActiveCallExpression(
  document: vscode.TextDocument,
  position: vscode.Position,
): string | null {
  const line = document.lineAt(position.line).text;
  const openParenIndex = findEnclosingCallOpenParen(line, position.character);
  if (openParenIndex === -1) {
    return null;
  }

  let cursor = openParenIndex - 1;
  while (cursor >= 0 && /\s/.test(line[cursor])) {
    cursor--;
  }
  if (cursor < 0) {
    return null;
  }

  const end = cursor + 1;
  while (cursor >= 0 && /[A-Za-z0-9_]/.test(line[cursor])) {
    cursor--;
  }
  const start = cursor + 1;
  if (start >= end || !/^[A-Za-z_]/.test(line[start] ?? "")) {
    return null;
  }

  let expression = line.slice(start, end);
  let scan = start - 1;
  while (scan >= 0) {
    while (scan >= 0 && /\s/.test(line[scan])) {
      scan--;
    }
    if (scan < 0 || line[scan] !== ".") {
      break;
    }
    scan--;
    while (scan >= 0 && /\s/.test(line[scan])) {
      scan--;
    }
    if (scan < 0 || !/[A-Za-z0-9_]/.test(line[scan])) {
      break;
    }
    const segmentEnd = scan + 1;
    while (scan >= 0 && /[A-Za-z0-9_]/.test(line[scan])) {
      scan--;
    }
    const segmentStart = scan + 1;
    if (!/^[A-Za-z_]/.test(line[segmentStart] ?? "")) {
      break;
    }
    expression = `${line.slice(segmentStart, segmentEnd)}.${expression}`;
  }

  return expression || null;
}

function findEnclosingCallOpenParen(line: string, cursor: number): number {
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  for (let index = Math.min(cursor, line.length - 1); index >= 0; index--) {
    const char = line[index];
    if (char === ")") {
      parenDepth++;
      continue;
    }
    if (char === "]") {
      bracketDepth++;
      continue;
    }
    if (char === "}") {
      braceDepth++;
      continue;
    }
    if (char === "(") {
      if (parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
        return index;
      }
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (char === "[") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (char === "{") {
      braceDepth = Math.max(0, braceDepth - 1);
    }
  }

  return -1;
}

function parseParameterInfo(
  label: string,
  description?: string,
): ParameterInfo {
  const cleanedLabel = label.trim();
  const variadicPrefix = cleanedLabel.startsWith("**")
    ? "**"
    : cleanedLabel.startsWith("*")
      ? "*"
      : "";
  const body = variadicPrefix
    ? cleanedLabel.slice(variadicPrefix.length).trim()
    : cleanedLabel;
  const nameMatch = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(body);
  const parameterName = nameMatch?.[1] ?? cleanedLabel;
  const remainder = nameMatch ? body.slice(parameterName.length).trim() : "";

  let type: string | undefined;
  let defaultValue: string | undefined;

  const typeMatch = remainder.match(/^:\s*([^=]+?)(?:\s*=\s*(.+))?$/);
  if (typeMatch) {
    type = typeMatch[1]?.trim() || undefined;
    defaultValue = typeMatch[2]?.trim() || undefined;
  } else {
    const defaultMatch = remainder.match(/^=\s*(.+)$/);
    defaultValue = defaultMatch?.[1]?.trim() || undefined;
  }

  return {
    name: parameterName,
    type,
    default: defaultValue,
    description,
  };
}

function normalizeParameterName(name: string | undefined): string {
  return (name ?? "").replace(/^\*+/, "").trim().toLowerCase();
}

function extractActiveArgumentExpression(
  document: vscode.TextDocument,
  position: vscode.Position,
  parameterIndex: number,
): string | undefined {
  const line = document.lineAt(position.line).text;
  const openParenIndex = findEnclosingCallOpenParen(line, position.character);
  if (openParenIndex === -1) {
    return undefined;
  }

  const cursor = Math.max(openParenIndex + 1, position.character);
  const slice = line.slice(openParenIndex + 1, cursor);
  const args = splitTopLevelCommaArgs(slice);
  const value = args[Math.min(parameterIndex, args.length - 1)]?.trim();
  return value || undefined;
}

function splitTopLevelCommaArgs(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index++) {
    const char = value[index];

    if (quote) {
      current += char;
      if (char === quote && value[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }

    if (char === "(") {
      paren++;
      current += char;
      continue;
    }
    if (char === ")") {
      paren = Math.max(0, paren - 1);
      current += char;
      continue;
    }
    if (char === "[") {
      bracket++;
      current += char;
      continue;
    }
    if (char === "]") {
      bracket = Math.max(0, bracket - 1);
      current += char;
      continue;
    }
    if (char === "{") {
      brace++;
      current += char;
      continue;
    }
    if (char === "}") {
      brace = Math.max(0, brace - 1);
      current += char;
      continue;
    }

    if (char === "," && paren === 0 && bracket === 0 && brace === 0) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function validateActiveArgument(
  parameter: ParameterInfo,
  argumentExpression?: string,
): ParameterValidation | undefined {
  if (!argumentExpression) {
    return undefined;
  }

  const argument = argumentExpression.trim();
  if (!argument) {
    return undefined;
  }

  const literalOptions = extractLiteralOptions(parameter.type);
  const argumentLiteral = extractStringLiteral(argument);
  if (literalOptions.length > 0 && argumentLiteral) {
    if (literalOptions.includes(argumentLiteral)) {
      return {
        status: "valid",
        message: `Value looks valid for this parameter (${argumentLiteral}).`,
      };
    }
    return {
      status: "warning",
      message: `"${argumentLiteral}" is not in allowed values: ${literalOptions.join(", ")}.`,
    };
  }

  if (/^timeout$/i.test(parameter.name)) {
    if (/^\d+(?:\.\d+)?$/.test(argument) || /^\(.+,.+\)$/.test(argument)) {
      return {
        status: "valid",
        message: "Timeout accepts float seconds or a (connect, read) tuple.",
      };
    }
    return {
      status: "unknown",
      message:
        "Timeout usually accepts float seconds or a (connect, read) tuple.",
    };
  }

  if (parameter.type?.toLowerCase().includes("bool")) {
    if (/^(True|False)$/i.test(argument)) {
      return {
        status: "valid",
        message: "Boolean argument matches expected type.",
      };
    }
  }

  if (
    parameter.type?.toLowerCase().includes("tuple") &&
    !/^\(.+\)$/.test(argument)
  ) {
    return {
      status: "warning",
      message: "Expected a tuple-like value for this parameter.",
    };
  }

  return {
    status: "unknown",
    message: "Argument shape could not be validated statically.",
  };
}

function extractLiteralOptions(typeValue?: string): string[] {
  if (!typeValue) {
    return [];
  }

  const literalMatch = /Literal\[([^\]]+)\]/i.exec(typeValue);
  if (!literalMatch) {
    return [];
  }

  return literalMatch[1]
    .split(",")
    .map((part) => extractStringLiteral(part.trim()) ?? part.trim())
    .filter(Boolean);
}

function extractStringLiteral(value: string): string | null {
  const match = /^['"](.+)['"]$/.exec(value.trim());
  return match?.[1] ?? null;
}

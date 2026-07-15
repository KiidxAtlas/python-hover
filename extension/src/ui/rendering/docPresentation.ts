import { HoverDoc, ParameterInfo, StructuredHoverSection } from "#shared/types";
import {
  cleanContent,
  cleanSignature,
  stripDocumentationBoilerplate,
} from "#src/ui/rendering/contentCleaner";

export function getDisplayTitle(title: string): string {
  return title.replace(/^builtins\./, "");
}

export function buildDescriptionContent(
  doc: Pick<HoverDoc, "summary" | "content">,
): string | undefined {
  const summary = doc.summary?.trim();
  const content = doc.content?.trim();

  if (!summary) {
    return content;
  }

  if (!content) {
    return summary;
  }

  const normalizedSummary = normalizeComparableContent(summary);
  const normalizedContent = normalizeComparableContent(content);

  if (!normalizedSummary) {
    return content;
  }

  if (!normalizedContent) {
    return summary;
  }

  if (normalizedContent.includes(normalizedSummary)) {
    return content;
  }

  if (normalizedSummary.includes(normalizedContent)) {
    return summary;
  }

  return `${summary}\n\n${content}`;
}

export function normalizeComparableContent(value: string): string {
  return normalizeText(value);
}

export function buildCopyableSignature(
  title: string,
  signature: string,
): string {
  let normalized = cleanSignature(signature);
  if (normalized.startsWith("(")) {
    normalized = `${getDisplayTitle(title)}${normalized}`;
  }
  return normalized;
}

export function getRequiredPythonVersion(
  doc: Pick<HoverDoc, "requiresPython">,
): string | undefined {
  const match = doc.requiresPython?.match(/(\d+\.\d+)/);
  return match?.[1];
}

export function getDisplayParameters(
  doc: Pick<HoverDoc, "parameters" | "kind">,
): ParameterInfo[] {
  const parameters = doc.parameters ?? [];
  if (parameters.length === 0) {
    return [];
  }

  return parameters.filter(
    (parameter, index) =>
      !isImplicitReceiverParameter(parameter, index, doc.kind) &&
      !isSignatureMarkerParameter(parameter),
  );
}

function isSignatureMarkerParameter(parameter: ParameterInfo): boolean {
  const normalized = (parameter.name ?? "").trim();
  return normalized === "/" || normalized === "*" || normalized === "";
}

export function isMeaningfullyOutdated(
  installed: string,
  latest: string,
): boolean {
  if (installed === latest) {
    return false;
  }

  const parseVersion = (value: string): number[] => {
    const normalized = value.replace(/^[^0-9]*/, "");
    const numeric = normalized.split(/[^0-9.]+/, 1)[0] ?? normalized;
    return numeric
      .split(".")
      .map((part) => Number(part))
      .filter((part) => Number.isFinite(part));
  };

  const installedParts = parseVersion(installed);
  const latestParts = parseVersion(latest);
  const maxLength = Math.max(installedParts.length, latestParts.length);

  for (let index = 0; index < maxLength; index++) {
    const installedPart = installedParts[index] ?? 0;
    const latestPart = latestParts[index] ?? 0;
    if (installedPart === latestPart) {
      continue;
    }

    return latestPart > installedPart;
  }

  return false;
}

export function buildImportStatement(
  doc: Pick<HoverDoc, "source" | "title" | "kind" | "module">,
): string | undefined {
  if (doc.source === "Local") {
    return undefined;
  }

  const rawTitle = getDisplayTitle(doc.title);
  if (!rawTitle || /^__\w+__$/.test(rawTitle)) {
    return undefined;
  }

  if (doc.kind === "module") {
    return rawTitle === "builtins" ? undefined : `import ${rawTitle}`;
  }

  if (!doc.module || doc.module === "builtins") {
    return undefined;
  }

  const titleSegments = rawTitle.split(".").filter(Boolean);
  const moduleSegments = doc.module.split(".").filter(Boolean);
  const leafName = titleSegments[titleSegments.length - 1] || rawTitle;
  const ownerName = moduleSegments[moduleSegments.length - 1] || doc.module;
  const rootModule = moduleSegments.slice(0, -1).join(".");
  const titleOwner =
    titleSegments.length > 1
      ? titleSegments[titleSegments.length - 2]
      : undefined;
  // A class-named owner is normally PascalCase (PEP8), but some well-known types
  // deliberately break that convention to read like builtins (numpy.ndarray, and
  // built-in str/int/list/dict themselves) — so also trust `doc.kind`, which is
  // independently classified upstream (Sphinx/docs-engine), not guessed from casing.
  const ownerIsClassKind = /^(?:method|property|field)$/i.test(doc.kind ?? "");
  const looksLikeClassMember =
    moduleSegments.length > 1 &&
    rawTitle.startsWith(`${doc.module}.`) &&
    (/^[A-Z]/.test(ownerName) || ownerIsClassKind);
  const looksLikeTopLevelClassMember = Boolean(
    titleOwner &&
    titleSegments.length > 1 &&
    moduleSegments.length === 1 &&
    titleSegments[0] === titleOwner &&
    ownerIsClassKind,
  );

  if (looksLikeClassMember && rootModule) {
    return `from ${rootModule} import ${ownerName}`;
  }

  if (looksLikeTopLevelClassMember) {
    return `from ${doc.module} import ${titleOwner}`;
  }

  return `from ${doc.module} import ${leafName}`;
}

export function getVisibleStructuredDescriptionSections(
  doc: HoverDoc,
): StructuredHoverSection[] {
  const sourceSections = doc.structuredContent?.sections ?? [];
  const sections: StructuredHoverSection[] = [];
  const grammarSections: StructuredHoverSection[] = [];
  const seen = new Set<string>();

  for (const section of sourceSections) {
    const cleanedSection = sanitizeStructuredSection(section);
    if (!cleanedSection) {
      continue;
    }

    if (
      cleanedSection.role === "example" ||
      cleanedSection.role === "note" ||
      cleanedSection.kind === "note"
    ) {
      continue;
    }

    const sectionField =
      getStructuredFieldKind(cleanedSection.title) ??
      inferStructuredFieldKind(cleanedSection, doc.parameters);

    if (sectionField === "parameters" && doc.parameters?.length) {
      continue;
    }
    if (sectionField === "returns" && doc.returns) {
      continue;
    }
    if (sectionField === "raises" && doc.raises?.length) {
      continue;
    }

    const dedupeKey = getStructuredSectionDedupKey(cleanedSection);
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    // Defer "Syntax"/BNF blocks to the end for ordinary symbols — a grammar
    // aside is secondary to a function/class's actual prose docs. Keyword
    // hovers are the opposite: someone hovering `def`/`for`/`match` wants the
    // syntax first, exactly where Python's own reference docs put it — and
    // deferring it risks it getting truncated out of the hover entirely if
    // the surrounding prose is long.
    if (
      doc.kind?.toLowerCase() !== "keyword" &&
      cleanedSection.kind === "code" &&
      (cleanedSection.language === "text" || !cleanedSection.language) &&
      (cleanedSection.content?.includes("::=") ||
        cleanedSection.title === "Syntax")
    ) {
      grammarSections.push(cleanedSection);
      continue;
    }

    sections.push(cleanedSection);
  }

  return [...sections, ...grammarSections];
}

export function getVisibleStructuredNoteSections(
  doc: HoverDoc,
): StructuredHoverSection[] {
  const sections: StructuredHoverSection[] = [];
  const seen = new Set<string>();

  for (const note of doc.notes ?? []) {
    pushSanitizedSection(sections, seen, {
      kind: "note",
      role: "note",
      content: note,
    });
  }

  for (const section of doc.structuredContent?.sections ?? []) {
    if (section.role === "note" || section.kind === "note") {
      pushSanitizedSection(sections, seen, section);
    }
  }

  return sections;
}

export function getVisibleNoteItems(
  doc: HoverDoc,
): Array<{ label: string; text: string }> {
  return getVisibleStructuredNoteSections(doc)
    .map((section) => {
      const text = cleanContent(getStructuredSectionText(section)).trim();
      if (!text) {
        return undefined;
      }

      return {
        label: section.title?.trim() || "Note",
        text,
      };
    })
    .filter((item): item is { label: string; text: string } => Boolean(item));
}

export function getStructuredExampleSections(
  doc: HoverDoc,
): StructuredHoverSection[] {
  const sections: StructuredHoverSection[] = [];
  const seen = new Set<string>();

  for (const section of doc.structuredContent?.sections ?? []) {
    if (section.role === "example") {
      pushSanitizedSection(sections, seen, section);
    }
  }

  return sections;
}

export function getCompactExample(doc: HoverDoc): string | undefined {
  const structuredExample = getStructuredExampleSections(doc)
    .map((section) => getStructuredSectionText(section).trim())
    .find(Boolean);
  const rawExample = structuredExample || doc.examples?.[0]?.trim();
  if (!rawExample) {
    return undefined;
  }

  return rawExample.split(/\r?\n/).slice(0, 4).join("\n");
}

function getStructuredFieldKind(
  title?: string,
): "parameters" | "returns" | "raises" | undefined {
  if (!title) {
    return undefined;
  }
  if (/^(?:Parameters|Args|Arguments)$/i.test(title)) {
    return "parameters";
  }
  if (/^Returns?$/i.test(title)) {
    return "returns";
  }
  if (/^Raises?$/i.test(title)) {
    return "raises";
  }
  return undefined;
}

function inferStructuredFieldKind(
  section: StructuredHoverSection,
  parameters: ParameterInfo[] | undefined,
): "parameters" | "returns" | "raises" | undefined {
  const rawContent =
    section.kind === "list" ? (section.items ?? []).join(" ") : section.content;
  const normalized = normalizeText(rawContent);
  if (!normalized) {
    return undefined;
  }

  if (parameters?.length) {
    const parameterNames = parameters
      .map((parameter) => normalizeParameterName(parameter.name))
      .filter(Boolean);
    if (
      parameterNames.some(
        (name) =>
          normalized.startsWith(`${name}:`) ||
          normalized.startsWith(`${name} `) ||
          normalized.startsWith(`${name},`) ||
          normalized.startsWith(`${name}=`),
      )
    ) {
      return "parameters";
    }
  }

  // Only infer returns/raises when the content looks like a typed field entry, not prose.
  // "returns: int" or "returns" (bare) → infer; "returns a new list" → do not infer.
  if (/^(?:returns?|yields?)(?:\s*[:()-]|$)/i.test(normalized)) {
    return "returns";
  }

  if (/^(?:raises?|exceptions?)(?:\s*[:()-]|$)/i.test(normalized)) {
    return "raises";
  }

  return undefined;
}

function getStructuredSectionDedupKey(section: StructuredHoverSection): string {
  const rawContent =
    section.kind === "list"
      ? (section.items ?? []).join(" | ")
      : section.content;
  const normalizedContent = normalizeText(rawContent);
  // Note sections can appear both in doc.notes (no title) and in structuredContent.sections
  // (with a title like "Note"). Deduplicate by content only to prevent double-rendering.
  if (section.kind === "note" || section.role === "note") {
    return `note:${normalizedContent}`;
  }
  const normalizedTitle = normalizeText(section.title ?? "");
  return `${section.kind}:${section.role ?? ""}:${normalizedTitle}:${normalizedContent}`;
}

function sanitizeStructuredSection(
  section: StructuredHoverSection,
): StructuredHoverSection | undefined {
  if (section.kind === "code") {
    const cleanedCode = stripDocumentationBoilerplate(section.content || "");
    return cleanedCode ? { ...section, content: cleanedCode } : undefined;
  }

  if (section.kind === "list") {
    const items = (section.items ?? [])
      .map((item) => stripDocumentationBoilerplate(item))
      .filter(Boolean);
    if (items.length === 0) {
      return undefined;
    }
    return {
      ...section,
      content: items.join("\n"),
      items,
    };
  }

  const cleanedContent = stripDocumentationBoilerplate(section.content || "");
  if (!cleanedContent || /^(?:…|\.\.\.)$/.test(cleanedContent.trim())) {
    return undefined;
  }

  return {
    ...section,
    content: cleanedContent,
  };
}

function pushSanitizedSection(
  sections: StructuredHoverSection[],
  seen: Set<string>,
  section: StructuredHoverSection,
): void {
  const cleanedSection = sanitizeStructuredSection(section);
  if (!cleanedSection) {
    return;
  }

  const dedupeKey = getStructuredSectionDedupKey(cleanedSection);
  if (!dedupeKey || seen.has(dedupeKey)) {
    return;
  }

  seen.add(dedupeKey);
  sections.push(cleanedSection);
}

function getStructuredSectionText(section: StructuredHoverSection): string {
  if (section.kind === "list") {
    return (section.items ?? []).join("\n");
  }

  return section.content;
}

function normalizeParameterName(name: string | undefined): string {
  return normalizeText((name ?? "").replace(/^\*+/, ""));
}

function isImplicitReceiverParameter(
  parameter: ParameterInfo,
  index: number,
  kind?: string,
): boolean {
  if (index !== 0) {
    return false;
  }

  const normalizedName = normalizeParameterName(parameter.name);
  if (normalizedName !== "self" && normalizedName !== "cls") {
    return false;
  }

  return /^(?:method|classmethod|staticmethod|function|class)$/i.test(
    kind ?? "",
  );
}

function normalizeText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

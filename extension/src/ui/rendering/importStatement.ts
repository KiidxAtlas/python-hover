import type { HoverDoc } from "#shared/types";

export function buildImportStatement(
  doc: Pick<HoverDoc, "source" | "title" | "kind" | "module">,
): string | undefined {
  if (doc.source === "Local") return undefined;

  const rawTitle = doc.title.replace(/^builtins\./, "");
  if (!rawTitle || /^__\w+__$/.test(rawTitle)) return undefined;
  if (doc.kind === "module") {
    return rawTitle === "builtins" ? undefined : `import ${rawTitle}`;
  }
  if (!doc.module || doc.module === "builtins") return undefined;

  const titleSegments = rawTitle.split(".").filter(Boolean);
  const moduleSegments = doc.module.split(".").filter(Boolean);
  const leafName = titleSegments[titleSegments.length - 1] || rawTitle;
  const ownerName = moduleSegments[moduleSegments.length - 1] || doc.module;
  const rootModule = moduleSegments.slice(0, -1).join(".");
  const titleOwner = titleSegments.length > 1
    ? titleSegments[titleSegments.length - 2]
    : undefined;
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
    ownerIsClassKind
  );

  if (looksLikeClassMember && rootModule) {
    return `from ${rootModule} import ${ownerName}`;
  }
  if (looksLikeTopLevelClassMember) {
    const importName = titleOwner === moduleSegments[0] ? leafName : titleOwner;
    return `from ${doc.module} import ${importName}`;
  }
  return `from ${doc.module} import ${leafName}`;
}

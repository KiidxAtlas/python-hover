import json
import re
import sys
from pathlib import Path

from identifier import identify_at_position
from resolver import get_docstring_from_source, resolve_symbol

KEYWORD_TARGETS = {
    "for",
    "if",
    "else",
    "pass",
    "match",
    "case",
    "with",
    "as",
    "async",
    "await",
    "yield",
}


def split_targets(comment_text: str) -> list[str]:
    value = comment_text.strip()
    if value.startswith("hover over "):
        value = value[len("hover over ") :]

    tokens: list[str] = []
    for chunk in value.split(","):
        for part in chunk.split("/"):
            cleaned = part.strip()
            if not cleaned:
                continue
            if "→" in cleaned:
                cleaned = cleaned.split("→", 1)[0].strip()
            if cleaned:
                tokens.append(cleaned)

    return tokens


def find_target_column(code: str, target: str) -> int | None:
    if target in {"[", "{", '"', "..."}:
        return code.find(target)

    pattern = re.compile(rf"\b{re.escape(target)}\b")
    match = pattern.search(code)
    if match:
        return match.start()

    direct = code.find(target)
    return direct if direct >= 0 else None


def extract_access_expression(code: str, column: int, target: str) -> str:
    if column < 0:
        return target

    end = column + len(target)
    if target in {"[", "{", '"', "..."}:
        return target

    start = column
    while start > 0 and re.match(r"[A-Za-z0-9_]", code[start - 1]):
        start -= 1

    segments = [code[start:end]]
    cursor = start

    while cursor > 0:
        idx = cursor - 1
        while idx >= 0 and code[idx].isspace():
            idx -= 1
        if idx < 0 or code[idx] != ".":
            break
        idx -= 1
        while idx >= 0 and code[idx].isspace():
            idx -= 1
        if idx < 0:
            break

        if code[idx] in ")]":
            open_char = "(" if code[idx] == ")" else "["
            close_char = code[idx]
            depth = 0
            while idx >= 0:
                if code[idx] == close_char:
                    depth += 1
                elif code[idx] == open_char:
                    depth -= 1
                    if depth == 0:
                        idx -= 1
                        break
                idx -= 1
            while idx >= 0 and code[idx].isspace():
                idx -= 1
            if idx < 0:
                break

        ident_end = idx + 1
        while idx >= 0 and re.match(r"[A-Za-z0-9_]", code[idx]):
            idx -= 1
        ident = code[idx + 1 : ident_end]
        if not ident or not re.match(r"^[A-Za-z_][A-Za-z0-9_]*$", ident):
            break
        segments.insert(0, ident)
        cursor = idx + 1

    return ".".join(segments)


def inspect_file(file_path: Path) -> list[dict]:
    source = file_path.read_text(encoding="utf-8")
    results: list[dict] = []

    for line_no, line in enumerate(source.splitlines(), start=1):
        if "# hover over" not in line:
            continue

        code, comment = line.split("#", 1)
        targets = split_targets(comment)
        for target in targets:
            column = find_target_column(code, target)
            if column is None:
                results.append(
                    {
                        "line": line_no,
                        "target": target,
                        "expression": None,
                        "identified": None,
                        "resolved": None,
                        "status": "target-not-found",
                    }
                )
                continue

            expression = extract_access_expression(code, column, target)
            identified = (
                target
                if target in KEYWORD_TARGETS
                else identify_at_position(source, line_no, column)
            )
            resolved = resolve_symbol(identified or expression)
            status = (
                "resolved" if resolved and not resolved.get("error") else "unresolved"
            )

            if status != "resolved" and identified and "." in identified:
                local_doc = get_docstring_from_source(source, identified)
                if local_doc and not local_doc.get("error"):
                    resolved = {
                        "module": local_doc.get("module"),
                        "qualname": local_doc.get("qualname"),
                        "signature": local_doc.get("signature"),
                        "error": None,
                    }
                    status = "local"

            results.append(
                {
                    "line": line_no,
                    "target": target,
                    "expression": expression,
                    "identified": identified,
                    "resolved": {
                        "module": resolved.get("module")
                        if isinstance(resolved, dict)
                        else None,
                        "qualname": resolved.get("qualname")
                        if isinstance(resolved, dict)
                        else None,
                        "signature": resolved.get("signature")
                        if isinstance(resolved, dict)
                        else None,
                        "docstring": resolved.get("docstring")
                        if isinstance(resolved, dict)
                        else None,
                        "is_stdlib": resolved.get("is_stdlib")
                        if isinstance(resolved, dict)
                        else None,
                        "kind": resolved.get("kind")
                        if isinstance(resolved, dict)
                        else None,
                        "error": resolved.get("error")
                        if isinstance(resolved, dict)
                        else None,
                    },
                    "status": status,
                }
            )

    return results


def main() -> int:
    file_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("test_hover.py")
    results = inspect_file(file_path)
    print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import ast
import io
import json
import sys
import tokenize
from pathlib import Path
import re
from collections.abc import Sequence

from identifier import identify_at_position
from resolver import get_docstring_from_source, resolve_symbol


SKIP_TOKEN_TYPES = {
    tokenize.COMMENT,
    tokenize.DEDENT,
    tokenize.ENCODING,
    tokenize.INDENT,
    tokenize.NL,
    tokenize.NEWLINE,
}


def collect_local_defs(tree: ast.AST) -> set[str]:
    names: set[str] = set()

    def walk(nodes: Sequence[ast.AST], prefix: str = "") -> None:
        for node in nodes:
            if isinstance(node, ast.ClassDef):
                qualname = f"{prefix}.{node.name}" if prefix else node.name
                names.add(qualname)
                walk(node.body, qualname)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                qualname = f"{prefix}.{node.name}" if prefix else node.name
                names.add(qualname)
                walk(node.body, qualname)

    if isinstance(tree, ast.Module):
        walk(tree.body)
    return names


def token_probe_position(token: tokenize.TokenInfo) -> tuple[int, int]:
    length = max(0, token.end[1] - token.start[1])
    return token.start[0], token.start[1] + max(0, length // 2)


def build_case(source: str, token: tokenize.TokenInfo, local_defs: set[str]) -> dict:
    line, col = token_probe_position(token)
    ident = identify_at_position(source, line, col)
    resolved = None
    if ident:
        if ident in local_defs or any(ident.startswith(prefix + ".") for prefix in local_defs):
            resolved = get_docstring_from_source(source, ident)
        else:
            resolved = resolve_symbol(ident)

    lines = source.splitlines()
    line_text = lines[line - 1] if 0 <= line - 1 < len(lines) else ""
    return {
        "line": line,
        "col": col,
        "token": token.string,
        "token_type": tokenize.tok_name[token.type],
        "ident": ident,
        "resolved": resolved,
        "line_text": line_text,
    }


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Sweep hover targets in a Python source file.")
    parser.add_argument("--file", required=True, help="Python source file to sweep")
    parser.add_argument("--match", help="Optional regex to filter reported cases")
    args = parser.parse_args()

    source_path = Path(args.file).expanduser().resolve()
    source = source_path.read_text(encoding="utf-8")

    tree = ast.parse(source)
    local_defs = collect_local_defs(tree)
    match_re = re.compile(args.match) if args.match else None

    cases: list[dict] = []
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type in SKIP_TOKEN_TYPES:
            continue
        case = build_case(source, token, local_defs)
        if match_re and not match_re.search(
            f"{case['line']}:{case['col']} {case['token']} {case['ident']} {case['line_text']}"
        ):
            continue
        cases.append(case)

    print(
        json.dumps(
            {
                "file": str(source_path),
                "python_version": f"{sys.version_info.major}.{sys.version_info.minor}",
                "cases": cases,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
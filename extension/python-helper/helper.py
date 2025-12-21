import argparse
import json
import sys

from identifier import identify_at_position
from resolver import resolve_symbol


def main():
    parser = argparse.ArgumentParser(description="Python Helper for PyHover")
    parser.add_argument("--resolve", help="Resolve a symbol to its documentation")
    parser.add_argument(
        "--identify", action="store_true", help="Identify symbol at position"
    )
    parser.add_argument("--file", help="File path or - for stdin")
    parser.add_argument("--line", type=int, help="Line number (1-based)")
    parser.add_argument("--column", type=int, help="Column number (0-based)")
    parser.add_argument(
        "--version-info", action="store_true", help="Get Python version info"
    )
    args = parser.parse_args()

    if args.version_info:
        print(
            json.dumps(
                {
                    "version": f"{sys.version_info.major}.{sys.version_info.minor}",
                    "full_version": sys.version,
                }
            )
        )
        return

    if args.identify:
        if not args.file or args.line is None or args.column is None:
            print(json.dumps({"error": "Missing arguments for identify"}))
            return

        source = ""
        if args.file == "-":
            source = sys.stdin.read()
        else:
            try:
                with open(args.file, "r", encoding="utf-8") as f:
                    source = f.read()
            except Exception as e:
                print(json.dumps({"error": str(e)}))
                return

        result = identify_at_position(source, args.line, args.column)
        print(result if result else "")
        return

    if args.resolve:
        result = resolve_symbol(args.resolve)
        print(json.dumps(result))


if __name__ == "__main__":
    main()

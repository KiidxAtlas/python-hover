import argparse
import json
import sys

from identifier import identify_at_position
from resolver import resolve_symbol


def main():
    parser = argparse.ArgumentParser(description="Python Helper for PyHover")
    parser.add_argument("--resolve", help="Resolve a symbol to its documentation")
    parser.add_argument(
        "--identify",
        help="Identify symbol at position (requires --line and --column)",
        action="store_true",
    )
    parser.add_argument("--file", help="File path for identification")
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
        if args.line is None or args.column is None:
            print(json.dumps({"error": "Missing arguments for identification"}))
            return

        try:
            if args.file and args.file != "-":
                with open(args.file, "r", encoding="utf-8") as f:
                    source = f.read()
            else:
                # Read from stdin
                source = sys.stdin.read()

            result = identify_at_position(source, args.line, args.column)
            print(json.dumps({"type": result}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
        return

    if args.resolve:
        result = resolve_symbol(args.resolve)
        print(json.dumps(result))


if __name__ == "__main__":
    main()

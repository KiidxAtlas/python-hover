import argparse
import json
import sys

from identifier import identify_at_position
from resolver import get_docstring_from_source, resolve_symbol


def server_mode():
    """
    Persistent IPC server — reads newline-delimited JSON requests from stdin,
    writes newline-delimited JSON responses to stdout.

    Request format:
        {"id": <int>, "cmd": "resolve",       "symbol": "<name>"}
        {"id": <int>, "cmd": "identify",      "source": "<src>", "line": <n>, "col": <n>}
        {"id": <int>, "cmd": "version_info"}

    Response format (success):
        {"id": <int>, "result": <any>}
    Response format (error):
        {"id": <int>, "error": "<message>"}
    """
    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue

        req_id = 0
        try:
            req = json.loads(raw)
            req_id = req.get("id", 0)
            cmd = req.get("cmd")

            if cmd == "resolve":
                result = resolve_symbol(req["symbol"])
            elif cmd == "get_docstring":
                result = get_docstring_from_source(req["source"], req["symbol"])
            elif cmd == "identify":
                result = identify_at_position(req["source"], req["line"], req["col"])
                result = {"type": result}
            elif cmd == "version_info":
                result = {
                    "version": f"{sys.version_info.major}.{sys.version_info.minor}",
                    "full_version": sys.version,
                }
            elif cmd == "pkg_version":
                pkg = req.get("package", "")
                try:
                    import importlib.metadata
                    result = {"version": importlib.metadata.version(pkg)}
                except Exception:
                    result = {"version": None}
            else:
                result = None
                print(
                    json.dumps({"id": req_id, "error": f"Unknown command: {cmd}"}),
                    flush=True,
                )
                continue

            print(json.dumps({"id": req_id, "result": result}), flush=True)

        except Exception as e:
            print(json.dumps({"id": req_id, "error": str(e)}), flush=True)


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
    parser.add_argument(
        "--server", action="store_true", help="Run as persistent IPC server"
    )
    args = parser.parse_args()

    if args.server:
        server_mode()
        return

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

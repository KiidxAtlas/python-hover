import builtins
import importlib
import importlib.metadata
import importlib.util
import inspect
import io
import keyword
import os
import pydoc
import sys


def resolve_symbol(symbol_name):
    """
    Resolves a symbol to its documentation and metadata.
    """
    try:
        # 0. Check if it's a keyword
        if keyword.iskeyword(symbol_name):
            # Capture help() output for the keyword
            capture = io.StringIO()
            original_stdout = sys.stdout
            sys.stdout = capture
            try:
                pydoc.help(symbol_name)
            finally:
                sys.stdout = original_stdout

            doc = capture.getvalue()

            return {
                "docstring": doc,
                "signature": None,
                "module": "builtins",
                "qualname": symbol_name,
                "kind": "keyword",
                "is_stdlib": True,
            }

        # 1. Try as a builtin
        if hasattr(builtins, symbol_name):
            obj = getattr(builtins, symbol_name)
            return _describe(obj, "builtins", symbol_name)

        # 1.5 Strip 'builtins.' prefix if present
        # This handles cases like 'builtins.list.append' which might fail to import as a module path
        if symbol_name.startswith("builtins."):
            short_name = symbol_name[9:]
            # Check if the short name is a builtin (e.g. 'list')
            if hasattr(builtins, short_name):
                obj = getattr(builtins, short_name)
                return _describe(obj, "builtins", short_name)

            # Update parts for subsequent strategies
            parts = short_name.split(".")
            # Also update symbol_name for Strategy B logic?
            # Actually, Strategy B uses 'parts', so we just need to update 'parts'.
            # But Strategy A uses 'parts' too.

            # Let's just use the short name for the rest of the logic
            symbol_name = short_name

        # 2. Try as a dotted path
        parts = symbol_name.split(".")

        # Strategy A: Try to find a module prefix (longest match first)
        # This handles 'os.path.join', 'datetime.datetime.now', 'builtins.list.append'
        for i in range(len(parts), 0, -1):
            module_path = ".".join(parts[:i])
            remainder = parts[i:]

            try:
                module = importlib.import_module(module_path)
            except Exception:
                # Catching Exception to be robust against weird import errors
                # e.g. "No module named 'builtins.list'; 'builtins' is not a package"
                continue

            # Found a module, try to traverse the rest
            try:
                obj = module
                for part in remainder:
                    obj = getattr(obj, part)
                return _describe(obj, module_path, symbol_name)
            except AttributeError:
                # Found module but path inside it is wrong.
                pass

        # Strategy B: Check if the root is a builtin (e.g. list.append)
        # 'list' is not a module, so Strategy A fails.
        if len(parts) > 1 and hasattr(builtins, parts[0]):
            try:
                obj = getattr(builtins, parts[0])
                for part in parts[1:]:
                    obj = getattr(obj, part)
                return _describe(obj, "builtins", symbol_name)
            except AttributeError:
                pass

        raise ImportError(f"Could not resolve {symbol_name}")

    except Exception as e:
        return {"error": str(e)}


def _describe(obj, module_name, name):
    if inspect.ismodule(obj):
        defined_module = obj.__name__
    else:
        defined_module = getattr(obj, "__module__", None)

    # Prefer the module we used to access it, if it's a standard library module
    # This handles os.chdir (nt), os.path (ntpath), re.match (re vs _sre?)
    if module_name and _is_stdlib(module_name):
        final_module = module_name
    else:
        final_module = defined_module or module_name

    try:
        signature = str(inspect.signature(obj)) if callable(obj) else None
    except ValueError:
        # Some builtins (like dict) might fail signature inspection
        signature = None

    url = (
        _get_stdlib_url(final_module, getattr(obj, "__qualname__", name), obj)
        if _is_stdlib(final_module)
        else None
    )

    return {
        "docstring": inspect.getdoc(obj),
        "signature": signature,
        "module": final_module,
        "qualname": getattr(
            obj, "__qualname__", name or getattr(obj, "__name__", str(obj))
        ),
        "is_stdlib": _is_stdlib(final_module),
        "url": url,
    }


def _get_stdlib_url(module_name, qualname, obj):
    version = f"{sys.version_info.major}.{sys.version_info.minor}"
    base = f"https://docs.python.org/{version}/library"

    if module_name == "builtins":
        if inspect.isclass(obj) or isinstance(obj, type):
            # Types like list, dict, int, str are in stdtypes.html
            # Exceptions are in exceptions.html
            if issubclass(obj, BaseException):
                return f"{base}/exceptions.html#{qualname}"
            return f"{base}/stdtypes.html#{qualname}"
        elif callable(obj):
            # Builtin functions like len, print are in functions.html
            # But methods on builtin types (list.append) are in stdtypes.html
            if "." in qualname:
                return f"{base}/stdtypes.html#{qualname}"
            return f"{base}/functions.html#{qualname}"

    # Standard library modules
    return f"{base}/{module_name}.html#{qualname}"


def _is_stdlib(module_name):
    if not module_name:
        return False

    root_pkg = module_name.split(".")[0]

    if root_pkg in sys.builtin_module_names:
        return True

    if hasattr(sys, "stdlib_module_names"):
        return root_pkg in sys.stdlib_module_names

    # Fallback for older Python versions
    try:
        spec = importlib.util.find_spec(root_pkg)
        if spec is None or spec.origin is None:
            return False

        # If it's in site-packages, it's definitely 3rd party
        origin = spec.origin.lower()
        if "site-packages" in origin or "dist-packages" in origin:
            return False

        # If it lives in the standard library path
        lib_path = os.path.dirname(os.__file__).lower()
        if origin.startswith(lib_path):
            return True

        return False
    except:
        return False
        return False

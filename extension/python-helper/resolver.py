import ast
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

    docstring = inspect.getdoc(obj)

    # Discard docstring if it is the parent module's own docstring (not the object's).
    # This happens with typing aliases where __doc__ is not overridden per-symbol.
    if docstring and not inspect.ismodule(obj) and module_name:
        try:
            parent_mod = importlib.import_module(module_name)
            parent_doc = inspect.getdoc(parent_mod)
            if parent_doc and docstring.strip() == parent_doc.strip():
                docstring = None
        except Exception:
            pass

    try:
        # Suppress signatures for all typing module objects regardless of Python version.
        # Typing constructs (_GenericAlias, _SpecialForm, etc.) inherit __call__ from
        # their implementation class, producing misleading (*args, **kwargs) signatures.
        # Since typing constructs are used as annotation forms (List[int]), not called
        # directly, we never want to show a callable signature for them.
        if getattr(obj, "__module__", None) == "typing":
            signature = None
        elif callable(obj):
            signature = str(inspect.signature(obj))
        else:
            signature = None
    except (ValueError, TypeError):
        signature = None

    url = (
        _get_stdlib_url(final_module, getattr(obj, "__qualname__", name), obj)
        if _is_stdlib(final_module)
        else None
    )

    return {
        "docstring": docstring,
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


def get_docstring_from_source(source: str, symbol_name: str) -> dict:
    """
    Extract the docstring for a function or class from source code using AST.
    Used for local user-defined symbols that can't be imported.

    symbol_name may be a simple name ("my_func") or a dotted qualified name
    ("MyClass.my_method").
    """
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        return {"error": f"SyntaxError: {e}"}

    parts = symbol_name.split(".")
    node = _find_ast_node(tree.body, parts)
    if node is None:
        return {"error": f"Symbol '{symbol_name}' not found in source"}

    docstring = ast.get_docstring(node)
    signature = _ast_signature(node)
    kind = "class" if isinstance(node, ast.ClassDef) else "function"

    return {
        "docstring": docstring,
        "signature": signature,
        "kind": kind,
        "qualname": symbol_name,
        "module": None,
        "is_stdlib": False,
    }


def _find_ast_node(stmts, parts):
    """Recursively walk the AST to find a function/class matching the dotted path."""
    if not parts:
        return None
    name = parts[0]
    for node in stmts:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            if node.name == name:
                if len(parts) == 1:
                    return node
                if isinstance(node, ast.ClassDef):
                    return _find_ast_node(node.body, parts[1:])
    return None


def _ast_signature(node) -> str | None:
    """Build a rough signature string from an AST function node."""
    if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        return None
    try:
        args = node.args
        params = []

        # positional-only (Python 3.8+)
        for i, arg in enumerate(args.posonlyargs):
            default_offset = len(args.posonlyargs) - len(args.defaults)
            idx = i - default_offset
            if idx >= 0 and idx < len(args.defaults):
                params.append(f"{arg.arg}={ast.unparse(args.defaults[idx])}")
            else:
                params.append(arg.arg)
        if args.posonlyargs:
            params.append("/")

        # regular args
        reg_defaults_start = len(args.args) - len(args.defaults)
        for i, arg in enumerate(args.args):
            default_idx = i - reg_defaults_start
            if default_idx >= 0 and default_idx < len(args.defaults):
                params.append(f"{arg.arg}={ast.unparse(args.defaults[default_idx])}")
            else:
                params.append(arg.arg)

        if args.vararg:
            params.append(f"*{args.vararg.arg}")
        elif args.kwonlyargs:
            params.append("*")

        for i, arg in enumerate(args.kwonlyargs):
            if i < len(args.kw_defaults) and args.kw_defaults[i] is not None:
                params.append(f"{arg.arg}={ast.unparse(args.kw_defaults[i])}")
            else:
                params.append(arg.arg)

        if args.kwarg:
            params.append(f"**{args.kwarg.arg}")

        ret = f" -> {ast.unparse(node.returns)}" if node.returns else ""
        prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
        return f"{prefix} {node.name}({', '.join(params)}){ret}"
    except Exception:
        return None


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

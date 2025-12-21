import builtins
import importlib
import importlib.util
import inspect
import io
import keyword
import os
import pydoc
import sys


def resolve_symbol(symbol_name):
    """
    Resolves a symbol to its documentation and metadata using a robust strategy.
    """
    try:
        # 1. Keyword Check
        if keyword.iskeyword(symbol_name):
            return _describe_keyword(symbol_name)

        # 2. Normalize Symbol (Handle 'builtins.' prefix)
        # 'builtins' is a module, but 'builtins.list' is not importable as a module.
        # We strip it to treat 'builtins.list' as 'list' (which is in builtins namespace).
        if symbol_name.startswith("builtins."):
            candidate = symbol_name[9:]
            # Only strip if the remainder is actually in builtins or looks like a path starting there
            root = candidate.split(".")[0]
            if hasattr(builtins, root):
                symbol_name = candidate

        # 3. Try to resolve as a dotted path
        # This covers:
        # - Modules: 'os', 'json'
        # - Classes/Functions in modules: 'os.path.join', 'json.dumps'
        # - Builtins: 'list', 'len' (via fallback)
        # - Methods on builtins: 'list.append', 'str.join' (via fallback)

        return _resolve_dotted_path(symbol_name)

    except Exception as e:
        return {"error": str(e)}


def _resolve_dotted_path(path):
    parts = path.split(".")

    # Strategy A: Import Descent
    # Try to import the longest possible prefix as a module.
    # e.g. for 'a.b.c.d', try 'a.b.c.d', then 'a.b.c', then 'a.b', then 'a'.
    for i in range(len(parts), 0, -1):
        module_path = ".".join(parts[:i])
        remainder = parts[i:]

        try:
            module = importlib.import_module(module_path)
        except Exception:
            # If import fails (ModuleNotFoundError, ImportError, or runtime error in module),
            # we assume this prefix is not a valid module and continue shrinking.
            continue

        # We found a valid module. Now try to traverse the remaining attributes.
        try:
            obj = _traverse_attributes(module, remainder)
            return _describe(obj, module_path, path)
        except AttributeError:
            # The module exists, but the path inside it is invalid.
            # This might mean we imported a parent package but the submodule isn't exposed.
            # Continue searching for a shorter prefix?
            # No, if 'os.path' exists but 'os.path.foo' doesn't, 'os' won't have 'path.foo' either.
            # UNLESS 'os.path' was a variable shadowing a module? Unlikely.
            pass

    # Strategy B: Builtin Root
    # If no module prefix matched, check if the root is a builtin object.
    # e.g. 'list.append' -> 'list' is in builtins.
    root = parts[0]
    if hasattr(builtins, root):
        try:
            obj = getattr(builtins, root)
            obj = _traverse_attributes(obj, parts[1:])
            return _describe(obj, "builtins", path)
        except AttributeError:
            pass

    raise ImportError(f"Could not resolve {path}")


def _traverse_attributes(obj, parts):
    """Traverses attributes of an object."""
    for part in parts:
        obj = getattr(obj, part)
    return obj


def _describe_keyword(name):
    capture = io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = capture
    try:
        pydoc.help(name)
    finally:
        sys.stdout = original_stdout

    return {
        "docstring": capture.getvalue(),
        "signature": None,
        "module": "builtins",
        "qualname": name,
        "kind": "keyword",
        "is_stdlib": True,
    }


def _describe(obj, module_name, name):
    # Determine the true module where the object is defined
    if inspect.ismodule(obj):
        defined_module = obj.__name__
    else:
        defined_module = getattr(obj, "__module__", None)

    # Prefer the module we used to access it if it's in the stdlib
    # This helps with aliased modules (e.g. 'os.path' vs 'ntpath')
    # If we resolved via 'os.path.join', module_name is 'os.path'.
    # If we resolved via 'ntpath.join', module_name is 'ntpath'.

    # If the defined module is internal (e.g. ntpath), but we have a better alias in sys.modules (e.g. os.path), use that.
    final_module = defined_module or module_name

    if final_module and _is_stdlib(final_module):
        # Check for better aliases in sys.modules
        # We want to map 'ntpath' -> 'os.path' dynamically
        try:
            module_obj = sys.modules.get(final_module)
            if module_obj:
                for alias, mod in sys.modules.items():
                    if mod is module_obj and alias != final_module:
                        # Prefer 'os.path' over 'ntpath'
                        if alias == "os.path":
                            final_module = alias
                            break
                        # Prefer 're' over 'sre_compile' (though re imports sre_compile, they are different objects usually)
                        # But for os.path, they are the SAME object.
        except Exception:
            pass

    # Get Signature
    signature = None
    if callable(obj):
        try:
            signature = str(inspect.signature(obj))
        except (ValueError, TypeError):
            # Some builtins (like dict) or C-extensions fail signature inspection
            pass

    # Get Qualname
    qualname = getattr(obj, "__qualname__", name or getattr(obj, "__name__", str(obj)))

    # Generate URL
    url = None
    if _is_stdlib(final_module):
        url = _get_stdlib_url(final_module, qualname, obj)

    return {
        "docstring": inspect.getdoc(obj),
        "signature": signature,
        "module": final_module,
        "qualname": qualname,
        "is_stdlib": _is_stdlib(final_module),
        "url": url,
    }


def _get_stdlib_url(module_name, qualname, obj):
    version = f"{sys.version_info.major}.{sys.version_info.minor}"
    base = f"https://docs.python.org/{version}/library"

    if module_name == "builtins":
        if inspect.isclass(obj) or isinstance(obj, type):
            if issubclass(obj, BaseException):
                return f"{base}/exceptions.html#{qualname}"
            return f"{base}/stdtypes.html#{qualname}"
        elif callable(obj):
            if "." in qualname:
                return f"{base}/stdtypes.html#{qualname}"
            return f"{base}/functions.html#{qualname}"

    return f"{base}/{module_name}.html#{qualname}"


def _is_stdlib(module_name):
    if not module_name:
        return False

    root_pkg = module_name.split(".")[0]

    if root_pkg in sys.builtin_module_names:
        return True

    if hasattr(sys, "stdlib_module_names"):
        return root_pkg in sys.stdlib_module_names

    try:
        spec = importlib.util.find_spec(root_pkg)
        if spec is None or spec.origin is None:
            return False

        origin = spec.origin.lower()
        if "site-packages" in origin or "dist-packages" in origin:
            return False

        lib_path = os.path.dirname(os.__file__).lower()
        if origin.startswith(lib_path):
            return True
    except Exception:
        pass

    return False

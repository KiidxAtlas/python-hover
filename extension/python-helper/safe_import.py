import importlib
import threading


def safe_import_module(module_name, timeout=2.0):
    """
    Imports a module with a timeout to prevent hanging on side-effects.
    """
    result = [None]  # type: list[any]

    def _import():
        try:
            result[0] = importlib.import_module(module_name)
        except Exception:
            pass

    t = threading.Thread(target=_import)
    t.start()
    t.join(timeout)

    if t.is_alive():
        # Timeout occurred
        return None

    return result[0]

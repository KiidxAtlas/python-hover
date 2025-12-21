import importlib


def test_resolve(symbol_name):
    parts = symbol_name.split(".")
    print(f"Resolving {symbol_name}")

    for i in range(len(parts), 0, -1):
        module_path = ".".join(parts[:i])
        print(f"Trying to import: {module_path}")

        try:
            module = importlib.import_module(module_path)
            print(f"Success: {module}")
            return
        except ImportError as e:
            print(f"ImportError: {e}")
        except Exception as e:
            print(f"Other Error: {type(e)} {e}")


test_resolve("builtins.list.append")
test_resolve("builtins.list.append")

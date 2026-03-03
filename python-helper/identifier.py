import ast


def identify_at_position(source, line, col):
    """
    Identifies the Python construct at the given line and column.
    line is 1-based, col is 0-based.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    target_node = None
    min_range = float("inf")

    # Keep track of parents to reconstruct qualified names
    parents = {}
    for node in ast.walk(tree):
        for _field, value in ast.iter_fields(node):
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, ast.AST):
                        parents[item] = node
            elif isinstance(value, ast.AST):
                parents[value] = node

    for node in ast.walk(tree):
        # Ensure node has position info (Python 3.8+)
        if not hasattr(node, "lineno") or not hasattr(node, "end_lineno"):
            continue

        start_line = node.lineno
        end_line = node.end_lineno
        start_col = node.col_offset
        end_col = node.end_col_offset

        # Check if the cursor (line, col) is within this node
        # Note: line is 1-based, col is 0-based

        # Line check
        if line < start_line or line > end_line:
            continue

        # Column check (only relevant if on start or end line)
        if line == start_line and col < start_col:
            continue
        if line == end_line and col > end_col:
            continue

        # Calculate "size" to find the most specific (smallest) node
        size = (end_line - start_line) * 10000 + (end_col - start_col)

        if size < min_range:
            min_range = size
            target_node = node

    if not target_node:
        return None

    # ast.Expr is a statement wrapper (e.g. a bare expression on its own line).
    # It has the exact same bounds as its child, so unwrap it to get the real expression.
    if isinstance(target_node, ast.Expr):
        target_node = target_node.value

    return _map_node_to_type(target_node, parents)


def _map_node_to_type(node, parents):
    # Literals
    if isinstance(node, (ast.List, ast.ListComp)):
        return "list"
    if isinstance(node, (ast.Dict, ast.DictComp)):
        return "dict"
    if isinstance(node, (ast.Set, ast.SetComp)):
        return "set"
    if isinstance(node, ast.Tuple):
        return "tuple"

    # Strings / F-Strings
    if isinstance(node, ast.JoinedStr):
        return "f-string"

    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool):  # bool before int — bool is a subclass of int
            return "bool"
        if isinstance(node.value, int):
            return "int"
        if isinstance(node.value, float):
            return "float"
        if isinstance(node.value, complex):
            return "complex"
        if isinstance(node.value, str):
            return "str"
        if isinstance(node.value, bytes):
            return "bytes"
        if node.value is None:
            return "None"
        if node.value is ...:
            return "Ellipsis"

    # Python < 3.8 Str/Num/NameConstant
    if hasattr(ast, "Str") and isinstance(node, ast.Str):
        return "str"

    # Class Definitions
    if isinstance(node, ast.ClassDef):
        name = node.name
        curr = node
        while curr in parents:
            curr = parents[curr]
            if isinstance(curr, ast.ClassDef):
                name = f"{curr.name}.{name}"
        return name

    # Function Definitions - Try to reconstruct qualified name
    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
        name = node.name
        curr = node
        while curr in parents:
            curr = parents[curr]
            if isinstance(curr, ast.ClassDef):
                name = f"{curr.name}.{name}"
            elif isinstance(curr, (ast.FunctionDef, ast.AsyncFunctionDef)):
                name = f"{curr.name}.{name}"
        return name

    return None

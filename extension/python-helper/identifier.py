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
        for child in ast.iter_fields(node):
            if isinstance(child, list):
                for item in child:
                    if isinstance(item, ast.AST):
                        parents[item] = node
            elif isinstance(child, ast.AST):
                parents[child] = node

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
        if isinstance(node.value, str):
            return "str"
        if isinstance(node.value, bool):
            return "bool"
        if isinstance(node.value, (int, float)):
            return type(node.value).__name__
        if node.value is None:
            return "None"

    # Python < 3.8 Str/Num/NameConstant
    if hasattr(ast, "Str") and isinstance(node, ast.Str):
        return "str"

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
    return None

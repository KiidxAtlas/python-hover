import ast
from dataclasses import dataclass, field


@dataclass
class InferenceContext:
    aliases: dict[str, str] = field(default_factory=dict)
    assignments: dict[str, str] = field(default_factory=dict)
    class_attrs: dict[str, dict[str, str]] = field(default_factory=dict)


COPY_METHODS = {"copy", "__copy__", "__deepcopy__"}


def identify_at_position(source, line, col):
    """
    Identifies the Python construct at the given line and column.
    line is 1-based, col is 0-based.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    context = _build_inference_context(tree)

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
        start_line = getattr(node, "lineno", None)
        end_line = getattr(node, "end_lineno", None)
        start_col = getattr(node, "col_offset", None)
        end_col = getattr(node, "end_col_offset", None)
        if None in (start_line, end_line, start_col, end_col):
            continue

        assert start_line is not None
        assert end_line is not None
        assert start_col is not None
        assert end_col is not None

        start_line = int(start_line)
        end_line = int(end_line)
        start_col = int(start_col)
        end_col = int(end_col)

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

    return _map_node_to_type(target_node, parents, context)


def _map_node_to_type(node, parents, context):
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
            # Suppress hover for docstring literals (first expression in a class/function/module body)
            parent = parents.get(node)  # ast.Expr wrapper
            if isinstance(parent, ast.Expr):
                grandparent = parents.get(parent)
                if isinstance(
                    grandparent,
                    (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef, ast.Module),
                ):
                    if grandparent.body and grandparent.body[0] is parent:
                        return "docstring_literal"
            return "str"
        if isinstance(node.value, bytes):
            return "bytes"
        if node.value is None:
            return "None"
        if node.value is ...:
            return "Ellipsis"

    if isinstance(node, ast.Name):
        return context.assignments.get(node.id) or context.aliases.get(node.id)

    if isinstance(node, ast.Attribute):
        return _infer_attribute(node, context)

    if isinstance(node, ast.Call):
        return _infer_call(node, context)

    if isinstance(node, ast.Subscript):
        return _infer_expr(node.value, context)

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


def _build_inference_context(tree):
    context = InferenceContext()

    for node in tree.body:
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name
                if alias.asname:
                    context.aliases[alias.asname] = root
                else:
                    bound_name = root.split(".")[0]
                    context.aliases[bound_name] = bound_name
        elif isinstance(node, ast.ImportFrom):
            if not node.module:
                continue
            for alias in node.names:
                if alias.name == "*":
                    continue
                bound_name = alias.asname or alias.name
                context.aliases[bound_name] = f"{node.module}.{alias.name}"
        elif isinstance(node, ast.ClassDef):
            context.aliases[node.name] = node.name
            context.class_attrs[node.name] = _collect_class_attributes(node, context)
        elif isinstance(node, (ast.With, ast.AsyncWith)):
            _record_with_bindings(node, context)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            _record_assignment(node, context)

    return context


def _record_assignment(node, context):
    if isinstance(node, ast.Assign):
        value = node.value
        targets = node.targets
    else:
        value = node.value
        targets = [node.target]

    inferred = _infer_expr(value, context)
    if not inferred:
        return

    for target in targets:
        if isinstance(target, ast.Name):
            context.assignments[target.id] = inferred


def _record_with_bindings(node, context):
    for item in node.items:
        inferred = _infer_context_manager_type(item.context_expr, context)
        if not inferred:
            continue

        if isinstance(item.optional_vars, ast.Name):
            context.assignments[item.optional_vars.id] = inferred


def _infer_context_manager_type(node, context):
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id == "open":
            return "io.TextIOWrapper"
        if isinstance(node.func, ast.Attribute) and node.func.attr == "open":
            return "io.TextIOWrapper"

    return _infer_expr(node, context)


def _collect_class_attributes(node, context):
    attrs = {}

    for item in node.body:
        if not isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        param_types = {}
        all_args = (
            list(item.args.posonlyargs)
            + list(item.args.args)
            + list(item.args.kwonlyargs)
        )
        for arg in all_args:
            if arg.annotation is not None:
                param_types[arg.arg] = _annotation_to_name(arg.annotation, context)

        for stmt in ast.walk(item):
            if not isinstance(stmt, ast.Assign):
                continue
            inferred = _infer_expr(
                stmt.value, context, current_class=node.name, local_types=param_types
            )
            if not inferred:
                continue
            for target in stmt.targets:
                if (
                    isinstance(target, ast.Attribute)
                    and isinstance(target.value, ast.Name)
                    and target.value.id == "self"
                ):
                    attrs[target.attr] = inferred

    return attrs


def _annotation_to_name(annotation, context):
    if isinstance(annotation, ast.Name):
        return context.aliases.get(annotation.id, annotation.id)
    if isinstance(annotation, ast.Attribute):
        return _infer_expr(annotation, context)
    if isinstance(annotation, ast.Subscript):
        return _annotation_to_name(annotation.value, context)
    if isinstance(annotation, ast.BinOp) and isinstance(annotation.op, ast.BitOr):
        return _annotation_to_name(annotation.left, context) or _annotation_to_name(
            annotation.right, context
        )
    return None


def _infer_call(node, context, current_class=None, local_types=None):
    if isinstance(node.func, ast.Attribute):
        owner = _infer_expr(
            node.func.value,
            context,
            current_class=current_class,
            local_types=local_types,
        )
        if owner:
            if node.func.attr in COPY_METHODS:
                return owner
            if node.func.attr and node.func.attr[:1].isupper():
                return f"{owner}.{node.func.attr}"

    callee = _infer_expr(
        node.func, context, current_class=current_class, local_types=local_types
    )
    if not callee:
        return None

    if callee.endswith(".__call__"):
        return callee[:-9]

    return callee


def _infer_attribute(node, context, current_class=None, local_types=None):
    owner = _infer_expr(
        node.value, context, current_class=current_class, local_types=local_types
    )
    if not owner:
        return None

    owner_root = owner.split(".")[0]
    class_name = owner.split(".")[-1]
    attr_map = context.class_attrs.get(class_name)
    if attr_map and node.attr in attr_map:
        return attr_map[node.attr]

    if owner_root == class_name and attr_map and node.attr in attr_map:
        return attr_map[node.attr]

    return f"{owner}.{node.attr}"


def _infer_expr(node, context, current_class=None, local_types=None):
    if node is None:
        return None

    if isinstance(node, ast.Name):
        if local_types and node.id in local_types:
            return local_types[node.id]
        if node.id == "self" and current_class:
            return current_class
        return context.assignments.get(node.id) or context.aliases.get(node.id)

    if isinstance(node, ast.Attribute):
        return _infer_attribute(
            node, context, current_class=current_class, local_types=local_types
        )

    if isinstance(node, ast.Call):
        return _infer_call(
            node, context, current_class=current_class, local_types=local_types
        )

    if isinstance(node, ast.Subscript):
        return _infer_expr(
            node.value, context, current_class=current_class, local_types=local_types
        )

    if isinstance(node, (ast.List, ast.ListComp)):
        return "list"
    if isinstance(node, (ast.Dict, ast.DictComp)):
        return "dict"
    if isinstance(node, (ast.Set, ast.SetComp)):
        return "set"
    if isinstance(node, ast.Tuple):
        return "tuple"
    if isinstance(node, ast.JoinedStr):
        return "str"
    if isinstance(node, ast.Constant):
        if isinstance(node.value, bool):
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

    return None

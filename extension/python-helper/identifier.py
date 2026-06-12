import ast
import builtins as py_builtins
import io
import keyword
import tokenize
from dataclasses import dataclass, field
from typing import Any


@dataclass
class InferenceContext:
    """Holds type inference state for a parsed AST."""
    aliases: dict[str, str] = field(default_factory=dict)
    assignments: dict[str, str] = field(default_factory=dict)
    class_attrs: dict[str, dict[str, str]] = field(default_factory=dict)


COPY_METHODS = {"copy", "__copy__", "__deepcopy__"}
SOFT_KEYWORDS = {"match", "case"}
BUILTIN_NAMES = set(dir(py_builtins))
GLOBAL_NAME_TYPES: dict[str, str] = {
    "__file__": "str",
    "__name__": "str",
    "__package__": "str",
    "__doc__": "str",
    "__annotations__": "dict",
}


def identify_at_position(source: str, line: int, col: int) -> str | None:
    """
    Identifies the Python construct at the given line and column.
    line is 1-based, col is 0-based.
    """
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None

    keyword_token = _token_at_position(source, line, col)
    if keyword_token:
        token_value = keyword_token.string
        if (
            keyword.iskeyword(token_value) or token_value in SOFT_KEYWORDS
        ) and token_value not in {"None", "True", "False"}:
            return token_value
        if token_value in {"None", "True", "False"}:
            return token_value

    context = _build_inference_context(tree)

    if keyword_token and keyword_token.type == tokenize.NAME:
        token_value = keyword_token.string
        inferred = context.assignments.get(token_value) or context.aliases.get(
            token_value
        )
        if inferred:
            return inferred
        if token_value in BUILTIN_NAMES:
            return token_value

    target_node = _find_target_node(tree, line, col)
    if not target_node:
        return None

    # ast.Expr is a statement wrapper (e.g. a bare expression on its own line).
    # It has the exact same bounds as its child, so unwrap it to get the real expression.
    if isinstance(target_node, ast.Expr):
        target_node = target_node.value

    parents = _build_parent_map(tree)
    return _map_node_to_type(target_node, parents, context)


def _build_parent_map(tree: ast.Module) -> dict[ast.AST, ast.AST]:
    """Build a mapping from each AST node to its parent."""
    parents: dict[ast.AST, ast.AST] = {}
    for node in ast.walk(tree):
        for _field, value in ast.iter_fields(node):
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, ast.AST):
                        parents[item] = node
            elif isinstance(value, ast.AST):
                parents[value] = node
    return parents


def _find_target_node(tree: ast.Module, line: int, col: int) -> ast.AST | None:
    """Find the smallest AST node containing the given line/col position."""
    target_node: ast.AST | None = None
    min_range = float("inf")

    for node in ast.walk(tree):
        start_line = getattr(node, "lineno", None)
        end_line = getattr(node, "end_lineno", None)
        start_col = getattr(node, "col_offset", None)
        end_col = getattr(node, "end_col_offset", None)
        if None in (start_line, end_line, start_col, end_col):
            continue

        # At this point, all four values are guaranteed non-None.
        assert start_line is not None
        assert end_line is not None
        assert start_col is not None
        assert end_col is not None

        start_line_int = int(start_line)
        end_line_int = int(end_line)
        start_col_int = int(start_col)
        end_col_int = int(end_col)

        if line < start_line_int or line > end_line_int:
            continue
        if line == start_line_int and col < start_col_int:
            continue
        if line == end_line_int and col > end_col_int:
            continue

        size = (end_line_int - start_line_int) * 10000 + (end_col_int - start_col_int)
        if size < min_range:
            min_range = size
            target_node = node

    return target_node


def _token_at_position(source: str, line: int, col: int) -> Any:
    cursor_line = line - 1
    try:
        for token in tokenize.generate_tokens(io.StringIO(source).readline):
            if token.start[0] - 1 != cursor_line:
                continue

            start_col = token.start[1]
            end_col = token.end[1]
            if start_col <= col < end_col:
                return token
    except (tokenize.TokenError, IndentationError):
        return None


def _map_literal_type(node: ast.AST, parents: dict[ast.AST, ast.AST]) -> str | None:
    """Return the type string for literal AST nodes."""
    if isinstance(node, (ast.List, ast.ListComp)):
        return "list"
    if isinstance(node, (ast.Dict, ast.DictComp)):
        return "dict"
    if isinstance(node, (ast.Set, ast.SetComp)):
        return "set"
    if isinstance(node, ast.Tuple):
        return "tuple"
    if isinstance(node, ast.JoinedStr):
        return "f-string"

    if isinstance(node, ast.Constant):
        return _infer_constant_value(node.value, parents, node)

    return None


def _infer_constant_value(
    value: Any,
    parents_map: dict[ast.AST, ast.AST] | None = None,
    node: ast.AST | None = None,
) -> str | None:
    """Infer the type string for a constant value."""
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, complex):
        return "complex"
    if isinstance(value, bytes):
        return "bytes"
    if value is None:
        return "None"
    if value is ...:
        return "Ellipsis"
    if isinstance(value, str):
        if parents_map is not None and node is not None:
            parent = parents_map.get(node)  # ast.Expr wrapper
            if isinstance(parent, ast.Expr):
                grandparent = parents_map.get(parent)
                if (
                    isinstance(
                        grandparent,
                        (
                            ast.ClassDef,
                            ast.FunctionDef,
                            ast.AsyncFunctionDef,
                            ast.Module,
                        ),
                    )
                    and grandparent.body
                    and grandparent.body[0] is parent
                ):
                    return "docstring_literal"
        return "str"

    return None


def _map_node_to_type(
    node: ast.AST, parents: dict[ast.AST, ast.AST], context: InferenceContext
) -> str | None:
    if isinstance(node, ast.alias):
        return node.name

    literal_type = _map_literal_type(node, parents)
    if literal_type:
        return literal_type

    if isinstance(node, ast.Name):
        inferred_name = context.assignments.get(node.id) or context.aliases.get(node.id)
        if inferred_name:
            return inferred_name
        global_name_type = GLOBAL_NAME_TYPES.get(node.id)
        if global_name_type:
            return global_name_type
        if node.id in BUILTIN_NAMES:
            return node.id
        return None

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
            if isinstance(curr, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
                name = f"{curr.name}.{name}"
        return name

    return None


def _build_inference_context(tree: ast.Module) -> InferenceContext:
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
            module_root = node.module.split(".")[0]
            context.aliases[module_root] = module_root
            for alias in node.names:
                if alias.name == "*":
                    continue
                bound_name = alias.asname or alias.name
                context.aliases[bound_name] = f"{node.module}.{alias.name}"
        elif isinstance(node, ast.ClassDef):
            context.aliases[node.name] = node.name
            context.class_attrs[node.name] = _collect_class_attributes(node, context)
            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    _record_function_signature_bindings(item, context)
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            _record_function_signature_bindings(node, context)
        elif isinstance(node, (ast.With, ast.AsyncWith)):
            _record_with_bindings(node, context)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            _record_assignment(node, context)

    # Second pass: bind names introduced by flow constructs (for/comprehension/match)
    # so local variables in these scopes can still produce useful hovers.
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.AsyncFor)):
            _record_for_bindings(node, context)
        elif isinstance(
            node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)
        ):
            for generator in node.generators:
                _record_comprehension_bindings(generator, context)
        elif isinstance(node, ast.Match):
            _record_match_bindings(node, context)

    return context


def _infer_iter_element_type(iter_type: str | None) -> str | None:
    if not iter_type:
        return None

    if iter_type in {"range"}:
        return "int"
    if iter_type in {"str"}:
        return "str"
    if iter_type in {"bytes", "bytearray"}:
        return "int"
    if iter_type in {"dict"}:
        return "str"
    if iter_type in {"list", "tuple", "set", "frozenset"}:
        return "object"

    if iter_type in {"pandas.DataFrame", "pandas.core.frame.DataFrame"}:
        return "str"
    if iter_type in {"pandas.Series", "pandas.core.series.Series"}:
        return "object"

    return "object"


def _bind_target_names(
    target: ast.AST, inferred_type: str | None, context: InferenceContext
) -> None:
    if isinstance(target, ast.Name):
        if inferred_type:
            context.assignments[target.id] = inferred_type
        return

    if isinstance(target, (ast.Tuple, ast.List)):
        for item in target.elts:
            _bind_target_names(item, inferred_type, context)


def _record_for_bindings(
    node: ast.For | ast.AsyncFor, context: InferenceContext
) -> None:
    iter_type = _infer_expr(node.iter, context)
    inferred_type = _infer_iter_element_type(iter_type)
    _bind_target_names(node.target, inferred_type, context)


def _record_comprehension_bindings(
    generator: ast.comprehension, context: InferenceContext
) -> None:
    iter_type = _infer_expr(generator.iter, context)
    inferred_type = _infer_iter_element_type(iter_type)
    _bind_target_names(generator.target, inferred_type, context)


def _bind_match_pattern_names(
    pattern: ast.pattern, inferred_type: str | None, context: InferenceContext
) -> None:
    if isinstance(pattern, ast.MatchAs):
        if pattern.name and inferred_type:
            context.assignments[pattern.name] = inferred_type
        if pattern.pattern:
            _bind_match_pattern_names(pattern.pattern, inferred_type, context)
        return

    if isinstance(pattern, ast.MatchStar):
        if pattern.name:
            context.assignments[pattern.name] = "list"
        return

    if isinstance(pattern, ast.MatchSequence):
        element_type = _infer_iter_element_type(inferred_type)
        for subpattern in pattern.patterns:
            _bind_match_pattern_names(subpattern, element_type, context)
        return

    if isinstance(pattern, ast.MatchMapping):
        for subpattern in pattern.patterns:
            _bind_match_pattern_names(subpattern, "object", context)
        if pattern.rest:
            context.assignments[pattern.rest] = "dict"
        return

    if isinstance(pattern, ast.MatchClass):
        class_name = _infer_expr(pattern.cls, context) or inferred_type
        for subpattern in pattern.patterns:
            _bind_match_pattern_names(subpattern, "object", context)
        for attr_name, subpattern in zip(pattern.kwd_attrs, pattern.kwd_patterns):
            _bind_match_pattern_names(
                subpattern,
                f"{class_name}.{attr_name}" if class_name else "object",
                context,
            )


def _record_match_bindings(node: ast.Match, context: InferenceContext) -> None:
    subject_type = _infer_expr(node.subject, context)
    for case in node.cases:
        _bind_match_pattern_names(case.pattern, subject_type, context)


def _record_assignment(
    node: ast.Assign | ast.AnnAssign, context: InferenceContext
) -> None:
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


def _record_with_bindings(
    node: ast.With | ast.AsyncWith, context: InferenceContext
) -> None:
    for item in node.items:
        inferred = _infer_context_manager_type(item.context_expr, context)
        if not inferred:
            continue

        if isinstance(item.optional_vars, ast.Name):
            context.assignments[item.optional_vars.id] = inferred


def _infer_context_manager_type(node: ast.AST, context: InferenceContext) -> str | None:
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id == "open":
            return "io.TextIOWrapper"
        if isinstance(node.func, ast.Attribute) and node.func.attr == "open":
            return "io.TextIOWrapper"

    return _infer_expr(node, context)


def _collect_class_attributes(
    node: ast.ClassDef, context: InferenceContext
) -> dict[str, str]:
    attrs: dict[str, str] = {}

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


def _record_function_signature_bindings(
    node: ast.FunctionDef | ast.AsyncFunctionDef, context: InferenceContext
) -> None:
    all_args = (
        list(node.args.posonlyargs) + list(node.args.args) + list(node.args.kwonlyargs)
    )
    for arg in all_args:
        if arg.annotation is None:
            continue
        inferred = _annotation_to_name(arg.annotation, context)
        if inferred:
            context.assignments[arg.arg] = inferred


def _annotation_to_name(annotation: ast.AST, context: InferenceContext) -> str | None:
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


def _infer_call(
    node: ast.Call,
    context: InferenceContext,
    current_class: str | None = None,
    local_types: dict[str, str] | None = None,
) -> str | None:
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
            inferred_groupby = _infer_pandas_groupby_return(owner, node.func.attr)
            if inferred_groupby:
                return inferred_groupby
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


def _infer_pandas_groupby_return(owner: str, attr: str) -> str | None:
    if attr != "groupby":
        return None

    owner_root = owner.split(".")[0]
    owner_leaf = owner.split(".")[-1]
    if owner_root != "pandas":
        return None

    if owner_leaf == "DataFrame":
        return "pandas.core.groupby.generic.DataFrameGroupBy"
    if owner_leaf == "Series":
        return "pandas.core.groupby.generic.SeriesGroupBy"

    return None


def _infer_attribute(
    node: ast.Attribute,
    context: InferenceContext,
    current_class: str | None = None,
    local_types: dict[str, str] | None = None,
) -> str | None:
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


def _infer_literal_type(node: ast.AST) -> str | None:
    """Infer the type of a literal AST node."""
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

    if not isinstance(node, ast.Constant):
        return None

    value = node.value
    if isinstance(value, bool):
        return "bool"
    if isinstance(value, int):
        return "int"
    if isinstance(value, float):
        return "float"
    if isinstance(value, complex):
        return "complex"
    if isinstance(value, str):
        return "str"
    if isinstance(value, bytes):
        return "bytes"
    if value is None:
        return "None"
    if value is ...:
        return "Ellipsis"

    return None


def _infer_expr(
    node: ast.AST | None,
    context: InferenceContext,
    current_class: str | None = None,
    local_types: dict[str, str] | None = None,
) -> str | None:
    if node is None:
        return None

    # Name lookup: check local types, self, assignments, aliases, globals, builtins.
    if isinstance(node, ast.Name):
        if local_types and node.id in local_types:
            return local_types[node.id]
        if node.id == "self" and current_class:
            return current_class
        inferred_name = context.assignments.get(node.id) or context.aliases.get(node.id)
        if inferred_name:
            return inferred_name
        global_name_type = GLOBAL_NAME_TYPES.get(node.id)
        if global_name_type:
            return global_name_type
        if node.id in BUILTIN_NAMES:
            return node.id
        return None

    # Attribute and Call delegates to specialized helpers.
    if isinstance(node, ast.Attribute):
        return _infer_attribute(
            node, context, current_class=current_class, local_types=local_types
        )

    if isinstance(node, ast.Call):
        return _infer_call(
            node, context, current_class=current_class, local_types=local_types
        )

    # Subscript: infer container type, then handle pandas special cases.
    if isinstance(node, ast.Subscript):
        container = _infer_expr(
            node.value, context, current_class=current_class, local_types=local_types
        )
        if not container:
            return None

        # Common pandas shape inference.
        if container in {"pandas.DataFrame", "pandas.core.frame.DataFrame"}:
            slice_node = node.slice
            if isinstance(slice_node, ast.Constant) and isinstance(
                slice_node.value, str
            ):
                return "pandas.Series"
            if isinstance(slice_node, (ast.Name, ast.List)):
                return container

        if container in {"pandas.Series", "pandas.core.series.Series"}:
            return "pandas.Series"

        return container

    # Literal types.
    literal = _infer_literal_type(node)
    if literal:
        return literal

    return None

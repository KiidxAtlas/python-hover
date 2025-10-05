/**
 * Python typing constructs and their descriptions
 * Primarily used for hover information
 */

export const TYPING_CONSTRUCTS: Record<string, string> = {
    'List': 'Generic version of list. Subscriptable with the type of items: `List[int]`',
    'Dict': 'Generic version of dict. Requires key and value types: `Dict[str, int]`',
    'Tuple': 'Generic version of tuple. Fixed-length: `Tuple[int, str]` or variable: `Tuple[int, ...]`',
    'Set': 'Generic version of set. Subscriptable with the type of items: `Set[int]`',
    'FrozenSet': 'Immutable variant of Set: `FrozenSet[int]`',
    'Optional': 'Type that is either the specified type or None: `Optional[str]` is `Union[str, None]`',
    'Union': 'Type that could be any of several types: `Union[int, str, bool]`',
    'Any': 'Special type indicating any type is acceptable. Disables type checking.',
    'Callable': 'Function or callable object. Specify arg and return types: `Callable[[int, str], bool]`',
    'Iterator': 'Iterator yielding items of the specified type: `Iterator[int]`',
    'Iterable': 'Iterable of items of the specified type: `Iterable[str]`',
    'Sequence': 'Sequence of items of the specified type: `Sequence[float]`',
    'Mapping': 'Mapping with keys and values of specified types: `Mapping[str, Any]`',
    'Type': 'A type itself. Used for class references: `Type[User]`',
    'TypeVar': 'Type variable for generic functions/classes: `T = TypeVar("T")`',
    'Protocol': 'Define structural subtyping protocols (PEP 544)',
    'Generic': 'Base for user-defined generic classes: `class Stack(Generic[T]): ...`',
    'TypedDict': 'Dictionary with known keys and value types: `class Movie(TypedDict): title: str`',
    'Final': 'Indicates a value cannot be reassigned: `x: Final = 1`',
    'Literal': 'Type restricted to specific values: `Literal["red", "green", "blue"]`',
    'ClassVar': 'Class variable rather than instance variable: `count: ClassVar[int] = 0`',
    'NewType': 'Create distinct types: `UserId = NewType("UserId", int)`',
    'cast': 'Cast a value to a type: `x = cast(List[int], y)`',
    'overload': 'Decorator for defining multiple function signatures',
    'Annotated': 'Type with additional metadata: `Annotated[int, "positive"]`'
};
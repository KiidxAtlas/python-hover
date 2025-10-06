/**
 * Version Comparison and Migration Data
 * Tracks when features were added, deprecated, or changed
 */

export interface VersionInfo {
    addedIn?: string;
    deprecatedIn?: string;
    removedIn?: string;
    changedIn?: Array<{ version: string; change: string }>;
    migrationGuide?: string;
}

export interface ComparisonInfo {
    similar: string[];
    differences: string;
    whenToUse: string;
}

export const VERSION_HISTORY: { [key: string]: VersionInfo } = {
    'match': {
        addedIn: '3.10',
        migrationGuide: 'Replace complex if-elif chains with match-case for pattern matching'
    },
    'case': {
        addedIn: '3.10',
        migrationGuide: 'Used within match statements for pattern matching'
    },
    'removeprefix': {
        addedIn: '3.9',
        migrationGuide: 'Replace: s[len(prefix):] if s.startswith(prefix) else s'
    },
    'removesuffix': {
        addedIn: '3.9',
        migrationGuide: 'Replace: s[:-len(suffix)] if s.endswith(suffix) else s'
    },
    'uniontype': {
        addedIn: '3.10',
        migrationGuide: 'Use X | Y instead of Union[X, Y] from typing'
    },
    'async': {
        addedIn: '3.5',
        changedIn: [
            { version: '3.7', change: 'async and await became reserved keywords' }
        ]
    },
    'await': {
        addedIn: '3.5',
        changedIn: [
            { version: '3.7', change: 'async and await became reserved keywords' }
        ]
    },
    'f-string': {
        addedIn: '3.6',
        migrationGuide: 'Replace: "Hello {}".format(name) with f"Hello {name}"'
    },
    'walrus': {
        addedIn: '3.8',
        migrationGuide: 'Assignment expressions: (n := len(data)) allows assignment in expressions'
    },
    'TypeAlias': {
        addedIn: '3.10',
        migrationGuide: 'Explicit type alias: Vector: TypeAlias = list[float]'
    },
    'zip': {
        changedIn: [
            { version: '3.10', change: 'Added strict parameter to ensure equal length iterables' }
        ]
    },
    'dict': {
        changedIn: [
            { version: '3.7', change: 'Dictionaries are guaranteed to maintain insertion order' },
            { version: '3.9', change: 'Can use dict | other_dict for merging (union operator)' }
        ]
    },
    'print': {
        changedIn: [
            { version: '3.0', change: 'Changed from statement to function' }
        ]
    }
};

export const METHOD_COMPARISONS: { [key: string]: ComparisonInfo } = {
    'append_vs_extend': {
        similar: ['append', 'extend', 'insert'],
        differences: `**append()**: Adds a single element to the end
**extend()**: Adds all elements from an iterable
**insert()**: Adds element at specific position

Example:
lst = [1, 2]
lst.append([3, 4])   # [1, 2, [3, 4]]
lst.extend([3, 4])   # [1, 2, 3, 4]
lst.insert(0, 0)     # [0, 1, 2]`,
        whenToUse: 'Use append for single items, extend for multiple items, insert for specific positions'
    },
    'remove_vs_pop_vs_del': {
        similar: ['remove', 'pop', 'del', 'clear'],
        differences: `**remove()**: Removes first occurrence by value
**pop()**: Removes and returns item by index
**del**: Removes item by index (no return)
**clear()**: Removes all items

Example:
lst = [1, 2, 3, 2]
lst.remove(2)    # [1, 3, 2] - first 2 removed
val = lst.pop()  # returns 2, lst = [1, 3]
del lst[0]       # lst = [3]
lst.clear()      # lst = []`,
        whenToUse: 'Use remove for value-based deletion, pop when you need the value, del for index-based, clear for all'
    },
    'sort_vs_sorted': {
        similar: ['sort', 'sorted', 'reverse', 'reversed'],
        differences: `**sort()**: Sorts list in-place, returns None
**sorted()**: Returns new sorted list, original unchanged

Example:
lst = [3, 1, 2]
lst.sort()           # lst = [1, 2, 3]
new_lst = sorted(lst) # lst unchanged, new_lst = [1, 2, 3]`,
        whenToUse: 'Use sort() to modify existing list, sorted() to create new sorted list'
    },
    'get_vs_setdefault': {
        similar: ['get', 'setdefault', '__getitem__'],
        differences: `**get()**: Returns value or default, doesn't modify dict
**setdefault()**: Returns value or sets and returns default
**dict[key]**: Raises KeyError if missing

Example:
d = {'a': 1}
d.get('b', 0)        # returns 0, d unchanged
d.setdefault('b', 0) # returns 0, d = {'a': 1, 'b': 0}
d['c']               # raises KeyError`,
        whenToUse: 'Use get() for read-only, setdefault() when you want to initialize missing keys'
    },
    'join_vs_concatenation': {
        similar: ['join', '+', 'f-string'],
        differences: `**join()**: Most efficient for multiple strings
**+ operator**: Simple but slow for many strings
**f-string**: Best for formatting with variables

Example:
# join - O(n)
''.join(['a', 'b', 'c'])  # 'abc'

# + operator - O(n²) for many strings
s = 'a' + 'b' + 'c'  # 'abc'

# f-string - best for formatting
f'{name}: {value}'`,
        whenToUse: 'Use join() for lists of strings, f-strings for formatting, avoid + in loops'
    }
};

export function getVersionInfo(symbol: string): VersionInfo | null {
    return VERSION_HISTORY[symbol.toLowerCase()] || null;
}

export function getMethodComparison(method: string): ComparisonInfo | null {
    // Try direct lookup
    if (METHOD_COMPARISONS[method]) {
        return METHOD_COMPARISONS[method];
    }

    // Try to find comparison that includes this method
    for (const [key, comparison] of Object.entries(METHOD_COMPARISONS)) {
        if (comparison.similar.includes(method)) {
            return comparison;
        }
    }

    return null;
}

export function formatVersionInfo(info: VersionInfo): string {
    const parts: string[] = [];

    if (info.addedIn) {
        parts.push(`✨ **New in Python ${info.addedIn}**`);
    }

    if (info.deprecatedIn) {
        parts.push(`⚠️  **Deprecated in Python ${info.deprecatedIn}**`);
    }

    if (info.removedIn) {
        parts.push(`❌ **Removed in Python ${info.removedIn}**`);
    }

    if (info.changedIn && info.changedIn.length > 0) {
        parts.push(`📝 **Changes:**`);
        for (const change of info.changedIn) {
            parts.push(`  - Python ${change.version}: ${change.change}`);
        }
    }

    if (info.migrationGuide) {
        parts.push(`\n💡 **Migration:** ${info.migrationGuide}`);
    }

    return parts.join('\n');
}

export function formatComparison(comparison: ComparisonInfo): string {
    return `### 🔄 Similar Methods: ${comparison.similar.join(', ')}

${comparison.differences}

**When to use:** ${comparison.whenToUse}`;
}

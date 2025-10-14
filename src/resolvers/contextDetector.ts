import * as vscode from 'vscode';
import { LIMITS, PERFORMANCE } from '../constants/defaults';
import { Logger } from '../services/logger';
import { TypeDetectionService } from '../services/typeDetectionService';
import { BoundedCache } from '../utils/boundedCache';

/**
 * Provides context-aware type detection for Python variables and expressions
 * Uses TypeDetectionService for the actual type inference logic
 */
export class ContextDetector {
    // Cache for compiled regex patterns to improve performance
    private regexCache: BoundedCache<string, RegExp>;

    constructor() {
        this.regexCache = new BoundedCache({
            maxSize: LIMITS.MAX_REGEX_CACHE_SIZE
        });
    }

    /**
     * Get a cached regex pattern or create and cache it
     */
    private getCachedRegex(pattern: string, flags?: string): RegExp {
        const key = `${pattern}:${flags || ''}`;
        if (!this.regexCache.has(key)) {
            try {
                this.regexCache.set(key, new RegExp(pattern, flags));
            } catch (error) {
                Logger.getInstance().error(`Invalid regex pattern: ${pattern}`, error as Error);
                // Return a safe fallback regex that never matches
                return /(?!)/;
            }
        }
        return this.regexCache.get(key)!;
    }

    /**
     * Determines the likely type of a variable based on context
     */
    public detectVariableTypeFromContext(document: vscode.TextDocument, position: vscode.Position, variableName: string): string | undefined {
        if (!variableName) return undefined;

        const maxLines = PERFORMANCE.MAX_CONTEXT_SCAN_LINES;
        const startLine = Math.max(0, position.line - maxLines);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);

        // Search backward then forward
        for (const line of this.scanLines(document, position.line, startLine, -1)) {
            const type = this.detectTypeFromLine(line, variableName);
            if (type) return type;
        }

        for (const line of this.scanLines(document, position.line + 1, endLine, 1)) {
            const type = this.detectTypeFromLine(line, variableName);
            if (type) return type;
        }

        return undefined;
    }

    /**
     * Scan lines in a direction
     */
    private *scanLines(document: vscode.TextDocument, start: number, end: number, step: number): Generator<string> {
        if (step > 0) {
            for (let i = start; i <= end; i++) {
                yield document.lineAt(i).text;
            }
        } else {
            for (let i = start; i >= end; i--) {
                yield document.lineAt(i).text;
            }
        }
    }

    /**
     * Detect type from a single line for a given variable
     */
    private detectTypeFromLine(line: string, variableName: string): string | undefined {
        // Check for assignments (var = value)
        const assignmentRegex = this.getCachedRegex(`${variableName}\\s*=\\s*(.+)$`);
        const assignmentMatch = line.match(assignmentRegex);
        if (assignmentMatch) {
            const type = TypeDetectionService.detectTypeFromValue(assignmentMatch[1].trim());
            if (type) return type;
        }

        // Check for walrus operator (var := value)
        const walrusRegex = this.getCachedRegex(`${variableName}\\s*:=\\s*(.+)$`);
        const walrusMatch = line.match(walrusRegex);
        if (walrusMatch) {
            const type = TypeDetectionService.detectTypeFromValue(walrusMatch[1].trim());
            if (type) return type;
        }

        // Check for type annotations (var: Type)
        const annotationRegex = this.getCachedRegex(`${variableName}\\s*:\\s*(\\w+)`);
        const annotationMatch = line.match(annotationRegex);
        if (annotationMatch) {
            const typeName = annotationMatch[1];
            if (TypeDetectionService.isBuiltinType(typeName)) {
                return typeName;
            }
        }

        return undefined;
    }

    /**
     * Detects if we are in a method call context and identifies the object type
     */
    public detectMethodContext(document: vscode.TextDocument, position: vscode.Position, methodName: string): string | undefined {
        const line = document.lineAt(position.line).text;
        const beforePosition = line.substring(0, position.character);

        Logger.getInstance().info(`[detectMethodContext] Line: "${line}"`);
        Logger.getInstance().info(`[detectMethodContext] BeforePosition: "${beforePosition}"`);
        Logger.getInstance().info(`[detectMethodContext] MethodName: "${methodName}"`);

        // Check for method calls (obj.method)
        // Look for pattern: objectName followed by dot, ending right before current position
        // This handles cases where cursor is AT the method name
        const dotMatch = beforePosition.match(this.getCachedRegex(`(\\w+)\\s*\\.\\s*$`));

        Logger.getInstance().info(`[detectMethodContext] DotMatch: ${dotMatch ? `Found: ${dotMatch[0]}, Object: ${dotMatch[1]}` : 'No match'}`);

        if (dotMatch) {
            const objectName = dotMatch[1];
            const detectedType = this.detectVariableTypeFromContext(document, position, objectName);

            Logger.getInstance().info(`[detectMethodContext] Detected type for "${objectName}": ${detectedType}`);

            // If we detected a qualified type name (e.g., "pandas.DataFrame"), return it as-is
            if (detectedType && detectedType.includes('.')) {
                return detectedType;
            }

            return detectedType;
        }

        // Method-to-type inference mapping
        const methodTypeMap: Record<string, string> = {
            // String methods
            'strip': 'str', 'split': 'str', 'join': 'str', 'replace': 'str', 'find': 'str',
            'startswith': 'str', 'endswith': 'str', 'upper': 'str', 'lower': 'str',
            'capitalize': 'str', 'title': 'str', 'isdigit': 'str', 'isalpha': 'str',
            'isalnum': 'str', 'format': 'str',
            // List methods
            'append': 'list', 'extend': 'list', 'insert': 'list', 'remove': 'list',
            'pop': 'list', 'clear': 'list', 'copy': 'list', 'reverse': 'list', 'sort': 'list',
            // Dict methods
            'keys': 'dict', 'values': 'dict', 'items': 'dict', 'get': 'dict',
            'setdefault': 'dict', 'update': 'dict', 'popitem': 'dict', 'fromkeys': 'dict',
            // Set methods
            'add': 'set', 'discard': 'set', 'union': 'set', 'intersection': 'set',
            // Pandas DataFrame methods
            'head': 'DataFrame', 'tail': 'DataFrame', 'describe': 'DataFrame',
            'groupby': 'DataFrame', 'merge': 'DataFrame', 'fillna': 'DataFrame',
            'dropna': 'DataFrame', 'drop': 'DataFrame', 'reset_index': 'DataFrame',
            // Pandas Series methods
            'value_counts': 'Series', 'unique': 'Series', 'nunique': 'Series',
            // NumPy array methods
            'reshape': 'ndarray', 'flatten': 'ndarray', 'transpose': 'ndarray',
            'dot': 'ndarray', 'sum': 'ndarray', 'mean': 'ndarray'
        };

        return methodTypeMap[methodName];
    }
}

import * as vscode from 'vscode';
import { Logger } from '../services/logger';
import { TypeDetectionService } from '../services/typeDetectionService';

/**
 * Provides context-aware type detection for Python variables and expressions
 * Uses TypeDetectionService for the actual type inference logic
 */
export class ContextDetector {
    // Cache for compiled regex patterns to improve performance
    private regexCache = new Map<string, RegExp>();

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

        const maxLines = 100; // Limit search to prevent performance issues
        const startLine = Math.max(0, position.line - maxLines);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);

        // Search backward for variable assignments
        for (let i = position.line; i >= startLine; i--) {
            const line = document.lineAt(i).text;

            // Check for variable assignments (var = value)
            const assignmentRegex = this.getCachedRegex(`${variableName}\\s*=\\s*(.+)$`);
            const assignmentMatch = line.match(assignmentRegex);

            if (assignmentMatch) {
                const value = assignmentMatch[1].trim();
                const detectedType = TypeDetectionService.detectTypeFromValue(value);
                if (detectedType) {
                    return detectedType;
                }
            }

            // Check for walrus operator assignments (var := value)
            const walrusRegex = this.getCachedRegex(`${variableName}\\s*:=\\s*(.+)$`);
            const walrusMatch = line.match(walrusRegex);

            if (walrusMatch) {
                const value = walrusMatch[1].trim();
                const detectedType = TypeDetectionService.detectTypeFromValue(value);
                if (detectedType) {
                    return detectedType;
                }
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
        }

        // If backward search didn't find anything, search forward a few lines
        // This helps when cursor is at the start of a variable name before assignment
        for (let i = position.line + 1; i <= endLine; i++) {
            const line = document.lineAt(i).text;

            // Check for variable assignments (var = value)
            const assignmentRegex = this.getCachedRegex(`${variableName}\\s*=\\s*(.+)$`);
            const assignmentMatch = line.match(assignmentRegex);

            if (assignmentMatch) {
                const value = assignmentMatch[1].trim();
                const detectedType = TypeDetectionService.detectTypeFromValue(value);
                if (detectedType) {
                    return detectedType;
                }
            }

            // Check for walrus operator in forward search too
            const walrusRegex = this.getCachedRegex(`${variableName}\\s*:=\\s*(.+)$`);
            const walrusMatch = line.match(walrusRegex);

            if (walrusMatch) {
                const value = walrusMatch[1].trim();
                const detectedType = TypeDetectionService.detectTypeFromValue(value);
                if (detectedType) {
                    return detectedType;
                }
            }

            // Check for type annotations in forward search
            const annotationRegex = this.getCachedRegex(`${variableName}\\s*:\\s*(\\w+)`);
            const annotationMatch = line.match(annotationRegex);

            if (annotationMatch) {
                const typeName = annotationMatch[1];
                if (TypeDetectionService.isBuiltinType(typeName)) {
                    return typeName;
                }
            }
        }

        // If we reach here, we couldn't determine the type
        return undefined;
    }

    /**
     * Detects if we are in a method call context and identifies the object type
     */
    public detectMethodContext(document: vscode.TextDocument, position: vscode.Position, methodName: string): string | undefined {
        const line = document.lineAt(position.line).text;
        const beforePosition = line.substring(0, position.character);

        // Check for method calls (obj.method)
        const dotMatch = beforePosition.match(this.getCachedRegex(`(\\w+)\\s*\\.\\s*${methodName}\\s*$`));
        if (dotMatch) {
            const objectName = dotMatch[1];
            return this.detectVariableTypeFromContext(document, position, objectName);
        }

        // Common method-to-type inference as a fallback
        if (['strip', 'split', 'join', 'replace', 'find', 'startswith', 'endswith', 'upper', 'lower',
            'capitalize', 'title', 'isdigit', 'isalpha', 'isalnum', 'format'].includes(methodName)) {
            return 'str';
        } else if (['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'copy', 'reverse', 'sort'].includes(methodName)) {
            return 'list';
        } else if (['keys', 'values', 'items', 'get', 'setdefault', 'update', 'popitem', 'fromkeys'].includes(methodName)) {
            return 'dict';
        } else if (['add', 'update', 'remove', 'discard', 'clear', 'copy', 'union', 'intersection'].includes(methodName)) {
            return 'set';
        }

        return undefined;
    }
}


import { ExceptionInfo, ParameterInfo, ReturnInfo } from '../../../shared/types';

export interface ParsedDocstring {
    summary?: string;
    description?: string;
    parameters?: ParameterInfo[];
    returns?: ReturnInfo;
    raises?: ExceptionInfo[];
    examples?: string[];
    notes?: string[];
}

export class DocstringParser {
    parse(docstring: string): ParsedDocstring {
        if (!docstring) return {};

        // Heuristic detection
        if (this.isNumpyStyle(docstring)) {
            return this.parseNumpy(docstring);
        } else if (this.isGoogleStyle(docstring)) {
            return this.parseGoogle(docstring);
        } else {
            return this.parseRest(docstring);
        }
    }

    parseHelpText(docstring: string): ParsedDocstring {
        const result: ParsedDocstring = {};
        let lines = docstring.split('\n');

        // 1. Remove "Related help topics" footer
        const footerIndex = lines.findIndex(l => l.startsWith('Related help topics:'));
        if (footerIndex !== -1) {
            lines = lines.slice(0, footerIndex);
        }

        // 2. Identify headers and calculate body indentation
        const isHeader = new Array(lines.length).fill(false);
        let minIndent = Infinity;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check for underline header
            if (i + 1 < lines.length && /^[-=*]+$/.test(lines[i + 1].trim()) && lines[i + 1].trim().length >= trimmed.length) {
                isHeader[i] = true;
                isHeader[i + 1] = true; // The underline itself
                i++;
                continue;
            }

            // Calculate indent
            const indent = line.search(/\S/);
            if (indent !== -1 && indent < minIndent) {
                minIndent = indent;
            }
        }

        if (minIndent === Infinity) minIndent = 0;

        // 3. Process lines
        const processedLines: string[] = [];
        let inCodeBlock = false;
        let inExampleSection = false;
        let codeBlockIndent = 0;
        let isReplBlock = false;

        for (let i = 0; i < lines.length; i++) {
            if (isHeader[i]) {
                // If it's the underline, skip
                if (/^[-=*]+$/.test(lines[i].trim())) continue;

                // It's the title
                if (inCodeBlock) {
                    processedLines.push('```\n');
                    inCodeBlock = false;
                }

                // Reset example section on new header
                inExampleSection = false;

                // Determine level based on underline char (peek next line)
                const underline = lines[i + 1].trim();
                let level = '###';
                if (underline.includes('=')) level = '##';
                if (underline.includes('*')) level = '###';

                processedLines.push(`\n${level} ${lines[i].trim()}\n`);
                continue;
            }

            let line = lines[i];
            if (line.trim().length === 0) {
                if (inCodeBlock) {
                    processedLines.push(line);
                } else {
                    processedLines.push(line);
                }
                continue;
            }

            // Dedent
            let content = line;
            if (line.length >= minIndent) {
                content = line.substring(minIndent);
            }

            // Check for code block start
            const currentIndent = content.search(/\S/);
            const isGrammar = content.includes('::=');
            const isPythonPrompt = content.trim().startsWith('>>>');
            const isContinuation = content.trim().startsWith('...');

            // Detect start of examples
            if (content.trim().match(/^Examples?:$/)) {
                if (inCodeBlock) {
                    processedLines.push('```\n');
                    inCodeBlock = false;
                }
                inExampleSection = true;
                processedLines.push(`**${content.trim()}**\n`);
                continue;
            }

            // If we are in example section, check if we exited it
            if (inExampleSection) {
                if (currentIndent === 0 && content.trim().length > 0) {
                    inExampleSection = false;
                }
            }

            // Determine if this line should be in a code block
            let isCode = false;

            if (inCodeBlock) {
                // Continuation logic
                if (isReplBlock) {
                    // In REPL block, accept anything indented at least as much as the start, or continuations
                    isCode = currentIndent >= codeBlockIndent || isContinuation || content.trim() === '';
                } else {
                    // Standard block
                    isCode = currentIndent >= 4 || isGrammar || isPythonPrompt || isContinuation || (inExampleSection && currentIndent >= 2);
                    // Also keep open if indented same as start (e.g. grammar blocks starting at 3)
                    if (currentIndent >= codeBlockIndent && codeBlockIndent > 0) isCode = true;
                }
            } else {
                // Start logic
                isCode = isGrammar || isPythonPrompt || (inExampleSection && currentIndent >= 2) || currentIndent >= 4;
            }

            if (isCode) {
                if (!inCodeBlock) {
                    processedLines.push('\n```python');
                    inCodeBlock = true;
                    codeBlockIndent = currentIndent;
                    isReplBlock = isPythonPrompt;
                }

                // Consistent dedent based on block start
                let dedentAmount = codeBlockIndent;
                // Cap dedent at 4 for standard blocks to avoid stripping too much if they are deeply indented?
                // Actually, for grammar blocks at 3, we want to strip 3.
                // For standard code at 4, strip 4.

                if (dedentAmount > 0 && content.length >= dedentAmount) {
                    processedLines.push(content.substring(dedentAmount));
                } else {
                    processedLines.push(content);
                }
            } else {
                if (inCodeBlock) {
                    processedLines.push('```\n');
                    inCodeBlock = false;
                    isReplBlock = false;
                    codeBlockIndent = 0;
                }

                let processedContent = this.processLinks(content);

                // Blockquotes for Note/See also
                if (processedContent.trim().startsWith('Note:') || processedContent.trim().startsWith('See also:')) {
                    processedContent = '> ' + processedContent;
                }

                processedLines.push(processedContent);
            }
        }

        if (inCodeBlock) {
            processedLines.push('```\n');
        }

        result.summary = processedLines.join('\n').trim();
        return result;
    }

    private isNumpyStyle(docstring: string): boolean {
        return /Parameters\n\s*-+\n/.test(docstring) || /Returns\n\s*-+\n/.test(docstring);
    }

    private isGoogleStyle(docstring: string): boolean {
        return /Args:\n/.test(docstring) || /Returns:\n/.test(docstring) || /Raises:\n/.test(docstring);
    }

    private parseNumpy(docstring: string): ParsedDocstring {
        const result: ParsedDocstring = {};
        const lines = docstring.split('\n');

        // Extract summary (first paragraph)
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        const summaryLines = [];
        while (i < lines.length && lines[i].trim() !== '') {
            summaryLines.push(lines[i].trim());
            i++;
        }
        result.summary = this.processLinks(summaryLines.join(' '));

        // Simple section parsing
        let currentSection = '';
        let buffer: string[] = [];

        for (; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === 'Parameters' || trimmed === 'Returns' || trimmed === 'Raises' || trimmed === 'Examples' || trimmed === 'Notes') {
                if (i + 1 < lines.length && lines[i + 1].trim().startsWith('---')) {
                    currentSection = trimmed;
                    i++; // Skip underline
                    continue;
                }
            }

            if (currentSection === 'Parameters') {
                // Parse parameters: name : type
                // description
                const match = /^\s*(\w+)\s*:\s*(.*)$/.exec(line);
                if (match) {
                    if (!result.parameters) result.parameters = [];
                    result.parameters.push({
                        name: match[1],
                        type: match[2],
                        description: ''
                    });
                } else if (result.parameters && result.parameters.length > 0 && trimmed !== '') {
                    result.parameters[result.parameters.length - 1].description += ' ' + trimmed;
                }
            } else if (currentSection === 'Returns') {
                // Parse returns: type
                // description
                if (!result.returns) result.returns = {};
                if (trimmed !== '') {
                    if (!result.returns.type) {
                        result.returns.type = trimmed;
                    } else {
                        result.returns.description = (result.returns.description || '') + ' ' + trimmed;
                    }
                }
            } else if (currentSection === 'Examples') {
                if (!result.examples) result.examples = [];
                // Collect example lines
                if (trimmed !== '') {
                    if (result.examples.length === 0) result.examples.push('');
                    result.examples[0] += line + '\n';
                }
            }
        }

        return result;
    }

    private parseGoogle(docstring: string): ParsedDocstring {
        // Simplified Google style parser
        const result: ParsedDocstring = {};
        const lines = docstring.split('\n');

        // Extract summary
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        const summaryLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].endsWith(':')) {
            summaryLines.push(lines[i].trim());
            i++;
        }
        result.summary = this.processLinks(summaryLines.join(' '));

        let currentSection = '';

        for (; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === 'Args:') {
                currentSection = 'Args';
                continue;
            } else if (trimmed === 'Returns:') {
                currentSection = 'Returns';
                continue;
            } else if (trimmed === 'Raises:') {
                currentSection = 'Raises';
                continue;
            } else if (trimmed === 'Example:' || trimmed === 'Examples:') {
                currentSection = 'Examples';
                continue;
            }

            if (currentSection === 'Args') {
                // name (type): description
                const match = /^\s*(\w+)\s*(\((.*)\))?\s*:\s*(.*)$/.exec(line);
                if (match) {
                    if (!result.parameters) result.parameters = [];
                    result.parameters.push({
                        name: match[1],
                        type: match[3],
                        description: match[4]
                    });
                } else if (result.parameters && result.parameters.length > 0 && trimmed !== '') {
                    result.parameters[result.parameters.length - 1].description += ' ' + trimmed;
                }
            }
            // ... similar logic for other sections
        }
        return result;
    }

    private parseRest(docstring: string): ParsedDocstring {
        // Fallback / reST parser
        const result: ParsedDocstring = {};
        const lines = docstring.split('\n');

        // Extract summary
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        const summaryLines = [];
        while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith(':')) {
            const line = lines[i].trim();
            // Skip reST title underlines (e.g. "=====", "-----")
            if (!/^[-=~^#*]+$/.test(line)) {
                summaryLines.push(line);
            }
            i++;
        }
        result.summary = this.processLinks(summaryLines.join(' '));

        for (; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // :param name: description
            // :type name: type
            const paramMatch = /^\s*:param\s+(\w+):\s*(.*)$/.exec(line);
            if (paramMatch) {
                if (!result.parameters) result.parameters = [];
                result.parameters.push({
                    name: paramMatch[1],
                    description: paramMatch[2]
                });
            }

            const typeMatch = /^\s*:type\s+(\w+):\s*(.*)$/.exec(line);
            if (typeMatch) {
                if (result.parameters) {
                    const param = result.parameters.find(p => p.name === typeMatch[1]);
                    if (param) {
                        param.type = typeMatch[2];
                    }
                }
            }
        }

        return result;
    }

    private processLinks(text: string): string {
        // 1. PEP references: PEP 8 -> [PEP 8](https://peps.python.org/pep-0008/)
        text = text.replace(/\bPEP\s+(\d+)\b/g, (match, num) => {
            const padded = num.padStart(4, '0');
            return `[${match}](https://peps.python.org/pep-${padded}/)`;
        });

        // 2. reST external links: `Link Text <url>`_
        text = text.replace(/`([^`\n]+)\s+<([^>\n]+)>`_/g, '[$1]($2)');

        // 3. Sphinx :ref:`label` -> *label*
        text = text.replace(/:ref:`([^`\n]+)`/g, '*$1*');

        // 4. Sphinx :func:`name` -> `name`
        text = text.replace(/:(?:func|class|meth|mod|attr|exc|data|const):`([^`\n]+)`/g, '`$1`');

        return text;
    }
}

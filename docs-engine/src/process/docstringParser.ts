import { ExceptionInfo, ParameterInfo, ReturnInfo } from '../../../shared/types'

const NUMPY_SECTIONS = new Set([
  'Parameters',
  'Other Parameters',
  'Returns',
  'Yields',
  'Raises',
  'Warns',
  'Examples',
  'Notes',
  'See Also',
])

export interface ParsedDocstring {
  summary?: string
  description?: string
  parameters?: ParameterInfo[]
  returns?: ReturnInfo
  raises?: ExceptionInfo[]
  examples?: string[]
  notes?: string[]
}

export class DocstringParser {
  parse(docstring: string): ParsedDocstring {
    if (!docstring) {
      return {}
    }

    // Runtime, LSP, and scraped docstrings can use different newline conventions.
    // Normalize once so section detection behaves identically on every platform.
    docstring = docstring.replace(/\r\n?/g, '\n')

    // Heuristic detection
    if (this.isNumpyStyle(docstring)) {
      return this.parseNumpy(docstring)
    } else if (this.isGoogleStyle(docstring)) {
      return this.parseGoogle(docstring)
    } else {
      return this.parseRest(docstring)
    }
  }

  parseHelpText(docstring: string): ParsedDocstring {
    const result: ParsedDocstring = {}
    let lines = docstring.replace(/\r\n?/g, '\n').split('\n')

    // 1. Remove "Related help topics" footer
    const footerIndex = lines.findIndex(l => l.startsWith('Related help topics:'))
    if (footerIndex !== -1) {
      lines = lines.slice(0, footerIndex)
    }

    // 2. Identify headers and calculate body indentation
    const isHeader = new Array(lines.length).fill(false)
    let minIndent = Infinity

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      // Check for underline header
      if (
        i + 1 < lines.length &&
        /^[-=*]+$/.test(lines[i + 1].trim()) &&
        lines[i + 1].trim().length >= trimmed.length
      ) {
        isHeader[i] = true
        isHeader[i + 1] = true // The underline itself
        i++
        continue
      }

      // Calculate indent
      const indent = line.search(/\S/)
      if (indent !== -1 && indent < minIndent) {
        minIndent = indent
      }
    }

    if (minIndent === Infinity) {
      minIndent = 0
    }

    // 3. Process lines
    const processedLines: string[] = []
    let inCodeBlock = false
    let inExampleSection = false
    let codeBlockIndent = 0
    let isReplBlock = false

    for (let i = 0; i < lines.length; i++) {
      if (isHeader[i]) {
        // If it's the underline, skip
        if (/^[-=*]+$/.test(lines[i].trim())) {
          continue
        }

        // It's the title
        if (inCodeBlock) {
          processedLines.push('```\n')
          inCodeBlock = false
        }

        // Reset example section on new header
        inExampleSection = false

        // Determine level based on underline char (peek next line)
        const underline = lines[i + 1].trim()
        let level = '###'
        if (underline.includes('=')) {
          level = '##'
        }
        if (underline.includes('*')) {
          level = '###'
        }

        processedLines.push(`\n${level} ${lines[i].trim()}\n`)
        continue
      }

      const line = lines[i]
      if (line.trim().length === 0) {
        if (inCodeBlock) {
          processedLines.push(line)
        } else {
          processedLines.push(line)
        }
        continue
      }

      // Dedent
      let content = line
      if (line.length >= minIndent) {
        content = line.substring(minIndent)
      }

      // Check for code block start
      const currentIndent = content.search(/\S/)
      const isGrammar = content.includes('::=')
      const isPythonPrompt = content.trim().startsWith('>>>')
      const isContinuation = content.trim().startsWith('...')
      const looksLikePython = this.looksLikePythonCode(content.trim())

      // Detect start of examples
      if (content.trim().match(/^Examples?:$/)) {
        if (inCodeBlock) {
          processedLines.push('```\n')
          inCodeBlock = false
        }
        inExampleSection = true
        processedLines.push(`**${content.trim()}**\n`)
        continue
      }

      // If we are in example section, check if we exited it
      if (inExampleSection) {
        if (currentIndent === 0 && content.trim().length > 0) {
          inExampleSection = false
        }
      }

      // Determine if this line should be in a code block
      let isCode = false

      if (inCodeBlock) {
        // Continuation logic
        if (isReplBlock) {
          // In REPL block, accept anything indented at least as much as the start, or continuations
          isCode = currentIndent >= codeBlockIndent || isContinuation || content.trim() === ''
        } else {
          // Standard block
          isCode =
            currentIndent >= 4 ||
          isGrammar ||
          isPythonPrompt ||
          isContinuation ||
          (inExampleSection && currentIndent >= 2) ||
          (currentIndent >= 4 && looksLikePython)
          // Also keep open if indented same as start (e.g. grammar blocks starting at 3)
          if (currentIndent >= codeBlockIndent && codeBlockIndent > 0) {
            isCode = true
          }
        }
      } else {
        // Start logic
        isCode =
          isGrammar ||
          isPythonPrompt ||
          (inExampleSection && currentIndent >= 2) ||
          (currentIndent >= 4 && looksLikePython)
      }

      if (isCode) {
        if (!inCodeBlock) {
          processedLines.push('\n```python')
          inCodeBlock = true
          codeBlockIndent = currentIndent
          isReplBlock = isPythonPrompt
        }

        // Consistent dedent based on block start
        const dedentAmount = codeBlockIndent
        // Cap dedent at 4 for standard blocks to avoid stripping too much if they are deeply indented?
        // Actually, for grammar blocks at 3, we want to strip 3.
        // For standard code at 4, strip 4.

        if (dedentAmount > 0 && content.length >= dedentAmount) {
          processedLines.push(content.substring(dedentAmount))
        } else {
          processedLines.push(content)
        }
      } else {
        if (inCodeBlock) {
          processedLines.push('```\n')
          inCodeBlock = false
          isReplBlock = false
          codeBlockIndent = 0
        }

        let processedContent = this.processLinks(content)

        // Blockquotes for Note/See also
        if (
          processedContent.trim().startsWith('Note:') ||
          processedContent.trim().startsWith('See also:')
        ) {
          processedContent = '> ' + processedContent
        }

        processedLines.push(processedContent)
      }
    }

    if (inCodeBlock) {
      processedLines.push('```\n')
    }

    result.summary = processedLines.join('\n').trim()
    return result
  }

  private looksLikePythonCode(line: string): boolean {
    if (!line || /^[A-Z][^=()[\]{}]*[.!?]$/.test(line)) {
      return false
    }
    return /^(?:async\s+def|def|class|for|while|if|elif|else:|try:|except\b|finally:|with|return\b|raise\b|yield\b|import\b|from\b|@)|^[A-Za-z_]\w*(?:\.\w+)*(?:\s*=|\s*\(|\s*\[)|^(?:print|len|range|list|dict|set|tuple)\s*\(/.test(line)
  }

  private isNumpyStyle(docstring: string): boolean {
    return /Parameters\n\s*-+\n/.test(docstring) || /Returns\n\s*-+\n/.test(docstring)
  }

  private isGoogleStyle(docstring: string): boolean {
    return /Args:\n/.test(docstring) || /Returns:\n/.test(docstring) || /Raises:\n/.test(docstring)
  }

  private parseNumpy(docstring: string): ParsedDocstring {
    const result: ParsedDocstring = {}
    const lines = docstring.split('\n')

    // Extract summary (first paragraph)
    let i = 0
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
    const summaryLines = []
    while (i < lines.length && lines[i].trim() !== '') {
      summaryLines.push(lines[i].trim())
      i++
    }
    result.summary = this.processLinks(summaryLines.join(' '))

    // Simple section parsing
    let currentSection = ''
    let activeParameterIndexes: number[] = []

    for (; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // Any underlined heading ends the previous section. Recognized headings are
      // extracted; unknown ones (References, Attributes, Methods, etc.) are skipped
      // instead of leaking their contents into the preceding section.
      if (
        trimmed &&
        i + 1 < lines.length &&
        /^-{3,}$/.test(lines[i + 1].trim())
      ) {
        currentSection = NUMPY_SECTIONS.has(trimmed) ? trimmed : ''
        activeParameterIndexes = []
        i++ // Skip underline
        continue
      }

      if (currentSection === 'Parameters' || currentSection === 'Other Parameters') {
        // Parse parameters: name : type
        // description
        const match = /^\s*((?:\*{0,2}[A-Za-z_]\w*)(?:\s*,\s*\*{0,2}[A-Za-z_]\w*)*)\s*:\s*(.*)$/.exec(line)
        if (match) {
          if (!result.parameters) {
            result.parameters = []
          }
          activeParameterIndexes = []
          for (const name of match[1].split(',').map(value => value.trim())) {
            activeParameterIndexes.push(result.parameters.length)
            result.parameters.push({
              name,
              type: match[2],
              description: '',
            })
          }
        } else if (result.parameters && result.parameters.length > 0 && trimmed !== '') {
          for (const parameterIndex of activeParameterIndexes) {
            const parameter = result.parameters[parameterIndex]
            parameter.description = `${parameter.description ?? ''} ${trimmed}`.trim()
          }
        }
      } else if (currentSection === 'Returns' || currentSection === 'Yields') {
        // Parse returns: type
        // description
        if (!result.returns) {
          result.returns = {}
        }
        if (trimmed !== '') {
          if (!result.returns.type) {
            const namedReturn = /^([A-Za-z_]\w*)\s*:\s*(.+)$/.exec(trimmed)
            result.returns.type = namedReturn?.[2]?.trim() ?? trimmed
          } else {
            result.returns.description = `${result.returns.description ?? ''} ${trimmed}`.trim()
          }
        }
      } else if (currentSection === 'Raises' || currentSection === 'Warns') {
        if (!result.raises) {
          result.raises = []
        }
        // Each non-empty line at base indent is an exception type
        const raiseMatch = /^\s*(\w+[\w.]*)\s*:\s*(.*)$/.exec(line)
        if (raiseMatch) {
          result.raises.push({ type: raiseMatch[1], description: raiseMatch[2] })
        } else if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$/.test(line)) {
          // NumPy style normally puts the exception on an unindented line and
          // its explanation on the following indented lines, without a colon.
          result.raises.push({ type: trimmed, description: '' })
        } else if (result.raises.length > 0 && trimmed !== '') {
          result.raises[result.raises.length - 1].description = (
            (result.raises[result.raises.length - 1].description || '') +
            ' ' +
            trimmed
          ).trim()
        }
      } else if (currentSection === 'Notes') {
        if (!result.notes) {
          result.notes = []
        }
        if (trimmed !== '') {
          result.notes.push(trimmed)
        }
      } else if (currentSection === 'Examples') {
        if (!result.examples) {
          result.examples = []
        }
        // Collect all example lines as a single block
        if (result.examples.length === 0) {
          result.examples.push('')
        }
        result.examples[0] += line + '\n'
      }
    }

    if (result.examples) {
      result.examples = result.examples.map(e => e.trim()).filter(Boolean)
    }

    return result
  }

  private parseGoogle(docstring: string): ParsedDocstring {
    // Simplified Google style parser
    const result: ParsedDocstring = {}
    const lines = docstring.split('\n')

    // Extract summary
    let i = 0
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
    const summaryLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].endsWith(':')) {
      summaryLines.push(lines[i].trim())
      i++
    }
    result.summary = this.processLinks(summaryLines.join(' '))

    let currentSection = ''

    for (; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      if (trimmed === 'Args:' || trimmed === 'Arguments:' || trimmed === 'Keyword Args:') {
        currentSection = 'Args'
        continue
      } else if (trimmed === 'Returns:') {
        currentSection = 'Returns'
        continue
      } else if (trimmed === 'Raises:') {
        currentSection = 'Raises'
        continue
      } else if (trimmed === 'Example:' || trimmed === 'Examples:') {
        currentSection = 'Examples'
        continue
      } else if (/^[A-Z][A-Za-z ]+:$/.test(line)) {
        // Stop collecting the previous recognized section at an unsupported
        // top-level Google-style heading such as Attributes: or Note:.
        currentSection = ''
        continue
      }

      if (currentSection === 'Args') {
        // name (type): description
        const match = /^\s*(\*{0,2}[A-Za-z_]\w*)\s*(?:\((.*)\))?\s*:\s*(.*)$/.exec(line)
        if (match) {
          if (!result.parameters) {
            result.parameters = []
          }
          result.parameters.push({
            name: match[1],
            type: match[2],
            description: match[3],
          })
        } else if (result.parameters && result.parameters.length > 0 && trimmed !== '') {
          result.parameters[result.parameters.length - 1].description = (
            (result.parameters[result.parameters.length - 1].description || '') +
            ' ' +
            trimmed
          ).trim()
        }
      } else if (currentSection === 'Returns') {
        if (!result.returns) {
          result.returns = {}
        }
        // Google style: optional "type: description" on the first indented line
        const typeDescMatch = /^\s+(\w[\w[\], |]*?):\s+(.+)$/.exec(line)
        if (typeDescMatch && !result.returns.type) {
          result.returns.type = typeDescMatch[1].trim()
          result.returns.description = typeDescMatch[2].trim()
        } else if (trimmed !== '') {
          result.returns.description = ((result.returns.description || '') + ' ' + trimmed).trim()
        }
      } else if (currentSection === 'Raises') {
        if (!result.raises) {
          result.raises = []
        }
        // ExceptionType: description
        const raiseMatch = /^\s+(\w[\w.]*)\s*:\s*(.*)$/.exec(line)
        if (raiseMatch) {
          result.raises.push({ type: raiseMatch[1], description: raiseMatch[2] })
        } else if (result.raises.length > 0 && trimmed !== '') {
          result.raises[result.raises.length - 1].description = (
            (result.raises[result.raises.length - 1].description || '') +
            ' ' +
            trimmed
          ).trim()
        }
      } else if (currentSection === 'Examples') {
        if (!result.examples) {
          result.examples = []
        }
        if (result.examples.length === 0) {
          result.examples.push('')
        }
        result.examples[0] += line + '\n'
      }
    }

    if (result.examples) {
      result.examples = result.examples.map(e => e.trim()).filter(Boolean)
    }

    return result
  }

  private parseRest(docstring: string): ParsedDocstring {
    // Fallback / reST parser
    const result: ParsedDocstring = {}
    const lines = docstring.split('\n')

    // Extract summary
    let i = 0
    while (i < lines.length && lines[i].trim() === '') {
      i++
    }
    const summaryLines = []
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().startsWith(':')) {
      const line = lines[i].trim()
      // Skip reST title underlines (e.g. "=====", "-----")
      if (!/^[-=~^#*]+$/.test(line)) {
        // Skip signature lines (heuristic: contains "->" or starts with name(...) )
        // e.g. "str(object='') -> str"
        if (!line.includes('->') && !/^\w+\(.*\)$/.test(line)) {
          summaryLines.push(line)
        }
      }
      i++
    }
    result.summary = this.processLinks(summaryLines.join(' '))

    let activeField:
      | { kind: 'parameter'; name: string }
      | { kind: 'returns' }
      | { kind: 'raises'; index: number }
      | undefined

    for (; i < lines.length; i++) {
      const line = lines[i]

      // :param name: description
      // :type name: type
      const paramMatch = /^\s*:param(?:\s+([^: ]+))?\s+(\*{0,2}[A-Za-z_]\w*):\s*(.*)$/.exec(line)
      if (paramMatch) {
        if (!result.parameters) {
          result.parameters = []
        }
        result.parameters.push({
          name: paramMatch[2],
          type: paramMatch[1],
          description: paramMatch[3],
        })
        activeField = { kind: 'parameter', name: paramMatch[2] }
        continue
      }

      const typeMatch = /^\s*:type\s+(\*{0,2}[A-Za-z_]\w*):\s*(.*)$/.exec(line)
      if (typeMatch) {
        if (result.parameters) {
          const param = result.parameters.find(p => p.name === typeMatch[1])
          if (param) {
            param.type = typeMatch[2]
          }
        }
        continue
      }

      const returnsMatch = /^\s*:returns?:\s*(.*)$/.exec(line)
      if (returnsMatch) {
        if (!result.returns) {
          result.returns = {}
        }
        result.returns.description = returnsMatch[1].trim() || undefined
        activeField = { kind: 'returns' }
        continue
      }

      const rtypeMatch = /^\s*:rtype:\s*(.*)$/.exec(line)
      if (rtypeMatch) {
        if (!result.returns) {
          result.returns = {}
        }
        result.returns.type = rtypeMatch[1].trim() || undefined
        continue
      }

      const raisesMatch = /^\s*:raises?\s+([\w.]+):\s*(.*)$/.exec(line)
      if (raisesMatch) {
        if (!result.raises) {
          result.raises = []
        }
        result.raises.push({ type: raisesMatch[1], description: raisesMatch[2] })
        activeField = { kind: 'raises', index: result.raises.length - 1 }
        continue
      }

      const continuation = /^\s+(.+)$/.exec(line)?.[1]?.trim()
      if (continuation && activeField) {
        if (activeField.kind === 'parameter') {
          const activeName = activeField.name
          const parameter = result.parameters?.find(p => p.name === activeName)
          if (parameter) {
            parameter.description = `${parameter.description ?? ''} ${continuation}`.trim()
          }
        } else if (activeField.kind === 'returns' && result.returns) {
          result.returns.description = `${result.returns.description ?? ''} ${continuation}`.trim()
        } else if (activeField.kind === 'raises' && result.raises?.[activeField.index]) {
          const raised = result.raises[activeField.index]
          raised.description = `${raised.description ?? ''} ${continuation}`.trim()
        }
      } else if (line.trim()) {
        activeField = undefined
      }
    }

    return result
  }

  private processLinks(text: string): string {
    // 1. PEP references: PEP 8 -> [PEP 8](https://peps.python.org/pep-0008/)
    text = text.replace(/\bPEP\s+(\d+)\b/g, (match, num) => {
      const padded = num.padStart(4, '0')
      return `[${match}](https://peps.python.org/pep-${padded}/)`
    })

    // 2. reST external links: `Link Text <url>`_
    text = text.replace(/`([^`\n]+)\s+<([^>\n]+)>`_/g, '[$1]($2)')

    // 3. Sphinx :ref:`label` -> *label*
    text = text.replace(/:ref:`([^`\n]+)`/g, '*$1*')

    // 4. Sphinx :func:`name` -> `name`
    text = text.replace(/:(?:func|class|meth|mod|attr|exc|data|const):`([^`\n]+)`/g, '`$1`')

    return text
  }
}

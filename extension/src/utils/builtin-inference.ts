import { BUILTIN_OWNER_TYPES } from '#shared/pythonBuiltins'
import * as vscode from 'vscode'

export function inferBuiltinOwnerFromSignature(signature?: string): string | null {
  if (!signature) {
    return null
  }

  const selfMatch = /\bself\s*:\s*([a-zA-Z0-9_.]+(?:@[a-zA-Z0-9_.]+)?)/.exec(signature)
  let owner = selfMatch?.[1]

  if (!owner) {
    const qualifiedMatch = /^([A-Za-z_][A-Za-z0-9_.]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(
      signature.trim(),
    )
    owner = qualifiedMatch?.[1]
  }

  if (!owner) {
    return null
  }
  if (owner.includes('@')) {
    owner = owner.split('@')[1]
  }
  if (owner.startsWith('builtins.')) {
    owner = owner.slice('builtins.'.length)
  }

  const root = owner.split('.')[0]
  return BUILTIN_OWNER_TYPES.has(root) ? root : null
}

export async function inferBuiltinOwnerFromReceiver(
  document: vscode.TextDocument,
  position: vscode.Position,
  getSegmentRange: (document: vscode.TextDocument, position: vscode.Position) => vscode.Range | undefined,
  resolveSymbol: (
    document: vscode.TextDocument,
    position: vscode.Position,
  ) => Promise<{ name?: string } | null>,
): Promise<string | null> {
  const literalOwner = inferBuiltinOwnerFromLiteralReceiver(document, position, getSegmentRange)
  if (literalOwner) {
    return literalOwner
  }

  const receiverPosition = getReceiverSegmentPosition(document, position, getSegmentRange)
  if (!receiverPosition) {
    return null
  }

  const receiverSymbol = await resolveSymbol(document, receiverPosition).catch(() => null)
  const receiverName = receiverSymbol?.name?.replace(/^builtins\./, '')
  if (!receiverName) {
    return null
  }

  const receiverRoot = receiverName.split('.')[0]
  if (BUILTIN_OWNER_TYPES.has(receiverRoot)) {
    return receiverRoot
  }

  const receiverLeaf = receiverName.split('.').pop() ?? receiverName
  return BUILTIN_OWNER_TYPES.has(receiverLeaf) ? receiverLeaf : null
}

export function inferBuiltinOwnerFromLiteralReceiver(
  document: vscode.TextDocument,
  position: vscode.Position,
  getSegmentRange: (document: vscode.TextDocument, position: vscode.Position) => vscode.Range | undefined,
): string | null {
  const currentRange = getSegmentRange(document, position)
  if (!currentRange) {
    return null
  }

  const line = document.lineAt(position.line).text
  let cursor = currentRange.start.character - 1
  while (cursor >= 0 && line[cursor] === ' ') {
    cursor--
  }
  if (cursor < 0 || line[cursor] !== '.') {
    return null
  }

  cursor--
  while (cursor >= 0 && line[cursor] === ' ') {
    cursor--
  }
  if (cursor < 0) {
    return null
  }

  const literalText = line.slice(0, cursor + 1)

  if (
    /(?:[bB][rR]?|[rR][bB]?|[fF][rR]?|[rR][fF]?|[uU])?(['"])(?:\\.|(?!\1).)*\1\s*$/.test(
      literalText,
    )
  ) {
    return /(?:^|[^A-Za-z0-9_])[bB][rR]?(['"])(?:\\.|(?!\1).)*\1\s*$/.test(literalText) ||
      /(?:^|[^A-Za-z0-9_])[rR][bB](['"])(?:\\.|(?!\1).)*\1\s*$/.test(literalText)
      ? 'bytes'
      : 'str'
  }

  if (/(?:True|False)\s*$/.test(literalText)) {
    return 'bool'
  }

  if (/None\s*$/.test(literalText)) {
    return 'None'
  }

  if (
    /(?:\d[\d_]*\.\d[\d_]*|\d[\d_]*[eE][+-]?\d[\d_]*|\.\d[\d_]+)(?:[jJ])?\s*$/.test(
      literalText,
    )
  ) {
    return /[jJ]\s*$/.test(literalText) ? 'complex' : 'float'
  }

  if (/(?:\d[\d_]*)(?:[jJ])\s*$/.test(literalText)) {
    return 'complex'
  }

  if (/(?:\d[\d_]*)\s*$/.test(literalText)) {
    return 'int'
  }

  if (line[cursor] === ']') {
    const open = findBalancedOpeningBracket(line, cursor, '[', ']')
    if (open !== -1) {
      return 'list'
    }
  }

  if (line[cursor] === '}') {
    const open = findBalancedOpeningBracket(line, cursor, '{', '}')
    if (open !== -1) {
      const body = line.slice(open + 1, cursor).trim()
      if (!body || body.includes(':')) {
        return 'dict'
      }
      return 'set'
    }
  }

  if (line[cursor] === ')') {
    const open = findBalancedOpeningBracket(line, cursor, '(', ')')
    if (open !== -1) {
      const body = line.slice(open + 1, cursor)
      if (body.includes(',')) {
        return 'tuple'
      }
    }
  }

  return null
}

function findBalancedOpeningBracket(
  line: string,
  closeIndex: number,
  openChar: string,
  closeChar: string,
): number {
  let depth = 0
  for (let index = closeIndex; index >= 0; index--) {
    const current = line[index]
    if (current === closeChar) {
      depth++
      continue
    }
    if (current === openChar) {
      depth--
      if (depth === 0) {
        return index
      }
    }
  }

  return -1
}

function getReceiverSegmentPosition(
  document: vscode.TextDocument,
  position: vscode.Position,
  getSegmentRange: (document: vscode.TextDocument, position: vscode.Position) => vscode.Range | undefined,
): vscode.Position | null {
  const currentRange = getSegmentRange(document, position)
  if (!currentRange) {
    return null
  }

  const line = document.lineAt(position.line).text
  let cursor = currentRange.start.character - 1
  while (cursor >= 0 && line[cursor] === ' ') {
    cursor--
  }
  if (cursor < 0 || line[cursor] !== '.') {
    return null
  }

  cursor--
  while (cursor >= 0 && line[cursor] === ' ') {
    cursor--
  }
  if (cursor < 0) {
    return null
  }

  const end = cursor + 1
  while (cursor >= 0 && /[A-Za-z0-9_]/.test(line[cursor])) {
    cursor--
  }
  const start = cursor + 1
  if (start >= end || !/^[A-Za-z_]/.test(line.slice(start, end))) {
    return null
  }

  return new vscode.Position(position.line, start)
}

export function findEnclosingClassName(document: vscode.TextDocument, lineIndex: number): string {
  const currentIndent = document.lineAt(lineIndex).text.match(/^(\s*)/)?.[1].length ?? 0
  for (let i = lineIndex - 1; i >= Math.max(0, lineIndex - 100); i--) {
    const lineText = document.lineAt(i).text
    const m = /^(\s*)class\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(lineText)
    if (m) {
      const classIndent = m[1].length
      if (classIndent < currentIndent) {
        return m[2]
      }
    }
  }
  return ''
}

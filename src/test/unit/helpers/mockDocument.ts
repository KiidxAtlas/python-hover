import * as vscode from 'vscode';

export function createMockDocument(content: string): vscode.TextDocument {
  const lines = content.split('\n');

  return {
    getText: (range?: vscode.Range) => {
      if (!range) return content;
      const start = (range as any).start ?? { line: (range as any).startLine, character: (range as any).startChar };
      const end = (range as any).end ?? { line: (range as any).endLine, character: (range as any).endChar };
      if (start.line === end.line) {
        return (lines[start.line] || '').substring(start.character, end.character);
      }
      return content;
    },
    lineAt: (arg: number | vscode.Position) => {
      const lineNum = typeof arg === 'number' ? arg : (arg as vscode.Position).line;
      const text = lines[lineNum] || '';
      const RangeCtor: any = (vscode as any).Range || (class { constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) { } });
      return {
        text,
        range: new RangeCtor(lineNum, 0, lineNum, text.length),
        lineNumber: lineNum,
        isEmptyOrWhitespace: text.trim().length === 0,
        firstNonWhitespaceCharacterIndex: text.length - text.trimStart().length,
        rangeIncludingLineBreak: new RangeCtor(lineNum, 0, lineNum + 1, 0)
      } as any;
    },
    lineCount: lines.length,
    uri: (vscode as any).Uri?.file?.('/unit.py') || ({ fsPath: '/unit.py' } as any),
    fileName: '/unit.py',
    languageId: 'python',
    version: 1,
    isDirty: false,
    isClosed: false,
    save: async () => true,
    eol: (vscode as any).EndOfLine?.LF ?? 1,
    positionAt: (offset: number) => {
      let cur = 0;
      for (let i = 0; i < lines.length; i++) {
        const len = lines[i].length + 1;
        if (cur + len > offset) return new (vscode as any).Position(i, offset - cur);
        cur += len;
      }
      return new (vscode as any).Position(lines.length - 1, lines[lines.length - 1].length);
    },
    offsetAt: (position: vscode.Position) => {
      let off = 0;
      for (let i = 0; i < position.line && i < lines.length; i++) off += lines[i].length + 1;
      return off + position.character;
    },
    getWordRangeAtPosition: (position: vscode.Position, regex?: RegExp) => {
      const line = lines[position.line] || '';
      const wordRegex = regex || /[A-Za-z_][A-Za-z0-9_]*/g;
      let match: RegExpExecArray | null;
      (wordRegex as any).lastIndex = 0;
      while ((match = wordRegex.exec(line)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (start <= position.character && end > position.character) {
          const RangeCtor: any = (vscode as any).Range || (class { constructor(public startLine: number, public startChar: number, public endLine: number, public endChar: number) { } });
          return new RangeCtor(position.line, start, position.line, end) as any;
        }
      }
      return undefined;
    },
    validateRange: (range: vscode.Range) => range,
    validatePosition: (position: vscode.Position) => position,
  } as any;
}

// CommonJS test setup to mock vscode for unit tests (no VS Code host required)
const path = require('path');
const mock = require('mock-require');

const noop = () => { };
class Position { constructor(line, character) { this.line = line; this.character = character; } }
class Range { constructor(startLine, startChar, endLine, endChar) { this.start = { line: startLine, character: startChar }; this.end = { line: endLine, character: endChar }; } }

const vscodeStub = {
  window: {
    createOutputChannel: () => ({ appendLine: noop, append: noop, clear: noop, show: noop, dispose: noop, name: 'Python Hover' })
  },
  workspace: {
    getConfiguration: () => ({ get: (_k, d) => d, update: noop })
  },
  env: { appRoot: path.join(process.cwd(), '.unit') },
  Uri: { file: (p) => ({ fsPath: p }) },
  Position,
  Range,
  EndOfLine: { LF: 1 }
};

mock('vscode', vscodeStub);
process.env.VSCODE_TEST = '1';

// Unit test setup: stub minimal vscode API to load modules that import 'vscode'
import * as path from 'path';
// Use CommonJS require to avoid TS import-equals in strip-only mode
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mock = require('mock-require');

// Provide a tiny stub for vscode used by non-integration unit tests.
const noop = () => { };
const vscodeStub = {
  window: {
    createOutputChannel: () => ({
      appendLine: noop,
      append: noop,
      clear: noop,
      show: noop,
      dispose: noop,
      name: 'Python Hover'
    })
  },
  workspace: {
    getConfiguration: (_section?: string) => ({
      get: (_: string, def?: any) => def,
      update: noop
    })
  },
  env: {
    appRoot: path.join(process.cwd(), '.unit')
  },
  Uri: {
    file: (p: string) => ({ fsPath: p })
  },
  Position: class {
    public line: number;
    public character: number;
    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  },
  Range: class {
    public start: { line: number; character: number };
    public end: { line: number; character: number };
    constructor(startLine: number, startChar: number, endLine: number, endChar: number) {
      this.start = { line: startLine, character: startChar };
      this.end = { line: endLine, character: endChar };
    }
  },
  EndOfLine: { LF: 1 },
};

mock('vscode', vscodeStub);

// Ensure test environment flag to trigger test-mode branches when helpful
process.env.VSCODE_TEST = '1';

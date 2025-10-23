import * as assert from 'assert';
import * as vscode from 'vscode';

suite('HoverProvider Test Suite', () => {
  let doc: vscode.TextDocument;
  let _editor: vscode.TextEditor;

  setup(async () => {
    // Activate the extension to ensure commands are registered
    const ext = vscode.extensions.getExtension('KiidxAtlas.python-hover');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Force real hover for this suite only using internal command (test-only)
    await vscode.commands.executeCommand('pythonHover.__test_setBypassShortcut', true);
    doc = await vscode.workspace.openTextDocument({ language: 'python', content: '' });
    _editor = await vscode.window.showTextDocument(doc);
  });

  teardown(async () => {
    await vscode.commands.executeCommand('pythonHover.__test_setBypassShortcut', false);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  async function getHoverFor(content: string, match: string): Promise<vscode.Hover | null> {
    const updated = await vscode.workspace.openTextDocument({ language: 'python', content });
    await vscode.window.showTextDocument(updated);
    const line = content.split('\n').findIndex(l => l.includes(match));
    const char = content.split('\n')[line].indexOf(match) + Math.floor(match.length / 2);
    const position = new vscode.Position(line, char);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', updated.uri, position);
    return hovers && hovers.length ? hovers[0] : null;
  }

  test('builtin: range shows correct link and title', async () => {
    const hover = await getHoverFor('nums = list(range(3))', 'range');
    assert.ok(hover, 'Hover should be returned');
    const md = hover!.contents[0] as vscode.MarkdownString;
    const text = md.value;
    assert.ok(text.toLowerCase().includes('range'), `Expected hover to mention 'range', got: ${text}`);
    // Integration hovers include a plain Docs URL line in test mode
    assert.ok(/docs\.python\.org\/3\/library\/functions\.html#func-range/i.test(text) || /Docs URL: .*func-range/.test(text), 'Should link to func-range anchor');
  });

  test('keyword: for shows docs', async () => {
    const hover = await getHoverFor('for i in range(2):\n    pass', 'for');
    assert.ok(hover);
    const text = (hover!.contents[0] as vscode.MarkdownString).value;
    assert.ok(text.toLowerCase().includes('for'), 'Should include keyword');
    assert.ok(/reference\/compound_stmts|Docs URL: .*compound_stmts/.test(text), 'Should link to compound statements');
  });

  test('dunder: __init__ links to datamodel', async () => {
    const hover = await getHoverFor('class A:\n    def __init__(self):\n        pass', '__init__');
    assert.ok(hover);
    const text = (hover!.contents[0] as vscode.MarkdownString).value;
    assert.ok(/reference\/datamodel\.html|Docs URL: .*datamodel\.html/.test(text), 'Should link to data model');
    assert.ok(text.includes('object.__init__'), 'Should include special method anchor');
  });

  test('third-party: numpy.array resolves and links', async () => {
    const hover = await getHoverFor('import numpy as np\narr = np.array([1,2,3])', 'array');
    assert.ok(hover);
    const text = (hover!.contents[0] as vscode.MarkdownString).value;
    assert.ok(/numpy|np|https?:\/\/|Docs URL:/i.test(text), 'Should contain numpy reference or a link');
  });
});

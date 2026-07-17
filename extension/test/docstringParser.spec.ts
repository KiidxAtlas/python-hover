import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DocstringParser } from "../../docs-engine/src/process/docstringParser";

describe("DocstringParser", () => {
  const parser = new DocstringParser();

  it("extracts NumPy-style variadics, named returns, raises, and examples", () => {
    const parsed = parser.parse(`Combine values.\r
\r
Parameters\r
----------\r
x, y : array_like\r
    Values to combine.\r
*args : object\r
    Additional values.\r
**kwargs : object\r
    Options forwarded to the backend.\r
Returns\r
-------\r
result : ndarray\r
    The combined array.\r
Raises\r
------\r
ValueError\r
    If the shapes are incompatible.\r
Examples\r
--------\r
>>> combine([1], [2])\r
array([1, 2])`);

    assert.equal(parsed.summary, "Combine values.");
    assert.deepEqual(
      parsed.parameters?.map((parameter) => parameter.name),
      ["x", "y", "*args", "**kwargs"],
    );
    assert.equal(parsed.parameters?.[0]?.description, "Values to combine.");
    assert.equal(parsed.parameters?.[1]?.description, "Values to combine.");
    assert.equal(parsed.returns?.type, "ndarray");
    assert.equal(parsed.returns?.description, "The combined array.");
    assert.equal(parsed.raises?.[0]?.type, "ValueError");
    assert.match(parsed.raises?.[0]?.description ?? "", /shapes are incompatible/);
    assert.match(parsed.examples?.[0] ?? "", /combine/);
  });

  it("extracts Google-style keyword arguments with nested type expressions", () => {
    const parsed = parser.parse(`Run a request.

Keyword Args:
    **options (dict[str, tuple[int, str]]): Backend options.
Returns:
    Response | None: The response when available.
Raises:
    RuntimeError: If the request fails.`);

    assert.equal(parsed.parameters?.[0]?.name, "**options");
    assert.equal(parsed.parameters?.[0]?.type, "dict[str, tuple[int, str]]");
    assert.equal(parsed.returns?.type, "Response | None");
    assert.equal(parsed.raises?.[0]?.type, "RuntimeError");
  });

  it("extracts typed reStructuredText parameters", () => {
    const parsed = parser.parse(`Load a resource.

:param pathlib.Path path: Resource path.
    Relative paths are resolved from the workspace.
:param **options: Loader options.
:type **options: dict[str, object]
:returns: Loaded resource.
    The returned object retains loader metadata.
:rtype: Resource`);

    assert.deepEqual(parsed.parameters?.[0], {
      name: "path",
      type: "pathlib.Path",
      description: "Resource path. Relative paths are resolved from the workspace.",
    });
    assert.equal(parsed.parameters?.[1]?.name, "**options");
    assert.equal(parsed.parameters?.[1]?.type, "dict[str, object]");
    assert.equal(parsed.returns?.type, "Resource");
    assert.equal(
      parsed.returns?.description,
      "Loaded resource. The returned object retains loader metadata.",
    );
  });

  it("does not leak unsupported sections into examples or parameter details", () => {
    const parsed = parser.parse(`Transform a value.

Parameters
----------
value : str
    Value to transform.
Attributes
----------
internal_state : object
    Implementation detail.
Examples
--------
>>> transform("x")
'X'
References
----------
External paper that should not become example code.`);

    assert.equal(parsed.parameters?.[0]?.description, "Value to transform.");
    assert.doesNotMatch(parsed.examples?.[0] ?? "", /External paper/);
    assert.doesNotMatch(parsed.examples?.[0] ?? "", /internal_state/);
  });

  it("does not promote ordinary indented help prose to a code block", () => {
    const parsed = parser.parseHelpText(`Topic
    This paragraph is indented by the help formatter.
    It remains ordinary explanatory prose.`);

    assert.doesNotMatch(parsed.summary ?? "", /```/);
  });

  it("still promotes recognizable indented Python to a code block", () => {
    const parsed = parser.parseHelpText(`Example
    result = transform(value)
    print(result)`);

    assert.match(parsed.summary ?? "", /```python/);
  });
});

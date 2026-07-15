import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HoverDocBuilder } from "../../docs-engine/src/process/hoverDocBuilder";
import { ResolutionSource } from "../../shared/types";

describe("HoverDocBuilder", () => {
  it("merges runtime fields with richer structured documentation", () => {
    const builder = new HoverDocBuilder();
    const doc = builder.build(
      {
        name: "run",
        module: "example",
        kind: "function",
        docstring: `Run the operation.

Args:
    x (number):
Returns:
    The result.
Raises:
    RuntimeError:`,
      },
      {
        title: "run",
        source: ResolutionSource.Corpus,
        confidence: 1,
        structuredContent: {
          sections: [
            {
              kind: "paragraph",
              role: "description",
              title: "Parameters",
              content: "x : int\nPrimary value from the documentation.",
            },
            {
              kind: "paragraph",
              role: "description",
              content: "y : str\nOptional documented value.",
            },
            {
              kind: "paragraph",
              role: "description",
              content: "If x is a list of dictionaries, insertion order is preserved.",
            },
            {
              kind: "paragraph",
              role: "description",
              content: "…",
            },
            {
              kind: "paragraph",
              role: "description",
              title: "Returns",
              content: "Result\nStructured return details.",
            },
            {
              kind: "paragraph",
              role: "description",
              title: "Raises",
              content: "RuntimeError\nRaised when execution fails.",
            },
          ],
        },
      },
    );

    assert.equal(doc.parameters?.[0]?.name, "x");
    assert.equal(doc.parameters?.[0]?.type, "number");
    assert.equal(
      doc.parameters?.[0]?.description,
      "Primary value from the documentation.",
    );
    assert.equal(doc.parameters?.[1]?.name, "y");
    assert.equal(doc.parameters?.length, 2);
    assert.equal(doc.returns?.type, "Result");
    assert.equal(doc.returns?.description, "The result.");
    assert.equal(doc.raises?.[0]?.description, "Raised when execution fails.");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildImportStatement } from "../src/ui/rendering/importStatement";
import { ResolutionSource } from "../../shared/types";
import { moduleSummariesSubstantiallyOverlap } from "../src/hover/moduleSummary";
import { getImportModuleAtColumn } from "../src/hover/importParsing";

describe("hover logic - baseline", () => {
  it("sanity check", () => {
    assert.equal(1 + 1, 2);
  });

  it("imports a qualified top-level symbol rather than its module prefix", () => {
    assert.equal(
      buildImportStatement({
        title: "pandas.DataFrame",
        module: "pandas",
        kind: "method",
        source: ResolutionSource.Sphinx,
      }),
      "from pandas import DataFrame",
    );
  });

  it("imports the owning class for a top-level class member", () => {
    assert.equal(
      buildImportStatement({
        title: "DataFrame.index",
        module: "pandas",
        kind: "property",
        source: ResolutionSource.Sphinx,
      }),
      "from pandas import DataFrame",
    );
  });

  it("recognizes substantially redundant module summaries", () => {
    assert.equal(
      moduleSummariesSubstantiallyOverlap(
        "Provides tools for linear algebra.",
        "It provides mathematical tools for performing complex linear algebra operations.",
      ),
      true,
    );
    assert.equal(
      moduleSummariesSubstantiallyOverlap(
        "Provides tools for linear algebra.",
        "Parses command-line arguments and configuration files.",
      ),
      false,
    );
  });

  it("only identifies the actual module token in import statements", () => {
    assert.equal(getImportModuleAtColumn("from pandas import DataFrame", 7), "pandas");
    assert.equal(getImportModuleAtColumn("from pandas import DataFrame", 20), undefined);
    assert.equal(getImportModuleAtColumn("import os.path as path", 9), "os.path");
    assert.equal(getImportModuleAtColumn("import os.path as path", 19), undefined);
  });
});

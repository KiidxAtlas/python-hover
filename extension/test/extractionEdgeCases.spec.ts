import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as zlib from "node:zlib";
import { InventoryParser } from "../../docs-engine/src/fetch/inventoryParser";
import { stripHtmlTags } from "../../shared/htmlSanitizer";

describe("extraction edge cases", () => {
  it("preserves comparisons and generic placeholders while removing HTML", () => {
    const cleaned = stripHtmlTags(
      "Return x < y and value > 0 as <T>, with <strong>strict ordering</strong>.",
    );

    assert.equal(
      cleaned,
      "Return x < y and value > 0 as <T>, with strict ordering.",
    );
  });

  it("parses CRLF Sphinx inventories and resolves relative and absolute URLs", () => {
    const body = [
      "pkg.run py:function 1 ../api/run.html -",
      "pkg.Type py:class 1 https://api.example.com/type.html -",
      "pkg.value py:data 1 generated/$ -",
    ].join("\n");
    const header = [
      "# Sphinx inventory version 2",
      "# Project: pkg",
      "# Version: 1",
      "# The remainder of this file is compressed using zlib.",
      "",
    ].join("\r\n");
    const inventory = new InventoryParser().parse(
      Buffer.concat([Buffer.from(header), zlib.deflateSync(Buffer.from(body))]),
      "https://docs.example.com/en/latest/reference/",
    );

    assert.equal(
      inventory.get("pkg.run")?.url,
      "https://docs.example.com/en/latest/api/run.html",
    );
    assert.equal(
      inventory.get("pkg.Type")?.url,
      "https://api.example.com/type.html",
    );
    assert.equal(
      inventory.get("pkg.value")?.url,
      "https://docs.example.com/en/latest/reference/generated/pkg.value",
    );
  });
});

# Python Hover — 0.5.3

Release date: 2025-10-22

## Highlights

- Operator hovers now show real documentation with correct anchors and versioned URLs.
- Standard library module hovers prefer curated module mappings for clearer descriptions and stable links.
- Snapshot test mode writes the exact hover Markdown to artifacts for easy auditing.
- Packaging cleanup: removed non-shipping files and tightened `.vscodeignore`.

## Details

- Operator docs: map each operator to the precise reference page/anchor, extract anchored HTML, convert to Markdown, and cache.
- Module hovers: version-aware links using `#module-<name>` anchors; better fallback when auto-detect is disabled.
- Tests: deterministic “Docs URL:” lines; expanded snapshot coverage across built-ins, keywords, stdlib, typing, operators, and popular libraries.
- Cleanup: removed unused UI helpers/types; gated test-only commands to test environments; pruned demo/scripts.

## Thanks

Feedback and contributions are welcome. If you spot any missing anchors or hover content issues, please open an issue.

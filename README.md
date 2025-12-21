<div align="center">

# 🐍 Python Hover

## Instant Python docs on hover — no context switching

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/KiidxAtlas.python-hover?color=blue&label=VS%20Marketplace&logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/KiidxAtlas.python-hover?color=success&style=for-the-badge&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/KiidxAtlas.python-hover?color=orange&style=for-the-badge&logo=microsoft)](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details)

[Install](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover) · [Rate](https://marketplace.visualstudio.com/items?itemName=KiidxAtlas.python-hover&ssr=false#review-details) · [Report bug](https://github.com/KiidxAtlas/python-hover/issues)

If this saves you time: [☕ Buy me a coffee](https://buymeacoffee.com/kiidxatlas) · [⭐ Star](https://github.com/KiidxAtlas/python-hover)

<img src="https://raw.githubusercontent.com/KiidxAtlas/python-hover/main/extension/media/media.gif" alt="Python Hover demo" width="760" />

</div>

---

## Why Python Hover?

You’re in the flow and you hover something like:

```python
result = df.groupby('category').agg(???)
```

Instead of alt-tabbing to docs (or guessing), you get a clean, contextual hover with:

- Signatures + docstrings
- Deep links to authoritative docs
- Useful examples and “see also” links

---

## Repo Structure

- extension/: VS Code extension (TypeScript)
- docs-engine/: doc resolution (Sphinx inventories, scraping)
- python-helper/: local Python helper for runtime introspection
- shared/: shared types/utilities
- cache/: on-disk caches

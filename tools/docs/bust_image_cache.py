#!/usr/bin/env python3
"""Add a content-based version to local image links in the docs.

GitHub serves repository images with `cache-control: max-age=300`, so a
browser can keep showing an old drawing for a few minutes after it has
changed. This script rewrites every Markdown image link to a local file,
for example `![x](img/hat-mockup.svg)`, to
`![x](img/hat-mockup.svg?v=<hash>)`, where the hash comes from the file's
content. A changed image therefore gets a new address and is fetched
fresh; an unchanged one keeps its address and stays cached.

Run from the repository root after changing images:
    python3 tools/docs/bust_image_cache.py
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LINK = re.compile(r"(!\[[^\]]*\]\()([^)\s?#]+\.(?:svg|png|jpe?g|gif))(\?v=[0-9a-f]+)?(\))")


def main() -> None:
    changed = []
    for md in sorted(list(ROOT.glob("*.md")) + list((ROOT / "docs").rglob("*.md"))):
        text = md.read_text(encoding="utf-8")

        def repl(m: re.Match) -> str:
            target = (md.parent / m.group(2)).resolve()
            if not target.is_file():
                return m.group(0)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()[:10]
            return f"{m.group(1)}{m.group(2)}?v={digest}{m.group(4)}"

        new = LINK.sub(repl, text)
        if new != text:
            md.write_text(new, encoding="utf-8")
            changed.append(md.relative_to(ROOT))
    print("updated:", ", ".join(map(str, changed)) if changed else "nothing")


if __name__ == "__main__":
    main()

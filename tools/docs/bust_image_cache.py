#!/usr/bin/env python3
"""Add a content-based version to local image links in the docs.

GitHub serves repository images with `cache-control: max-age=300`, so a
browser can keep showing an old drawing for a few minutes after it has
changed. A `?v=` on a relative link doesn't help: GitHub redirects
relative images to raw.githubusercontent.com and drops the query on the
way. So this script rewrites every Markdown image link to a file in the
repository, for example `![x](img/hat-mockup.svg)`, to the raw address
with a content hash:
`![x](https://raw.githubusercontent.com/<repo>/main/docs/img/hat-mockup.svg?v=<hash>)`.
A changed image gets a new address and is fetched fresh; an unchanged one
keeps its address and stays cached. (Trade-off: the links point at the
main branch, so old commits show the current images.)

Run from the repository root after changing images:
    python3 tools/docs/bust_image_cache.py
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = "https://raw.githubusercontent.com/isarrider/OSCoST/main/"
LINK = re.compile(r"(!\[[^\]]*\]\()([^)\s?#]+\.(?:svg|png|jpe?g|gif))(\?v=[0-9a-f]+)?(\))")


def main() -> None:
    changed = []
    for md in sorted(list(ROOT.glob("*.md")) + list((ROOT / "docs").rglob("*.md"))):
        text = md.read_text(encoding="utf-8")

        def repl(m: re.Match) -> str:
            link = m.group(2)
            if link.startswith(RAW):
                target = ROOT / link[len(RAW):]
            elif "://" in link:
                return m.group(0)
            else:
                target = (md.parent / link).resolve()
            if not target.is_file():
                return m.group(0)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()[:10]
            rel = target.relative_to(ROOT).as_posix()
            return f"{m.group(1)}{RAW}{rel}?v={digest}{m.group(4)}"

        new = LINK.sub(repl, text)
        if new != text:
            md.write_text(new, encoding="utf-8")
            changed.append(md.relative_to(ROOT))
    print("updated:", ", ".join(map(str, changed)) if changed else "nothing")


if __name__ == "__main__":
    main()

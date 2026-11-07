"""Write 640 px WebP card derivatives for every project image in data/projects.json.

Run from the repo root after adding or replacing a project image:
    python3 tools/make_card_thumbs.py
For assets/images/project-cards/<name>.<ext> it writes <name>-640w.webp next to
it (originals are never touched). render.js uses the derivative as the card
image and keeps the original in srcset for wide, high-density cards.
"""
import json
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 640


def main():
    projects = json.load(open(os.path.join(ROOT, 'data', 'projects.json'), encoding='utf-8'))
    for p in projects:
        src = (p.get('media') or {}).get('src')
        if not src:
            continue
        path = os.path.join(ROOT, src)
        base, _ = os.path.splitext(path)
        out = base + '-640w.webp'
        im = Image.open(path)
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(out, 'WEBP', quality=74, method=6)
        print(f'{os.path.relpath(out, ROOT)}  {im.width}x{im.height}  {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    main()

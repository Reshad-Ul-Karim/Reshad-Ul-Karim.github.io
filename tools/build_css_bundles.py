"""Bundle each page's local stylesheets into one file (fewer render-blocking requests).

Run from the repo root after editing any CSS:  python3 tools/build_css_bundles.py

Each page keeps the source list in a comment, so the build can be re-run:
    <!-- css-bundle: tokens.css liquid-glass.css ... -->
    <link rel="stylesheet" href="bundle-<hash>.css">
The first run takes the list from the page's own <link> tags. Sources are
concatenated in order (cascade order is unchanged), comments are stripped,
and the file is named by its content hash, so it never needs a ?v= bump.
Bundles live at the site root, so url(...) paths inside the CSS stay valid.
"""
import glob
import hashlib
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['index.html', '404.html'] + sorted(glob.glob('projects/*.html')) + sorted(glob.glob('publications/*.html'))
LINK = re.compile(r'[ \t]*<link rel="stylesheet" href="((?:\.\./)?)([a-z0-9-]+\.css)(?:\?v=[^"]*)?">\n')
MARK = re.compile(r'[ \t]*<!-- css-bundle: ([^>]*?) -->\n[ \t]*<link rel="stylesheet" href="(?:\.\./)?bundle-[0-9a-f]+\.css">\n')
COMMENT = re.compile(r'/\*.*?\*/', re.S)


def build(sources):
    parts = []
    for name in sources:
        css = open(os.path.join(ROOT, name), encoding='utf-8').read()
        css = COMMENT.sub('', css)
        css = re.sub(r'\n\s*\n+', '\n', css).strip()
        # A browser closes blocks left open at the end of a stylesheet; inside a
        # bundle they would swallow the next file, so close them here instead.
        open_blocks = css.count('{') - css.count('}')
        if open_blocks > 0:
            css += '\n' + '}' * open_blocks
        parts.append(f'/* {name} */\n{css}')
    body = '\n'.join(parts) + '\n'
    digest = hashlib.sha1(body.encode()).hexdigest()[:10]
    out = f'bundle-{digest}.css'
    path = os.path.join(ROOT, out)
    if not os.path.exists(path):
        open(path, 'w', encoding='utf-8').write(body)
    return out


def main():
    os.chdir(ROOT)
    used = set()
    for page in PAGES:
        html = open(page, encoding='utf-8').read()
        m = MARK.search(html)
        if m:
            sources = m.group(1).split()
            prefix = '../' if '/' in page else ''
            span = (m.start(), m.end())
        else:
            links = list(LINK.finditer(html))
            if not links:
                continue
            sources = [l.group(2) for l in links]
            prefix = links[0].group(1)
            # keep only the first link's position; drop the others
            for l in reversed(links[1:]):
                html = html[:l.start()] + html[l.end():]
            first = LINK.search(html)
            span = (first.start(), first.end())
        out = build(sources)
        used.add(out)
        tag = f'    <!-- css-bundle: {" ".join(sources)} -->\n    <link rel="stylesheet" href="{prefix}{out}">\n'
        html = html[:span[0]] + tag + html[span[1]:]
        open(page, 'w', encoding='utf-8').write(html)
        print(f'{page}: {len(sources)} files -> {out}')
    for old in glob.glob('bundle-*.css'):
        if old not in used:
            os.remove(old)


if __name__ == '__main__':
    main()

"""One-shot migration: legacy project detail pages -> glass hero + visual story.

Rewrites projects/<slug>.html in place (skips pages already migrated):
  * hero: glass card with status, domains, title, lead, glyph buttons, cover
  * the shared 3D "trace" exhibit -> a scroll-told story (story.js), whose beats
    are the page's own documented steps, its outcome, then any second case
  * section headers: glyph tile + title, no decorative rule
"""
import glob, html, json, re, sys

SPRITE = '../assets/glyphs.svg#'
ICON = {'fa-github': 'g-github', 'fa-file-pdf': 'g-pdf', 'fa-youtube': 'g-play', 'fa-file-alt': 'g-doc',
        'fa-arrow-up-right-from-square': 'g-external', 'fa-image': 'g-image'}
SECTION = [('overview', 'g-eye'), ('challenge', 'g-target'), ('hard', 'g-target'), ('problem', 'g-target'),
           ('approach', 'g-nodes'), ('how', 'g-nodes'), ('idea', 'g-spark'), ('architecture', 'g-layers'),
           ('result', 'g-chart'), ('numbers', 'g-chart'), ('tech stack', 'g-chip'), ('schematic', 'g-layers'),
           ('figure', 'g-image'), ('highlight', 'g-spark'), ('status', 'g-flask'), ('scope', 'g-target'),
           ('decision', 'g-nodes'), ('gameplay', 'g-play'), ('training', 'g-chip'), ('navigation', 'g-nodes')]
CAMDET = [
    ('Different cameras', 'Each lens sees the same scene a little differently, which quietly breaks most single-image 3D detectors.', 'ok'),
    ('Robust to the camera', 'Training makes the model robust to the camera itself, so one set of weights covers sensors it never saw.', 'ok'),
    ('Metric depth', 'From one ordinary RGB photo it estimates how far away each object is, with no depth sensor.', 'ok'),
    ('Full 3D box', 'The 2D box, the distance and the 3D box come out together from one shared set of queries.', 'ok'),
    ('Outcome', 'Real time, up to about 128 FPS at the smallest scale, and the same exported model runs from a desktop GPU down to an edge device.', 'ok'),
]


def gi(name, extra=''):
    return f'<svg class="gi{extra}" aria-hidden="true"><use href="{SPRITE}{name}"/></svg>'


def section_glyph(title):
    t = html.unescape(title).lower()
    for key, g in SECTION:
        if key in t:
            return g
    return 'g-spark'


def beats_from(config, slug):
    if slug == 'camdet' or not config:
        return CAMDET
    sc = config['scenarios']
    out = [(s['label'], s['detail'], s.get('state', 'ok')) for s in sc[0]['steps']]
    out.append(('Outcome', sc[0]['result'], 'ok'))
    for extra in sc[1:]:
        stop = any(s.get('state') == 'stop' for s in extra['steps'])
        out.append((extra['label'], extra['result'], 'stop' if stop else 'alt'))
    return out


def convert_links(links_html):
    def repl(m):
        tag, cls, attrs, icon, text = m.group(1), m.group(2), m.group(3), m.group(4), m.group(5).strip()
        keep = ' '.join(c for c in cls.split() if c in ('pdf-viewer-btn', 'youtube-modal-btn', 'is-primary'))
        g = next((v for k, v in ICON.items() if k in icon), 'g-external')
        clear = '' if 'is-primary' in cls else ' gi--clear'
        return f'<{tag} class="ph-btn {keep}".strip(){attrs}>{gi(g, clear)}<span>{text}</span></{tag}>'.replace('".strip()', '"')
    out = re.sub(r'<(a|button)\s+(?:type="button"\s+)?class="([^"]*detail-link[^"]*)"([^>]*)><i class="([^"]+)"></i>(.*?)</\1>', repl, links_html, flags=re.S)
    return out.replace('class="ph-btn "', 'class="ph-btn"').replace('<button class=', '<button type="button" class=')


def migrate(path):
    s = open(path, encoding='utf-8').read()
    if 'class="ph-hero' in s:
        return 'skip'
    slug = path.rsplit('/', 1)[1][:-5]

    # ---- head ----
    s = s.replace('    <link rel="stylesheet" href="../demo-pane.css?v=1.0.0">\n', '')
    s = s.replace('    <script type="module" src="../demo-pane.js?v=1.0.0"></script>\n', '')
    s = re.sub(r'    <script src="https://cdnjs.cloudflare.com/ajax/libs/vanilla-tilt/[^"]+" defer></script>\n', '', s)
    s = re.sub(r'(    <link rel="stylesheet" href="../liquid-glass.css\?v=[^"]+">\n)',
               r'\1    <link rel="stylesheet" href="../glyphs.css?v=1.0.0">\n    <link rel="stylesheet" href="../project-page.css?v=1.0.0">\n', s)
    s = s.replace('</head>', '    <script src="../story-scenes.js?v=1.0.0" defer></script>\n    <script src="../story.js?v=1.0.0" defer></script>\n</head>', 1)

    # ---- parse hero + exhibit ----
    hero = re.search(r'<a class="detail-back"[^>]*>.*?</a>\s*<header class="detail-hero">(.*?)</header>\s*(?:<!--.*?-->\s*)?<section class="xp".*?</section>', s, re.S)
    if not hero:
        raise SystemExit(f'{path}: unexpected structure')
    h = hero.group(1)
    xp = hero.group(0)[hero.group(0).find('<section class="xp"'):]
    domains = re.findall(r'<span class="detail-domain-tag( is-primary)?">(.*?)</span>', h)
    title = re.search(r'<h1 class="detail-title">(.*?)</h1>', h, re.S).group(1)
    status = re.search(r'<span class="detail-status-dot"></span>\s*(.*?)</div>', h, re.S).group(1).strip()
    lead = re.search(r'<p class="detail-lead">(.*?)</p>', h, re.S).group(1)
    links = re.search(r'<div class="detail-links">(.*?)</div>', h, re.S)
    xtitle = re.search(r'class="xp-title"[^>]*>(.*?)</h2>', xp, re.S).group(1)
    poster = re.search(r'<img class="xp-poster" src="([^"]+)" alt="([^"]*)"', xp)
    cfg = re.search(r'<script type="application/json">(.*?)</script>', xp, re.S)
    config = json.loads(cfg.group(1)) if cfg and 'scenarios' in cfg.group(1) else None
    beats = beats_from(config, slug)

    chips = ''.join(f'<span class="ph-chip{" is-primary" if p else ""}">{d}</span>' for p, d in domains)
    actions = convert_links(links.group(1)) if links else ''
    actions += f'<a class="ph-btn" href="#story">{gi("g-film", " gi--clear")}<span>Watch the story</span></a>'
    cover = (f'\n          <figure class="ph-hero__cover"><img src="{poster.group(1)}" alt="{poster.group(2)}" decoding="async" fetchpriority="high"></figure>'
             if poster else '')
    tone = 'ongoing' if status.lower().startswith('ongoing') else 'done'
    phd = ('<a class="phd-pill" href="../assets/papers/Reshad_Ul_Karim_Resume.pdf" download="Reshad_Ul_Karim_Resume.pdf">'
           '<span class="hero__status-dot" aria-hidden="true"></span><strong>Seeking PhD opportunities</strong>'
           '<span class="hero__status-sep" aria-hidden="true"></span>Download CV</a>')

    items = []
    for i, (label, detail, st) in enumerate(beats):
        tone_attr = f' data-tone="{st}"' if st != 'ok' else ''
        items.append(f'<li class="story__beat"{tone_attr}><span class="story__num">{i + 1:02d}</span><h3>{html.escape(label, quote=False)}</h3><p>{html.escape(detail, quote=False)}</p></li>')
    poster_img = f'<img class="story__poster" src="{poster.group(1)}" alt="" loading="lazy" decoding="async">' if poster else ''

    new = f'''<a class="ph-back" href="index.html">{gi("g-arrow-left", " gi--clear")}<span>All projects</span></a>
        <header class="ph-hero{" has-cover" if poster else ""}">
          <div class="ph-hero__card">
            {phd}
            <div class="ph-hero__meta"><span class="ph-status ph-status--{tone}"><span class="ph-status__dot" aria-hidden="true"></span>{status}</span>{chips}</div>
            <h1 class="ph-title">{title}</h1>
            <p class="ph-lead">{lead}</p>
            <div class="ph-actions">{actions}</div>
          </div>{cover}
        </header>
        <section class="story" id="story" data-story="{slug}" aria-labelledby="story-title">
          <header class="ph-head">
            <span class="ph-kicker">{gi("g-film")}Visual story</span>
            <h2 class="ph-h2" id="story-title">{xtitle}</h2>
            <p class="ph-sub">Scroll to watch it unfold. Each beat is one documented step of the project.</p>
          </header>
          <div class="story__grid">
            <div class="story__stage">{poster_img}<canvas class="story__canvas" aria-hidden="true"></canvas><div class="story__dots" aria-hidden="true"></div></div>
            <ol class="story__beats">
              {"""
              """.join(items)}
            </ol>
          </div>
          <p class="story__note">{gi("g-spark", " gi--clear")}An illustration of how the system works, drawn from the write-up below. It is not recorded output.</p>
        </section>'''
    s = s.replace(hero.group(0), new, 1)

    # ---- body ----
    s = re.sub(r'<section class="detail-section"><h2 class="detail-section-title">(.*?)</h2>',
               lambda m: f'<section class="ph-section"><h2 class="ph-h2">{gi(section_glyph(m.group(1)))}<span>{m.group(1)}</span></h2>', s)
    s = s.replace('<div class="detail-related"><a class="detail-back" href="index.html"><i class="fas fa-arrow-left"></i> Back to all projects</a></div>',
                  f'<div class="ph-related"><a class="ph-back" href="index.html">{gi("g-arrow-left", " gi--clear")}<span>Back to all projects</span></a></div>')
    s = s.replace('<main class="detail-page">', '<main class="detail-page ph-page">')
    open(path, 'w', encoding='utf-8').write(s)
    return f'ok ({len(beats)} beats)'


if __name__ == '__main__':
    for p in sorted(glob.glob('projects/*.html')):
        if p.endswith('/index.html'):
            continue
        print(p, migrate(p))

import { useMemo, useRef } from 'react';
import CardSwap from '../reactbits/CardSwap/CardSwap.jsx';
import { useStill, useTheme } from '../env.js';

// Homepage projects as a Card Swap stack. The list beside it (ul.projects)
// stays the readable, linkable version of the same six projects; the stack
// shows their images. Clicking the front card opens that project; clicking a
// card behind brings it forward. Autoplay pauses on hover, with Pause motion
// and with reduced motion.
// The smallest listed image that still covers a ~440 px card at 2x, or a
// 640 px card derivative (tools/make_card_thumbs.py), never the full original.
function cardImage(img) {
  const set = (img.getAttribute('srcset') || '').split(',').map((part) => part.trim().split(/\s+/)).filter((p) => p[0] && p[1]);
  const fits = set.map(([url, w]) => [url, parseInt(w, 10)]).filter(([, w]) => w >= 640).sort((a, b) => a[1] - b[1]);
  if (fits.length) return new URL(fits[0][0], document.baseURI).href;
  const src = img.getAttribute('src') || '';
  if (/assets\/images\/project-cards\/[^/]+\.(png|jpe?g|webp)$/i.test(src) && !/-\d+w\.webp$/.test(src)) {
    return new URL(src.replace(/\.(png|jpe?g|webp)$/i, '-640w.webp'), document.baseURI).href;
  }
  return img.currentSrc || img.src;
}

export default function ProjectsIsland({ host }) {
  const theme = useTheme();
  const still = useStill();
  const front = useRef(0);
  const projects = useMemo(() => {
    const list = host.closest('section').querySelectorAll('ul.projects > li');
    return Array.from(list).map((li) => {
      const img = li.querySelector('.project__media img');
      const link = li.querySelector('h3 a');
      return {
        title: link ? link.textContent.trim() : '',
        href: link ? link.getAttribute('href') : null,
        image: img ? cardImage(img) : null,
        alt: img ? img.getAttribute('alt') || '' : ''
      };
    });
  }, [host]);

  return (
    <CardSwap
      items={projects.map(({ title, image, alt }) => ({ title, image, alt, icon: null }))}
      width={440}
      height={300}
      cardDistance={48}
      verticalDistance={56}
      delay={4500}
      autoplay={!still}
      pauseOnHover
      theme={theme.dark ? 'dark' : 'light'}
      intro={!still}
      ariaLabel="Project images: use the arrow keys to cycle"
      onChange={(i) => { front.current = i; }}
      onCardClick={(i) => {
        if (i === front.current && projects[i] && projects[i].href) location.href = projects[i].href;
      }}
    />
  );
}

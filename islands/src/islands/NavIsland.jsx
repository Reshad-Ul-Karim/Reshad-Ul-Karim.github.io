import { useEffect, useRef, useState } from 'react';
import GooeyNav from '../reactbits/GooeyNav/GooeyNav.jsx';
import { useTheme } from '../env.js';

// Desktop nav links as Gooey Nav. The plain list (#nav-links) stays in the
// page for phones (disclosure panel) and without JS; home.js's scrollspy
// drives the active pill through 'spychange'. While a clicked link's smooth
// scroll runs, the pill stays on the target instead of flowing through every
// section passed on the way.
const header = document.querySelector('[data-header]');

function readItems() {
  const links = Array.from(document.querySelectorAll('#nav-links a[href^="#"]:not(.nav__cta)'));
  return [{ label: 'Home', href: '#home', id: 'home' }].concat(
    links.map((a) => ({ label: a.textContent.trim(), href: a.getAttribute('href'), id: a.getAttribute('href').slice(1) }))
  );
}

export default function NavIsland() {
  const theme = useTheme();
  const [items] = useState(readItems);
  const [active, setActive] = useState(() => {
    const cur = document.querySelector('#nav-links a[aria-current]');
    const i = cur ? items.findIndex((it) => it.href === cur.getAttribute('href')) : -1;
    return i < 0 ? 0 : i;
  });
  const [surface, setSurface] = useState(() => header?.getAttribute('data-surface') || 'dark');
  const lock = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add('has-gooey-nav');
    const onSpy = (e) => {
      if (performance.now() < lock.current) return;
      const i = items.findIndex((it) => it.id === (e.detail && e.detail.id));
      setActive(i < 0 ? 0 : i);
    };
    document.addEventListener('spychange', onSpy);
    const mo = header ? new MutationObserver(() => setSurface(header.getAttribute('data-surface') || 'dark')) : null;
    if (mo) mo.observe(header, { attributes: true, attributeFilter: ['data-surface'] });
    return () => {
      document.documentElement.classList.remove('has-gooey-nav');
      document.removeEventListener('spychange', onSpy);
      if (mo) mo.disconnect();
    };
  }, [items]);

  const onDark = surface !== 'light' || theme.dark;
  return (
    <GooeyNav
      items={items}
      activeIndex={active}
      onChange={(i) => { lock.current = performance.now() + 1400; setActive(i); }}
      theme={onDark ? 'dark' : 'light'}
      color={surface !== 'light' ? theme.hl : theme.actionBg}
      activeTextColor={surface !== 'light' ? theme.onHl : theme.actionInk}
      size="sm"
      frame={false}
      particleCount={12}
    />
  );
}

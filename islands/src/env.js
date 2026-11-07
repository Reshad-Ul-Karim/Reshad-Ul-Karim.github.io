import { useEffect, useState } from 'react';

import { media } from './media.js';

export { media };
const root = document.documentElement;

function readTheme() {
  const cs = getComputedStyle(root);
  const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
  return {
    dark: root.getAttribute('data-theme') === 'dark',
    hl: v('--hl', '#8CF0D3'),
    onHl: v('--on-hl', '#0C2120'),
    decor: v('--decor', '#D8B98B'),
    mid: v('--mark-mid', '#3FB7A0'),
    primary: v('--primary', '#0B5D56'),
    primaryInk: v('--primary-ink', '#FFFFFF'),
    link: v('--link', '#0B5D56'),
    actionBg: v('--action-bg', '#8CF0D3'),
    actionInk: v('--action-ink', '#0C2120'),
    heroInk: v('--hero-ink', '#EAF3EE'),
    ink: v('--ink', '#ECEDEE')
  };
}

// Site colours (html[data-theme] + html[data-accent]) as props, re-read
// whenever the theme toggle or the colour widget changes them.
export function useTheme() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(readTheme()));
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-accent'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

// The hero's Pause motion button (hero-motion.js) and prefers-reduced-motion.
export function useStill() {
  const read = () => media.reduced() || root.classList.contains('motion-paused');
  const [still, setStill] = useState(read);
  useEffect(() => {
    const update = () => setStill(read());
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    document.addEventListener('motionchange', update);
    mq.addEventListener('change', update);
    return () => { document.removeEventListener('motionchange', update); mq.removeEventListener('change', update); };
  }, []);
  return still;
}

export function openAssistant(fallbackHash = '#contact') {
  const fab = document.getElementById('ask-reshad-fab');
  if (fab) fab.click();
  else location.hash = fallbackHash;
}

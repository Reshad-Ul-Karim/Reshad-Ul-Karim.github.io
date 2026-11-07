import { useEffect, useState } from 'react';
import TechText from '../reactbits/TechText/TechText.jsx';
import { useStill, useTheme } from '../env.js';

// The hero name as Tech Text, one canvas per line. The <h1>'s own text stays
// in the DOM (visually hidden once this mounts) for screen readers and search;
// the host keeps the two lines' exact height, so nothing shifts.
export default function NameIsland({ host }) {
  const theme = useTheme();
  const still = useStill();
  const title = host.closest('h1');
  const lines = Array.from(title.querySelectorAll(':scope > span:not([data-island])')).map((s) => s.textContent.trim());
  const [font, setFont] = useState(() => {
    const cs = getComputedStyle(title);
    return { family: cs.fontFamily, size: parseFloat(cs.fontSize) || 80 };
  });

  useEffect(() => {
    title.classList.add('is-tech');
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(title);
      setFont((f) => (Math.abs(f.size - parseFloat(cs.fontSize)) > 0.5 ? { family: cs.fontFamily, size: parseFloat(cs.fontSize) } : f));
    });
    ro.observe(title);
    return () => { ro.disconnect(); title.classList.remove('is-tech'); };
  }, [title]);

  const common = {
    fontFamily: font.family,
    fontWeight: 700,
    fontSize: font.size,
    letterSpacing: -0.04,
    align: 'left',
    reach: 160,
    accentColor: theme.hl,
    labels: true,
    specks: 10,
    selection: false,
    sweep: false, // an always-on sweep redraws the canvas every frame while the hero is visible
    intro: 'none' // it mounts on the first interaction, so the name must not re-assemble then
  };
  return (
    <>
      {lines.map((text, i) => (
        <span key={i} className="hero__tech-line">
          <TechText {...common} text={text} color={i === 0 ? theme.heroInk : theme.hl} accentColor={i === 0 ? theme.hl : theme.decor} />
        </span>
      ))}
    </>
  );
}

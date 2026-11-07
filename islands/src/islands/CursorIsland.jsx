import SplashCursor from '../reactbits/SplashCursor/SplashCursor.jsx';
import { media, useTheme } from '../env.js';

// Fluid ink that follows the mouse, or a finger on touch screens (never with
// reduced motion, Save-Data or on the lite tier: see main.jsx). It simulates
// only while the pointer or finger moves, then goes quiet; touch screens use
// the low-resolution simulation. Inked in the active accent, below the nav
// and floating controls, never taking input or blocking scrolling.
export default function CursorIsland() {
  const theme = useTheme();
  return (
    <SplashCursor
      colors={[theme.hl, theme.mid, theme.decor]}
      rainbow={false}
      intensity={0.85}
      quality={media.fine() ? 'medium' : 'low'}
      intro={false}
      theme={theme.dark ? 'dark' : 'light'}
      zIndex={55}
    />
  );
}

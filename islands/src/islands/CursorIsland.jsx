import SplashCursor from '../reactbits/SplashCursor/SplashCursor.jsx';
import { useTheme } from '../env.js';

// Fluid ink that follows the mouse (desktop fine pointers only; never on
// touch, reduced motion, Save-Data or the lite tier: see main.jsx). It
// simulates only while the pointer moves, then goes quiet. Inked in the
// active accent, below the nav and floating controls, never taking input.
export default function CursorIsland() {
  const theme = useTheme();
  return (
    <SplashCursor
      colors={[theme.hl, theme.mid, theme.decor]}
      rainbow={false}
      intensity={0.85}
      quality="medium"
      intro={false}
      theme={theme.dark ? 'dark' : 'light'}
      zIndex={55}
    />
  );
}

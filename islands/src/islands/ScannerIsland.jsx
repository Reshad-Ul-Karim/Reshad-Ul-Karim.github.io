import Scanner from '../reactbits/Scanner/Scanner.jsx';
import { media, useStill, useTheme } from '../env.js';

// Hero background: Scanner in the active accent. It renders only while the
// hero is on screen and the tab is visible (built into Scanner). The hero is
// always a dark stage, so it uses the dark palette in both page themes. Pause
// motion and reduced motion hold a still frame. Drawn at 1x (0.75x on
// low-end devices): a soft background needs no retina resolution.
export default function ScannerIsland() {
  const theme = useTheme();
  const still = useStill();
  return (
    <Scanner
      color1={theme.hl}
      color2={theme.mid}
      color3="#FFFFFF"
      speed={still ? 0 : 0.4}
      sweepSpeed={still ? 0 : 0.2}
      opacity={0.75}
      brightness={0.9}
      glow={0.5}
      vignette={0.45}
      grainIntensity={0.03}
      mouseInteraction={media.fine()}
      clickEffect="ping"
      intro={!still}
      dpr={media.lite() ? 0.75 : 1}
    />
  );
}

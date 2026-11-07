import { useLayoutEffect } from 'react';
import FlyingButton from '../reactbits/FlyingButton/FlyingButton.jsx';
import { openAssistant, useTheme } from '../env.js';

// "Ask my AI assistant" as a Flying Button: it lifts off on hover, and a
// click opens the chat widget (or jumps to the contact section if the widget
// is unavailable). The host's plain link is the no-JS version. Flying Button
// is a stage the button flies up inside, so the host keeps the button's own
// footprint in the row and home.css hangs the stage above it.
export default function AssistantButtonIsland({ host }) {
  const theme = useTheme();
  const label = host.getAttribute('data-label') || 'Ask my AI assistant';
  useLayoutEffect(() => {
    const fit = () => {
      const craft = host.querySelector('.flying-button__craft');
      if (craft && craft.offsetWidth) host.style.width = craft.offsetWidth + 'px';
    };
    fit();
    const ro = new ResizeObserver(fit);
    const craft = host.querySelector('.flying-button__craft');
    if (craft) ro.observe(craft);
    return () => ro.disconnect();
  }, [host]);
  return (
    <FlyingButton
      onClick={() => openAssistant()}
      theme={theme.dark ? 'dark' : 'light'}
      size="large"
      buttonColor={theme.actionBg}
      textColor={theme.actionInk}
      thrustColor={theme.hl}
      carryCursor={false}
      altitude={110}
    >
      {label}
    </FlyingButton>
  );
}

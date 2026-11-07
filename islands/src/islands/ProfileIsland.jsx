import ProfileCard from '../reactbits/ProfileCard/ProfileCard.jsx';
import { useTheme } from '../env.js';

// About: a tilting holographic profile card in place of the static portrait
// card the host holds (which stays for no-JS). Contact jumps to the contact
// section. Card text comes from facts already on the page.
// Absolute URLs: the card passes some of them through CSS custom properties,
// which would otherwise resolve against the island's own stylesheet.
const abs = (path) => new URL(path, document.baseURI).href;

export default function ProfileIsland() {
  const theme = useTheme();
  return (
    <ProfileCard
      avatarUrl={abs('assets/portrait/reshad-headshot-720.webp')}
      miniAvatarUrl={abs('assets/brand/avatar-96.webp')}
      iconUrl={abs('assets/brand/holo-pattern.svg')}
      name="Reshad Ul Karim"
      title="AI/ML Engineer & Researcher"
      handle="reshad-ul-karim"
      status="Seeking PhD opportunities"
      statusColor={theme.hl}
      contactText="Contact"
      onContactClick={() => {
        const target = document.getElementById('contact');
        if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }}
      theme={theme.dark ? 'dark' : 'light'}
      enableMobileTilt={false}
    />
  );
}

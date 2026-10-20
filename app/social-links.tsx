import { ArrowUpRight, Send } from 'lucide-react';

const socials = [
  { id: 'instagram', label: 'Instagram', handle: '@devvvanarayanan', href: 'https://www.instagram.com/devvvanarayanan?stkn=MXd6ajFrdG5tMnV5NQ==' },
  { id: 'facebook', label: 'Facebook', handle: 'Visit my page', href: 'https://www.facebook.com/share/14uxK1yCDgS/' },
  { id: 'telegram', label: 'Telegram', handle: '@Devanarayananv2006', href: 'https://t.me/Devanarayananv2006' },
] as const;

function SocialIcon({ id }: { id: typeof socials[number]['id'] }) {
  if (id === 'telegram') return <Send size={20} aria-hidden="true"/>;
  if (id === 'facebook') return <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8c0-.9.3-1.5 1.6-1.5h1.7V3.8a23 23 0 0 0-2.5-.1c-2.5 0-4.2 1.5-4.2 4.3v2H8v3h2.6v8H14Z"/></svg>;
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>;
}

export default function SocialLinks() {
  return <section className="social-section" aria-labelledby="social-title">
    <div className="settings-section-heading"><h3 id="social-title">Stay connected</h3><p>Find Devanarayanan on your favourite platform.</p></div>
    <div className="social-links">{socials.map(social => <a key={social.id} className="social-link" href={social.href} target="_blank" rel="noopener noreferrer" aria-label={`${social.label}: ${social.handle} (opens in a new tab)`}>
      <span className={`social-icon ${social.id}`}><SocialIcon id={social.id}/></span>
      <span className="social-label"><strong>{social.label}</strong><small>{social.handle}</small></span>
      <ArrowUpRight size={18} className="social-arrow" aria-hidden="true"/>
    </a>)}</div>
    <p className="social-hint">Links open in a new tab or the installed social app.</p>
  </section>;
}

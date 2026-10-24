import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar, BrandMark, LinkButton, NavItem, PillToggle, SegmentedControl, Toast } from '../ds';
import { LANG_OPTIONS, NAV, NAV_GROUP, ROLE_OPTIONS, SCREEN_TITLES } from '../data/shared';
import { useApp } from '../app/useApp';
import { useAuth, useSignedIn } from '../auth/useAuth';

const initialsOf = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).map(w => w[0]).join('') : email[0]).slice(0, 2).toUpperCase();

/** Who is signed in, with the language setting: opened from the name at the foot of the sidebar. */
function ProfilePopup({ onClose }: { onClose: () => void }) {
  const { s, set } = useApp();
  const { profile, roles } = useSignedIn();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown); };
  }, [onClose]);
  const row = { display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: 12.5 } as const;
  return (
    <div ref={box} role="dialog" aria-label="Profile details" style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(100% + 8px)', background: '#fff', color: '#1a1d18', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Profile details</div>
      <div style={row}><span style={{ color: '#6b716a' }}>Name</span><span>{profile.full_name || '—'}</span></div>
      <div style={row}><span style={{ color: '#6b716a' }}>Email</span><span style={{ overflowWrap: 'anywhere' }}>{profile.email}</span></div>
      <div style={row}><span style={{ color: '#6b716a' }}>Roles</span><span>{roles.map(r => r.name).join(', ')}</span></div>
      {profile.cohort ? <div style={row}><span style={{ color: '#6b716a' }}>Cohort</span><span>{profile.cohort}</span></div> : null}
      <div style={{ ...row, alignItems: 'center' }}><span style={{ color: '#6b716a' }}>Language</span><PillToggle options={LANG_OPTIONS} value={s.lang} onChange={lang => set({ lang })} size="xs" /></div>
    </div>
  );
}

function Account() {
  const { profile, roles } = useSignedIn();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', marginTop: 'auto', padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
      {open ? <ProfilePopup onClose={() => setOpen(false)} /> : null}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        title="Profile details"
        style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1, background: 'none', border: 0, padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
      >
        <Avatar initials={initialsOf(profile.full_name, profile.email)} tone="green" size={32} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name || profile.email}</span>
          <span style={{ display: 'block', fontSize: 11.5, color: '#a9afa5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roles.map(r => r.name).join(' · ')}</span>
        </span>
      </button>
      <LinkButton tone="onDark" size={12} onClick={() => void signOut()}>Sign out</LinkButton>
    </div>
  );
}

function Sidebar() {
  const { s, go } = useApp();
  return (
    <aside style={{ width: 248, flex: 'none', background: '#171a16', color: '#c9cec5', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <BrandMark />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Game Studio</div>
          <div style={{ fontSize: 11, color: '#858c82' }}>Deloitte</div>
        </div>
      </div>
      <nav style={{ padding: '14px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#858c82', padding: '4px 8px 8px' }}>{NAV_GROUP[s.role]}</div>
        {NAV[s.role].map(([label, screen, count]) => (
          <NavItem
            key={label}
            label={label}
            count={count}
            active={s.screen === screen || (screen === 'results' && s.screen === 'play')}
            badge={label === 'Games' ? 1 : undefined}
            onClick={() => go(screen)}
          />
        ))}
      </nav>
      <Account />
    </aside>
  );
}

function Header() {
  const { s, roles, setRole } = useApp();
  // Only roles the user holds; someone with a single role has nothing to switch.
  const options = ROLE_OPTIONS.filter(o => roles.includes(o.value));
  return (
    <header style={{ height: 60, flex: 'none', position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #e1e5dc', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#5a6058', marginRight: 'auto' }}>{SCREEN_TITLES[s.screen]}</div>
      {options.length > 1 ? (
        <>
          <span style={{ fontSize: 12, color: '#8b918a' }}>View as</span>
          <SegmentedControl options={options} value={s.role} onChange={setRole} size="sm" />
        </>
      ) : null}
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { s } = useApp();
  return (
    <>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Header />
          <main style={{ padding: '26px 32px 140px', maxWidth: 1260, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</main>
        </div>
      </div>
      {s.toast ? <Toast>{s.toast}</Toast> : null}
    </>
  );
}

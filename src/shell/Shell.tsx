import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Avatar, BrandMark, LinkButton, NavItem, PillToggle, SegmentedControl, Toast } from '../ds';
import { LANG_OPTIONS, NAV, NAV_GROUP, ROLE_OPTIONS, SCREEN_TITLES } from '../data/shared';
import { useApp } from '../app/useApp';
import { useAuth, useSignedIn } from '../auth/useAuth';

const initialsOf = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).map(w => w[0]).join('') : email[0]).slice(0, 2).toUpperCase();

/** Who is signed in, with the language setting: opened from the name at the foot of the sidebar. */
function ProfilePopup({ onClose, folded }: { onClose: () => void; folded: boolean }) {
  const { s, set } = useApp();
  const { profile, roles } = useSignedIn();
  const { signOut } = useAuth();
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
    <div ref={box} role="dialog" aria-label="Profile details" style={{ position: 'absolute', ...(folded ? { left: 'calc(100% + 8px)', bottom: 8, width: 260 } : { left: 12, right: 12, bottom: 'calc(100% + 8px)' }), background: '#fff', color: '#1a1d18', borderRadius: 8, boxShadow: '0 12px 32px rgba(0,0,0,.28)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13.5 }}>Profile details</div>
      <div style={row}><span style={{ color: '#6b716a' }}>Name</span><span>{profile.full_name || '—'}</span></div>
      <div style={row}><span style={{ color: '#6b716a' }}>Email</span><span style={{ overflowWrap: 'anywhere' }}>{profile.email}</span></div>
      <div style={row}><span style={{ color: '#6b716a' }}>Roles</span><span>{roles.map(r => r.name).join(', ')}</span></div>
      {profile.cohort ? <div style={row}><span style={{ color: '#6b716a' }}>Cohort</span><span>{profile.cohort}</span></div> : null}
      <div style={{ ...row, alignItems: 'center' }}><span style={{ color: '#6b716a' }}>Language</span><PillToggle options={LANG_OPTIONS} value={s.lang} onChange={lang => set({ lang })} size="xs" /></div>
      {folded ? <div><LinkButton size={12.5} onClick={() => void signOut()}>Sign out</LinkButton></div> : null}
    </div>
  );
}

function Account({ folded }: { folded: boolean }) {
  const { profile, roles } = useSignedIn();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: 'relative', flex: 'none', padding: folded ? '12px 0' : '14px 18px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: folded ? 'center' : undefined, gap: 10 }}>
      {open ? <ProfilePopup folded={folded} onClose={() => setOpen(false)} /> : null}
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={folded ? `${profile.full_name || profile.email}, profile details` : undefined}
        onClick={() => setOpen(o => !o)}
        title="Profile details"
        style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: folded ? 'none' : 1, background: 'none', border: 0, padding: 0, font: 'inherit', textAlign: 'left', cursor: 'pointer', color: 'inherit' }}
      >
        <Avatar initials={initialsOf(profile.full_name, profile.email)} tone="green" size={32} />
        {folded ? null : (
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.full_name || profile.email}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: '#a9afa5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roles.map(r => r.name).join(' · ')}</span>
          </span>
        )}
      </button>
      {folded ? null : <LinkButton tone="onDark" size={12} onClick={() => void signOut()}>Sign out</LinkButton>}
    </div>
  );
}

const NAV_WIDTH = { open: 248, folded: 64 };

/**
 * Fixed to the window (top and bottom), not sized by viewport units, so the account at its foot is always in
 * view; the menu items scroll if the window is short. The Game Studio mark folds it to a rail and back.
 */
function Sidebar() {
  const { s, set, go } = useApp();
  const folded = !s.navOpen;
  return (
    <aside style={{ position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 10, width: folded ? NAV_WIDTH.folded : NAV_WIDTH.open, background: '#171a16', color: '#c9cec5', display: 'flex', flexDirection: 'column', transition: 'width .15s ease' }}>
      <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: folded ? '16px 0' : '16px 18px', justifyContent: folded ? 'center' : undefined, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <button
          type="button"
          aria-label={folded ? 'Show menu' : 'Hide menu'}
          aria-expanded={!folded}
          title={folded ? 'Show menu' : 'Hide menu'}
          onClick={() => set({ navOpen: folded })}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', borderRadius: 6 }}
        >
          <BrandMark />
        </button>
        {folded ? null : (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Game Studio</div>
            <div style={{ fontSize: 11, color: '#858c82' }}>Deloitte</div>
          </div>
        )}
      </div>
      {folded ? <div style={{ flex: 1 }} /> : (
        <nav style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#858c82', padding: '4px 8px 8px' }}>{NAV_GROUP[s.role]}</div>
          {NAV[s.role].map(([label, screen, count]) => (
            <NavItem
              key={label}
              label={label}
              count={count}
              active={s.screen === screen || (screen === 'results' && s.screen === 'play')}
              onClick={() => go(screen)}
            />
          ))}
        </nav>
      )}
      <Account folded={folded} />
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
      <Sidebar />
      <div style={{ minHeight: '100dvh', marginLeft: s.navOpen ? NAV_WIDTH.open : NAV_WIDTH.folded, transition: 'margin-left .15s ease' }}>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Header />
          <main style={{ padding: '26px 32px 140px', maxWidth: 1260, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>{children}</main>
        </div>
      </div>
      {s.toast ? <Toast>{s.toast}</Toast> : null}
    </>
  );
}

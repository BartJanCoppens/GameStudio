import type { ReactNode } from 'react';
import { Avatar, BrandMark, Button, LinkButton, NavItem, PillToggle, SegmentedControl, Toast } from '../ds';
import { LANG_OPTIONS, NAV, NAV_GROUP, ROLE_OPTIONS, SCREEN_TITLES } from '../data/shared';
import { useApp } from '../app/useApp';
import { useAuth, useSignedIn } from '../auth/useAuth';

const initialsOf = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).map(w => w[0]).join('') : email[0]).slice(0, 2).toUpperCase();

function Account() {
  const { profile, roles } = useSignedIn();
  const { signOut } = useAuth();
  return (
    <div style={{ marginTop: 'auto', padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <Avatar initials={initialsOf(profile.full_name, profile.email)} tone="green" size={32} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={profile.email}>{profile.full_name || profile.email}</div>
        <div style={{ fontSize: 11.5, color: '#a9afa5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{roles.map(r => r.name).join(' · ')}</div>
      </div>
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
  const { s, set, roles, setRole } = useApp();
  const { signOut } = useAuth();
  const { profile } = useSignedIn();
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
      <PillToggle options={LANG_OPTIONS} value={s.lang} onChange={lang => set({ lang })} size="xs" />
      <span style={{ width: 1, height: 24, background: '#e1e5dc' }} aria-hidden="true" />
      <span style={{ fontSize: 12, color: '#5a6058', whiteSpace: 'nowrap' }}>{profile.email}</span>
      <Button variant="secondary" size="sm" onClick={() => void signOut()}>Sign out</Button>
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

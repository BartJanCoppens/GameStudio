import type { ReactNode } from 'react';
import { Avatar, BrandMark, NavItem, PillToggle, SegmentedControl, Toast } from '../ds';
import { LANG_OPTIONS, ME, NAV, NAV_GROUP, ROLE_OPTIONS, SCREEN_TITLES } from '../data/shared';
import { useApp } from '../app/useApp';

function Sidebar() {
  const { s, go } = useApp();
  const me = ME[s.role];
  return (
    <aside style={{ width: 248, flex: 'none', background: '#171a16', color: '#c9cec5', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <BrandMark />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>Game Studio</div>
          <div style={{ fontSize: 11, color: '#858c82' }}>Meridian Tax Advisors</div>
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
      <div style={{ marginTop: 'auto', padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar initials={me.initials} tone="green" size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{me.name}</div>
          <div style={{ fontSize: 11.5, color: '#a9afa5' }}>{me.title}</div>
        </div>
      </div>
    </aside>
  );
}

function Header() {
  const { s, set, setRole } = useApp();
  return (
    <header style={{ height: 60, flex: 'none', position: 'sticky', top: 0, zIndex: 5, background: '#fff', borderBottom: '1px solid #e1e5dc', display: 'flex', alignItems: 'center', gap: 14, padding: '0 24px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#5a6058', marginRight: 'auto' }}>{SCREEN_TITLES[s.screen]}</div>
      <span style={{ fontSize: 12, color: '#8b918a' }}>View as</span>
      <SegmentedControl options={ROLE_OPTIONS} value={s.role} onChange={setRole} size="sm" />
      <PillToggle options={LANG_OPTIONS} value={s.lang} onChange={lang => set({ lang })} size="xs" />
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

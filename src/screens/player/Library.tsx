import { Button, FilterChip, LinkButton, StatusChip, Tag } from '../../ds';
import { LIB_FILTERS, LIBRARY, RESET_RUN, matchesLibFilter, type LibraryGame } from '../../data/player';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';

function GameCard({ g }: { g: LibraryGame }) {
  const { s, set, toast } = useApp();
  const onPhone = g.plat !== 'browser';
  const showInstall = s.installOpen === g.title;
  const platform = g.plat === 'both' ? 'Browser + phone' : g.plat === 'phone' ? (g.installed ? 'Phone · installed' : 'Phone app') : 'Browser';

  const install = () => {
    if (g.installed) { toast('Installed on your phone · 14 Oct · open it there'); return; }
    set({ installOpen: showInstall ? null : g.title });
  };
  const sendLink = () => {
    set({ installOpen: null });
    toast(`Link sent to +32 ··· ·· 48 · “${g.title}” · valid 24 h`);
  };
  const play = () => {
    if (g.playable) set({ ...RESET_RUN, screen: 'play' });
    else if (g.plat === 'phone') toast(`“${g.title}” runs on your phone · open it there or get the app below`);
    else toast(`Prototype: “${g.title}” opens here · only the VAT rates ladder is playable`);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <Tag tone="neutral">{g.type}</Tag>
          <Tag tone={g.plat === 'browser' ? 'muted' : 'green'}>{platform}</Tag>
        </div>
        <StatusChip status={g.playStatus} label={g.playLabel} size="xs" />
      </div>
      <div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.25 }}>{g.title}</div>
        <div style={{ color: '#5a6058', marginTop: 4 }}>{g.blurb}</div>
      </div>
      <div style={{ fontSize: 12, color: '#8b918a' }}>{g.meta}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #eef0ea' }}>
        <Tag tone="bundle">{g.domain}</Tag>
        <div style={{ display: 'flex', gap: 6 }}>
          {onPhone ? (
            <Button variant="secondary" size="md" onClick={install}>{g.installed ? 'Installed' : showInstall ? 'Hide' : 'Get on phone'}</Button>
          ) : null}
          <Button variant={g.btnVariant} size="md" onClick={play}>{g.btnLabel}</Button>
        </div>
      </div>
      {showInstall ? (
        <div style={{ background: '#fafbf8', border: '1px solid #e1e5dc', borderRadius: 6, padding: '12px 14px', display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            aria-hidden="true"
            style={{ width: 72, height: 72, flex: 'none', border: '1px solid #d5dacf', borderRadius: 4, background: 'repeating-conic-gradient(#1a1d18 0 25%,#fff 0 50%) 0 0/12px 12px', opacity: 0.85 }}
          />
          <div style={{ fontSize: 12.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontWeight: 600 }}>Install on your phone</div>
            <div style={{ color: '#5a6058' }}>Scan with your phone camera, or we text the link to +32 ··· ·· 48. Signs you in with your firm account; progress syncs with the browser.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
              <LinkButton size={12} onClick={sendLink}>Send link to my phone</LinkButton>
              <LinkButton size={12} tone="muted" onClick={install}>Close</LinkButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Library() {
  const { s, set } = useApp();
  return (
    <Screen label="Player · Library">
      <PageHead
        title="Your games"
        lead="4 assigned to you · 1 in progress · 2 completed · 3 run on your phone"
        actions={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {LIB_FILTERS.map(f => <FilterChip key={f} selected={s.libFilter === f} onClick={() => set({ libFilter: f })}>{f}</FilterChip>)}
          </div>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
        {LIBRARY.filter(g => matchesLibFilter(g, s.libFilter)).map(g => <GameCard key={g.title} g={g} />)}
      </div>
    </Screen>
  );
}

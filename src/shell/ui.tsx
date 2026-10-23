import type { ReactNode } from 'react';
import { LinkButton } from '../ds';
import { eyebrow } from './styles';

export function PageHead({ eyebrow: eb, title, lead, actions }: { eyebrow?: ReactNode; title: ReactNode; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div>
        {eb ? <div style={eyebrow}>{eb}</div> : null}
        <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, margin: eb ? '4px 0 0' : 0 }}>{title}</h1>
        {lead ? <div style={{ color: '#5a6058', marginTop: 4 }}>{lead}</div> : null}
      </div>
      {actions}
    </div>
  );
}

export function BackLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <LinkButton onClick={onClick} style={{ alignSelf: 'flex-start' }}>{children}</LinkButton>;
}

export function Screen({ label, narrow, gap = 18, children }: { label: string; narrow?: 860 | 920; gap?: number; children: ReactNode }) {
  return (
    <section
      data-screen-label={label}
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap, ...(narrow ? { maxWidth: narrow, margin: '0 auto', width: '100%' } : null) }}
    >
      {children}
    </section>
  );
}

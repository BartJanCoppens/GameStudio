import { Tag } from '../../../ds';
import { PASSAGES, type GameConcept } from '../../../game/content';
import { DesignSpecimen } from '../../../game/DesignSpecimen';
import { card } from '../../../shell/styles';

const row = { display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, fontSize: 13, lineHeight: 1.45 } as const;
const label = { color: 'var(--tc-ink-4)', fontWeight: 500 } as const;

/** The proposed game, field by field, as the creator approves it. */
export function ConceptCard({ concept }: { concept: GameConcept }) {
  const sources = PASSAGES.filter(p => concept.sources.includes(p.id));
  return (
    <section aria-label="Concept" style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{concept.title}</h2>
        <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>{concept.pitch}</div>
      </div>
      <div style={row}><span style={label}>How to play</span><ol style={{ margin: 0, paddingLeft: 18 }}>{concept.howToPlay.map(s => <li key={s}>{s}</li>)}</ol></div>
      <div style={row}><span style={label}>To win</span><span>{concept.winCondition}</span></div>
      <div style={row}><span style={label}>Scoring</span><span>{concept.scoring}{concept.leaderboard ? ' · leaderboard' : ' · no leaderboard'}</span></div>
      <div style={row}><span style={label}>Play</span><span>{concept.mode === 'common_goal' && concept.goal ? `Together: ${concept.goal.description} (${concept.goal.target} ${concept.goal.unit})` : 'Solo'}</span></div>
      <div style={row}><span style={label}>AI in the game</span><span>{concept.aiRole ? `${concept.aiRole.kind === 'opponent' ? 'Opponent' : 'Game master'}: ${concept.aiRole.description}${concept.aiRole.actions.length ? ` · moves: ${concept.aiRole.actions.join(', ')}` : ''}` : 'None'}</span></div>
      <div style={row}><span style={label}>Grounded in</span><span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{sources.length ? sources.map(p => <Tag key={p.id} tone="source">{p.heading}</Tag>) : 'Not linked to source material'}</span></div>
      <div style={row}><span style={label}>Look</span><div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span>{concept.look.name}</span><DesignSpecimen tokens={concept.look.tokens} title={concept.title} compact /></div></div>
    </section>
  );
}

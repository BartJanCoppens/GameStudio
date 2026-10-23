import { Button, Table } from '../../ds';
import { GAMES, TEMPLATES } from '../../data/creator';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';
import { gameColumns } from './gameColumns';

export function MyGames() {
  const { set, go } = useApp();
  const openTemplate = (name: string) =>
    name === 'Blank'
      ? go('blank')
      : set({ screen: 'studio', studioGame: { title: `Untitled ${name.toLowerCase()}`, domain: 'Belgian VAT', status: 'not-started', stage: 'Draft · v1', structureNote: `${name} template · empty` } });

  return (
    <Screen label="Creator · My games">
      <PageHead
        title="My games"
        lead="6 games · 2 published · 1 in review · each grounded in a Content Domain"
        actions={<Button variant="primary" size="lg" onClick={() => go('blank')}>+ New game</Button>}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
        {TEMPLATES.map(([name, desc]) => (
          <button
            key={name}
            type="button"
            onClick={() => openTemplate(name)}
            style={{ textAlign: 'left', background: '#fff', border: '1px dashed #cfd4c9', borderRadius: 6, padding: 14, cursor: 'pointer', font: 'inherit', color: 'inherit' }}
          >
            <div style={{ fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 12, color: '#5a6058', marginTop: 3 }}>{desc}</div>
          </button>
        ))}
      </div>
      <div style={card}>
        <Table columns={gameColumns(studioGame => set({ role: 'creator', screen: 'studio', studioGame }))} rows={GAMES} rowKey="id" style={flush} />
      </div>
    </Screen>
  );
}

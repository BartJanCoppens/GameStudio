import { useState } from 'react';
import { Banner, Button, Dialog, Field, Table, Textarea } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { EMPTY_CONTENT } from '../../game/content';
import { canEditGame, createGame } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { useFinishedRuns } from '../../game/runs';
import { errorMessage } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';
import { GameActions } from './GameActions';
import { gameColumns, gameRows } from './gameColumns';

const IDEA_MAX = 2000;

/** The first step of a new game: the creator's idea, in their words. The Studio's questions take it from there. */
function NewGameDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (key: string) => void }) {
  const [idea, setIdea] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const text = idea.trim();
    if (text.length < 5) { setError('Describe your game in a few words.'); return; }
    setBusy(true);
    setError(null);
    try {
      onCreated(await createGame('Untitled game', '', { ...EMPTY_CONTENT, brief: [{ role: 'creator', text }] }));
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title="New game"
      subtitle="Describe the game you have in mind. The AI asks a few questions, shows you a design, then builds it."
      onClose={busy ? undefined : onClose}
      width={600}
      footer={
        <>
          <Button variant="primary" size="xl" onClick={() => void start()} disabled={busy}>{busy ? 'Starting…' : 'Start'}</Button>
          <Button variant="secondary" size="xl" onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      }
    >
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <Field label="Describe your game" hint="Anything: a detective story, a strategy game, a quiz, a simulation…">
        <Textarea value={idea} onChange={e => setIdea(e.target.value.slice(0, IDEA_MAX))} rows={5} autoFocus />
      </Field>
    </Dialog>
  );
}

export function MyGames() {
  const { openGame } = useApp();
  const { profile, permissions } = useSignedIn();
  const { games, reloadGames } = useGameContent();
  const { runs } = useFinishedRuns();
  const [creating, setCreating] = useState(false);
  const mine = games.filter(g => canEditGame(g, profile.id, permissions));
  const published = mine.filter(g => g.liveVersion !== null && !g.archived_at).length;

  return (
    <Screen label="Creator · My games">
      <PageHead
        title="My games"
        lead={`${mine.length} ${mine.length === 1 ? 'game' : 'games'} · ${published} published`}
        actions={permissions.has('games.create') ? <Button variant="primary" size="lg" onClick={() => setCreating(true)}>New game</Button> : undefined}
      />
      <div style={card}>
        {mine.length
          ? <Table columns={gameColumns({ openInStudio: key => openGame(key, 'studio'), actions: r => <GameActions game={mine.find(g => g.key === r.id)!} runs={r.runs} /> })} rows={gameRows(mine, runs)} rowKey="id" style={flush} />
          : <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No games yet. Start one with New game.</div>}
      </div>
      {creating ? (
        <NewGameDialog
          onClose={() => setCreating(false)}
          onCreated={async key => {
            await reloadGames();
            setCreating(false);
            openGame(key, 'studio');
          }}
        />
      ) : null}
    </Screen>
  );
}

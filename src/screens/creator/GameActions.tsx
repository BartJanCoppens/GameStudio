import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Banner, Button, Dialog } from '../../ds';
import { useApp } from '../../app/useApp';
import { archiveGame, deleteGame, type GameMeta } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { errorMessage } from '../../lib/supabase';

/** Archive or restore, delete for good (after a confirmation), and optionally export: one game's row actions. */
export function GameActions({ game, runs, onExport }: { game: GameMeta; runs: number; onExport?: () => void }) {
  const { toast } = useApp();
  const { reloadGames } = useGameContent();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    try { await work(); await reloadGames(); toast(done); setConfirming(false); } catch (e) { setError(errorMessage(e)); if (!confirming) toast(errorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
      {onExport ? <Button variant="secondary" size="sm" onClick={onExport} disabled={busy}>Export</Button> : null}
      {game.archived_at
        ? <Button variant="secondary" size="sm" onClick={() => void act(() => archiveGame(game.key, false), `Restored “${game.title}”`)} disabled={busy}>Restore</Button>
        : <Button variant="secondary" size="sm" onClick={() => void act(() => archiveGame(game.key, true), `Archived “${game.title}” · players no longer see it`)} disabled={busy}>Archive</Button>}
      <Button variant="secondary" size="sm" onClick={() => setConfirming(true)} disabled={busy} style={{ color: 'var(--tc-red-text)' }}>Delete</Button>
      {/* Outside the table, so the dialog doesn't inherit the cell's layout. */}
      {confirming ? createPortal(
        <Dialog
          title={`Delete “${game.title}”?`}
          subtitle={`This removes the game and its content${runs ? `, its ${runs} ${runs === 1 ? 'run' : 'runs'} and its leaderboard` : ''}. It can’t be undone. To keep the results and only hide it from players, archive it instead.`}
          onClose={busy ? undefined : () => setConfirming(false)}
          footer={
            <>
              <Button variant="primary" size="xl" onClick={() => void act(() => deleteGame(game.key), `Deleted “${game.title}”`)} disabled={busy} style={{ background: 'var(--tc-red)', borderColor: 'var(--tc-red)', color: '#fff' }}>{busy ? 'Deleting…' : 'Delete for good'}</Button>
              <Button variant="secondary" size="xl" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
            </>
          }
        >
          {error ? <Banner tone="warning">{error}</Banner> : null}
        </Dialog>,
        document.body,
      ) : null}
    </div>
  );
}

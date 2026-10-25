import { useEffect, useState } from 'react';
import { Button, Dialog, Select, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import type { GameMeta } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { errorMessage, supabase } from '../../lib/supabase';
import { card } from '../../shell/styles';

interface GameAdmin { id: string; full_name: string }

/** Online or offline, and who looks after the game; platform admins can hand it to someone else. */
export function GameStatus({ game }: { game: GameMeta }) {
  const { toast } = useApp();
  const { profile, permissions } = useSignedIn();
  const { reloadGames } = useGameContent();
  const platformAdmin = permissions.has('users.manage');
  const [gameAdmins, setGameAdmins] = useState<GameAdmin[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [changing, setChanging] = useState(false);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!platformAdmin) return;
    let cancelled = false;
    supabase.rpc('game_admins_to_choose').then(({ data }) => { if (!cancelled) setGameAdmins((data ?? []) as GameAdmin[]); });
    return () => { cancelled = true; };
  }, [platformAdmin]);

  const run = async (work: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    try {
      const { error } = await work();
      if (error) throw new Error(error.message);
      await reloadGames();
      toast(done);
    } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  const setOffline = (offline: boolean) => run(() => supabase.rpc('set_game_offline', { p_game_key: game.key, p_offline: offline }),
    offline ? `“${game.title}” is offline` : `“${game.title}” is back online`);

  const offline = !!game.offline_at;
  const gameAdminName = game.game_admin === profile.id ? 'you'
    : gameAdmins.find(a => a.id === game.game_admin)?.full_name ?? (game.game_admin ? 'someone who can no longer look after games' : 'not set');

  return (
    <div style={{ ...card, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Tag tone={offline ? 'amber' : 'green'}>{offline ? 'Offline' : 'Online'}</Tag>
      <Button variant="secondary" size="sm" disabled={busy} onClick={() => (offline ? void setOffline(false) : setConfirming(true))}>{offline ? 'Bring online' : 'Take offline'}</Button>
      <span style={{ fontSize: 13, color: 'var(--tc-ink-3)', marginLeft: 'auto' }}>Game admin: {gameAdminName}</span>
      {platformAdmin && !changing ? <Button variant="secondary" size="sm" disabled={busy} onClick={() => { setChosen(''); setChanging(true); }}>Change game admin</Button> : null}
      {platformAdmin && changing ? (
        <>
          <Select
            aria-label="New game admin"
            value={chosen}
            disabled={busy}
            onChange={e => setChosen(e.target.value)}
            options={[{ value: '', label: 'Choose a game admin…' }, ...gameAdmins.filter(a => a.id !== game.game_admin).map(a => ({ value: a.id, label: a.full_name }))]}
          />
          <Button variant="primary" size="sm" disabled={busy || !chosen}
            onClick={() => void run(() => supabase.rpc('set_game_admin', { p_game_key: game.key, p_user: chosen }), 'Game admin changed').then(() => setChanging(false))}>Save</Button>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setChanging(false)}>Cancel</Button>
        </>
      ) : null}
      {confirming ? (
        <Dialog
          title={`Take “${game.title}” offline?`}
          subtitle="Nobody can play it, and games in progress can’t be finished, until you bring it back online. Who may play it stays as it is."
          onClose={busy ? undefined : () => setConfirming(false)}
          footer={
            <>
              <Button variant="primary" size="xl" disabled={busy} onClick={() => void setOffline(true).then(() => setConfirming(false))}>Take offline</Button>
              <Button variant="secondary" size="xl" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          }
        />
      ) : null}
    </div>
  );
}

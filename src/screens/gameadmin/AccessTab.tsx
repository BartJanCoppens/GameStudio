import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banner, Button, Checkbox, Select } from '../../ds';
import { useApp } from '../../app/useApp';
import type { GameMeta } from '../../game/games';
import { useGameContent } from '../../game/useGameContent';
import { errorMessage, supabase } from '../../lib/supabase';
import { card, cardHead } from '../../shell/styles';

interface Group { id: string; name: string; members: string[] }
interface Player { id: string; full_name: string; email: string }
interface AccessRow { id: string; group_id: string | null; user_id: string | null }

/** Who may play this game: everyone, or the groups and people listed here. The database enforces it. */
export function AccessTab({ game }: { game: GameMeta }) {
  const { toast } = useApp();
  const { reloadGames } = useGameContent();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Shown at once; put back if saving fails.
  const [access, setAccessShown] = useState<'everyone' | 'restricted'>(game.access ?? 'everyone');

  const load = useCallback(async () => {
    const [g, m, a, p] = await Promise.all([
      supabase.from('user_groups').select('id, name').order('name'),
      supabase.from('group_members').select('group_id, user_id'),
      supabase.from('game_access').select('id, group_id, user_id').eq('game_key', game.key),
      supabase.rpc('players_for_access'),
    ]);
    const failed = [g, m, a, p].find(r => r.error);
    if (failed?.error) throw failed.error;
    return {
      groups: (g.data ?? []).map(x => ({ id: x.id as string, name: x.name as string, members: (m.data ?? []).filter(r => r.group_id === x.id).map(r => r.user_id as string) })),
      rows: (a.data ?? []) as AccessRow[],
      players: (p.data ?? []) as Player[],
    };
  }, [game.key]);

  const apply = useCallback((d: Awaited<ReturnType<typeof load>>) => { setGroups(d.groups); setRows(d.rows); setPlayers(d.players); setError(null); }, []);
  useEffect(() => {
    let cancelled = false;
    load().then(d => { if (!cancelled) apply(d); }, e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, [load, apply]);

  const run = async (work: () => PromiseLike<{ error: { message: string } | null }>, done: string) => {
    setBusy(true);
    try {
      const { error: e } = await work();
      if (e) throw new Error(e.message);
      toast(done);
    } catch (e) { toast(errorMessage(e)); } finally {
      // Whatever happened, the list shown is the list saved.
      apply(await load().catch(() => ({ groups: groups ?? [], rows, players })));
      setBusy(false);
    }
  };
  /** Shown at once, then saved; a failed save puts the saved list back. */
  const toggle = (change: { group_id?: string; user_id?: string }, on: boolean, done: string) => {
    setRows(r => (on ? [...r, { id: `pending-${Math.random()}`, group_id: change.group_id ?? null, user_id: change.user_id ?? null }]
      : r.filter(x => !(change.group_id ? x.group_id === change.group_id : x.user_id === change.user_id))));
    const match = change.group_id ? { group_id: change.group_id } : { user_id: change.user_id! };
    void run(() => (on
      ? supabase.from('game_access').insert({ game_key: game.key, ...match })
      : supabase.from('game_access').delete().eq('game_key', game.key).match(match)), done);
  };

  const setAccess = async (next: 'everyone' | 'restricted') => {
    const previous = access;
    setAccessShown(next);
    await run(async () => {
      const { error: failed } = await supabase.rpc('set_game_access', { p_game_key: game.key, p_access: next });
      if (failed) setAccessShown(previous);
      await reloadGames();
      return { error: failed };
    }, next === 'everyone' ? 'Everyone can play this game' : 'Only the groups and people below can play this game');
  };

  const listedGroups = new Set(rows.filter(r => r.group_id).map(r => r.group_id!));
  const listedPeople = rows.filter(r => r.user_id).map(r => r.user_id!);
  const allowed = useMemo(() => new Set([...listedPeople, ...(groups ?? []).filter(g => listedGroups.has(g.id)).flatMap(g => g.members)]), [rows, groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const restricted = access === 'restricted';
  const name = (id: string) => { const p = players.find(x => x.id === id); return p ? p.full_name || p.email : 'Someone'; };

  if (error) return <Banner tone="warning" title="Could not load the access settings.">{error}</Banner>;
  if (!groups) return <div style={{ color: 'var(--tc-ink-5)' }}>Loading…</div>;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <div style={cardHead}>Who can play {game.title}</div>
      <div role="radiogroup" aria-label="Who can play" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--tc-line-hair)' }}>
        {(['everyone', 'restricted'] as const).map(v => (
          <label key={v} style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="access" checked={access === v} disabled={busy} onChange={() => void setAccess(v)} style={{ accentColor: 'var(--tc-green)' }} />
            <span>{v === 'everyone' ? 'Everyone' : 'Selected groups and people'}</span>
          </label>
        ))}
      </div>
      {restricted ? (
        <div style={{ padding: '14px 18px', display: 'flex', gap: 28, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>Groups</div>
            {groups.length ? groups.map(g => (
              <Checkbox key={g.id} checked={listedGroups.has(g.id)} onChange={on => toggle({ group_id: g.id }, on, on ? `${g.name} can play` : `${g.name} removed`)}>
                {g.name}<span style={{ color: 'var(--tc-ink-5)' }}> · {g.members.length}</span>
              </Checkbox>
            )) : <div style={{ fontSize: 13, color: 'var(--tc-ink-4)' }}>No groups yet. A platform admin creates them under Groups.</div>}
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontWeight: 600 }}>People</div>
            <Select
              aria-label="Add a person"
              value=""
              disabled={busy}
              onChange={e => { const id = e.target.value; if (id) toggle({ user_id: id }, true, `${name(id)} can play`); }}
              options={[{ value: '', label: 'Add a person…' }, ...players.filter(p => !listedPeople.includes(p.id)).map(p => ({ value: p.id, label: p.full_name || p.email }))]}
            />
            {listedPeople.map(id => (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{name(id)}</span>
                <Button variant="secondary" size="sm" onClick={() => toggle({ user_id: id }, false, `${name(id)} removed`)}>Remove</Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--tc-line-hair)', fontSize: 13, color: 'var(--tc-ink-3)' }}>
        {restricted
          ? `${allowed.size} ${allowed.size === 1 ? 'player can' : 'players can'} play this game, plus its creator, game admins and platform admins.`
          : `All ${players.length} ${players.length === 1 ? 'player' : 'players'} can play this game.`}
      </div>
    </div>
  );
}

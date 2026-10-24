import { StatCard, Table } from '../../ds';
import type { GameContent } from '../../game/content';
import { exportGame } from '../../game/exportZip';
import { errorMessage, supabase } from '../../lib/supabase';
import { useApp } from '../../app/useApp';
import { useGameContent } from '../../game/useGameContent';
import { clock, useFinishedRuns } from '../../game/runs';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { gameColumns, gameRows } from '../creator/gameColumns';
import { useDirectory } from './directory';

export function Dashboard() {
  const { roles, set, toast } = useApp();
  const { games } = useGameContent();
  const { runs } = useFinishedRuns();
  const { data } = useDirectory();
  const all = runs ?? [];
  const users = data?.users ?? [];
  const active = users.filter(u => u.status === 'active').length;
  const players = new Set(all.map(r => r.user_id)).size;
  const published = games.filter(g => g.liveVersion !== null).length;
  const openStudio = roles.includes('creator') ? (gameKey: string) => set({ role: 'creator', screen: 'studio', gameKey }) : undefined;
  // The live version when there is one, else the draft.
  const exportCode = async (gameKey: string) => {
    try {
      const { data, error } = await supabase.from('game_content').select('stage, content').eq('game_key', gameKey);
      if (error) throw error;
      const row = data?.find(r => r.stage === 'live') ?? data?.find(r => r.stage === 'draft');
      const game = games.find(g => g.key === gameKey);
      if (!row || !game) throw new Error('This game has nothing to export yet');
      exportGame(game, row.content as GameContent);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  return (
    <Screen label="Admin · Overview">
      <PageHead title="Overview" lead={`Platform · ${users.length} users · ${games.length} ${games.length === 1 ? 'game' : 'games'} · 1 content domain`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
        <StatCard label="Users" value={data ? users.length : '—'} unit={data ? `${active} active` : ''} />
        <StatCard label="Players who played" value={players} unit={`· ${all.length} runs`} />
        <StatCard label="Games" value={games.length} unit={`· ${published} published`} />
        <StatCard label="In the studio" value={games.length - published} unit="not published yet" />
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ ...card, flex: '1 1 600px', minWidth: 0 }}>
          <div style={cardHead}>Games</div>
          <Table columns={gameColumns(openStudio, key => void exportCode(key))} rows={gameRows(games, runs)} rowKey="id" compact style={flush} />
        </div>
        <div style={{ ...card, flex: '0 1 320px' }}>
          <div style={cardHead}>Recent runs</div>
          {all.length ? all.slice(0, 6).map((r, i) => (
            <div key={r.id} style={{ padding: '10px 18px', borderTop: i ? '1px solid #eef0ea' : 0 }}>
              <div style={{ fontSize: 12.5 }}>{r.player_name} · {games.find(g => g.key === r.game_key)?.title ?? 'a game'} · score {r.score}</div>
              <div style={{ fontSize: 11.5, color: '#8b918a' }}>{new Date(r.finished_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {clock(r.duration_seconds ?? 0)}</div>
            </div>
          )) : <div style={{ padding: '14px 18px', color: '#8b918a' }}>No finished runs yet.</div>}
        </div>
      </div>
    </Screen>
  );
}

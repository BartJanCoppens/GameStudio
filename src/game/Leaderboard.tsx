import { Table, type Column } from '../ds';
import { flush } from '../shell/styles';
import type { LeaderboardEntry } from './runs';

const columns = (meId?: string): Column<LeaderboardEntry>[] => [
  { key: 'rank', label: '#', width: '44px', muted: true },
  { key: 'name', label: 'Player', width: 'minmax(140px,1fr)', strong: true, render: r => <>{r.name}{r.userId === meId ? <span style={{ color: 'var(--tc-ink-5)', fontWeight: 400 }}> · you</span> : null}</> },
  { key: 'cohort', label: 'Cohort', width: 'minmax(120px,1fr)', muted: true, render: r => r.cohort || '—' },
  { key: 'runs', label: 'Runs', width: '70px', align: 'right', numeric: true },
  { key: 'score', label: 'Best score', width: '100px', align: 'right', numeric: true },
];

/** Best run per player. */
export function Leaderboard({ entries, meId, limit = 10 }: { entries: LeaderboardEntry[]; meId?: string; limit?: number }) {
  if (!entries.length) return <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No finished runs yet.</div>;
  return <Table columns={columns(meId)} rows={entries.slice(0, limit)} rowKey="userId" compact style={flush} rowStyle={r => (r.userId === meId ? { background: 'var(--tc-green-100)' } : {})} />;
}

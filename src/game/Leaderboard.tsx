import { Table, type Column } from '../ds';
import { flush } from '../shell/styles';
import type { LeaderboardEntry } from './runs';

const columns = (meId?: string): Column<LeaderboardEntry>[] => [
  { key: 'rank', label: '#', width: '44px', muted: true },
  { key: 'name', label: 'Player', width: 'minmax(140px,1fr)', strong: true, render: r => <>{r.name}{r.userId === meId ? <span style={{ color: '#8b918a', fontWeight: 400 }}> · you</span> : null}</> },
  { key: 'cohort', label: 'Cohort', width: 'minmax(120px,1fr)', muted: true, render: r => r.cohort || '—' },
  { key: 'invoicesCorrect', label: 'Invoices right', width: '120px', align: 'right', numeric: true, render: r => `${r.invoicesCorrect} of 12` },
  { key: 'points', label: 'Points', width: '80px', align: 'right', numeric: true },
];

/** Best run per player. */
export function Leaderboard({ entries, meId, limit = 10 }: { entries: LeaderboardEntry[]; meId?: string; limit?: number }) {
  if (!entries.length) return <div style={{ padding: 18, color: '#8b918a' }}>No finished runs yet.</div>;
  return <Table columns={columns(meId)} rows={entries.slice(0, limit)} rowKey="userId" compact style={flush} rowStyle={r => (r.userId === meId ? { background: 'var(--tc-green-100)' } : {})} />;
}

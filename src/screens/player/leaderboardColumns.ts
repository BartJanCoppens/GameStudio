import type { Column } from '../../ds';
import type { LeaderboardRow } from '../../data/shared';

export const leaderboardColumns: Column<LeaderboardRow>[] = [
  { key: 'rank', label: '#', width: '44px', muted: true },
  { key: 'name', label: 'Player', width: 'minmax(140px,1fr)', strong: true },
  { key: 'cohort', label: 'Cohort', width: 'minmax(120px,1fr)', muted: true },
  { key: 'pts', label: 'Points', width: '80px', align: 'right', numeric: true },
];

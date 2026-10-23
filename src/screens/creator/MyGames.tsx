import { Table } from '../../ds';
import { useApp } from '../../app/useApp';
import { useFinishedRuns } from '../../game/runs';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';
import { gameColumns, gameRows } from './gameColumns';

export function MyGames() {
  const { go } = useApp();
  const { runs } = useFinishedRuns();
  return (
    <Screen label="Creator · My games">
      <PageHead title="My games" lead="1 game · published · grounded in the Belgian VAT Content Domain" />
      <div style={card}>
        <Table columns={gameColumns(() => go('studio'))} rows={gameRows(runs)} rowKey="id" style={flush} />
      </div>
    </Screen>
  );
}

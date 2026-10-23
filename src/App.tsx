import type { ComponentType } from 'react';
import type { Screen } from './data/shared';
import { AppProvider } from './app/state';
import { useApp } from './app/useApp';
import { Shell } from './shell/Shell';
import { Library } from './screens/player/Library';
import { Play } from './screens/player/Play';
import { Results } from './screens/player/Results';
import { MyGames } from './screens/creator/MyGames';
import { NewGame } from './screens/creator/NewGame';
import { Studio } from './screens/creator/Studio';
import { Workflow } from './screens/creator/Workflow';
import { Console } from './screens/gameadmin/Console';
import { Dashboard } from './screens/admin/Dashboard';
import { Users } from './screens/admin/Users';
import { Roles } from './screens/admin/Roles';
import { Content } from './screens/admin/Content';

const SCREENS: Record<Screen, ComponentType> = {
  library: Library, play: Play, results: Results,
  games: MyGames, blank: NewGame, studio: Studio, workflow: Workflow,
  console: Console,
  dashboard: Dashboard, users: Users, roles: Roles, content: Content,
};

function CurrentScreen() {
  const { s } = useApp();
  const View = SCREENS[s.screen];
  return <View />;
}

export default function App() {
  return (
    <AppProvider>
      <Shell>
        <CurrentScreen />
      </Shell>
    </AppProvider>
  );
}

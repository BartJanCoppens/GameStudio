import type { ComponentType } from 'react';
import type { Role, Screen } from './data/shared';
import { Button } from './ds';
import { AppProvider } from './app/state';
import { useApp } from './app/useApp';
import { AuthProvider } from './auth/AuthProvider';
import { Login } from './auth/Login';
import { useAuth } from './auth/useAuth';
import { Shell } from './shell/Shell';
import { Library } from './screens/player/Library';
import { Play } from './screens/player/Play';
import { Results } from './screens/player/Results';
import { MyGames } from './screens/creator/MyGames';
import { Studio } from './screens/creator/Studio';
import { Workflow } from './screens/creator/Workflow';
import { Console } from './screens/gameadmin/Console';
import { Dashboard } from './screens/admin/Dashboard';
import { Users } from './screens/admin/Users';
import { Roles } from './screens/admin/Roles';
import { Content } from './screens/admin/Content';

const SCREENS: Record<Screen, ComponentType> = {
  library: Library, play: Play, results: Results,
  games: MyGames, studio: Studio, workflow: Workflow,
  console: Console,
  dashboard: Dashboard, users: Users, roles: Roles, content: Content,
};

function CurrentScreen() {
  const { s } = useApp();
  const View = SCREENS[s.screen];
  return <View />;
}

const APP_ROLES: Role[] = ['admin', 'creator', 'gameadmin', 'player'];

function Gate() {
  const { state, signOut } = useAuth();
  if (state.status === 'loading') return <div role="status" style={{ padding: 32, color: '#8b918a' }}>Loading…</div>;
  if (state.status === 'signed-out') return <Login />;

  // Custom roles carry permissions but have no screens of their own; the app needs one of the four built-in roles.
  const views = state.roles.map(r => r.key).filter((k): k is Role => APP_ROLES.includes(k as Role));
  if (!views.length) {
    return (
      <div style={{ maxWidth: 520, margin: '15vh auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>No screens for your role yet</h1>
        <div style={{ color: '#5a6058' }}>Your roles ({state.roles.map(r => r.name).join(', ')}) don’t include Player, Game creator, Game administrator or Platform admin. Ask a platform admin to add one.</div>
        <div><Button variant="secondary" onClick={() => void signOut()}>Sign out</Button></div>
      </div>
    );
  }
  // key: a different account, or a change to your own roles, starts from a clean app state.
  return (
    <AppProvider key={`${state.profile.id}:${views.join(',')}`} roles={views}>
      <Shell>
        <CurrentScreen />
      </Shell>
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

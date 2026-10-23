import { useState } from 'react';
import { Avatar, Banner, Button, FilterChip, LinkButton, StatusChip, Table, Tag, type Column } from '../../ds';
import { useApp } from '../../app/useApp';
import { useAuth, useSignedIn } from '../../auth/useAuth';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';
import { shortDate, useDirectory, userStatus, type DirectoryUser } from './directory';
import { UserDialog } from './UserDialog';

const initials = (u: DirectoryUser) => (u.full_name.trim() ? u.full_name.trim().split(/\s+/).map(x => x[0]).join('') : u.email[0]).slice(0, 2).toUpperCase();

export function Users() {
  const { toast, toastProto } = useApp();
  const { profile, permissions } = useSignedIn();
  const { refresh } = useAuth();
  const { data, error, reload } = useDirectory();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<DirectoryUser | 'new' | null>(null);

  if (!permissions.has('users.manage')) {
    return (
      <Screen label="Admin · Users">
        <PageHead title="Users" />
        <Banner tone="info">You need the “Manage users and invitations” permission to see this page.</Banner>
      </Screen>
    );
  }

  const roles = data?.roles ?? [];
  const roleName = new Map(roles.map(r => [r.key, r.name]));
  const users = data?.users ?? [];
  const q = query.trim().toLowerCase();
  const rows = users.filter(u => (filter === 'All' || u.roleKeys.includes(filter)) && (!q || u.full_name.toLowerCase().includes(q) || u.email.includes(q)));
  const countFor = (key: string) => users.filter(u => u.roleKeys.includes(key)).length;
  const lead = [`${users.length} users`, ...roles.map(r => `${countFor(r.key)} ${r.name.toLowerCase()}${countFor(r.key) === 1 ? '' : 's'}`)].join(' · ');

  const saved = async (message: string) => {
    setEditing(null);
    toast(message);
    await reload();
    await refresh(); // the admin may have changed their own roles
  };

  const columns: Column<DirectoryUser>[] = [
    {
      key: 'name', label: 'User', width: 'minmax(220px,1.2fr)',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={initials(r)} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{r.full_name || '—'}{r.id === profile.id ? <span style={{ color: '#8b918a', fontWeight: 400 }}> · you</span> : null}</div>
            <div style={{ fontSize: 11.5, color: '#8b918a' }}>{r.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'roles', label: 'Roles', width: 'minmax(180px,1fr)',
      render: r => (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {r.roleKeys.length ? r.roleKeys.map(k => <Tag key={k} tone={k === 'player' ? 'muted' : 'neutral'}>{roleName.get(k) ?? k}</Tag>) : <Tag tone="amber">No role</Tag>}
        </div>
      ),
    },
    { key: 'cohort', label: 'Cohort attributes', width: 'minmax(180px,1fr)', muted: true, render: r => r.cohort || '—' },
    { key: 'last', label: 'Last active', width: '100px', muted: true, render: r => shortDate(r.last_sign_in_at) },
    { key: 'status', label: 'Status', width: '140px', render: r => { const s = userStatus(r); return <StatusChip status={s.st} label={s.label} size="xs" />; } },
    { key: 'act', label: '', width: '70px', align: 'right', render: r => <LinkButton size={12} onClick={() => setEditing(r)}>Edit</LinkButton> },
  ];

  return (
    <Screen label="Admin · Users">
      <PageHead
        title="Users"
        lead={data ? lead : 'Loading…'}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="lg" onClick={toastProto}>Import from HR</Button>
            <Button variant="primary" size="lg" onClick={() => setEditing('new')} disabled={!data}>+ Invite user</Button>
          </div>
        }
      />
      {error ? <Banner tone="warning" title="Could not load users." actions={<Button variant="secondary" size="sm" onClick={() => void reload()}>Retry</Button>}>{error}</Banner> : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterChip selected={filter === 'All'} onClick={() => setFilter('All')}>All · {users.length}</FilterChip>
        {roles.map(r => <FilterChip key={r.key} selected={filter === r.key} onClick={() => setFilter(r.key)}>{r.name} · {countFor(r.key)}</FilterChip>)}
        <input
          type="search"
          aria-label="Search name or email"
          placeholder="Search name or email"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginLeft: 'auto', height: 32, border: '1px solid #d5dacf', borderRadius: 6, padding: '0 10px', font: 'inherit', fontSize: 13, width: 220 }}
        />
      </div>
      <div style={card}>
        <Table columns={columns} rows={rows} rowKey="id" style={flush} />
        {data && !rows.length ? <div style={{ padding: '18px', color: '#8b918a' }}>No users match.</div> : null}
      </div>
      {editing ? (
        <UserDialog user={editing === 'new' ? undefined : editing} roles={roles} selfId={profile.id} onClose={() => setEditing(null)} onSaved={msg => void saved(msg)} />
      ) : null}
    </Screen>
  );
}

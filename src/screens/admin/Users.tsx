import { useState } from 'react';
import { Avatar, Button, FilterChip, LinkButton, StatusChip, Table, Tag, type Column } from '../../ds';
import { USER_FILTERS, USERS, type User } from '../../data/admin';
import { useApp } from '../../app/useApp';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';

export function Users() {
  const { s, set, toastProto } = useApp();
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const rows = USERS.filter(u => (s.userFilter === 'All' || u.roles.includes(s.userFilter)) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)));

  const columns: Column<User>[] = [
    {
      key: 'name', label: 'User', width: 'minmax(200px,1.2fr)',
      render: r => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={r.name.split(' ').map(x => x[0]).join('').slice(0, 2)} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 11.5, color: '#8b918a' }}>{r.email}</div>
          </div>
        </div>
      ),
    },
    { key: 'roles', label: 'Roles', width: 'minmax(180px,1fr)', render: r => <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.roles.map(x => <Tag key={x} tone={x === 'Player' ? 'muted' : 'neutral'}>{x}</Tag>)}</div> },
    { key: 'cohort', label: 'Cohort attributes', width: 'minmax(180px,1fr)', muted: true },
    { key: 'last', label: 'Last active', width: '100px', muted: true },
    { key: 'status', label: 'Status', width: '120px', render: r => <StatusChip status={r.st} label={r.status} size="xs" /> },
    { key: 'act', label: '', width: '70px', align: 'right', render: () => <LinkButton size={12} onClick={toastProto}>Edit</LinkButton> },
  ];

  return (
    <Screen label="Admin · Users">
      <PageHead
        title="Users"
        lead="214 users · 4 platform admins · 9 game creators · 5 game administrators · 196 players"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="secondary" size="lg" onClick={toastProto}>Import from HR</Button>
            <Button variant="primary" size="lg" onClick={toastProto}>+ Invite user</Button>
          </div>
        }
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {USER_FILTERS.map(f => <FilterChip key={f} selected={s.userFilter === f} onClick={() => set({ userFilter: f })}>{f === 'All' ? 'All · 214' : f}</FilterChip>)}
        <input
          type="search"
          aria-label="Search name or email"
          placeholder="Search name or email"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ marginLeft: 'auto', height: 32, border: '1px solid #d5dacf', borderRadius: 6, padding: '0 10px', font: 'inherit', fontSize: 13, width: 220 }}
        />
      </div>
      <div style={card}><Table columns={columns} rows={rows} rowKey="email" style={flush} /></div>
    </Screen>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Banner, Button, Dialog, Field, Input, Table, type Column } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { errorMessage, supabase } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';
import { card, cardHead, flush } from '../../shell/styles';
import { useDirectory, type DirectoryUser } from './directory';

interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
}

/** A group name is unique: say so instead of the database's wording. */
function groupError(e: unknown): string {
  return e && typeof e === 'object' && 'code' in e && e.code === '23505' ? 'A group with that name already exists' : errorMessage(e);
}

async function fetchGroups(): Promise<Group[]> {
  const [groups, members] = await Promise.all([
    supabase.from('user_groups').select('id, name, description').order('name'),
    supabase.from('group_members').select('group_id, user_id'),
  ]);
  if (groups.error) throw groups.error;
  if (members.error) throw members.error;
  return (groups.data ?? []).map(g => ({ ...g, members: (members.data ?? []).filter(m => m.group_id === g.id).map(m => m.user_id as string) }));
}

function GroupDetail({ group, users, onChanged, onDeleted }: { group: Group; users: DirectoryUser[]; onChanged: () => Promise<void>; onDeleted: () => void }) {
  const { toast } = useApp();
  const [name, setName] = useState(group.name);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const run = async (work: () => PromiseLike<{ error: { message: string } | null }>, done?: string) => {
    setBusy(true);
    try {
      const { error } = await work();
      if (error) throw error;
      await onChanged();
      if (done) toast(done);
    } catch (e) { toast(groupError(e)); } finally { setBusy(false); }
  };
  const members = users.filter(u => group.members.includes(u.id));
  const candidates = users.filter(u => u.status === 'active' && !group.members.includes(u.id));
  const q = query.trim().toLowerCase();
  const matches = q.length < 2 ? [] : candidates.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)).slice(0, 8);
  const columns: Column<DirectoryUser>[] = [
    { key: 'full_name', label: 'Name', width: 'minmax(160px,1fr)', strong: true, render: u => u.full_name || u.email },
    { key: 'email', label: 'Email', width: 'minmax(200px,1.2fr)', muted: true },
    { key: 'remove', label: '', width: '100px', render: u => <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run(() => supabase.from('group_members').delete().eq('group_id', group.id).eq('user_id', u.id))}>Remove</Button> },
  ];
  return (
    <section aria-label={group.name} style={{ ...card, flex: '1 1 520px', minWidth: 0 }}>
      <div style={{ ...cardHead, display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
        <Field label="Name" style={{ flex: '1 1 220px' }}><Input value={name} maxLength={60} onChange={e => setName(e.target.value)} /></Field>
        <Button variant="secondary" size="md" disabled={busy || !name.trim() || name.trim() === group.name} onClick={() => void run(() => supabase.from('user_groups').update({ name: name.trim() }).eq('id', group.id), 'Group renamed')}>Rename</Button>
        <Button variant="secondary" size="md" disabled={busy} onClick={() => setConfirming(true)} style={{ color: 'var(--tc-red-text)' }}>Delete group</Button>
      </div>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--tc-line-hair)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Input aria-label="Find a person to add" value={query} disabled={busy} maxLength={100} placeholder={candidates.length ? 'Find a person to add: name or email' : 'Everyone is already in this group'} onChange={e => setQuery(e.target.value)} style={{ maxWidth: 360 }} />
        {q.length >= 2 && !matches.length ? <div style={{ fontSize: 13, color: 'var(--tc-ink-4)' }}>Nobody found who isn’t in the group yet.</div> : null}
        {matches.map(u => (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1 }}>{u.full_name || u.email}<span style={{ color: 'var(--tc-ink-5)' }}> · {u.email}</span></span>
            <Button variant="secondary" size="sm" aria-label={`Add ${u.full_name || u.email}`} disabled={busy}
              onClick={() => void run(() => supabase.from('group_members').insert({ group_id: group.id, user_id: u.id }), 'Member added').then(() => setQuery(''))}>Add</Button>
          </div>
        ))}
      </div>
      {members.length ? <Table columns={columns} rows={members} rowKey="id" compact style={flush} /> : <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No members yet.</div>}
      {confirming ? (
        <Dialog
          title={`Delete “${group.name}”?`}
          subtitle="The group goes, and games restricted to it no longer let its members in through it. The games stay restricted."
          onClose={busy ? undefined : () => setConfirming(false)}
          footer={
            <>
              <Button variant="primary" size="xl" disabled={busy} style={{ background: 'var(--tc-red)', borderColor: 'var(--tc-red)', color: '#fff' }}
                onClick={() => void run(() => supabase.from('user_groups').delete().eq('id', group.id), `Deleted “${group.name}”`).then(onDeleted)}>Delete</Button>
              <Button variant="secondary" size="xl" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
            </>
          }
        />
      ) : null}
    </section>
  );
}

/** Platform admins keep the groups that game admins give access to. */
export function Groups() {
  const { toast } = useApp();
  const { permissions } = useSignedIn();
  const { data } = useDirectory();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const reload = useCallback(async () => {
    try { setGroups(await fetchGroups()); setError(null); } catch (e) { setError(errorMessage(e)); }
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetchGroups().then(g => { if (!cancelled) setGroups(g); }, e => { if (!cancelled) setError(errorMessage(e)); });
    return () => { cancelled = true; };
  }, []);

  if (!permissions.has('users.manage')) return <Screen label="Admin · Groups"><Banner tone="info">You need “Manage users and invitations” to see this page.</Banner></Screen>;

  const create = async () => {
    const { data: row, error: e } = await supabase.from('user_groups').insert({ name: newName.trim() }).select('id').single();
    if (e) { toast(groupError(e)); return; }
    setCreating(false);
    setNewName('');
    await reload();
    setSelected(row.id);
  };

  const current = groups?.find(g => g.id === selected) ?? null;
  return (
    <Screen label="Admin · Groups">
      <PageHead
        title="Groups"
        lead="Named groups of people. Game admins give a game to groups, to people, or to everyone."
        actions={<Button variant="primary" size="lg" onClick={() => setCreating(true)}>New group</Button>}
      />
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '0 1 300px', display: 'flex', flexDirection: 'column' }}>
          {!groups ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>Loading…</div> : null}
          {groups && !groups.length ? <div style={{ padding: 18, color: 'var(--tc-ink-5)' }}>No groups yet.</div> : null}
          {groups?.map((g, i) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={g.id === selected}
              onClick={() => setSelected(g.id)}
              style={{ textAlign: 'left', font: 'inherit', border: 0, borderTop: i ? '1px solid var(--tc-line-hair)' : 0, background: g.id === selected ? 'var(--tc-green-100)' : 'transparent', padding: '12px 16px', cursor: 'pointer', color: 'inherit' }}
            >
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--tc-ink-4)' }}>{g.members.length} {g.members.length === 1 ? 'member' : 'members'}</div>
            </button>
          ))}
        </div>
        {current ? <GroupDetail key={current.id} group={current} users={data?.users ?? []} onChanged={reload} onDeleted={() => setSelected(null)} /> : null}
      </div>
      {creating ? (
        <Dialog
          title="New group"
          onClose={() => setCreating(false)}
          footer={<><Button variant="primary" size="xl" disabled={!newName.trim()} onClick={() => void create()}>Create group</Button><Button variant="secondary" size="xl" onClick={() => setCreating(false)}>Cancel</Button></>}
        >
          <Field label="Name"><Input value={newName} maxLength={60} autoFocus onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) void create(); }} placeholder="e.g. Analysts" /></Field>
        </Dialog>
      ) : null}
    </Screen>
  );
}

import { useState } from 'react';
import { Banner, Button, Dialog, Field, Input, Select } from '../../ds';
import { errorMessage, supabase } from '../../lib/supabase';
import type { RolePermissionRow, RoleRow } from '../../lib/db';

interface Props {
  /** Omitted when adding a role. */
  role?: RoleRow;
  roles: RoleRow[];
  grants: RolePermissionRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** "Content reviewer" → "content-reviewer", made unique against the existing keys. */
function roleKey(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^[^a-z]+|-+$/g, '').slice(0, 36) || 'role';
  let key = base.length >= 2 ? base : `${base}-role`;
  for (let i = 2; taken.has(key); i++) key = `${base}-${i}`;
  return key;
}

export function RoleDialog({ role, roles, grants, onClose, onSaved }: Props) {
  const creating = !role;
  const [name, setName] = useState(role?.name ?? '');
  const [shortName, setShortName] = useState(role?.short_name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [copyFrom, setCopyFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const values = { name: name.trim(), short_name: (shortName.trim() || name.trim()).slice(0, 20), description: description.trim() };
      if (!values.name) throw new Error('Give the role a name.');
      if (role) {
        const { error: e } = await supabase.from('roles').update(values).eq('key', role.key);
        if (e) throw e;
        onSaved(`Saved “${values.name}”`);
        return;
      }
      const key = roleKey(values.name, new Set(roles.map(r => r.key)));
      const sortOrder = Math.max(0, ...roles.map(r => r.sort_order)) + 1;
      const { error: e } = await supabase.from('roles').insert({ key, ...values, sort_order: sortOrder });
      if (e) throw e;
      const copied = grants.filter(g => g.role_key === copyFrom).map(g => ({ role_key: key, permission_key: g.permission_key, level: g.level }));
      if (copied.length) {
        const { error: ge } = await supabase.from('role_permissions').insert(copied);
        if (ge) throw ge;
      }
      onSaved(`Added “${values.name}”${copied.length ? ` with ${copied.length} permissions from ${roles.find(r => r.key === copyFrom)?.name}` : ''}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={creating ? 'New role' : `Edit “${role.name}”`}
      subtitle={creating ? 'A custom role carries permissions. Screens still come from the four built-in roles.' : undefined}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <Button variant="primary" size="xl" onClick={() => void save()} disabled={busy}>{creating ? 'Add role' : 'Save'}</Button>
          <Button variant="secondary" size="xl" onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      }
    >
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <Field label="Name"><Input value={name} onChange={e => setName(e.target.value)} autoFocus maxLength={60} /></Field>
        <Field label="Column label" hint="Up to 20 characters"><Input value={shortName} onChange={e => setShortName(e.target.value)} maxLength={20} placeholder={name.slice(0, 20)} /></Field>
      </div>
      <Field label="What this role is for"><Input value={description} onChange={e => setDescription(e.target.value)} /></Field>
      {creating ? (
        <Field label="Start with the permissions of" hint="Optional · adjust them in the matrix afterwards">
          <Select value={copyFrom} onChange={e => setCopyFrom(e.target.value)} options={[{ value: '', label: 'No permissions' }, ...roles.map(r => ({ value: r.key, label: r.name }))]} />
        </Field>
      ) : null}
    </Dialog>
  );
}

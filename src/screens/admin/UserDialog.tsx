import { useState } from 'react';
import { Banner, Button, Checkbox, Dialog, Field, Input, LinkButton, StatusChip } from '../../ds';
import { adminUsers, errorMessage, NOT_YOURS_TO_GRANT, supabase } from '../../lib/supabase';
import type { RoleRow } from '../../lib/db';
import { generatePassword, userStatus, type DirectoryUser } from './directory';

interface Props {
  /** Omitted when inviting a new user. */
  user?: DirectoryUser;
  roles: RoleRow[];
  /** The signed-in admin's own id: they cannot deactivate themselves. */
  selfId: string;
  onClose: () => void;
  /** Called after any change, with a line for the toast. */
  onSaved: (message: string) => void;
}

export function UserDialog({ user, roles, selfId, onClose, onSaved }: Props) {
  const creating = !user;
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState('');
  const [cohort, setCohort] = useState(user?.cohort ?? '');
  const [roleKeys, setRoleKeys] = useState<string[]>(user?.roleKeys ?? ['player']);
  const [password, setPassword] = useState(creating ? generatePassword() : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await work());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = (key: string, on: boolean) => setRoleKeys(prev => (on ? [...prev, key] : prev.filter(k => k !== key)));

  const save = () => run(async () => {
    if (!roleKeys.length) throw new Error('Give the user at least one role.');
    if (creating) {
      await adminUsers({ action: 'create', email, password, full_name: fullName, cohort, roles: roleKeys });
      return `Created ${email.trim().toLowerCase()} · share the temporary password with them`;
    }
    const added = roleKeys.filter(k => !user.roleKeys.includes(k));
    const removed = user.roleKeys.filter(k => !roleKeys.includes(k));
    // RLS skips rows it refuses without an error, so check that each write touched what it should.
    const { data: updated, error: profileError } = await supabase.from('profiles').update({ full_name: fullName.trim(), cohort: cohort.trim() }).eq('id', user.id).select('id');
    if (profileError) throw profileError;
    if (!updated?.length) throw new Error(NOT_YOURS_TO_GRANT);
    // Add before removing, so swapping someone's only admin role for another never leaves the platform without one.
    if (added.length) {
      const { error: addError } = await supabase.from('user_roles').insert(added.map(role_key => ({ user_id: user.id, role_key })));
      if (addError) throw addError;
    }
    if (removed.length) {
      const { data: gone, error: removeError } = await supabase.from('user_roles').delete().eq('user_id', user.id).in('role_key', removed).select('role_key');
      if (removeError) throw removeError;
      if ((gone?.length ?? 0) < removed.length) throw new Error(NOT_YOURS_TO_GRANT);
    }
    return `Saved ${user.email}`;
  });

  const setStatus = (status: 'active' | 'deactivated') => run(async () => {
    await adminUsers({ action: 'set_status', user_id: user!.id, status });
    return status === 'deactivated' ? `${user!.email} is deactivated and can no longer sign in` : `${user!.email} is active again`;
  });

  const resetPassword = () => run(async () => {
    await adminUsers({ action: 'set_password', user_id: user!.id, password });
    return `New password set for ${user!.email} · share it with them`;
  });

  const st = user ? userStatus(user) : null;

  return (
    <Dialog
      title={creating ? 'Invite user' : user.full_name || user.email}
      subtitle={creating ? 'The account works straight away. No email is sent: share the temporary password yourself.' : user.email}
      onClose={busy ? undefined : onClose}
      width={560}
      footer={
        <>
          <Button variant="primary" size="xl" onClick={save} disabled={busy}>{creating ? 'Create user' : 'Save changes'}</Button>
          <Button variant="secondary" size="xl" onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      }
    >
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
        <Field label="Full name"><Input value={fullName} onChange={e => setFullName(e.target.value)} autoFocus /></Field>
        {creating ? <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@deloitte.com" /></Field> : null}
        <Field label="Cohort attributes" hint="Grade · service line · office"><Input value={cohort} onChange={e => setCohort(e.target.value)} /></Field>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Roles</legend>
        {roles.map(r => (
          <Checkbox key={r.key} checked={roleKeys.includes(r.key)} onChange={on => toggleRole(r.key, on)} disabled={busy}>
            <span style={{ fontWeight: 500 }}>{r.name}</span>
            {r.description ? <span style={{ display: 'block', fontSize: 12, color: 'var(--tc-ink-5)' }}>{r.description}</span> : null}
          </Checkbox>
        ))}
      </fieldset>

      {creating ? (
        <Field label="Temporary password" hint="At least 10 characters with upper case, lower case and a digit.">
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={password} onChange={e => setPassword(e.target.value)} style={{ fontFamily: 'var(--font-mono)' }} />
            <Button variant="secondary" size="lg" onClick={() => setPassword(generatePassword())}>New</Button>
          </div>
        </Field>
      ) : (
        <div style={{ borderTop: '1px solid var(--tc-line-hair)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500 }}>Account</span>
            {st ? <StatusChip status={st.st} label={st.label} size="xs" /> : null}
            <span style={{ marginLeft: 'auto' }}>
              {user.status === 'active' ? (
                <Button variant="secondary" size="md" onClick={() => setStatus('deactivated')} disabled={busy || user.id === selfId} title={user.id === selfId ? 'You cannot deactivate your own account' : undefined}>Deactivate</Button>
              ) : (
                <Button variant="accent" size="md" onClick={() => setStatus('active')} disabled={busy}>Reactivate</Button>
              )}
            </span>
          </div>
          <Field label="Reset password" size="sm">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Input size="md" value={password} onChange={e => setPassword(e.target.value)} placeholder="New password" style={{ fontFamily: 'var(--font-mono)' }} />
              <LinkButton size={12} onClick={() => setPassword(generatePassword())}>Generate</LinkButton>
              <Button variant="dark" size="sm" onClick={resetPassword} disabled={busy || !password}>Set</Button>
            </div>
          </Field>
        </div>
      )}
    </Dialog>
  );
}

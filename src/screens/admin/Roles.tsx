import { Fragment, useState } from 'react';
import { Banner, Button, Dialog, LinkButton } from '../../ds';
import { useApp } from '../../app/useApp';
import { useAuth, useSignedIn } from '../../auth/useAuth';
import { errorMessage, supabase } from '../../lib/supabase';
import { LOCKED_ADMIN_PERMISSIONS, type GrantLevel, type PermissionRow, type RoleRow } from '../../lib/db';
import { PageHead, Screen } from '../../shell/ui';
import { useDirectory } from './directory';
import { RoleDialog } from './RoleDialog';

const headCell = { padding: '10px 18px', background: '#fafbf8', borderBottom: '1px solid #eef0ea', fontSize: 11.5, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: '#5a6058' } as const;
const MARK = {
  1: { mark: '✓', bg: '#86BC25', border: '#78aa1e', label: 'Granted' },
  2: { mark: '–', bg: '#eef0ec', border: '#d5dacf', label: 'Partial' },
  0: { mark: '', bg: '#fff', border: '#d5dacf', label: 'Not granted' },
};
/** Clicking a cell steps through: not granted → granted → partial → not granted. */
const NEXT: Record<0 | GrantLevel, 0 | GrantLevel> = { 0: 1, 1: 2, 2: 0 };

export function Roles() {
  const { toast } = useApp();
  const { permissions: mine, roles: myRoles } = useSignedIn();
  const { refresh } = useAuth();
  const { data, error, reload, setData } = useDirectory();
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const canEdit = mine.has('roles.manage');

  const roles = data?.roles ?? [];
  const grants = data?.grants ?? [];
  const level = (role: string, perm: string): 0 | GrantLevel => grants.find(g => g.role_key === role && g.permission_key === perm)?.level ?? 0;
  const userCount = (role: string) => data?.users.filter(u => u.roleKeys.includes(role)).length;
  const touchesMe = (role: string) => myRoles.some(r => r.key === role);

  const cycle = async (role: RoleRow, perm: PermissionRow) => {
    if (!data) return;
    const from = level(role.key, perm.key), to = NEXT[from];
    // Show the change at once; put it back if the database refuses it.
    const others = grants.filter(g => !(g.role_key === role.key && g.permission_key === perm.key));
    setData({ ...data, grants: to ? [...others, { role_key: role.key, permission_key: perm.key, level: to }] : others });
    const { error: e } = to
      ? await supabase.from('role_permissions').upsert({ role_key: role.key, permission_key: perm.key, level: to })
      : await supabase.from('role_permissions').delete().eq('role_key', role.key).eq('permission_key', perm.key);
    if (e) {
      toast(errorMessage(e));
      await reload();
      return;
    }
    toast(`${role.name} · ${perm.name}: ${MARK[to].label.toLowerCase()}`);
    if (touchesMe(role.key)) await refresh();
  };

  const remove = async (role: RoleRow) => {
    const { error: e } = await supabase.from('roles').delete().eq('key', role.key);
    setDeleting(null);
    if (e) toast(errorMessage(e));
    else toast(`Deleted “${role.name}”`);
    await reload();
  };

  const saved = async (message: string) => {
    setEditing(null);
    toast(message);
    await reload();
    await refresh();
  };

  return (
    <Screen label="Admin · Roles & permissions">
      <PageHead
        title="Roles and permissions"
        lead={canEdit ? 'A user can hold more than one role · click a cell to change a grant · changes apply at once' : 'A user can hold more than one role · read only: you need “Edit roles and permissions” to change this'}
        actions={canEdit ? <Button variant="secondary" size="lg" onClick={() => setEditing('new')} disabled={!data}>+ New role</Button> : null}
      />
      {error ? <Banner tone="warning" title="Could not load roles." actions={<Button variant="secondary" size="sm" onClick={() => void reload()}>Retry</Button>}>{error}</Banner> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {roles.map(r => {
          const count = userCount(r.key);
          return (
            <div key={r.key} style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '16px 18px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                {/* Without "Manage users" the assignments are not visible, so no count is shown. */}
                {mine.has('users.manage') ? <span style={{ fontSize: 12, color: '#8b918a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{count} {count === 1 ? 'user' : 'users'}</span> : null}
              </div>
              <div style={{ fontSize: 12.5, color: '#5a6058', marginTop: 6, flex: 1 }}>{r.description || (r.is_system ? '' : 'Custom role')}</div>
              {canEdit ? (
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <LinkButton size={12} onClick={() => setEditing(r)}>Edit</LinkButton>
                  {!r.is_system ? <LinkButton size={12} tone="muted" onClick={() => setDeleting(r)}>Delete</LinkButton> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, overflow: 'auto' }}>
        <div role="table" aria-label="Permissions by role" style={{ display: 'grid', gridTemplateColumns: `minmax(260px,1fr) repeat(${roles.length || 4},130px)`, minWidth: 260 + 130 * (roles.length || 4) }}>
          <div role="columnheader" style={headCell}>Permission</div>
          {roles.map(r => <div key={r.key} role="columnheader" style={{ ...headCell, padding: '10px 12px', textAlign: 'center' }} title={r.name}>{r.short_name}</div>)}
          {(data?.permissions ?? []).map(p => (
            <Fragment key={p.key}>
              <div style={{ padding: '10px 18px', borderBottom: '1px solid #eef0ea', display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 500 }}>{p.name}</span>
                <span style={{ fontSize: 11.5, color: '#8b918a' }}>{p.category}</span>
              </div>
              {roles.map(r => {
                const v = level(r.key, p.key), m = MARK[v];
                const locked = r.key === 'admin' && LOCKED_ADMIN_PERMISSIONS.includes(p.key);
                const disabled = !canEdit || locked;
                return (
                  <button
                    key={r.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => void cycle(r, p)}
                    aria-label={`${p.name} · ${r.name} · ${m.label}${locked ? ' · always granted' : ''}`}
                    title={locked ? 'Platform admin always keeps this, so nobody is locked out' : canEdit ? 'Click to change' : undefined}
                    style={{ border: 'none', borderBottom: '1px solid #eef0ea', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', font: 'inherit', opacity: locked ? 0.6 : 1 }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${m.border}`, background: m.bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#10180a' }}>{m.mark}</span>
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#5a6058', flexWrap: 'wrap' }}>
        <span>✓ granted</span><span>– partial (shown, not enough to pass a check)</span><span>empty · not granted</span>
      </div>
      {editing ? (
        <RoleDialog role={editing === 'new' ? undefined : editing} roles={roles} grants={grants} onClose={() => setEditing(null)} onSaved={msg => void saved(msg)} />
      ) : null}
      {deleting ? (
        <Dialog
          title={`Delete “${deleting.name}”?`}
          subtitle={userCount(deleting.key) ? `${userCount(deleting.key)} users hold this role and will lose it.` : 'Nobody holds this role.'}
          onClose={() => setDeleting(null)}
          footer={
            <>
              <Button variant="dark" size="xl" onClick={() => void remove(deleting)}>Delete role</Button>
              <Button variant="secondary" size="xl" onClick={() => setDeleting(null)}>Cancel</Button>
            </>
          }
        />
      ) : null}
    </Screen>
  );
}

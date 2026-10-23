import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PASSWORD_FILE, ROLES, adminClient, deleteE2eAccounts, emailFor } from './accounts';

export default async function globalSetup() {
  await deleteE2eAccounts(); // leftovers from an interrupted run
  const admin = adminClient();
  const pw = `E2e${randomBytes(9).toString('base64url')}7a`;
  for (const role of ROLES) {
    const { data, error } = await admin.auth.admin.createUser({ email: emailFor(role), password: pw, email_confirm: true, user_metadata: { full_name: `E2E ${role}` } });
    if (error) throw error;
    await admin.from('profiles').update({ cohort: 'E2E cohort' }).eq('id', data.user.id);
    const { error: e } = await admin.from('user_roles').insert({ user_id: data.user.id, role_key: role });
    if (e) throw e;
  }
  writeFileSync(PASSWORD_FILE, pw, { mode: 0o600 });
}

// Creates (or resets) the four demo accounts, one per built-in role.
//
//   SUPABASE_URL=… SUPABASE_SECRET_KEY=… SEED_PASSWORD=… npm run seed:users
//
// Or put the three variables in .env.seed (git-ignored) and run the same command.
// Safe to re-run: existing accounts get the password reset, are reactivated and keep exactly their one role.
import { createClient } from '@supabase/supabase-js';

const DEMO_USERS = [
  { email: 'player@deloitte.com', role: 'player', full_name: 'Demo Player', cohort: 'Analyst · Indirect tax · Brussels' },
  { email: 'creator@deloitte.com', role: 'creator', full_name: 'Demo Creator', cohort: 'Senior manager · Indirect tax' },
  { email: 'gameadmin@deloitte.com', role: 'gameadmin', full_name: 'Demo Game Admin', cohort: 'Manager · Indirect tax' },
  { email: 'admin@deloitte.com', role: 'admin', full_name: 'Demo Admin', cohort: 'Partner · Brussels' },
];

const { SUPABASE_URL, SUPABASE_SECRET_KEY, SEED_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !SEED_PASSWORD) {
  console.error('Set SUPABASE_URL, SUPABASE_SECRET_KEY (the secret / service_role key) and SEED_PASSWORD.');
  process.exit(1);
}
if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,}$/.test(SEED_PASSWORD)) {
  console.error('SEED_PASSWORD needs 10+ characters with upper case, lower case and a digit.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find(u => u.email === email);
    if (hit || data.users.length < 200) return hit;
  }
}

for (const u of DEMO_USERS) {
  const existing = await findUser(u.email);
  let id;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password: SEED_PASSWORD, ban_duration: 'none', email_confirm: true });
    if (error) throw error;
    id = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: SEED_PASSWORD, email_confirm: true, user_metadata: { full_name: u.full_name } });
    if (error) throw error;
    id = data.user.id;
  }

  const { error: profileError } = await admin.from('profiles').update({ full_name: u.full_name, cohort: u.cohort, status: 'active' }).eq('id', id);
  if (profileError) throw profileError;
  // Add the role before removing others, so the last-admin guard never trips.
  const { error: addError } = await admin.from('user_roles').upsert({ user_id: id, role_key: u.role }, { onConflict: 'user_id,role_key', ignoreDuplicates: true });
  if (addError) throw addError;
  const { error: trimError } = await admin.from('user_roles').delete().eq('user_id', id).neq('role_key', u.role);
  if (trimError) throw trimError;

  console.log(`${existing ? 'reset  ' : 'created'} ${u.email.padEnd(24)} ${u.role}`);
}

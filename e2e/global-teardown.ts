import { rmSync } from 'node:fs';
import { PASSWORD_FILE, deleteE2eAccounts } from './accounts';

export default async function globalTeardown() {
  await deleteE2eAccounts();
  rmSync(PASSWORD_FILE, { force: true });
}

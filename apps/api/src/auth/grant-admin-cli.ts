// Usage: node dist/auth/grant-admin-cli.js <IdP subject>   (the account must have signed in once)
import { parseEnv } from '../config/env.js';
import { connect } from '../db/connect.js';
import { UsersService } from '../users/users.service.js';

const sub = process.argv[2];
if (!sub) {
  throw new Error('usage: grant-admin <IdP subject>');
}
const env = parseEnv(process.env);
const conn = await connect(env);
try {
  const user = await new UsersService(conn.db, env).grantAdmin(sub);
  if (!user) {
    console.error(`No account for '${sub}' — sign in once first.`);
    process.exitCode = 1;
  } else {
    console.log(`${user.nickname} (${user.id}) is now an admin`);
  }
} finally {
  await conn.close();
}

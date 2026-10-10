// Usage:
//   node dist/sdk/register-cli.js <dir>   upload a bundle dir (index.js + manifest.json) to storage, register
//   node dist/sdk/register-cli.js <url>   register a manifest.json served elsewhere (development)
import { parseEnv } from '../config/env.js';
import { connect } from '../db/connect.js';
import { storageFromEnv } from '../storage/s3-storage.js';
import { publishAdapterDir, registerAdapterUrl } from './register-adapter.js';

const target = process.argv[2];
if (!target) {
  throw new Error('usage: sdk:register <adapter dist directory | manifest.json URL>');
}
const env = parseEnv(process.env);
const conn = await connect(env);
try {
  const result = /^https?:\/\//.test(target)
    ? await registerAdapterUrl(conn.db, target)
    : await publishAdapterDir(conn.db, storageFromEnv(env), target);
  console.log(`SDK v${result.major} → ${result.adapterUrl} (${result.sri})`);
} finally {
  await conn.close();
}

// Usage: pnpm --filter @croffledev/play-api sdk:register <manifest-url>
import { parseEnv } from '../config/env.js';
import { connect } from '../db/connect.js';
import { fetchAdapterManifest, registerAdapter } from './register-adapter.js';

const url = process.argv[2];
if (!url) {
  throw new Error('usage: sdk:register <adapter manifest.json URL>');
}
const conn = await connect(parseEnv(process.env));
try {
  const result = await registerAdapter(conn.db, await fetchAdapterManifest(url), url);
  console.log(`SDK v${result.major} → ${result.adapterUrl} (${result.sri})`);
} finally {
  await conn.close();
}

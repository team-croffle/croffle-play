import { parseEnv } from '../config/env.js';
import { connect } from './connect.js';
import { seed } from './seed.js';

const conn = await connect(parseEnv(process.env));
try {
  await seed(conn.db);
} finally {
  await conn.close();
}

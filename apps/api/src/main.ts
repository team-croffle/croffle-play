import { createApp } from './bootstrap.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

const app = await createApp();
const env = app.get<Env>(ENV);
await app.listen(env.PORT, env.HOST);

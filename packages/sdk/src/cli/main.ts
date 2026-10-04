#!/usr/bin/env node
import { migrate } from './migrate.js';

process.exitCode = await migrate(process.argv.slice(2));

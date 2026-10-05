// Writes dist/game.json: game.json + the version being released.
// Version: GAME_VERSION (the publish workflow passes the git tag, `v1.2.0`) or package.json.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const game = JSON.parse(readFileSync('game.json', 'utf8'));
const version = (process.env.GAME_VERSION || pkg.version).replace(/^v/, '');
writeFileSync('dist/game.json', `${JSON.stringify({ ...game, version }, null, 2)}\n`);
console.log(`dist/game.json: ${game.id}@${version}`);

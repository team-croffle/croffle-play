// Writes dist/game.json (served at <game origin>/game.json for the portal): game.json + version.
// Version (for information only): GAME_VERSION (e.g. a git tag, `v1.2.0`) or package.json.
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const game = JSON.parse(readFileSync('game.json', 'utf8'));
const version = (process.env.GAME_VERSION || pkg.version).replace(/^v/, '');
writeFileSync('dist/game.json', `${JSON.stringify({ ...game, version }, null, 2)}\n`);
console.log(`dist/game.json: ${game.id}@${version}`);

// Rooms fixture: joins the room `lobby` and relays pings between players. Served by
// `pnpm dev:games`; needs the rooms server (`pnpm dev:rooms`) and a signed-in player.
import { createSdk } from '@croffledev/play-sdk';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const log = (line: string) => {
  $('log').textContent += `${line}\n`;
  // oxlint-disable-next-line no-console -- read by the e2e smoke test
  console.log(`[duo] ${line}`);
};

const sdk = await createSdk({ game: 'duo' });
await sdk.ready();
const room = await sdk.joinRoom('lobby', { maxPeers: 4 }).catch((err: { code?: string }) => {
  log(`join failed: ${err.code}`);
  throw err;
});
const status = () => {
  $('status').textContent =
    `room ${room.id} · ${room.peers.size} players · ${room.isHost ? 'host' : 'guest'}`;
};
log(`joined ${room.id} as ${room.self.nickname} (${room.peers.size} here)`);
status();

let n = 0;
room.on('peer-join', (p) => {
  log(`peer-join ${p.nickname}`);
  status();
});
room.on('peer-leave', () => status());
room.on('host', () => status());
room.on('message', (data, from) =>
  log(`msg from ${room.peers.get(from)?.nickname ?? from}: ${JSON.stringify(data)}`),
);
room.on('reconnecting', (attempt) => log(`reconnecting ${attempt}`));
room.on('reconnected', () => {
  log('reconnected');
  status();
});
room.on('closed', (reason) => log(`closed: ${reason}`));
$('ping').addEventListener('click', () => room.send({ ping: ++n, from: room.self.nickname }));

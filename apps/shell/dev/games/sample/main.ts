// SDK handshake fixture. Not shipped with the shell (design invariant 1): it is built and served
// on its own origin by `pnpm dev:games`.
import { createSdk } from '@croffledev/play-sdk';
import { createMockHost } from '@croffledev/play-sdk/mock';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const log = (line: string) => {
  $('log').textContent += `${line}\n`;
  // oxlint-disable-next-line no-console -- read by the e2e smoke test
  console.log(`[sample] ${line}`);
};

const sdk = await createSdk({
  game: 'sample',
  ...(window.parent === window ? { transport: createMockHost() } : {}),
});
log(`welcome: ${[...sdk.capabilities].join(',')}`);
$('caps').textContent = `capabilities: ${[...sdk.capabilities].join(', ')}`;

const user = await sdk.getUser();
$('user').textContent = user ? `hello, ${user.nickname}` : 'playing as guest';

sdk.on('pause', () => log('pause'));
sdk.on('resume', () => log('resume'));

$('score').addEventListener('click', async () => {
  const score = Math.floor(Math.random() * 1000);
  try {
    log(`submitScore(${score}) → ${JSON.stringify(await sdk.submitScore(score))}`);
  } catch (err) {
    log(`submitScore failed: ${(err as Error).message}`);
  }
});
$('fullscreen').addEventListener('click', async () => {
  log(`fullscreen → ${await sdk.setFullscreen(true)}`);
});
$('exit').addEventListener('click', () => void sdk.exit());

await sdk.ready();
log('ready');

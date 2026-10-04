# @croffledev/play-sdk

SDK for games on Croffle Play. Bundle it into your game; the platform talks to it over
`postMessage`.

```ts
import { createSdk } from '@croffledev/play-sdk';
import { createMockHost } from '@croffledev/play-sdk/mock';

const sdk = await createSdk({
  game: 'tetris',
  // Outside the platform (vite dev), use the mock host.
  transport: window.parent === window ? createMockHost() : undefined,
});

await sdk.ready();
const user = await sdk.getUser(); // null for guests
if (sdk.has('score')) await sdk.submitScore(1200);
sdk.on('pause', () => game.pause());
```

Check features with `sdk.has(name)`, never by comparing versions. Errors are `SdkError` with a
stable `code` (`unsupported`, `invalid_request`, `auth_required`, `timeout`, …).

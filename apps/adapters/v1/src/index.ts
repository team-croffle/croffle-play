/**
 * Host adapter for SDK major 1. Loaded by the shell at runtime (design invariant 6); translates v1
 * messages from the game into shell core calls. Ships as one immutable bundle per release.
 */
import {
  type Envelope,
  event,
  fail,
  isRequestType,
  ok,
  parseEnvelope,
  type RequestType,
  requests,
} from '@croffledev/play-protocol';
import type { AdapterContext, HostCore, MountedAdapter } from '@croffledev/play-protocol/host';
import * as v from 'valibot';

import { toProtocolError } from './errors.js';

export const major = 1;

/** Features this adapter serves. `save` and `leaderboard` need accounts. */
const CAPABILITIES = ['user', 'score', 'fullscreen', 'exit'];

type Handler = (core: HostCore, payload: never) => Promise<unknown>;

const handlers: Partial<Record<RequestType, Handler>> = {
  ready: async (core) => {
    core.ui.gameReady();
  },
  getUser: (core) => core.identity.getUser(),
  submitScore: (core, payload: { score: number }) =>
    core.api('POST', `games/${encodeURIComponent(core.lifecycle.gameId)}/scores`, payload),
  exit: async (core) => {
    core.lifecycle.exit();
  },
  fullscreen: async (core, payload: { on: boolean }) => ({
    on: await core.ui.setFullscreen(payload.on),
  }),
};

export function mount({ core, port }: AdapterContext): MountedAdapter {
  const onRequest = async (msg: Extract<Envelope, { kind: 'req' }>) => {
    const handler = isRequestType(msg.type) ? handlers[msg.type] : undefined;
    if (!handler || !isRequestType(msg.type)) {
      port.post(fail(msg.id, { code: 'unsupported', message: `'${msg.type}' is not supported` }));
      return;
    }
    const check = v.safeParse(requests[msg.type].request, msg.payload);
    if (!check.success) {
      port.post(fail(msg.id, { code: 'invalid_request', message: check.issues[0].message }));
      return;
    }
    try {
      port.post(ok(msg.id, await handler(core, check.output as never)));
    } catch (err) {
      port.post(fail(msg.id, toProtocolError(err)));
    }
  };

  const offMessage = port.onMessage((raw) => {
    const msg = parseEnvelope(raw);
    if (msg?.kind === 'req') {
      void onRequest(msg);
    }
  });
  const offVisibility = core.lifecycle.onVisibility((visible) => {
    port.post(event(visible ? 'resume' : 'pause'));
  });

  return {
    capabilities: CAPABILITIES,
    dispose() {
      offMessage();
      offVisibility();
    },
  };
}

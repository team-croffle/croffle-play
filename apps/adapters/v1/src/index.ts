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

/** Features this adapter serves. */
const CAPABILITIES = ['user', 'score', 'save', 'leaderboard', 'fullscreen', 'exit'];

const game = (core: HostCore) => `games/${encodeURIComponent(core.lifecycle.gameId)}`;

interface LeaderboardItem {
  rank: number;
  user: { id: string; nickname: string; avatar: string | null };
  score: number;
}

type Handler = (core: HostCore, payload: never) => Promise<unknown>;

const handlers: Partial<Record<RequestType, Handler>> = {
  ready: async (core) => {
    core.ui.gameReady();
  },
  getUser: (core) => core.identity.getUser(),
  submitScore: (core, payload: { score: number }) =>
    core.api('POST', `${game(core)}/scores`, payload),
  save: async (core, payload: { slot: string; data: string }) => {
    await core.api('PUT', `${game(core)}/saves/${payload.slot}`, { data: payload.data });
  },
  load: (core, payload: { slot: string }) => core.api('GET', `${game(core)}/saves/${payload.slot}`),
  getLeaderboard: async (core, payload: { limit?: number }) => {
    const res = await core.api<{ items: LeaderboardItem[] }>(
      'GET',
      `${game(core)}/leaderboard?limit=${payload.limit ?? 10}`,
    );
    return { entries: res.items.map(({ rank, user, score }) => ({ rank, user, score })) };
  },
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
      const error = toProtocolError(err);
      if (error.code === 'auth_required') {
        core.ui.requestLogin();
      }
      port.post(fail(msg.id, error));
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

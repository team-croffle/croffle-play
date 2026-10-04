import { event, ok, parseEnvelope, type RequestEnvelope } from '@croffledev/play-protocol';

import type { Transport } from '../../src/transport.js';

type Handler = (req: RequestEnvelope) => unknown;

/** In-memory host side for tests: answers hello and dispatches requests to handlers. */
export function fakeHost(opts: {
  origin?: string;
  capabilities?: string[];
  handlers?: Record<string, Handler>;
  silent?: boolean;
}) {
  const origin = opts.origin ?? 'https://play.test';
  const toGame = new Set<(m: unknown, o: string) => void>();
  const sent: unknown[] = [];
  const deliver = (m: unknown, from = origin) => {
    for (const l of toGame) {
      l(structuredClone(m), from);
    }
  };
  const transport: Transport = {
    send(message, targetOrigin) {
      sent.push({ message, targetOrigin });
      if (opts.silent) {
        return;
      }
      const m = message as { type?: string };
      if (m.type === '__hello') {
        deliver({ type: '__welcome', capabilities: opts.capabilities ?? [] });
        return;
      }
      const req = parseEnvelope(message);
      if (req?.kind === 'req') {
        const handler = opts.handlers?.[req.type];
        if (handler) {
          const res = handler(req);
          if (res !== 'no-reply') {
            deliver(res ?? ok(req.id));
          }
        }
      }
    },
    onMessage(listener) {
      toGame.add(listener);
      return () => toGame.delete(listener);
    },
  };
  return {
    transport,
    sent,
    deliver,
    emit: (type: string) => deliver(event(type)),
  };
}

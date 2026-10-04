import {
  type EventType,
  type RequestPayload,
  type RequestType,
  type ResponsePayload,
  parseEnvelope,
  parseWelcome,
  request as envelope,
  requests,
  requiredCapability,
} from '@croffledev/play-protocol';
import * as v from 'valibot';

import { SdkError } from './errors.js';
import type { Transport } from './transport.js';

interface Pending {
  resolve: (payload: unknown) => void;
  reject: (err: SdkError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Connected SDK. Create it with `createSdk()`. */
export class SdkClient {
  readonly capabilities: ReadonlySet<string>;
  private readonly pending = new Map<string, Pending>();
  private readonly listeners = new Map<EventType, Set<() => void>>();
  private nextId = 1;
  private readonly unsubscribe: () => void;

  constructor(
    private readonly transport: Transport,
    private readonly hostOrigin: string,
    capabilities: string[],
    private readonly timeoutMs: number,
  ) {
    this.capabilities = new Set(capabilities);
    this.unsubscribe = transport.onMessage((msg, origin) => {
      if (origin === hostOrigin) {
        this.receive(msg);
      }
    });
  }

  /** True when the host supports a feature (see `capabilities` in the protocol). */
  has(capability: string): boolean {
    return this.capabilities.has(capability);
  }

  /** Low-level request. Prefer the typed helpers below. */
  request<T extends RequestType>(type: T, payload: RequestPayload<T>): Promise<ResponsePayload<T>> {
    const cap = requiredCapability[type];
    if (cap && !this.has(cap)) {
      return Promise.reject(new SdkError('unsupported', `Host does not support '${cap}'`));
    }
    const check = v.safeParse(requests[type].request, payload);
    if (!check.success) {
      return Promise.reject(new SdkError('invalid_request', check.issues[0].message));
    }
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new SdkError('timeout', `'${type}' timed out after ${this.timeoutMs} ms`));
      }, this.timeoutMs);
      this.pending.set(id, {
        resolve: (p) => resolve(p as ResponsePayload<T>),
        reject,
        timer,
      });
      this.transport.send(envelope(id, type, payload), this.hostOrigin);
    });
  }

  /** Tell the host the game finished loading (hides the platform loading screen). */
  ready(): Promise<void> {
    return this.request('ready', undefined);
  }

  /** Signed-in player's public profile, or null for guests. */
  getUser(): Promise<ResponsePayload<'getUser'>> {
    return this.request('getUser', undefined);
  }

  submitScore(score: number): Promise<ResponsePayload<'submitScore'>> {
    return this.request('submitScore', { score });
  }

  save(slot: string, data: string): Promise<void> {
    return this.request('save', { slot, data });
  }

  async load(slot: string): Promise<string | null> {
    return (await this.request('load', { slot })).data;
  }

  exit(): Promise<void> {
    return this.request('exit', undefined);
  }

  async setFullscreen(on: boolean): Promise<boolean> {
    return (await this.request('fullscreen', { on })).on;
  }

  /** Subscribe to host events (`pause`, `resume`). Returns an unsubscribe function. */
  on(type: EventType, listener: () => void): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
    return () => set.delete(listener);
  }

  /** Stop listening and reject in-flight requests. */
  dispose(): void {
    this.unsubscribe();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new SdkError('internal', 'SDK disposed'));
    }
    this.pending.clear();
    this.listeners.clear();
  }

  private receive(raw: unknown): void {
    const msg = parseEnvelope(raw);
    if (!msg) {
      return;
    }
    if (msg.kind === 'evt') {
      for (const listener of this.listeners.get(msg.type as EventType) ?? []) {
        listener();
      }
      return;
    }
    if (msg.kind !== 'res') {
      return;
    }
    const p = this.pending.get(msg.id);
    if (!p) {
      return;
    }
    this.pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) {
      p.resolve(msg.payload);
    } else {
      p.reject(new SdkError(msg.error.code, msg.error.message));
    }
  }
}

/** Waits for `__welcome`, re-sending `__hello` until the host is listening. */
export function handshake(
  transport: Transport,
  hello: { sdk: string; game: string },
  timeoutMs: number,
): Promise<{ origin: string; capabilities: string[] }> {
  return new Promise((resolve, reject) => {
    const send = () => transport.send({ type: '__hello', ...hello }, '*');
    const retry = setInterval(send, 250);
    const timer = setTimeout(() => {
      done();
      reject(new SdkError('timeout', `No __welcome from the host within ${timeoutMs} ms`));
    }, timeoutMs);
    const off = transport.onMessage((msg, origin) => {
      const welcome = parseWelcome(msg);
      if (welcome) {
        done();
        resolve({ origin, capabilities: welcome.capabilities });
      }
    });
    function done() {
      clearInterval(retry);
      clearTimeout(timer);
      off();
    }
    send();
  });
}

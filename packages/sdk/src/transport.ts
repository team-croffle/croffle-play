/** How the SDK reaches its host. The default is `postMessage` to the parent window. */
export interface Transport {
  send(message: unknown, targetOrigin: string): void;
  /** Delivers messages from the host only, with the sender's origin. */
  onMessage(listener: (message: unknown, origin: string) => void): () => void;
}

/** Minimal window surface used here (lets tests pass a fake). */
export interface WindowLike {
  parent: { postMessage(message: unknown, targetOrigin: string): void };
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

/** Talks to the embedding page. Messages from any other window are ignored. */
export function windowTransport(win: WindowLike): Transport {
  return {
    send(message, targetOrigin) {
      win.parent.postMessage(message, targetOrigin);
    },
    onMessage(listener) {
      const handler = (event: MessageEvent) => {
        if (event.source === win.parent) {
          listener(event.data, event.origin);
        }
      };
      win.addEventListener('message', handler);
      return () => win.removeEventListener('message', handler);
    },
  };
}

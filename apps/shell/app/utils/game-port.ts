import type { GamePort } from '@croffledev/play-protocol/host';

interface FrameLike {
  contentWindow: { postMessage(message: unknown, targetOrigin: string): void } | null;
}

interface WindowLike {
  addEventListener(type: 'message', l: (e: MessageEvent) => void): void;
  removeEventListener(type: 'message', l: (e: MessageEvent) => void): void;
}

/**
 * Channel to one game frame. Only messages from that frame's window *and* the game origin get
 * through; everything posted goes to the game origin only, never `*`.
 */
export function createGamePort(frame: FrameLike, gameOrigin: string, win: WindowLike): GamePort {
  return {
    post(message) {
      frame.contentWindow?.postMessage(message, gameOrigin);
    },
    onMessage(listener) {
      const handler = (e: MessageEvent) => {
        if (e.source !== null && e.source === frame.contentWindow && e.origin === gameOrigin) {
          listener(e.data);
        }
      };
      win.addEventListener('message', handler);
      return () => win.removeEventListener('message', handler);
    },
  };
}

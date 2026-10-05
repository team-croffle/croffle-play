/**
 * The game iframe. The game keeps its own origin (`allow-same-origin` is about the game's origin,
 * not the portal's) but cannot open popups, submit forms, navigate the portal, or download.
 */
export const GAME_FRAME = {
  sandbox: 'allow-scripts allow-same-origin allow-pointer-lock',
  allow: 'fullscreen; autoplay; gamepad',
  referrerpolicy: 'no-referrer',
} as const;

// oxlint-disable-next-line no-underscore-dangle -- build-time define
declare const __SDK_VERSION__: string | undefined;

/** Version this SDK build announces in `__hello` (replaced at build time). */
export const SDK_VERSION: string =
  typeof __SDK_VERSION__ === 'string' ? __SDK_VERSION__ : '1.0.0-dev';

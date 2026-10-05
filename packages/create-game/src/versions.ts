// oxlint-disable-next-line no-underscore-dangle -- build-time define
declare const __SDK_VERSION__: string | undefined;
// oxlint-disable-next-line no-underscore-dangle -- build-time define
declare const __CLI_VERSION__: string | undefined;

/** Versions of @croffledev/play-sdk and play-cli released together with this package. */
export const SDK_VERSION = typeof __SDK_VERSION__ === 'string' ? __SDK_VERSION__ : '0.0.0';
export const CLI_VERSION = typeof __CLI_VERSION__ === 'string' ? __CLI_VERSION__ : '0.0.0';

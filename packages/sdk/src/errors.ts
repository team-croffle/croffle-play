import type { ErrorCode } from '@croffledev/play-protocol';

/** Rejection reason for every SDK call. `code` is stable; `message` is for humans. */
export class SdkError extends Error {
  override readonly name = 'SdkError';

  constructor(
    readonly code: ErrorCode | (string & {}),
    message: string,
  ) {
    super(message);
  }
}

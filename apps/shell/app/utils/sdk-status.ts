import type { GameSummary } from '~~/shared/types/game';

/**
 * What players are told about a game's SDK lifecycle; null when there is nothing to say. Only
 * `deprecated` (and an unknown major) concerns players: the game stays listed but cannot run.
 * `old` is for developers and admins only (docs/sdk-lifecycle.md).
 */
export function sdkNotice(
  sdk: GameSummary['sdk'],
): { badge: string; text: string; playable: boolean } | null {
  if (!sdk || sdk.status === 'deprecated') {
    return {
      badge: '업데이트되지 않음',
      text: '이 게임은 업데이트되지 않아 실행할 수 없습니다. 제작자가 업데이트하면 다시 플레이할 수 있습니다.',
      playable: false,
    };
  }
  return null;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

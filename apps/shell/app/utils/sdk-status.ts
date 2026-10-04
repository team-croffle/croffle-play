import type { GameSummary } from '~~/shared/types/game';

/** What players are told about a game's SDK lifecycle; null when there is nothing to say. */
export function sdkNotice(
  sdk: GameSummary['sdk'],
): { badge: string; text: string; playable: boolean } | null {
  if (!sdk || sdk.status === 'eol') {
    return {
      badge: '지원 종료',
      text: '이 게임은 지원이 끝난 SDK로 만들어져 더 이상 실행할 수 없습니다.',
      playable: false,
    };
  }
  if (sdk.status === 'deprecated') {
    const date = sdk.eolAt ? `${formatDate(sdk.eolAt)}부터` : '곧';
    return {
      badge: '곧 지원 종료',
      text: `이 게임은 ${date} 실행할 수 없게 됩니다. 제작자가 업데이트하면 계속 플레이할 수 있습니다.`,
      playable: true,
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

import { Logger } from '@nestjs/common';

export interface SdkNotice {
  game: { id: string; name: string; repo: string };
  major: number;
  status: 'deprecated' | 'eol';
  eolAt: Date | null;
  guideUrl: string;
}

/** Where deprecation notices go. GitHub issues by default; swappable (e.g. a GitHub App). */
export interface Notifier {
  notify(notice: SdkNotice): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');

export function noticeText(n: SdkNotice): { title: string; body: string } {
  const date = n.eolAt?.toISOString().slice(0, 10);
  const title =
    n.status === 'eol'
      ? `Croffle Play: SDK v${n.major} reached end of life — ${n.game.name} no longer runs`
      : `Croffle Play: SDK v${n.major} is deprecated${date ? ` (end of life ${date})` : ''}`;
  const body = [
    `**${n.game.name}** (\`${n.game.id}\`) is built with \`@croffledev/play-sdk\` v${n.major}.`,
    '',
    n.status === 'eol'
      ? `SDK v${n.major} reached end of life: versions built with it cannot be played any more.`
      : `SDK v${n.major} is deprecated: new versions built with it are refused${date ? `, and existing ones stop working on ${date}` : ''}.`,
    '',
    `Upgrade to a supported SDK major (\`npx @croffledev/play-sdk migrate ${n.major}-to-<next>\`) and publish a new version.`,
    `Guide: ${n.guideUrl}`,
    '',
    '_Opened automatically by the Croffle Play platform._',
  ].join('\n');
  return { title, body };
}

export class GithubIssueNotifier implements Notifier {
  constructor(
    private readonly token: string,
    private readonly apiUrl: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async notify(n: SdkNotice): Promise<void> {
    const { title, body } = noticeText(n);
    const res = await this.fetcher(`${this.apiUrl}/repos/${n.game.repo}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'croffle-play-platform',
      },
      body: JSON.stringify({ title, body, labels: ['croffle-play', 'sdk'] }),
    });
    if (!res.ok) {
      throw new Error(`GitHub ${res.status} for ${n.game.repo}: ${await res.text()}`);
    }
  }
}

export class LogNotifier implements Notifier {
  private readonly logger = new Logger('SdkNotice');

  async notify(n: SdkNotice): Promise<void> {
    this.logger.warn(`${noticeText(n).title} → ${n.game.repo} (GITHUB_NOTIFY_TOKEN not set)`);
  }
}

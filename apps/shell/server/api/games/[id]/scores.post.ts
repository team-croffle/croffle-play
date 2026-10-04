import { requests } from '@croffledev/play-protocol';
import * as v from 'valibot';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (b) => v.parse(requests.submitScore.request, b));
  setResponseStatus(event, 202);
  return proxied(() => usePlatformApi().submitScore(getRouterParam(event, 'id') ?? '', body.score));
});

import { requests } from '@croffledev/play-protocol';
import * as v from 'valibot';

/** Score from the game (via the adapter), recorded as the signed-in player's; 401 for guests. */
export default defineEventHandler(async (event) => {
  const id = gameIdParam(event);
  const body = await readValidatedBody(event, (b) => v.parse(requests.submitScore.request, b));
  setResponseStatus(event, 201);
  return apiAsUser(event, `/v1/games/${id}/scores`, { method: 'POST', body });
});

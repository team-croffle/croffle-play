import { MAX_SAVE_LENGTH, slotSchema } from '@croffledev/play-protocol';
import * as v from 'valibot';

const bodySchema = v.object({ data: v.pipe(v.string(), v.maxLength(MAX_SAVE_LENGTH)) });

export default defineEventHandler(async (event) => {
  const id = gameIdParam(event);
  const slot = v.parse(slotSchema, getRouterParam(event, 'slot'));
  const body = await readValidatedBody(event, (b) => v.parse(bodySchema, b));
  await apiAsUser(event, `/v1/games/${id}/saves/${slot}`, { method: 'PUT', body });
  setResponseStatus(event, 204);
  return null;
});

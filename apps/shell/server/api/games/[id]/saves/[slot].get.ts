import { slotSchema } from '@croffledev/play-protocol';
import * as v from 'valibot';

export default defineEventHandler((event) => {
  const id = gameIdParam(event);
  const slot = v.parse(slotSchema, getRouterParam(event, 'slot'));
  return apiAsUser(event, `/v1/games/${id}/saves/${slot}`);
});

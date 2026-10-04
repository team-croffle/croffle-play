export default defineEventHandler(() => proxied(() => usePlatformApi().listGames()));

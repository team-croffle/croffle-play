export default defineEventHandler((event) => {
  const { csp, siteUrl } = useRuntimeConfig();
  setResponseHeaders(event, {
    ...securityHeaders,
    'Content-Security-Policy': buildCsp(csp, import.meta.dev),
    // HTTPS only from now on (also for api./rooms. below the platform host).
    ...(siteUrl.startsWith('https://')
      ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }
      : {}),
  });
});

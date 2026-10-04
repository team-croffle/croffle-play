export default defineEventHandler((event) => {
  const { csp } = useRuntimeConfig();
  setResponseHeaders(event, {
    ...securityHeaders,
    'Content-Security-Policy': buildCsp(csp, import.meta.dev),
  });
});

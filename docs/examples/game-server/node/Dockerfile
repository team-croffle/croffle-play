FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
# The platform runs game servers read-only as uid 10001 with no capabilities.
USER 10001:10001
EXPOSE 8080
CMD ["node", "server.mjs"]

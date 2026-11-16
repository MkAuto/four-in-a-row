# Stage 1: run the tests and build the game into /app/dist
FROM docker.io/library/node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm test && npm run build

# Stage 2: serve the built files with Caddy, as an unprivileged user
FROM docker.io/library/caddy:2-alpine
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
USER nobody
EXPOSE 8080

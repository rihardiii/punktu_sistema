# syntax=docker/dockerfile:1

# ---- build stage -----------------------------------------------------------
# Builds the web bundle and compiles the server. Dev dependencies (TypeScript,
# Vite, React types) live only here and never reach the running image.
FROM node:24-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 ships prebuilt binaries for linux/amd64 and linux/arm64 but
# falls back to compiling with node-gyp when there is no match; these make that
# fallback work instead of failing the build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Manifests first, so npm ci stays cached until a dependency actually changes.
# Editing a .tsx file should not re-download node_modules.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# --foreground-scripts surfaces better-sqlite3's native build in the log.
# npm 11 gates lifecycle scripts; the root package.json's "allowScripts"
# entry is what permits this one to run.
RUN npm ci --foreground-scripts

COPY . .
RUN npm run build


# ---- runtime stage ---------------------------------------------------------
FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=4173 \
    HOST=0.0.0.0 \
    PUNKTI_DB=/data/punkti.sqlite

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/

# Production dependencies only. Build toolchain is installed and removed inside
# one layer so it is not carried in the final image. This installs the web
# workspace's runtime deps too (React) even though only its built bundle is
# served — a few MB, in exchange for not depending on workspace-filtered
# installs, which are easier to get subtly wrong.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev --foreground-scripts \
 && npm cache clean --force \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The database lives on a mounted volume, never inside the image, so pulling a
# newer version of the app never touches the family's points.
VOLUME ["/data"]
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4173)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/dist/index.js"]

# Web{X} Finance: one container serves the API and the built React app.
# Not tested on this machine (Docker isn't installed here); see README → Deploy.

# ── Build: install everything, build the client ───────────────
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# ── Runtime: production dependencies + headless Chrome for PDFs ──
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=5050 \
    PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

# Libraries Chrome needs, plus Noto fonts so ₹ and other symbols render in PDFs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-noto-core fonts-noto-color-emoji \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 \
      libnss3 libpango-1.0-0 libx11-xcb1 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev && npx --yes puppeteer browsers install chrome
COPY shared shared
COPY server server
COPY --from=build /app/client/dist client/dist

RUN useradd --create-home webx && mkdir -p server/uploads && chown -R webx:webx /app
USER webx
# Uploaded logos, bills, proofs and documents live here: mount a persistent disk.
VOLUME ["/app/server/uploads"]
EXPOSE 5050
CMD ["node", "server/src/server.js"]

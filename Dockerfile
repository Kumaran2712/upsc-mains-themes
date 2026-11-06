FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY astro.config.mjs ./
COPY src ./src
COPY public ./public
COPY data/prelims.json ./data/prelims.json
ARG SITE_URL=https://upscthemes.live
ARG PUBLIC_STAGE0_API_URL=/api
ENV SITE_URL=$SITE_URL PUBLIC_STAGE0_API_URL=$PUBLIC_STAGE0_API_URL
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 SERVE_STATIC=true DATABASE_PATH=/data/stage0.sqlite
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node backend ./backend
COPY --chown=node:node src/lib/stage0 ./src/lib/stage0
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "backend/entrypoint.mjs"]

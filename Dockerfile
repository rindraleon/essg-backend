FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder

WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV APP_PORT=3000

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/main.js"]

FROM node:24-bookworm-slim AS base

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["node", "--env-file-if-exists=.env", "server/index.js"]

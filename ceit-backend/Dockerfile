# Production image for ceit-backend (Express API).
# Deploy on Railway, Render, Fly.io, etc., then point the Vercel viewer's BACKEND_URL here.

FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY public ./public
RUN mkdir -p uploads
EXPOSE 3000
CMD ["node", "dist/index.js"]

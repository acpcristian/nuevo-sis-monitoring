FROM node:22-alpine

RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependencias (con cache por capa)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN corepack enable && corepack prepare pnpm@12.11.2 --activate \
  && pnpm install --frozen-lockfile

# Build de la app
COPY . .
RUN pnpm prisma generate --schema=src/infrastructure/db/schema.prisma \
  && pnpm build

EXPOSE 3000

# Sincroniza esquema Prisma con la base y arranca Next.js
CMD ["sh", "-c", "pnpm prisma db push --skip-generate --schema=src/infrastructure/db/schema.prisma && node node_modules/next/dist/bin/next start -p 3000"]

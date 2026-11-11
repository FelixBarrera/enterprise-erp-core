# syntax=docker/dockerfile:1
#
# Imagen de la API. Se construye desde la raíz del proyecto:
#   docker build -f despliegue/api/Dockerfile --target api      -t base-api .
#   docker build -f despliegue/api/Dockerfile --target migrador -t base-migrador .
#
# Dos imágenes de la misma receta:
# - `api`: solo lo compilado (`dist/`) y las dependencias de producción, sin el código fuente.
#   La usan todos los clientes; cada uno le pasa su propio .env. También corre los `admin:*`.
# - `migrador`: prepara las tablas (`prisma migrate deploy`) con el usuario dueño de la base y
#   termina. Lleva las herramientas de desarrollo (Prisma CLI), por eso va aparte.

ARG IMAGEN_NODE=node:24.21.0-bookworm-slim

# ─── Común: Node con pnpm (por corepack, con la versión del package.json raíz) ───
FROM ${IMAGEN_NODE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
# OpenSSL antes de instalar: Prisma elige con él qué motor de migraciones baja (sin OpenSSL,
# avisa y baja uno que adivina). Va solo en las etapas de construcción y en el migrador; la
# imagen `api` sale de otra base y no lo necesita.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# ─── Todas las dependencias y el cliente de Prisma generado ───
FROM base AS dependencias
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/base-backend/package.json apps/base-backend/prisma.config.ts apps/base-backend/
COPY apps/base-backend/prisma apps/base-backend/prisma
# Prisma mira el tsconfig.json para elegir cómo escribe los imports del cliente (`.js`, lo que
# pide Node); sin él, los escribe con `.ts` y la API no arranca.
COPY apps/base-backend/tsconfig.json apps/base-backend/
# `prisma generate` (postinstall) lee prisma.config.ts, que pide una DATABASE_URL: no se conecta,
# así que basta una de mentira, solo para construir.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    DATABASE_URL=postgresql://construir@localhost/construir \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --filter base-backend

# ─── Compilar ───
FROM dependencias AS construccion
COPY apps/base-backend/tsconfig.json apps/base-backend/tsconfig.build.json apps/base-backend/nest-cli.json apps/base-backend/
COPY apps/base-backend/src apps/base-backend/src
RUN pnpm --filter base-backend build

# ─── Solo las dependencias de producción ───
# Sin scripts: el cliente de Prisma ya está compilado dentro de dist/ y nada más se instala con uno.
FROM base AS dependencias-produccion
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/base-backend/package.json apps/base-backend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --store-dir /pnpm-store --filter base-backend

# ─── Imagen `migrador` ───
FROM dependencias AS migrador
WORKDIR /app/apps/base-backend
USER node
# DATABASE_URL: la del usuario dueño de las tablas (no la de la API). Ver despliegue/README.md.
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ─── Imagen `api` ───
FROM ${IMAGEN_NODE} AS api
ENV NODE_ENV=production
WORKDIR /app/apps/base-backend
# Los archivos quedan del administrador del sistema (root) y la API corre como `node`: no puede
# cambiar su propio código.
COPY --from=dependencias-produccion /app/node_modules /app/node_modules
COPY --from=dependencias-produccion /app/apps/base-backend/node_modules ./node_modules
COPY --from=construccion /app/apps/base-backend/dist ./dist
COPY apps/base-backend/package.json ./
USER node
EXPOSE 3000
# Docker la marca `healthy` cuando /health responde 200 (la base contesta).
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "dist/main.js"]

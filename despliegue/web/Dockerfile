# syntax=docker/dockerfile:1
#
# Imagen de Nginx con las pantallas ya compiladas. Una sola para todos los clientes: cada uno
# entra por su subdominio y Nginx pasa su /api a la copia de la API de ese cliente.
# Se construye desde la raíz del proyecto:
#   docker build -f despliegue/web/Dockerfile -t base-web .

ARG IMAGEN_NODE=node:24.21.0-bookworm-slim
ARG IMAGEN_NGINX=nginx:1.30.0-alpine

# ─── Compilar las pantallas ───
FROM ${IMAGEN_NODE} AS construccion
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/base-frontend/package.json apps/base-frontend/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --filter base-frontend
COPY apps/base-frontend apps/base-frontend
RUN pnpm --filter base-frontend build

# ─── Nginx ───
FROM ${IMAGEN_NGINX} AS web
RUN rm /etc/nginx/conf.d/default.conf \
 && mkdir -p /etc/nginx/sitios /var/www/acme
COPY despliegue/web/nginx.conf /etc/nginx/nginx.conf
COPY despliegue/web/fragmentos /etc/nginx/fragmentos
COPY --from=construccion /app/apps/base-frontend/dist/base-frontend/browser /usr/share/nginx/aplicacion
# Los sitios de cada cliente (/etc/nginx/sitios), los certificados (/etc/letsencrypt) y la
# carpeta de Let's Encrypt (/var/www/acme) llegan como volúmenes: ver despliegue/compose.yml.
EXPOSE 80 443

#!/usr/bin/env bash
# Construye las tres imágenes con el código que hay en la carpeta (la versión es el commit) y
# las marca también como `latest`, la que usan los servicios.
#
#   despliegue/scripts/construir-imagenes.sh
#
# Avisa si hay cambios sin commitear: la imagen llevaría código que no está en ningún commit.

source "$(dirname "$0")/comun.sh"

version="$(version_del_codigo)"
if [[ -n "$(git -C "$RAIZ" status --porcelain -- apps despliegue/api despliegue/web)" ]]; then
  aviso "Hay cambios sin commitear en apps/ o despliegue/: la versión $version no los describe."
fi

cd "$RAIZ"
for destino in api migrador; do
  info "base-$destino:$version"
  docker build -q -f despliegue/api/Dockerfile --target "$destino" \
    --label "org.opencontainers.image.version=$version" \
    -t "base-$destino:$version" -t "base-$destino:latest" . >/dev/null
done
info "base-web:$version"
docker build -q -f despliegue/web/Dockerfile --label "org.opencontainers.image.version=$version" \
  -t "base-web:$version" -t base-web:latest . >/dev/null
info "Imágenes listas (versión $version)."

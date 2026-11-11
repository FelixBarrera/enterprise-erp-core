#!/usr/bin/env bash
# Pone el código nuevo en todos los clientes: construye las imágenes y, cliente por cliente,
# respalda su base, prepara sus tablas (migraciones) y reinicia su API. Al final, las
# pantallas (Nginx). Mejor fuera del horario de trabajo: cada API se corta unos segundos.
#
#   git pull                                   # el código nuevo, en la raíz del proyecto
#   despliegue/scripts/actualizar.sh           # todos los clientes
#   despliegue/scripts/actualizar.sh cliente1  # solo uno (para probar primero con uno)
#
# Opción: --sin-construir  usa las imágenes `latest` que ya están (construidas antes).
#
# Si un cliente falla, se detiene ahí: los que siguen se quedan con la versión anterior y
# funcionando. Las migraciones no se deshacen: si hay que volver atrás, se restaura el
# respaldo que este script hizo justo antes (despliegue/README.md).

source "$(dirname "$0")/comun.sh"
cargar_env_servidor
[[ "${VERSION:-latest}" == latest ]] ||
  fallar "despliegue/.env tiene VERSION=$VERSION (una versión fija, de una vuelta atrás): póngala en latest para actualizar."

construir=si
todos=si
clientes=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sin-construir) construir=no; shift ;;
    -*) fallar "Opción desconocida: $1 (ver el comienzo de este script)" ;;
    *) validar_cliente "$1"; clientes+=("$1"); todos=no; shift ;;
  esac
done
[[ ${#clientes[@]} -gt 0 ]] || mapfile -t clientes < <(clientes_instalados)
[[ ${#clientes[@]} -gt 0 ]] || fallar "No hay clientes instalados."
for cliente in "${clientes[@]}"; do
  [[ -f "clientes/$cliente/api.env" ]] || fallar "«$cliente» no está instalado (falta clientes/$cliente/api.env)."
done

if [[ "$construir" == si ]]; then
  paso "Construyendo las imágenes"
  "$DESPLIEGUE/scripts/construir-imagenes.sh"
fi

total=${#clientes[@]}
n=0
for cliente in "${clientes[@]}"; do
  n=$((n + 1))
  paso "[$n/$total] «$cliente»"
  "$DESPLIEGUE/scripts/respaldar.sh" "$cliente" </dev/null ||
    fallar "Sin respaldo no se migra. «$cliente» y los que siguen quedaron como estaban."
  info "Migraciones"
  migrar_cliente "$cliente" ||
    fallar "Falló la migración de «$cliente»: su API sigue con la versión anterior; los que siguen, sin tocar."
  info "Reiniciando $cliente-api con la imagen nueva"
  cliente_compose "$cliente" up -d api
  esperar_sano "$cliente-api" ||
    fallar "«$cliente» no arrancó con la versión nueva. Los que siguen, sin tocar."
done

# Las pantallas, al final: son las mismas para todos y ya hablan con las API nuevas.
# Una actualización parcial (solo algunos clientes) no las cambia.
if [[ "$todos" == si ]]; then
  paso "Pantallas (Nginx)"
  servicios up -d --wait web
else
  aviso "Solo se actualizaron algunos clientes: las pantallas siguen en la versión anterior."
fi

paso "Actualización lista (versión $(version_de_imagen base-api:latest))"

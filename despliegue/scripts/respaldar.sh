#!/usr/bin/env bash
# Respaldo de la base de cada cliente (o solo de los que se nombran), en
# despliegue/respaldos/<cliente>/<cliente>-<fecha>.dump, y borra los de más de DIAS_RESPALDO
# días (despliegue/.env; por defecto 30).
#
#   despliegue/scripts/respaldar.sh             # todos los clientes
#   despliegue/scripts/respaldar.sh cliente1    # solo uno
#
# Cada respaldo se comprueba (que se pueda leer entero) antes de darlo por bueno. Sale con
# error si alguno falló, para que el cron lo avise; los demás clientes se respaldan igual.
# Para el cron (todos los días de madrugada), ver docs/despliegue.md, sección 9.
#
# Los respaldos quedan en este mismo servidor: copiarlos a otro lado es parte de la guía
# (docs/despliegue.md). Restaurar: despliegue/README.md, «Restaurar un respaldo».

source "$(dirname "$0")/comun.sh"
cargar_env_servidor

if [[ $# -gt 0 ]]; then
  clientes=("$@")
else
  mapfile -t clientes < <(clientes_instalados)
fi
[[ ${#clientes[@]} -gt 0 ]] || fallar "No hay clientes instalados."

fecha="$(date +%Y%m%d-%H%M%S)"
fallidos=()
for cliente in "${clientes[@]}"; do
  validar_cliente "$cliente"
  paso "Respaldo de «$cliente»"
  carpeta="respaldos/$cliente"
  archivo="$carpeta/$cliente-$fecha.dump"
  mkdir -p "$carpeta"
  # Formato propio de PostgreSQL (comprimido; se restaura con pg_restore). Lleva los dueños y
  # los permisos, así la base restaurada queda igual de cerrada.
  if servicios exec -T postgres pg_dump -U "$POSTGRES_USUARIO" -Fc -d "$cliente" </dev/null >"$archivo.parcial" &&
    servicios exec -T postgres pg_restore --list <"$archivo.parcial" >/dev/null; then
    mv "$archivo.parcial" "$archivo"
    info "$archivo ($(du -h "$archivo" | cut -f1))"
  else
    rm -f "$archivo.parcial"
    aviso "No se pudo respaldar «$cliente»."
    fallidos+=("$cliente")
    continue
  fi
  # Los viejos, solo si este salió bien (nunca quedarse sin ninguno).
  find "$carpeta" -name "$cliente-*.dump" -mtime "+$DIAS_RESPALDO" -print -delete | sed 's/^/  borrado: /'
done

if [[ ${#fallidos[@]} -gt 0 ]]; then
  fallar "Fallaron: ${fallidos[*]}"
fi
paso "Respaldos listos"

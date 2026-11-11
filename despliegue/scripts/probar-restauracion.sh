#!/usr/bin/env bash
# Prueba que los respaldos sirven: restaura el último de cada cliente (o de los que se nombran)
# en una base aparte, revisa que esté completo y la borra. La base del cliente no se toca.
#
#   despliegue/scripts/probar-restauracion.sh                   # los respaldos de este servidor
#   despliegue/scripts/probar-restauracion.sh --copia-externa   # los de la copia fuera del servidor
#   despliegue/scripts/probar-restauracion.sh cliente1          # solo uno
#
# Revisa: que se restaure sin errores, que tenga las migraciones (todas terminadas, y no más
# que la base del cliente), al menos una empresa y un usuario, que la API siga sin poder
# cambiar la bitácora y que el respaldo sea de los últimos 2 días (si no, el cron no está
# respaldando). Con --copia-externa, además, que la copia traiga el .env de cada cliente.
# Sale con error si algo falla, para que el cron lo avise. Para el cron (una vez al mes), ver
# docs/despliegue.md, sección 9.

source "$(dirname "$0")/comun.sh"
cargar_env_servidor

copia_externa=no
clientes=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --copia-externa) copia_externa=si; shift ;;
    -*) fallar "Opción desconocida: $1 (ver el comienzo de este script)" ;;
    *) validar_cliente "$1"; clientes+=("$1"); shift ;;
  esac
done
[[ ${#clientes[@]} -gt 0 ]] || mapfile -t clientes < <(clientes_instalados)
[[ ${#clientes[@]} -gt 0 ]] || fallar "No hay clientes instalados."

origen="respaldos"
traido="copia-externa/traido/latest"
base_de_prueba=''
limpiar() {
  # Si el script se cortó a mitad de una restauración, no dejar la base de prueba.
  [[ -n "$base_de_prueba" ]] &&
    servicios exec -T postgres dropdb -U "$POSTGRES_USUARIO" --if-exists --force "$base_de_prueba" </dev/null 2>/dev/null
  [[ "$copia_externa" == si ]] && rm -rf "$traido"
  return 0
}
trap limpiar EXIT

if [[ "$copia_externa" == si ]]; then
  rm -rf "$traido"
  "$DESPLIEGUE/scripts/copia-externa.sh" traer latest
  origen="$traido/despliegue/respaldos"
  [[ -s "$traido/despliegue/.env" ]] || fallar "La copia externa no trae despliegue/.env."
fi

fallidos=()
falla() {
  aviso "$1"
  fallidos+=("$cliente")
}

for cliente in "${clientes[@]}"; do
  paso "Restaurando «$cliente» en una base aparte"
  if [[ "$copia_externa" == si && ! -s "$traido/despliegue/clientes/$cliente/api.env" ]]; then
    falla "La copia externa no trae clientes/$cliente/api.env."
  fi
  respaldo="$(find "$origen/$cliente" -maxdepth 1 -name "$cliente-*.dump" -printf '%T@ %p\n' 2>/dev/null |
    sort -n | tail -1 | cut -d' ' -f2- || true)"
  if [[ -z "$respaldo" ]]; then
    falla "No hay respaldos de «$cliente» en $origen/$cliente/."
    continue
  fi
  info "$respaldo"
  if [[ -n "$(find "$respaldo" -mtime +1)" ]]; then
    falla "El último respaldo tiene más de 2 días: ¿corre el cron de respaldar.sh?"
  fi

  # Sin guion bajo no puede haber un cliente con este nombre (validar_cliente).
  base_de_prueba="restauracion_$cliente"
  if [[ -n "$(psql_consulta postgres "SELECT 1 FROM pg_database WHERE datname = '$base_de_prueba'")" ]]; then
    servicios exec -T postgres dropdb -U "$POSTGRES_USUARIO" --force "$base_de_prueba" </dev/null
  fi
  servicios exec -T postgres createdb -U "$POSTGRES_USUARIO" -O "${cliente}_dueno" "$base_de_prueba" </dev/null
  if ! servicios exec -T postgres pg_restore -U "$POSTGRES_USUARIO" -d "$base_de_prueba" --exit-on-error <"$respaldo"; then
    falla "No se pudo restaurar el respaldo de «$cliente»."
  else
    migraciones="$(psql_consulta "$base_de_prueba" 'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
    sin_terminar="$(psql_consulta "$base_de_prueba" 'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL')"
    en_uso="$(psql_consulta "$cliente" 'SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
    empresas="$(psql_consulta "$base_de_prueba" 'SELECT count(*) FROM organizacion.empresas')"
    usuarios="$(psql_consulta "$base_de_prueba" 'SELECT count(*) FROM seguridad.usuarios')"
    eventos="$(psql_consulta "$base_de_prueba" 'SELECT count(*) FROM auditoria.eventos')"
    cambia_bitacora="$(psql_consulta "$base_de_prueba" "SELECT has_table_privilege('${cliente}_app', 'auditoria.eventos', 'UPDATE') OR has_table_privilege('${cliente}_app', 'auditoria.eventos', 'DELETE')")"
    info "$migraciones migraciones (la base en uso tiene $en_uso), $empresas empresas, $usuarios usuarios, $eventos eventos en la bitácora"
    [[ "$migraciones" -gt 0 && "$sin_terminar" -eq 0 ]] || falla "Migraciones incompletas en el respaldo."
    [[ "$migraciones" -le "$en_uso" ]] || falla "El respaldo tiene más migraciones que la base en uso."
    [[ "$empresas" -gt 0 && "$usuarios" -gt 0 ]] || falla "El respaldo no tiene empresas o usuarios."
    [[ "$cambia_bitacora" == f ]] || falla "Restaurada, la API podría cambiar la bitácora."
    # La zona no viaja en el respaldo (la pone fijar_zona_base): se revisa en la base en uso.
    zona_esperada="$(zona_del_cliente "$cliente")"
    zona_en_uso="$(psql_consulta "$cliente" 'SHOW timezone')"
    [[ "$zona_en_uso" == "$zona_esperada" ]] ||
      falla "La base en uso muestra la hora de $zona_en_uso y su API usa $zona_esperada: scripts/actualizar.sh $cliente la corrige."
  fi
  servicios exec -T postgres dropdb -U "$POSTGRES_USUARIO" --force "$base_de_prueba" </dev/null
  base_de_prueba=''
done

if [[ ${#fallidos[@]} -gt 0 ]]; then
  fallar "Prueba de restauración con problemas en: $(printf '%s\n' "${fallidos[@]}" | sort -u | xargs)"
fi
paso "Los respaldos se restauran bien"

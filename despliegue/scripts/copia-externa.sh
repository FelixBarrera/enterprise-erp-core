#!/usr/bin/env bash
# Copia cifrada fuera del servidor (restic): el último respaldo de cada cliente y lo que hace
# falta para volver a levantar todo en otro servidor (despliegue/.env, clientes/ y sitios/).
# Guarda la última copia de cada día por COPIA_DIARIAS días (30) y la última de cada mes por
# COPIA_MENSUALES meses (84 = 7 años).
#
#   despliegue/scripts/copia-externa.sh iniciar          # una vez: crea el destino y la clave
#   despliegue/scripts/copia-externa.sh copiar           # el cron, después de respaldar.sh
#   despliegue/scripts/copia-externa.sh listar           # qué copias hay
#   despliegue/scripts/copia-externa.sh traer [<copia>]  # la trae a copia-externa/traido/<copia>/
#
# Configuración en despliegue/copia-externa/ (no se sube): destino.env (adónde y con qué
# usuario; ejemplo en copia-externa.env.example) y clave (la contraseña con que se cifra).
# **Sin la clave no se puede leer ninguna copia**: guárdela también fuera del servidor.
# Detalle en docs/despliegue.md, «Copia fuera del servidor».

source "$(dirname "$0")/comun.sh"

orden="${1:-copiar}"
[[ $# -gt 0 ]] && shift

if [[ -f .env ]]; then
  cargar_env_servidor
elif [[ "$orden" == traer || "$orden" == listar ]]; then
  # Un servidor nuevo, que todavía no tiene su .env porque viene en la copia. Solo para que
  # Docker pueda leer compose.yml; no se levanta ningún servicio.
  export POSTGRES_CONTRASENA=sin-servidor REDIS_CONTRASENA=sin-servidor
else
  cargar_env_servidor
fi

CONFIG="copia-externa"
[[ -f "$CONFIG/destino.env" ]] ||
  fallar "Falta $CONFIG/destino.env: cópielo de copia-externa.env.example y complételo (docs/despliegue.md)."
set -a
# shellcheck disable=SC1091
source "$CONFIG/destino.env"
set +a
[[ -n "${RESTIC_REPOSITORY:-}" ]] || fallar "Falta RESTIC_REPOSITORY en $CONFIG/destino.env."
COPIA_DIARIAS="${COPIA_DIARIAS:-30}"
COPIA_MENSUALES="${COPIA_MENSUALES:-84}"
# La carpeta del servidor que restic ve como /destino (solo si el destino es una carpeta).
export COPIA_EXTERNA_CARPETA="${COPIA_EXTERNA_CARPETA:-./$CONFIG/carpeta}"
# Si no existen, Docker las crearía a nombre del administrador.
mkdir -p "$CONFIG/traido" "$CONFIG/carpeta"
# La de un disco externo no se crea: si el disco no está montado, Docker la crearía en el disco
# del servidor y la copia «externa» quedaría en el mismo disco.
if [[ "$RESTIC_REPOSITORY" == /destino* && ! -d "$COPIA_EXTERNA_CARPETA" ]]; then
  fallar "No existe $COPIA_EXTERNA_CARPETA: ¿está montado el disco? (créela en el disco la primera vez)."
fi

# restic dentro de su contenedor (servicio restic de compose.yml). Con otro servidor por ssh,
# usa la llave y los servidores conocidos de copia-externa/ssh/.
opciones_restic=()
if [[ "$RESTIC_REPOSITORY" == sftp:* ]]; then
  [[ -f "$CONFIG/ssh/id_ed25519" && -f "$CONFIG/ssh/known_hosts" ]] ||
    fallar "Falta $CONFIG/ssh/id_ed25519 o known_hosts (docs/despliegue.md, «Otro servidor por ssh»)."
  opciones_restic=(-o "sftp.args=-i /despliegue/copia-externa/ssh/id_ed25519 -o UserKnownHostsFile=/despliegue/copia-externa/ssh/known_hosts -o BatchMode=yes")
fi
restic() { servicios --progress quiet --profile copias run --rm -T restic "${opciones_restic[@]}" "$@" </dev/null; }

hay_clave() { [[ -s "$CONFIG/clave" ]]; }

case "$orden" in
  iniciar)
    if ! hay_clave; then
      paso "Creando la clave con que se cifran las copias"
      contrasena_al_azar 48 >"$CONFIG/clave"
      chmod 600 "$CONFIG/clave"
      printf '\n  \033[1m%s\033[0m\n\n' "$(cat "$CONFIG/clave")"
      aviso "Guárdela YA en un gestor de contraseñas, fuera del servidor, junto con destino.env."
      aviso "Si se pierde el servidor y esta clave, las copias no se pueden leer."
    fi
    paso "Preparando el destino $RESTIC_REPOSITORY"
    if restic cat config >/dev/null 2>&1; then
      info "El destino ya estaba preparado (con esta clave): no se cambia nada."
    else
      restic init
    fi
    paso "Listo"
    info "Siguiente: despliegue/scripts/copia-externa.sh copiar (y el cron de docs/despliegue.md)."
    ;;

  copiar)
    hay_clave || fallar "Falta $CONFIG/clave: corra primero copia-externa.sh iniciar."
    paso "Eligiendo el último respaldo de cada cliente"
    rutas=(/despliegue/.env /despliegue/clientes /despliegue/sitios)
    sin_respaldo=()
    while IFS= read -r cliente; do
      ultimo="$(find "respaldos/$cliente" -maxdepth 1 -name "$cliente-*.dump" -printf '%T@ %f\n' 2>/dev/null |
        sort -n | tail -1 | cut -d" " -f2 || true)"
      if [[ -z "$ultimo" ]]; then
        aviso "«$cliente» no tiene respaldos en respaldos/$cliente/."
        sin_respaldo+=("$cliente")
        continue
      fi
      info "$cliente: $ultimo"
      rutas+=("/despliegue/respaldos/$cliente/$ultimo")
    done < <(clientes_instalados)

    paso "Copiando a $RESTIC_REPOSITORY (cifrado)"
    restic backup --tag erp --exclude /despliegue/clientes/ejemplo "${rutas[@]}"

    paso "Borrando las copias viejas (quedan $COPIA_DIARIAS diarias y $COPIA_MENSUALES mensuales)"
    # Cada día la copia lleva otros archivos (el respaldo nuevo): agruparlas por servidor y
    # etiqueta, no por archivos, para que cuenten como una sola serie.
    restic forget --tag erp --group-by host,tags \
      --keep-daily "$COPIA_DIARIAS" --keep-monthly "$COPIA_MENSUALES" --prune

    paso "Comprobando el destino"
    restic check

    [[ ${#sin_respaldo[@]} -eq 0 ]] || fallar "Copiado sin el respaldo de: ${sin_respaldo[*]}"
    paso "Copia externa lista"
    ;;

  listar)
    restic snapshots --tag erp
    ;;

  traer)
    copia="${1:-latest}"
    [[ "$copia" =~ ^[a-z0-9]+$ ]] || fallar "«$copia» no es una copia (ver copia-externa.sh listar)."
    destino="$CONFIG/traido/$copia"
    [[ ! -e "$destino" ]] || fallar "Ya existe $destino: bórrelo o muévalo antes."
    paso "Trayendo la copia «$copia» a $destino"
    # restic corre como administrador del contenedor: al terminar, los archivos quedan del
    # usuario de este servidor (y solo él los lee).
    # shellcheck disable=SC2016  # las variables se leen dentro del contenedor
    servicios --progress quiet --profile copias run --rm -T -e DUENO="$(id -u):$(id -g)" -e COPIA="$copia" \
      --entrypoint sh restic -c \
      'restic "$@" && chown -R "$DUENO" "/traido/$COPIA" && chmod -R go-rwx "/traido/$COPIA"' sh \
      "${opciones_restic[@]}" restore "$copia" --target "/traido/$copia" </dev/null
    info "Listo: $destino/despliegue/ (.env, clientes/, sitios/ y respaldos/)."
    info "Restaurar una base: despliegue/README.md, «Restaurar un respaldo». Al terminar, borre $destino."
    ;;

  *)
    fallar "Orden desconocida: $orden (iniciar, copiar, listar o traer)."
    ;;
esac

#!/usr/bin/env bash
# Vuelve a levantar un cliente desde su respaldo en un servidor que no lo tiene (porque el de
# antes se perdió): con su .env de siempre (sus contraseñas y su JWT_SECRETO), su base con los
# mismos usuarios, su API, su certificado y su sitio. Los pasos completos, con la copia externa,
# en docs/despliegue.md, «Si se pierde el servidor».
#
#   despliegue/scripts/recuperar-cliente.sh cliente1
#
# Necesita, ya en su lugar (los trae scripts/copia-externa.sh traer):
#   clientes/<cliente>/   su api.env, migrador.env y dominio
#   respaldos/<cliente>/  su respaldo (se usa el más nuevo; otro: --respaldo <archivo>)
#
# Opciones:
#   --respaldo <archivo>       otro respaldo que el más nuevo
#   --certificado-de-prueba    un certificado hecho aquí, sin Let's Encrypt (solo en una PC)
#
# No sirve para reemplazar la base de un cliente que sigue funcionando: para eso,
# despliegue/README.md, «Restaurar un respaldo».

source "$(dirname "$0")/comun.sh"

cliente=''
respaldo=''
certificado_de_prueba=no
while [[ $# -gt 0 ]]; do
  case "$1" in
    --respaldo) respaldo="${2:-}"; shift 2 ;;
    --certificado-de-prueba) certificado_de_prueba=si; shift ;;
    -*) fallar "Opción desconocida: $1 (ver el comienzo de este script)" ;;
    *) [[ -z "$cliente" ]] || fallar "Un solo cliente por vez."; cliente="$1"; shift ;;
  esac
done
[[ -n "$cliente" ]] || fallar "Falta el nombre corto del cliente (ej. recuperar-cliente.sh cliente1)."
validar_cliente "$cliente"
cargar_env_servidor

# ─── Antes de tocar nada ───
for archivo in api.env migrador.env dominio; do
  [[ -s "clientes/$cliente/$archivo" ]] ||
    fallar "Falta clientes/$cliente/$archivo (tráigalo de la copia externa: docs/despliegue.md)."
done
dominio="$(<"clientes/$cliente/dominio")"
if [[ -z "$respaldo" ]]; then
  respaldo="$(find "respaldos/$cliente" -maxdepth 1 -name "$cliente-*.dump" -printf '%T@ %p\n' 2>/dev/null |
    sort -n | tail -1 | cut -d' ' -f2- || true)"
fi
[[ -n "$respaldo" && -s "$respaldo" ]] ||
  fallar "No hay respaldo de «$cliente» en respaldos/$cliente/ (o --respaldo <archivo>)."
servicios exec -T postgres pg_restore --list <"$respaldo" >/dev/null ||
  fallar "El respaldo $respaldo no se puede leer."

# Las contraseñas de la base, de su .env (postgresql://usuario:contraseña@…).
clave_de() { sed -n 's|^DATABASE_URL=postgresql://[^:]*:\([^@]*\)@.*|\1|p' "$1"; }
clave_dueno="$(clave_de "clientes/$cliente/migrador.env")"
clave_app="$(clave_de "clientes/$cliente/api.env")"
[[ "$clave_dueno" =~ ^[A-Za-z0-9]+$ && "$clave_app" =~ ^[A-Za-z0-9]+$ ]] ||
  fallar "No se pudieron leer las contraseñas de la base en clientes/$cliente/ (DATABASE_URL)."
grep -q "^REDIS_URL=redis://:$REDIS_CONTRASENA@" "clientes/$cliente/api.env" ||
  fallar "La contraseña de Redis de clientes/$cliente/api.env no es la de despliegue/.env: traiga también el .env de la copia."

corriendo="$(servicios ps --status running --services </dev/null)"
for servicio in postgres redis web; do
  grep -qx "$servicio" <<<"$corriendo" ||
    fallar "El servicio «$servicio» no está corriendo: corra primero scripts/iniciar-servidor.sh."
done
if [[ -n "$(psql_consulta postgres "SELECT 1 FROM pg_database WHERE datname = '$cliente'")" ]]; then
  fallar "Ya hay una base «$cliente» en este servidor: no se toca (ver «Restaurar un respaldo» en despliegue/README.md)."
fi
if [[ -n "$(psql_consulta postgres "SELECT 1 FROM pg_roles WHERE rolname IN ('${cliente}_dueno', '${cliente}_app')")" ]]; then
  fallar "Ya existen los usuarios de «$cliente» en PostgreSQL (¿una recuperación a medias? scripts/baja-cliente.sh $cliente)."
fi
if [[ "$certificado_de_prueba" == no && -z "${CORREO_CERTIFICADOS:-}" ]]; then
  fallar "Falta CORREO_CERTIFICADOS en despliegue/.env (o use --certificado-de-prueba en una PC)."
fi

paso "Recuperar «$cliente» ($dominio) desde $respaldo"
seguir=''
preguntar seguir '¿Seguimos? (s/n)'
[[ "$seguir" == s || "$seguir" == S ]] || fallar "Cancelado: no se hizo ningún cambio."

paso_actual=''
trap '[[ -n "$paso_actual" ]] && aviso "Falló en: $paso_actual. Revise el mensaje de arriba; para empezar de nuevo, scripts/baja-cliente.sh $cliente (sus respaldos se quedan)."' ERR

paso_actual='crear la base y sus usuarios'
paso "1/5 Base «$cliente» y sus usuarios, con las contraseñas de su .env"
crear_base_y_usuarios "$cliente" "$clave_dueno" "$clave_app"
unset clave_dueno clave_app

paso_actual='restaurar el respaldo'
paso "2/5 Restaurando el respaldo"
servicios exec -T postgres pg_restore -U "$POSTGRES_USUARIO" -d "$cliente" --exit-on-error <"$respaldo"
quitar_permisos_tras_migrar "$cliente"
fijar_zona_base "$cliente"

paso_actual='levantar su API'
paso "3/5 Su API ($cliente-api)"
cliente_compose "$cliente" up -d api </dev/null
esperar_sano "$cliente-api"

paso_actual='sacar su certificado'
paso "4/5 Certificado para $dominio"
if [[ -s "certificados/live/$dominio/fullchain.pem" ]]; then
  info "Ya está en certificados/: se usa ese."
else
  sacar_certificado "$dominio" "$certificado_de_prueba"
fi

paso_actual='publicar su sitio'
paso "5/5 Sitio sitios/$cliente.conf"
publicar_sitio "$cliente" "$dominio"
paso_actual=''

origen="https://$dominio"
[[ "$PUERTO_HTTPS" == 443 ]] || origen="$origen:$PUERTO_HTTPS"
cat <<FIN

✅ Cliente «$cliente» recuperado: $origen

   Los datos son los del respaldo ($(basename "$respaldo")): lo que se hizo después se perdió.
   Los usuarios entran con sus contraseñas de siempre.
FIN

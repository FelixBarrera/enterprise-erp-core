# Funciones que usan todos los scripts del servidor. No se corre solo: lo cargan los demás con
#   source "$(dirname "$0")/comun.sh"
# Deja la terminal en la carpeta despliegue/ (donde están compose.yml y cliente.compose.yml).

# -E: el aviso de «falló en…» (trap ERR) también salta dentro de las funciones.
set -Eeuo pipefail
# Los archivos que se crean (contraseñas, respaldos) solo los lee el dueño.
umask 077

DESPLIEGUE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RAIZ="$(cd "$DESPLIEGUE/.." && pwd)"
cd "$DESPLIEGUE"

# ─── Mensajes ───
paso() { printf '\n\033[1m▶ %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
aviso() { printf '\033[33m  ⚠ %s\033[0m\n' "$*" >&2; }
fallar() {
  printf '\033[31m✖ %s\033[0m\n' "$*" >&2
  exit 1
}

# ─── El .env de los servicios comunes ───
cargar_env_servidor() {
  [[ -f .env ]] || fallar "Falta despliegue/.env. Corra primero scripts/iniciar-servidor.sh."
  set -a
  # shellcheck disable=SC1091
  source ./.env
  set +a
  POSTGRES_USUARIO="${POSTGRES_USUARIO:-postgres}"
  PUERTO_HTTPS="${PUERTO_HTTPS:-443}"
  DIAS_RESPALDO="${DIAS_RESPALDO:-30}"
  export POSTGRES_USUARIO PUERTO_HTTPS DIAS_RESPALDO
}

# ─── Contraseñas al azar ───
# Solo letras y números: van dentro de una URL (DATABASE_URL) y no hace falta escaparlas.
# Al cortar `head`, `tr` termina con error (a propósito): con `< <(…) || true` no lo toman por
# una falla ni `pipefail` ni el aviso de «falló en…».
contrasena_al_azar() {
  local largo="${1:-32}" letras="${2:-A-Za-z0-9}"
  head -c "$largo" < <(LC_ALL=C tr -dc "$letras" </dev/urandom 2>/dev/null || true)
}

# ─── Nombre corto de un cliente ───
# Va en el nombre de su base, de sus usuarios y de su contenedor: solo minúsculas y números,
# empezando por una letra (sin guiones ni tildes), de 2 a 30 caracteres.
validar_cliente() {
  local cliente="$1"
  [[ "$cliente" =~ ^[a-z][a-z0-9]{1,29}$ ]] ||
    fallar "«$cliente» no sirve como nombre corto: solo minúsculas y números, empezando por una letra (2 a 30)."
  case "$cliente" in
    postgres | template0 | template1 | ejemplo | servidor | web | redis)
      fallar "«$cliente» es un nombre reservado del servidor: elija otro."
      ;;
  esac
}

# Los clientes instalados: una carpeta en clientes/ con su api.env (sin la de ejemplo).
clientes_instalados() {
  local carpeta
  for carpeta in clientes/*/; do
    carpeta="${carpeta%/}"
    carpeta="${carpeta#clientes/}"
    [[ "$carpeta" == "ejemplo" || ! -f "clientes/$carpeta/api.env" ]] && continue
    printf '%s\n' "$carpeta"
  done
}

# ─── Docker ───
servicios() { docker compose "$@"; }
cliente_compose() {
  local cliente="$1"
  shift
  CLIENTE="$cliente" docker compose -f cliente.compose.yml "$@"
}

# Ojo: `docker compose exec -T` y `run` leen lo que se escribe en la terminal aunque no lo
# necesiten (y se comerían las respuestas a las preguntas del script). Cada llamada que no
# lee nada va con </dev/null.

# psql como administrador del servidor de base de datos (dentro del contenedor, sin contraseña).
# Las órdenes SQL le llegan por la entrada (un heredoc).
psql_admin() {
  servicios exec -T postgres psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USUARIO" "$@"
}

# Una consulta de una línea; devuelve el resultado sin adornos (ej. «1» o nada).
psql_consulta() {
  local base="$1" sql="$2"
  servicios exec -T postgres psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USUARIO" -d "$base" -c "$sql" </dev/null
}

# Nginx: comprobar la configuración y recargarla.
nginx_valida() { servicios exec -T web nginx -t -q </dev/null; }
nginx_recargar() { servicios exec -T web nginx -s reload </dev/null; }

# Let's Encrypt (el servicio certbot de compose.yml).
certbot() { servicios --profile certificados run --rm certbot "$@" </dev/null; }

# Pregunta hasta tener una respuesta y la deja en la variable nombrada. Sin más entrada (fin
# del archivo), termina el script.
preguntar() {
  local variable="$1" pregunta="$2" valor=''
  while [[ -z "$valor" ]]; do
    read -r -p "  $pregunta: " valor || fallar "Sin respuesta: no se hizo ningún cambio más."
    valor="$(printf '%s' "$valor" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
  done
  printf -v "$variable" '%s' "$valor"
}

# Espera a que un contenedor quede `healthy` (hasta 2 minutos).
esperar_sano() {
  local contenedor="$1" estado
  for _ in $(seq 1 60); do
    estado="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$contenedor" 2>/dev/null || echo 'no existe')"
    [[ "$estado" == "healthy" ]] && return 0
    [[ "$estado" == "unhealthy" || "$estado" == "exited" ]] && break
    sleep 2
  done
  aviso "$contenedor no quedó en funcionamiento (estado: $estado). Últimas líneas de su log:"
  docker logs --tail 30 "$contenedor" >&2 || true
  return 1
}

# ─── La base de un cliente ───
# Sus dos usuarios (<cliente>_dueno prepara las tablas; <cliente>_app es la API) y su base,
# todavía vacía. Las contraseñas llegan como argumentos (nunca en la línea de órdenes de psql).
crear_base_y_usuarios() {
  local cliente="$1" clave_dueno="$2" clave_app="$3"
  psql_admin -d postgres <<SQL
CREATE ROLE ${cliente}_dueno LOGIN PASSWORD '$clave_dueno';
CREATE ROLE ${cliente}_app LOGIN PASSWORD '$clave_app';
CREATE DATABASE $cliente OWNER ${cliente}_dueno;
SQL
  cerrar_base "$cliente"
}

# Solo sus dos usuarios entran a su base. Va aparte porque no viaja en los respaldos: después
# de crear la base para restaurar uno, hay que repetirlo (createdb la deja abierta a todos).
cerrar_base() {
  local cliente="$1"
  psql_admin -d postgres <<SQL
REVOKE ALL ON DATABASE $cliente FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE $cliente TO ${cliente}_dueno, ${cliente}_app;
SQL
}

# Lo que se hace una vez en una base nueva antes de la primera migración (un respaldo ya lo
# trae y no hace falta).
preparar_esquema() {
  local cliente="$1"
  psql_admin -d "$cliente" <<SQL
ALTER SCHEMA public OWNER TO ${cliente}_dueno;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT USAGE ON SCHEMA public TO ${cliente}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${cliente}_dueno GRANT USAGE ON SCHEMAS TO ${cliente}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${cliente}_dueno GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${cliente}_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${cliente}_dueno GRANT USAGE, SELECT ON SEQUENCES TO ${cliente}_app;
SQL
}

# ─── El certificado y el sitio de un cliente ───
# Let's Encrypt (o, con «si» en el tercer argumento, uno hecho aquí para probar en una PC).
sacar_certificado() {
  local dominio="$1" de_prueba="$2"
  if [[ "$de_prueba" == si ]]; then
    mkdir -p "certificados/live/$dominio"
    openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=$dominio" \
      -addext "subjectAltName=DNS:$dominio" \
      -keyout "certificados/live/$dominio/privkey.pem" \
      -out "certificados/live/$dominio/fullchain.pem" 2>/dev/null
    info "Certificado de prueba (el navegador avisará que no es de confianza)."
  else
    # Let's Encrypt comprueba que el subdominio apunta aquí pidiendo un archivo por HTTP: Nginx
    # ya lo sirve desde acme/ aunque el cliente aún no tenga su sitio.
    certbot certonly --webroot -w /var/www/acme \
      -d "$dominio" --email "$CORREO_CERTIFICADOS" --agree-tos --no-eff-email --non-interactive
  fi
}

# sitios/<cliente>.conf desde la plantilla y recarga Nginx. Si Nginx lo rechaza, lo quita (los
# demás clientes siguen igual) y termina con error.
publicar_sitio() {
  local cliente="$1" dominio="$2"
  sed -e "s/__DOMINIO__/$dominio/g" -e "s/__CLIENTE__/$cliente/g" web/sitio.conf.plantilla >"sitios/$cliente.conf"
  chmod 644 "sitios/$cliente.conf"
  if ! nginx_valida; then
    rm -f "sitios/$cliente.conf"
    fallar "Nginx rechazó el sitio; se quitó sitios/$cliente.conf y los demás clientes siguen igual."
  fi
  nginx_recargar
}

# Lo que hay que repetir después de cada migración: los permisos que la API (<cliente>_app) no
# debe tener sobre las tablas nuevas (docs: despliegue/README.md).
quitar_permisos_tras_migrar() {
  local cliente="$1"
  psql_admin -d "$cliente" <<SQL
REVOKE ALL ON public._prisma_migrations FROM ${cliente}_app;
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA auditoria FROM ${cliente}_app;
SQL
}

# ─── La zona del negocio en la base de un cliente ───
# Una zona de la base de datos de husos horarios (America/Guayaquil, Europe/Madrid, UTC): letras,
# números, «_», «+», «-» y «/». Va dentro de una orden SQL, por eso se revisa antes.
validar_zona() {
  local zona="$1"
  [[ "$zona" =~ ^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$ ]] ||
    fallar "«$zona» no es una zona horaria válida (ej. America/Guayaquil)."
}

# La de su api.env (la que usa su API).
zona_del_cliente() {
  local cliente="$1" zona
  zona="$(grep -E '^ZONA_NEGOCIO=' "clientes/$cliente/api.env" | tail -1 | cut -d= -f2-)"
  echo "${zona:-America/Guayaquil}"
}

# La zona por defecto de su base: la que muestran psql, DBeaver o Power BI (la API no la usa: se
# conecta en UTC). La migración `configurar_zona_horaria` pone America/Guayaquil y el ajuste no
# viaja en los respaldos: se repite después de cada migración y de cada restauración.
fijar_zona_base() {
  local cliente="$1" zona
  zona="$(zona_del_cliente "$cliente")"
  validar_zona "$zona"
  psql_admin -d postgres <<SQL
ALTER DATABASE $cliente SET timezone TO '$zona';
SQL
}

# Prepara las tablas de un cliente con su migrador, quita los permisos de más y deja su zona.
# Con `&&`: si se llama con `migrar_cliente x || …`, bash no corta la función al primer error.
migrar_cliente() {
  local cliente="$1"
  cliente_compose "$cliente" --profile migrar run --rm migrador </dev/null &&
    quitar_permisos_tras_migrar "$cliente" &&
    fijar_zona_base "$cliente"
}

# Versión de las imágenes: el commit del código (y `latest` apunta a la misma).
version_del_codigo() {
  git -C "$RAIZ" rev-parse --short=12 HEAD
}

# La versión (commit) con que se construyó una imagen (la pone construir-imagenes.sh).
version_de_imagen() {
  docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.version"}}' "$1" 2>/dev/null || echo '?'
}

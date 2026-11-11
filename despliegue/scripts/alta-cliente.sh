#!/usr/bin/env bash
# Da de alta un cliente: su base con dos usuarios, su .env con contraseñas nuevas, sus tablas,
# su copia de la API, su primer administrador, su certificado y su sitio en Nginx.
#
#   despliegue/scripts/alta-cliente.sh cliente1
#
# Opciones:
#   --dominio <sub.dominio>    otro subdominio (por defecto: <cliente>.<DOMINIO_BASE>)
#   --certificado-de-prueba    un certificado hecho aquí, sin Let's Encrypt (solo en una PC)
#
# Pregunta el nombre de la empresa y los datos del administrador. La contraseña del
# administrador es temporal: se muestra una sola vez y no se guarda en ningún archivo; la
# primera vez que entre, el sistema le pide cambiarla.
#
# Si algo falla a mitad de camino, el script se detiene y dice qué paso fue. Para volver a
# empezar: despliegue/scripts/baja-cliente.sh <cliente> (solo si todavía no tiene datos).

source "$(dirname "$0")/comun.sh"

cliente=''
dominio=''
certificado_de_prueba=no
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dominio) dominio="${2:-}"; shift 2 ;;
    --certificado-de-prueba) certificado_de_prueba=si; shift ;;
    -*) fallar "Opción desconocida: $1 (ver el comienzo de este script)" ;;
    *) [[ -z "$cliente" ]] || fallar "Un solo cliente por vez."; cliente="$1"; shift ;;
  esac
done
[[ -n "$cliente" ]] || fallar "Falta el nombre corto del cliente (ej. alta-cliente.sh cliente1)."
validar_cliente "$cliente"
cargar_env_servidor

dominio="${dominio:-$cliente.${DOMINIO_BASE:?Falta DOMINIO_BASE en despliegue/.env}}"
[[ "$dominio" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] ||
  fallar "El subdominio «$dominio» no es válido."
# La dirección exacta que escribe el usuario (con el puerto si no es el 443): la API solo
# acepta peticiones con sesión que vengan de ella (CORS_ORIGINS).
origen="https://$dominio"
[[ "$PUERTO_HTTPS" == 443 ]] || origen="$origen:$PUERTO_HTTPS"

# ─── Antes de tocar nada ───
[[ ! -e "clientes/$cliente" ]] || fallar "Ya existe clientes/$cliente: el cliente ya está dado de alta."
[[ ! -e "sitios/$cliente.conf" ]] || fallar "Ya existe sitios/$cliente.conf."
corriendo="$(servicios ps --status running --services </dev/null)"
for servicio in postgres redis web; do
  grep -qx "$servicio" <<<"$corriendo" ||
    fallar "El servicio «$servicio» no está corriendo: cd despliegue && docker compose up -d"
done
if [[ -n "$(psql_consulta postgres "SELECT 1 FROM pg_database WHERE datname = '$cliente'")" ]]; then
  fallar "Ya hay una base «$cliente» en PostgreSQL."
fi
if [[ "$certificado_de_prueba" == no && -z "${CORREO_CERTIFICADOS:-}" ]]; then
  fallar "Falta CORREO_CERTIFICADOS en despliegue/.env (o use --certificado-de-prueba en una PC)."
fi

# ─── Datos de la empresa y del administrador ───
paso "Cliente «$cliente» en $origen"
empresa='' admin_usuario='' admin_nombre='' seguir=''
preguntar empresa 'Nombre de la empresa'
preguntar admin_usuario 'Usuario del administrador (para entrar)'
preguntar admin_nombre 'Nombre completo del administrador'
preguntar seguir '¿Seguimos? (s/n)'
[[ "$seguir" == s || "$seguir" == S ]] || fallar "Cancelado: no se hizo ningún cambio."

paso_actual=''
trap '[[ -n "$paso_actual" ]] && aviso "Falló en: $paso_actual. Revise el mensaje de arriba; para empezar de nuevo, scripts/baja-cliente.sh $cliente."' ERR

# ─── 1. Base y usuarios ───
paso_actual='crear la base y sus usuarios'
paso "1/7 Base «$cliente» y sus usuarios ${cliente}_dueno y ${cliente}_app"
clave_dueno="$(contrasena_al_azar 32)"
clave_app="$(contrasena_al_azar 32)"
crear_base_y_usuarios "$cliente" "$clave_dueno" "$clave_app"
preparar_esquema "$cliente"

# ─── 2. Su .env ───
paso_actual='escribir su .env'
paso "2/7 clientes/$cliente/api.env y migrador.env (permisos 600)"
mkdir -p "clientes/$cliente"
chmod 700 "clientes/$cliente"
cat >"clientes/$cliente/api.env" <<ENV
# Hecho por scripts/alta-cliente.sh. Qué es cada variable: clientes/ejemplo/api.env.example.
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://${cliente}_app:$clave_app@postgres:5432/$cliente
REDIS_URL=redis://:$REDIS_CONTRASENA@redis:6379
CORS_ORIGINS=$origen
TRUST_PROXY=true
LOG_LEVEL=info
ZONA_NEGOCIO=${ZONA_NEGOCIO:-America/Guayaquil}
JWT_SECRETO=$(contrasena_al_azar 88)
SESION_DURACION_MAXIMA_HORAS=13
SESION_INACTIVIDAD_MINUTOS=120
LIMITE_LOGIN_POR_MINUTO=10
LIMITE_USUARIO_POR_MINUTO=300
LIMITE_IP_POR_MINUTO=60
ENV
cat >"clientes/$cliente/migrador.env" <<ENV
# Hecho por scripts/alta-cliente.sh. Solo para preparar las tablas (usuario dueño de la base).
DATABASE_URL=postgresql://${cliente}_dueno:$clave_dueno@postgres:5432/$cliente
ENV
printf '%s\n' "$dominio" >"clientes/$cliente/dominio"
chmod 600 "clientes/$cliente"/*
unset clave_dueno clave_app

# ─── 3. Tablas ───
paso_actual='preparar las tablas'
paso "3/7 Tablas (migraciones)"
migrar_cliente "$cliente"

# ─── 4. Su API ───
paso_actual='levantar su API'
paso "4/7 Su API ($cliente-api)"
cliente_compose "$cliente" up -d api
esperar_sano "$cliente-api"

# ─── 5. Primer administrador ───
paso_actual='crear su primer administrador'
paso "5/7 Empresa «$empresa» y su administrador «$admin_usuario»"
# Doce letras y números, sin los que se confunden (0/O, 1/l/I). Solo en la memoria de este
# script: se le pasa al comando por el entorno, sin escribirla en la línea de órdenes. Si el
# comando la rechaza (o rechaza el usuario), se pueden corregir los datos y reintentar.
while true; do
  ADMIN_INICIAL_CONTRASENA="$(contrasena_al_azar 12 'A-HJ-NP-Za-km-z2-9')"
  if EMPRESA_INICIAL_NOMBRE="$empresa" ADMIN_INICIAL_USUARIO="$admin_usuario" \
    ADMIN_INICIAL_NOMBRE="$admin_nombre" ADMIN_INICIAL_CONTRASENA="$ADMIN_INICIAL_CONTRASENA" \
    docker exec -e EMPRESA_INICIAL_NOMBRE -e ADMIN_INICIAL_USUARIO -e ADMIN_INICIAL_NOMBRE \
    -e ADMIN_INICIAL_CONTRASENA "$cliente-api" node dist/comandos/admin-crear-inicial.js </dev/null; then
    break
  fi
  preguntar seguir '¿Corregir los datos y reintentar? (s/n)'
  [[ "$seguir" == s || "$seguir" == S ]] || fallar "Sin administrador. Para empezar de nuevo: scripts/baja-cliente.sh $cliente."
  preguntar empresa 'Nombre de la empresa'
  preguntar admin_usuario 'Usuario del administrador (para entrar)'
  preguntar admin_nombre 'Nombre completo del administrador'
done

# ─── 6. Certificado ───
paso_actual='sacar su certificado'
paso "6/7 Certificado para $dominio"
sacar_certificado "$dominio" "$certificado_de_prueba"

# ─── 7. Sitio ───
paso_actual='publicar su sitio'
paso "7/7 Sitio sitios/$cliente.conf"
publicar_sitio "$cliente" "$dominio"
paso_actual=''

cat <<FIN

✅ Cliente «$cliente» listo: $origen

   Usuario:              $admin_usuario
   Contraseña temporal:  $ADMIN_INICIAL_CONTRASENA

   Désela al cliente por un medio seguro: no queda guardada en ningún lado. Al entrar por
   primera vez el sistema le pide cambiarla. Si se pierde, otro administrador puede darle una
   nueva; si no hay otro, vuelva a dar de alta al cliente mientras no tenga datos.
FIN

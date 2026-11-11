#!/usr/bin/env bash
# Una sola vez por servidor: arma despliegue/.env con contraseñas nuevas, construye las imágenes
# y levanta los servicios comunes (PostgreSQL, Redis y Nginx).
#
#   despliegue/scripts/iniciar-servidor.sh --dominio midominio.com --correo yo@midominio.com
#
# Opciones:
#   --dominio      el dominio de los subdominios de los clientes (cliente1.<dominio>)
#   --correo       correo para Let's Encrypt (avisa si un certificado está por vencer)
#   --zona         la zona del negocio de todos los clientes de este servidor (por defecto
#                  America/Guayaquil); no se cambia con datos guardados
#   --puertos-de-prueba   Nginx en 8080 y 8443 (para probar en una PC, no en el servidor)
#
# Si despliegue/.env ya existe no lo toca: solo levanta lo que falte.

source "$(dirname "$0")/comun.sh"

dominio=''
correo=''
zona='America/Guayaquil'
puertos_de_prueba=no
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dominio) dominio="${2:-}"; shift 2 ;;
    --correo) correo="${2:-}"; shift 2 ;;
    --zona) zona="${2:-}"; shift 2 ;;
    --puertos-de-prueba) puertos_de_prueba=si; shift ;;
    *) fallar "Opción desconocida: $1 (ver el comienzo de este script)" ;;
  esac
done

if [[ -f .env ]]; then
  paso "despliegue/.env ya existe: se usa el que está"
else
  [[ -n "$dominio" ]] || fallar "Falta --dominio (ej. --dominio midominio.com)."
  [[ "$dominio" =~ ^[a-z0-9.-]+$ ]] || fallar "El dominio «$dominio» no es válido (solo minúsculas, números, puntos y guiones)."
  [[ -n "$correo" || "$puertos_de_prueba" == si ]] || fallar "Falta --correo (para Let's Encrypt)."
  validar_zona "$zona"
  if [[ -d /usr/share/zoneinfo && ! -f "/usr/share/zoneinfo/$zona" ]]; then
    fallar "No conozco la zona «$zona» (ej. America/Guayaquil; la lista: timedatectl list-timezones)."
  fi
  paso "Armando despliegue/.env con contraseñas nuevas"
  if [[ "$puertos_de_prueba" == si ]]; then http=8080 https=8443; else http=80 https=443; fi
  {
    echo '# Hecho por scripts/iniciar-servidor.sh. Nunca se sube al repositorio. Ver .env.example.'
    echo 'POSTGRES_USUARIO=postgres'
    echo "POSTGRES_CONTRASENA=$(contrasena_al_azar 32)"
    echo "REDIS_CONTRASENA=$(contrasena_al_azar 32)"
    echo "ZONA_NEGOCIO=$zona"
    echo 'VERSION=latest'
    echo "PUERTO_HTTP=$http"
    echo "PUERTO_HTTPS=$https"
    echo "DOMINIO_BASE=$dominio"
    echo "CORREO_CERTIFICADOS=$correo"
    echo 'DIAS_RESPALDO=30'
  } >.env
  chmod 600 .env
  info "Listo (permisos 600). Guarde una copia de despliegue/.env fuera del servidor."
fi
cargar_env_servidor

mkdir -p clientes sitios certificados acme respaldos copia-externa
chmod 700 clientes certificados respaldos copia-externa
# Nginx (su propio usuario dentro del contenedor) tiene que poder leer los sitios y los
# archivos con que Let's Encrypt comprueba el subdominio.
chmod 755 sitios acme

paso "Construyendo las imágenes (tarda unos minutos la primera vez)"
"$DESPLIEGUE/scripts/construir-imagenes.sh"

paso "Levantando PostgreSQL, Redis y Nginx"
servicios up -d --wait </dev/null

paso "Cerrando las bases del sistema (nadie más que el administrador entra a ellas)"
psql_admin -d postgres <<'SQL'
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;
SQL

paso "Servidor listo"
info "Siguiente: despliegue/scripts/alta-cliente.sh <cliente>"

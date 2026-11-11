#!/usr/bin/env bash
# Renueva los certificados de Let's Encrypt que vencen en menos de 30 días y, si alguno cambió,
# recarga Nginx. Los que no están por vencer no se tocan: se puede correr todos los días.
#
#   despliegue/scripts/renovar-certificados.sh
#
# Para el cron (todos los días de madrugada), ver docs/despliegue.md, sección 9.

source "$(dirname "$0")/comun.sh"
cargar_env_servidor

paso "Renovando certificados"
antes="$(find certificados/live -name fullchain.pem -exec stat -Lc '%n %Y' {} + 2>/dev/null | sort || true)"
certbot renew --webroot -w /var/www/acme --non-interactive --quiet
despues="$(find certificados/live -name fullchain.pem -exec stat -Lc '%n %Y' {} + 2>/dev/null | sort || true)"

if [[ "$antes" != "$despues" ]]; then
  nginx_valida
  nginx_recargar
  info "Hubo certificados nuevos: Nginx recargado."
else
  info "Ninguno estaba por vencer."
fi

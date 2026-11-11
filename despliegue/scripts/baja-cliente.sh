#!/usr/bin/env bash
# Da de baja un cliente: hace un último respaldo, apaga su API, quita su sitio y su certificado
# y BORRA su base y sus usuarios. Pide escribir el nombre del cliente para confirmar.
#
#   despliegue/scripts/baja-cliente.sh cliente1
#
# Sirve también para empezar de nuevo un alta que falló a mitad de camino. Los respaldos del
# cliente se quedan en respaldos/<cliente>/ (borrarlos a mano cuando ya no hagan falta).

source "$(dirname "$0")/comun.sh"
cargar_env_servidor

[[ $# -eq 1 ]] || fallar "Uso: baja-cliente.sh <cliente>"
cliente="$1"
validar_cliente "$cliente"
dominio="$(cat "clientes/$cliente/dominio" 2>/dev/null || true)"
hay_base="$(psql_consulta postgres "SELECT 1 FROM pg_database WHERE datname = '$cliente'")"

paso "Baja de «$cliente»${dominio:+ ($dominio)}"
aviso "Se borrarán su base de datos y sus usuarios. Esto no se puede deshacer (salvo con un respaldo)."
confirmacion=''
preguntar confirmacion 'Para confirmar, escriba el nombre del cliente'
[[ "$confirmacion" == "$cliente" ]] || fallar "No coincide: no se hizo ningún cambio."

if [[ -n "$hay_base" ]]; then
  paso "Último respaldo"
  "$DESPLIEGUE/scripts/respaldar.sh" "$cliente" </dev/null || fallar "Sin respaldo no se borra nada."
fi

paso "Apagando su API"
if [[ -f "clientes/$cliente/api.env" ]]; then
  cliente_compose "$cliente" down --remove-orphans </dev/null
fi

paso "Quitando su sitio"
if [[ -f "sitios/$cliente.conf" ]]; then
  rm -f "sitios/$cliente.conf"
  nginx_recargar
fi
if [[ -n "$dominio" ]]; then
  if [[ -d "certificados/renewal" && -f "certificados/renewal/$dominio.conf" ]]; then
    certbot delete --cert-name "$dominio" --non-interactive
  else
    # Uno de prueba (alta con --certificado-de-prueba).
    rm -rf "certificados/live/$dominio"
  fi
fi

if [[ -n "$hay_base" ]]; then
  paso "Borrando su base y sus usuarios"
  psql_admin -d postgres <<SQL
DROP DATABASE $cliente WITH (FORCE);
SQL
fi
psql_admin -d postgres <<SQL
DROP ROLE IF EXISTS ${cliente}_app;
DROP ROLE IF EXISTS ${cliente}_dueno;
SQL

rm -rf "clientes/$cliente"
paso "«$cliente» dado de baja. Sus respaldos siguen en respaldos/$cliente/."

#!/usr/bin/env bash
# Convierte esta plantilla («Base ERP») en un proyecto nuevo.
#
#   ./nuevo-proyecto.sh                # pregunta todo y al final comprueba que arranque
#   ./nuevo-proyecto.sh --sin-pruebas  # igual, sin instalar ni correr las pruebas
#
# Qué hace:
#   1. Pregunta el nombre visible, el nombre corto (carpetas y paquetes), cómo se parte en el
#      logo y los puertos de PostgreSQL y Redis en esta máquina.
#   2. Cambia «Base ERP», base-erp, base-backend, base-frontend, las imágenes del servidor
#      (base-api, base-migrador y base-web) y base_erp por los nuevos, y
#      renombra las carpetas de apps/.
#   3. Crea los dos .env (raíz y backend) con una contraseña de la base y un JWT_SECRETO nuevos.
#   4. Comprueba que arranque: pnpm install, prisma generate, lint, tsc, test y build.
#   5. Activa Dependabot (apagado en la plantilla) y se borra a sí mismo. El resultado queda sin commitear: revisarlo con `git diff`.
#
# Se corre una sola vez, en un clon recién creado desde la plantilla y sin cambios.
set -euo pipefail

cd "$(dirname "$0")"

CON_PRUEBAS=true
if [[ "${1:-}" == "--sin-pruebas" ]]; then
  CON_PRUEBAS=false
elif [[ -n "${1:-}" ]]; then
  echo "Opción desconocida: $1 (la única es --sin-pruebas)." >&2
  exit 1
fi

falla() {
  echo "✗ $1" >&2
  exit 1
}

# --- 0. ¿Es la plantilla, sin tocar? ---------------------------------------------------------
[[ -d apps/base-backend && -d apps/base-frontend ]] ||
  falla "No encuentro apps/base-backend ni apps/base-frontend: este script ya se corrió o no es la plantilla."
grep -q '"name": "base-erp"' package.json || falla "package.json no es el de la plantilla."
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [[ -n "$(git status --porcelain)" ]]; then
  falla "Hay cambios sin commitear. Córralo en un clon limpio de la plantilla."
fi
for programa in perl openssl iconv; do
  command -v "$programa" >/dev/null || falla "Falta el programa «$programa»."
done
if $CON_PRUEBAS; then
  command -v pnpm >/dev/null || falla "Falta pnpm (ver CLAUDE.md, sección 3). O corra con --sin-pruebas."
fi

# --- 1. Preguntas ------------------------------------------------------------------------------
preguntar() { # preguntar "Texto" "por defecto" → la respuesta (o el valor por defecto)
  local respuesta
  read -r -p "$1${2:+ [$2]}: " respuesta
  echo "${respuesta:-$2}"
}

echo "Proyecto nuevo desde la plantilla Base ERP."
echo

NOMBRE=""
until [[ -n "$NOMBRE" ]]; do
  NOMBRE="$(preguntar 'Nombre que verá el usuario (por ejemplo, «Acme ERP»)' '')"
  if [[ "$NOMBRE" =~ [\"\'\`\<\>\\\&\$] ]]; then
    echo "  Sin comillas ni los signos < > \\ & \$." >&2
    NOMBRE=""
  fi
done

sugerido="$(echo "$NOMBRE" | iconv -f utf-8 -t ascii//TRANSLIT | tr '[:upper:]' '[:lower:]' |
  sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
CORTO=""
until [[ "$CORTO" =~ ^[a-z][a-z0-9-]{1,29}$ && "$CORTO" != *- && "$CORTO" != *--* ]]; do
  CORTO="$(preguntar 'Nombre corto para carpetas y paquetes (minúsculas, números y guiones)' "$sugerido")"
done
[[ "$CORTO" != "base" && "$CORTO" != base-* ]] || falla "El nombre corto no puede empezar con «base»."
BD="${CORTO//-/_}"

# El logo: el nombre en negrita y la sigla en el color de acento. «Acme ERP» → «Acme» + «ERP».
ultima="${NOMBRE##* }"
if [[ "$NOMBRE" == *" "* && "$ultima" =~ ^[A-Z0-9]{2,5}$ ]]; then
  logo_nombre_def="${NOMBRE% *}"
  logo_sigla_def="$ultima"
else
  logo_nombre_def="$NOMBRE"
  logo_sigla_def=""
fi
LOGO_NOMBRE="$(preguntar 'Logo: la parte en negrita' "$logo_nombre_def")"
LOGO_SIGLA="$(preguntar 'Logo: la sigla en color (vacía si no lleva; escriba - para ninguna)' "$logo_sigla_def")"
[[ "$LOGO_SIGLA" == "-" ]] && LOGO_SIGLA=""

PUERTO_PG="$(preguntar 'Puerto de PostgreSQL en esta máquina (otro si ya hay un proyecto en 5433)' '5433')"
PUERTO_REDIS="$(preguntar 'Puerto de Redis en esta máquina (otro si ya hay un proyecto en 6380)' '6380')"
[[ "$PUERTO_PG" =~ ^[0-9]{4,5}$ && "$PUERTO_REDIS" =~ ^[0-9]{4,5}$ ]] || falla "Los puertos son números."

echo
echo "Va a quedar así:"
echo "  Nombre visible:  $NOMBRE"
echo "  Carpetas:        apps/$CORTO-backend, apps/$CORTO-frontend"
echo "  Base de datos:   $BD (puerto $PUERTO_PG), Redis en el puerto $PUERTO_REDIS"
echo "  Logo:            «$LOGO_NOMBRE»${LOGO_SIGLA:+ + «$LOGO_SIGLA»}"
[[ "$(preguntar '¿Sigo? (s/n)' 'n')" == "s" ]] || falla "Cancelado: no se cambió nada."

# --- 2. Reemplazos -----------------------------------------------------------------------------
echo
echo "→ Cambiando los nombres…"
export NOMBRE CORTO BD LOGO_NOMBRE LOGO_SIGLA PUERTO_PG PUERTO_REDIS
este_script="$(basename "$0")"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  mapfile -t archivos < <(git ls-files)
else
  mapfile -t archivos < <(find . -type f -not -path './.git/*' -not -path '*/node_modules/*' -printf '%P\n')
fi
textos=()
for f in "${archivos[@]}"; do
  [[ "$f" == "$este_script" || ! -f "$f" ]] && continue
  grep -Iq . "$f" 2>/dev/null && textos+=("$f") # solo archivos de texto
done

# El logo primero (antes de cambiar «Base ERP»): marca.ts y los SVG de public/marca/.
perl -pi -e 's/logo: \{ nombre: \x27Base\x27, sigla: \x27ERP\x27 \}/logo: { nombre: \x27$ENV{LOGO_NOMBRE}\x27, sigla: \x27$ENV{LOGO_SIGLA}\x27 }/' \
  apps/base-frontend/src/app/shared/infrastructure/layout/marca/marca.ts
# En los SVG la sigla va en un <tspan> del mismo texto: se acomoda sola detrás del nombre.
# El ancho del dibujo (viewBox) se agranda a ojo si el nombre es largo (revisarlo a la vista).
ANCHO=$((42 + ${#LOGO_NOMBRE} * 14 + ${#LOGO_SIGLA} * 11 + 8))
((ANCHO < 160)) && ANCHO=160
export ANCHO
for svg in apps/base-frontend/public/marca/logo.svg apps/base-frontend/public/marca/logo-claro.svg; do
  perl -pi -e 's/viewBox="0 0 160 32"/viewBox="0 0 $ENV{ANCHO} 32"/; s/>Base<tspan/>$ENV{LOGO_NOMBRE}<tspan/' "$svg"
  if [[ -n "$LOGO_SIGLA" ]]; then
    perl -pi -e 's/>ERP<\/tspan>/>$ENV{LOGO_SIGLA}<\/tspan>/' "$svg"
  else
    perl -pi -e 's/<tspan [^>]*>ERP<\/tspan>//' "$svg"
  fi
done

perl -pi -e '
  s/Base ERP/$ENV{NOMBRE}/g;
  s/base-erp/$ENV{CORTO}/g;
  s/base-(backend|frontend|e2e|api|migrador|web)\b/$ENV{CORTO}-$1/g;
  s/base-(?=\$destino)/$ENV{CORTO}-/g; # despliegue/scripts/construir-imagenes.sh
  s/\bbase_erp(?=_|\b)/$ENV{BD}/g;
' "${textos[@]}"

# Los puertos (solo en los .env.example y en el CLAUDE.md, donde se dicen).
perl -pi -e 's/\b5433\b/$ENV{PUERTO_PG}/g; s/\b6380\b/$ENV{PUERTO_REDIS}/g' \
  .env.example apps/base-backend/.env.example CLAUDE.md docker-compose.yml docs/manual-docker.md

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git mv apps/base-backend "apps/$CORTO-backend"
  git mv apps/base-frontend "apps/$CORTO-frontend"
else
  mv apps/base-backend "apps/$CORTO-backend"
  mv apps/base-frontend "apps/$CORTO-frontend"
fi

# Dependabot va apagado en la plantilla (para no abrir PRs ni gastar minutos de Actions allí).
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git mv .github/dependabot.yml.plantilla .github/dependabot.yml
else
  mv .github/dependabot.yml.plantilla .github/dependabot.yml
fi

# El README de la plantilla explica cómo usarla: el del proyecto empieza de cero.
cat >README.md <<LEEME
# $NOMBRE

Hecho sobre la plantilla de la base (\`base-v1\`): empresas, login, roles y permisos,
administración y bitácora. Cómo trabajar, las reglas y los comandos: \`CLAUDE.md\`.

\`\`\`bash
docker compose up -d
pnpm install
pnpm dev:backend    # API en http://localhost:3000/api
pnpm dev:frontend   # Web en http://localhost:4200
\`\`\`
LEEME

# --- 3. Los .env con secretos nuevos -----------------------------------------------------------
echo "→ Creando los .env con secretos nuevos…"
CLAVE_BD="$(openssl rand -hex 24)"
JWT="$(openssl rand -base64 64 | tr -d '\n')"
export CLAVE_BD JWT
perl -pe 's/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$ENV{CLAVE_BD}/' .env.example >.env
perl -pe '
  s/^(DATABASE_URL=postgresql:\/\/[^:]+:)[^@]+@/$1$ENV{CLAVE_BD}@/;
  s/^JWT_SECRETO=.*/JWT_SECRETO=$ENV{JWT}/;
' "apps/$CORTO-backend/.env.example" >"apps/$CORTO-backend/.env"
chmod 600 .env "apps/$CORTO-backend/.env"

# --- 4. ¿Arranca? ------------------------------------------------------------------------------
if $CON_PRUEBAS; then
  echo "→ Instalando y probando (unos minutos)…"
  pnpm install --frozen-lockfile
  pnpm --filter "$CORTO-backend" exec prisma generate
  pnpm lint
  pnpm --filter "$CORTO-backend" exec tsc --noEmit
  pnpm --filter "$CORTO-frontend" exec tsc --noEmit -p tsconfig.spec.json
  pnpm test
  pnpm build
fi

# --- 5. Listo ----------------------------------------------------------------------------------
rm -- "$0"
cat <<FIN

✓ Listo: «$NOMBRE» quedó creado (sin commitear; revíselo con git diff).

Lo que sigue:
  1. En apps/$CORTO-backend/.env: EMPRESA_INICIAL_NOMBRE y ADMIN_INICIAL_* (el primer administrador).
  2. docker compose up -d, luego pnpm --filter $CORTO-backend exec prisma migrate deploy y pnpm test:e2e.
  3. Con Claude: la sección 1.2 del CLAUDE.md (qué es el negocio), la marca
     (docs/arquitectura-frontend.md, 8.6: colores, logo y los textos de MARCA del login).
  4. El primer commit y el repositorio en GitHub.
FIN

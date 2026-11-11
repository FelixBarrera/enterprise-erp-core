# Despliegue: una copia por cliente (forma A)

Lo que corre en el servidor. Cada cliente tiene **su base de datos, su `.env` y su copia de la API**, todas con el mismo programa; las pantallas son las mismas para todos y cada cliente entra por **su subdominio** (`cliente1.midominio.com`). El trabajo de todos los días lo hacen los scripts de `scripts/` (abajo). **Guía paso a paso para un servidor nuevo** (Ubuntu, Docker, cortafuegos, dominio, copia externa, tareas programadas y qué hacer si se pierde el servidor): `docs/despliegue.md`.

```
                   internet (80 y 443)
                          │
                ┌─────────▼─────────┐
                │  web (Nginx)      │  pantallas + /api de cada subdominio
                └──┬─────────────┬──┘
     cliente1.…/api│             │cliente2.…/api
         ┌─────────▼──┐     ┌────▼───────┐
         │cliente1-api│     │cliente2-api│   misma imagen, distinto .env
         └──┬──────┬──┘     └──┬──────┬──┘
            │      │           │      │
     ┌──────▼──────▼───────────▼──────▼──────┐
     │ postgres (una base por cliente)  redis │   sin puertos hacia afuera
     └────────────────────────────────────────┘
```

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `api/Dockerfile` | Imágenes `base-api` (lo compilado, sin el código fuente; corre como `node`) y `base-migrador` (prepara las tablas y termina) |
| `web/Dockerfile`, `web/nginx.conf`, `web/fragmentos/` | Imagen `base-web`: Nginx con las pantallas, HTTPS, HTTP/2, compresión, cabeceras de seguridad y caché |
| `web/sitio.conf.plantilla` | El sitio de un cliente (su subdominio y su certificado) |
| `compose.yml` | Servicios comunes: `postgres`, `redis` y `web`, en la red `erp` |
| `cliente.compose.yml` | La API de un cliente (`<cliente>-api`) y su `migrador` |
| `.env.example` | Contraseñas de los servicios comunes (→ `despliegue/.env`) |
| `clientes/ejemplo/` | Qué lleva el `.env` de un cliente (→ `clientes/<cliente>/api.env` y `migrador.env`) |
| `copia-externa.env.example` | Adónde va la copia cifrada fuera del servidor (→ `copia-externa/destino.env`) |
| `scripts/` | Preparar el servidor, dar de alta, de baja y recuperar un cliente, actualizar todos, respaldar, copiar afuera, probar la restauración y renovar certificados |

No se suben (`.gitignore`): `despliegue/.env`, `clientes/<cliente>/`, `sitios/`, `certificados/`, `acme/`, `respaldos/` y `copia-externa/`.

## Los scripts (desde cualquier carpeta)

| Script | Qué hace |
|---|---|
| `scripts/iniciar-servidor.sh --dominio midominio.com --correo yo@midominio.com` | **Una vez por servidor.** Arma `despliegue/.env` con contraseñas nuevas y la zona del negocio (`--zona`, por defecto `America/Guayaquil`; es la de todos sus clientes y su base la toma después de cada migración y recuperación), construye las imágenes, levanta PostgreSQL, Redis y Nginx y cierra las bases del sistema |
| `scripts/alta-cliente.sh cliente1` | Pregunta el nombre de la empresa y del administrador y hace todo lo de «Qué hace el alta» (abajo). Al final muestra **una sola vez** la contraseña temporal del administrador (no se guarda en ningún archivo). Otro subdominio: `--dominio otro.midominio.com` |
| `scripts/actualizar.sh` | Tras un `git pull`: construye las imágenes y, cliente por cliente, **respalda, migra y reinicia** su API (espera a que responda); al final, las pantallas. Si uno falla, se detiene y los que siguen quedan como estaban. Solo uno (para probar primero): `actualizar.sh cliente1` |
| `scripts/respaldar.sh` | Respaldo de la base de cada cliente en `respaldos/<cliente>/`, comprobado, y borra los de más de `DIAS_RESPALDO` días (30). Solo uno: `respaldar.sh cliente1` |
| `scripts/copia-externa.sh iniciar` / `copiar` / `listar` / `traer [<copia>]` | Copia **cifrada** (restic) fuera del servidor: el último respaldo de cada cliente, `despliegue/.env`, `clientes/` y `sitios/`. Guarda la última de cada día por 30 días y la de cada mes por 7 años. `iniciar` una vez (crea la clave: guardarla fuera del servidor); `copiar`, en el cron; `traer`, a `copia-externa/traido/<copia>/`. Destinos: `docs/despliegue.md`, sección 8 |
| `scripts/probar-restauracion.sh [--copia-externa]` | Restaura el último respaldo de cada cliente en una base aparte, lo revisa (migraciones, empresas y usuarios, la bitácora cerrada, que sea de los últimos 2 días) y la borra. Con `--copia-externa`, el de la copia de afuera. Una vez al mes, en el cron |
| `scripts/recuperar-cliente.sh cliente1` | En un servidor que **no** tiene al cliente (se perdió el anterior): con su `.env` y su respaldo traídos de la copia, su base con los mismos usuarios y contraseñas, su API, su certificado y su sitio (`docs/despliegue.md`, sección 11) |
| `scripts/renovar-certificados.sh` | Renueva los certificados que vencen en menos de 30 días y recarga Nginx |
| `scripts/baja-cliente.sh cliente1` | Último respaldo y **borra** su base, sus usuarios, su API, su sitio y su certificado (pide escribir el nombre). También para empezar de nuevo un alta que falló a mitad |
| `scripts/construir-imagenes.sh` | Solo construir las imágenes (versión = el commit; también `latest`) |

Las respuestas se escriben en la terminal; ningún script guarda una contraseña en la línea de órdenes ni en el historial. Lo que crean (`.env`, `clientes/`, `respaldos/`, `certificados/`) queda con permisos solo para el dueño.

### Tareas programadas (cron del servidor)

Respaldo diario, copia externa, certificados y la prueba mensual de restauración: el `crontab` está en `docs/despliegue.md`, sección 9 (con las horas en UTC).

### Restaurar un respaldo

Primero en una base aparte, para mirar que esté bien (con los mismos usuarios del cliente):

```bash
cd despliegue
docker compose exec -T postgres createdb -U postgres -O cliente1_dueno revisar </dev/null
docker compose exec -T postgres psql -U postgres -c "REVOKE ALL ON DATABASE revisar FROM PUBLIC;" </dev/null
docker compose exec -T postgres pg_restore -U postgres -d revisar --exit-on-error < respaldos/cliente1/cliente1-AAAAMMDD-HHMMSS.dump
docker compose exec -T postgres dropdb -U postgres revisar </dev/null      # al terminar de mirar
```

Para reemplazar la base del cliente (borra lo que tenga ahora: **solo con su respaldo recién hecho**):

```bash
CLIENTE=cliente1 docker compose -f cliente.compose.yml stop api
docker compose exec -T postgres dropdb -U postgres --force cliente1 </dev/null
docker compose exec -T postgres createdb -U postgres -O cliente1_dueno cliente1 </dev/null
# createdb la deja abierta a todos y eso no viaja en el respaldo: cerrarla otra vez.
docker compose exec -T postgres psql -U postgres -c "REVOKE ALL ON DATABASE cliente1 FROM PUBLIC; GRANT CONNECT, TEMPORARY ON DATABASE cliente1 TO cliente1_dueno, cliente1_app;" </dev/null
docker compose exec -T postgres pg_restore -U postgres -d cliente1 --exit-on-error < respaldos/cliente1/cliente1-AAAAMMDD-HHMMSS.dump
CLIENTE=cliente1 docker compose -f cliente.compose.yml up -d api
```

El respaldo lleva los dueños y los permisos de las tablas: la API sigue sin poder cambiarlas ni cambiar la bitácora (comprobado en el 6.16b). Los de la **base misma** (quién se conecta) no van en el respaldo: por eso el `REVOKE`/`GRANT` después de `createdb` (corregido en el 6.16c).

Si se perdió el servidor entero (el cliente no existe en este): `scripts/recuperar-cliente.sh` (`docs/despliegue.md`, sección 11).

Volver a la versión anterior del programa: `VERSION=<commit anterior>` en `despliegue/.env` (las imágenes de cada versión quedan en el servidor: `docker image ls base-api`) y `CLIENTE=cliente1 docker compose -f cliente.compose.yml up -d api`. Si esa actualización migró la base, además hay que restaurar el respaldo que hizo `actualizar.sh` justo antes. Para la próxima actualización, volver a `VERSION=latest` (`actualizar.sh` no corre si no).

## Construir las imágenes a mano (desde la raíz del proyecto)

```bash
docker build -f despliegue/api/Dockerfile --target api      -t base-api .
docker build -f despliegue/api/Dockerfile --target migrador -t base-migrador .
docker build -f despliegue/web/Dockerfile                   -t base-web .
```

## Qué hace el alta (por si hay que hacer un paso a mano)

1. **Servicios comunes** (una sola vez, `iniciar-servidor.sh`): `despliegue/.env` con contraseñas al azar y `docker compose up -d`. Después, que nadie entre a las bases del sistema:
   `docker compose exec postgres psql -U postgres -c "REVOKE CONNECT ON DATABASE postgres FROM PUBLIC; REVOKE CONNECT ON DATABASE template1 FROM PUBLIC;"`
2. **Su base y dos usuarios**: `<cliente>_dueno` (dueño de la base: prepara las tablas) y `<cliente>_app` (la API: lee y escribe, sin cambiar tablas):
   ```sql
   CREATE ROLE cliente1_dueno LOGIN PASSWORD '…';
   CREATE ROLE cliente1_app LOGIN PASSWORD '…';
   CREATE DATABASE cliente1 OWNER cliente1_dueno;
   REVOKE ALL ON DATABASE cliente1 FROM PUBLIC;
   GRANT CONNECT, TEMPORARY ON DATABASE cliente1 TO cliente1_dueno, cliente1_app;
   \c cliente1
   ALTER SCHEMA public OWNER TO cliente1_dueno;
   CREATE EXTENSION pg_stat_statements;
   GRANT USAGE ON SCHEMA public TO cliente1_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE cliente1_dueno GRANT USAGE ON SCHEMAS TO cliente1_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE cliente1_dueno GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cliente1_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE cliente1_dueno GRANT USAGE, SELECT ON SEQUENCES TO cliente1_app;
   ```
3. **Su `.env`**: `clientes/cliente1/api.env` y `migrador.env` desde `clientes/ejemplo/` (permisos `600`).
4. **Sus tablas**: `CLIENTE=cliente1 docker compose -f cliente.compose.yml run --rm migrador`, y **después de cada migración**:
   ```sql
   REVOKE ALL ON public._prisma_migrations FROM cliente1_app;
   REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA auditoria FROM cliente1_app;
   ```
5. **Su API**: `CLIENTE=cliente1 docker compose -f cliente.compose.yml up -d api` (queda `healthy` cuando `/health` responde).
6. **Su administrador**: `docker exec -e EMPRESA_INICIAL_NOMBRE -e ADMIN_INICIAL_USUARIO -e ADMIN_INICIAL_NOMBRE -e ADMIN_INICIAL_CONTRASENA cliente1-api node dist/comandos/admin-crear-inicial.js`, con esas cuatro variables puestas en la terminal (así la contraseña temporal no queda en ningún archivo). Los otros comandos, con `docker exec -it cliente1-api node dist/comandos/<comando>.js`.
7. **Su certificado**: `docker compose --profile certificados run --rm certbot certonly --webroot -w /var/www/acme -d <subdominio> --email <correo> --agree-tos --no-eff-email` (Nginx ya sirve la comprobación aunque el cliente no tenga sitio; el subdominio tiene que apuntar al servidor).
8. **Su sitio**: `sitios/cliente1.conf` desde `web/sitio.conf.plantilla` (cambiando `__DOMINIO__` y `__CLIENTE__`) y `docker compose exec web nginx -s reload`.

## Probarlo en una PC

Con Nginx en 8080 y 8443, el dominio `localhost` (el navegador manda `cliente1.localhost` a la propia PC) y un certificado hecho aquí en vez de Let's Encrypt:

```bash
despliegue/scripts/iniciar-servidor.sh --dominio localhost --puertos-de-prueba
despliegue/scripts/alta-cliente.sh cliente1 --certificado-de-prueba
curl -sk --resolve cliente1.localhost:8443:127.0.0.1 https://cliente1.localhost:8443/api/v1/health
```

Y en el navegador, `https://cliente1.localhost:8443` (aceptando el aviso del certificado).

Para borrar la prueba: `baja-cliente.sh` de cada cliente, `cd despliegue && docker compose down -v` (**borra todas las bases**: solo en una PC de prueba) y las carpetas que no se suben (`.env`, `clientes/<cliente>/`, `sitios/`, `certificados/`, `acme/`, `respaldos/`, `copia-externa/`). `certificados/` y `acme/` tienen archivos del administrador (los crea Let's Encrypt en su contenedor): `docker run --rm -v "$PWD:/d" alpine:3.22 rm -rf /d/certificados /d/acme`.

La copia externa se prueba en la PC con una carpeta como destino (`RESTIC_REPOSITORY=/destino` y `COPIA_EXTERNA_CARPETA=/ruta/de/prueba` en `copia-externa/destino.env`).

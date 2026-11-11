# Manual de Docker

Docker corre en la PC la base de datos (PostgreSQL 18) y Redis 7, sin instalarlos en el sistema. Todo está en `docker-compose.yml` (raíz del proyecto).

## Qué hay

| Servicio | Contenedor | Puerto en esta PC | Datos guardados en |
|---|---|---|---|
| PostgreSQL 18 | `base-erp-postgres` | `127.0.0.1:5433` | volumen `postgres-datos` (montado en `/var/lib/postgresql`) |
| Redis 7 | `base-erp-redis` | `127.0.0.1:6380` | volumen `redis-datos` |

- Los puertos se publican **solo en `127.0.0.1`**: Docker se salta el firewall, así que publicar en todas las interfaces dejaría la base abierta a la red.
- Puertos 5433 y 6380 (no los normales 5432 y 6379) para no chocar con otros proyectos en la misma PC.
- Las credenciales se leen del `.env` de la raíz (copia de `.env.example`).
- Cada servicio tiene un **healthcheck**: Docker revisa solo que esté respondiendo (`healthy`).
- PostgreSQL 18 guarda sus datos en `/var/lib/postgresql` (no en `/data`, como versiones anteriores).
- Redis corre con `appendonly` (guarda en disco cada cambio): las colas no se pierden si se reinicia.
- La base tiene como zona por defecto `America/Guayaquil` (migración `configurar_zona_horaria`): `psql` y otras herramientas muestran la hora local. El backend se conecta siempre en UTC.
- **Instalación con otra zona** (`ZONA_NEGOCIO` distinta en el `.env` del backend): la migración no se edita (regla 9). Después de migrar, se cambia la zona por defecto de la base a mano, una sola vez, y se vuelve a conectar la herramienta:

  ```bash
  docker compose exec postgres psql -U base_erp -d base_erp -c "ALTER DATABASE base_erp SET timezone TO 'America/Mexico_City'"
  docker compose exec postgres psql -U base_erp -d base_erp -c "SHOW timezone"
  ```

  Solo cambia lo que muestran `psql`, DBeaver o Power BI; el backend no la usa. La zona se elige al instalar y **no se cambia con datos guardados**. (`TZ` del contenedor en `docker-compose.yml` solo afecta la hora de los mensajes de PostgreSQL.)

## Día a día

```bash
docker compose up -d              # levantar (en segundo plano)
docker compose ps                 # ver estado (debe decir "healthy")
docker compose logs -f postgres   # ver mensajes de la base (Ctrl+C para salir)
docker compose stop               # detener sin borrar nada
docker compose down               # detener y quitar contenedores (los datos quedan en los volúmenes)
```

Entrar a la base con la consola de PostgreSQL:

```bash
docker compose exec postgres psql -U base_erp -d base_erp
```

Probar Redis:

```bash
docker compose exec redis redis-cli ping     # responde PONG
```

## Volúmenes (dónde viven los datos)

```bash
docker volume ls | grep base_erp
```

- `docker compose down` **no** borra los datos.
- `docker compose down -v` **sí los borra** (base y Redis vacíos). Solo en desarrollo, y avisando antes.

## Respaldos en desarrollo

Antes de una migración delicada:

```bash
docker compose exec -T postgres pg_dump -U base_erp -d base_erp -Fc > respaldo-$(date +%F).dump
```

Restaurar en una base vacía:

```bash
docker compose exec -T postgres pg_restore -U base_erp -d base_erp --clean --if-exists < respaldo-AAAA-MM-DD.dump
```

Los archivos `.dump` **no se commitean** (son respaldos con datos). Guardarlos fuera del proyecto.

Los respaldos de producción (diarios, 30 días locales, 7 años externos, restauración probada cada mes) se definen antes de producción (`docs/arquitectura-backend.md`, sección "Antes de producción").

## Base de pruebas

Los e2e usan una base aparte, `base_erp_test`, en el mismo contenedor. La crea y migra sola el `global-setup` de las pruebas (paso 5). Nunca tocan la base de desarrollo.

## Errores comunes

| Mensaje / síntoma | Qué pasa | Qué hacer |
|---|---|---|
| `port is already allocated` | Otro programa usa el puerto 5433 o 6380 | Cambiar `POSTGRES_PORT` / `REDIS_PORT` en `.env` (y la URL en `apps/base-backend/.env`) |
| `permission denied ... docker.sock` | El usuario no está en el grupo `docker` | `sudo usermod -aG docker $USER` y cerrar sesión |
| El backend no conecta a la base | El contenedor no está `healthy` o la URL no coincide | `docker compose ps`; revisar `DATABASE_URL` en `apps/base-backend/.env` |
| `password authentication failed` | Se cambió la contraseña en `.env` después de crear el volumen | La contraseña queda fija al crear la base: volver a la anterior, o `docker compose down -v` (borra los datos) |
| El contenedor de PostgreSQL se reinicia solo | Volumen de una versión anterior montado en `/data` | Revisar los logs; en desarrollo, `docker compose down -v` y levantar de nuevo |
| Docker no arranca tras reiniciar la PC | El servicio está apagado | `sudo systemctl start docker` |

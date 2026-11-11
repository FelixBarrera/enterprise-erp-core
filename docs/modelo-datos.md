# Modelo de datos

Convenciones de la base de datos (PostgreSQL 18 con Prisma 7.10). Se deciden **antes de la primera migración**: cambiar una convención después obliga a migrar datos reales.

> **Decidido (2026-11-05, paso 6.1):** varias empresas en la misma base. Toda tabla de negocio lleva `empresa_id` (sección 11). Diseño en `docs/modulos/empresas.md`.

## 1. Organización

- `prisma/schema.prisma`: solo `generator` y `datasource`. Modelos en `prisma/models/<modulo>.prisma`; `prisma.config.ts` apunta a la carpeta `prisma/` (la URL va ahí, no en el schema).
- **Un esquema de PostgreSQL por área** (`seguridad`, `auditoria`, `contabilidad`…; `@@schema` en cada modelo y enum). **Nada de negocio en `public`.**
- Un esquema `reportes` solo con **vistas** de nombres claros para reportes o Power BI (opcional: solo si se decide usarlo, con un usuario de solo lectura que nunca vea `seguridad`).
- El esquema da el contexto: `auditoria.eventos`, no `auditoria.eventos_auditoria`. Sin prefijos de módulo, sin mayúsculas ni guiones.
- Migración: `pnpm exec prisma migrate dev --name <verbo>_<que>` (`crear_usuarios`). Con SQL a mano (CHECK, índices parciales, triggers): `--create-only`, editar `migration.sql`, luego `migrate dev` y `prisma generate` (**en Prisma 7, `migrate dev` ya no regenera el cliente solo**).
- Se revisa el SQL de cada migración antes de commitear. Nunca editar una ya aplicada.

## 2. Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Modelo | PascalCase singular | `Factura`, `DetalleFactura` |
| Tabla | snake_case plural con `@@map` | `facturas`, `detalles_factura` |
| Campo / columna | camelCase / snake_case con `@map` | `razonSocial` → `razon_social` |
| Foreign key | `<entidad>Id` → `<entidad>_id` | `clienteId` → `cliente_id` |
| Enum | miembros en UPPER_SNAKE_CASE en español | `AUTORIZADA`, `PENDIENTE` |

Prisma agrega relaciones con nombres en inglés al correr `prisma format` (`sesions`): renombrarlas. El vocabulario fiscal va como lo nombra el SRI (RUC, clave de acceso, punto de emisión); el del rubro, como lo nombra su regulador.

## 3. Claves

`id String @id @default(uuid(7)) @db.Uuid`. UUID v7 está ordenado por fecha (índices sin fragmentar) y no revela cuántos registros hay.

**Los números de negocio no son la clave**: un secuencial o un código van en su propia columna con índice único.

## 4. Tipos

| Dato | Tipo | Notas |
|---|---|---|
| Instante | `DateTime @db.Timestamptz(6)` | Siempre con zona |
| Fecha fiscal | `DateTime @db.Date` | Calculada en la zona de la empresa |
| Montos | `Decimal @db.Decimal(14, 2)` | |
| Precio unitario, cantidad | `Decimal @db.Decimal(18, 6)` | Confirmar con la ficha técnica (en valores pueden pedir más decimales) |
| Porcentajes | `Decimal @db.Decimal(7, 4)` | `15.0000` = 15 % |
| RUC / cédula | `String @db.VarChar(13)` | Nunca número (perdería ceros) |
| Textos | `String @db.VarChar(n)` | Con el límite real |

**Prohibido:** `Float` para dinero, cantidades o porcentajes; instantes sin `Timestamptz`.

## 5. Campos de auditoría

`creado_en`, `actualizado_en` (`@updatedAt`), `creado_por` (`null` = proceso del sistema); `actualizado_por` en lo que se edita desde pantalla.

Excepciones, con su motivo escrito en el registro de tablas:
- Tablas de unión: solo `creado_en`, `creado_por` (se crean o se quitan).
- Tablas técnicas de sesión.
- La bitácora: su hora es `ocurrido_en` y quién es `usuario_id`.

La trazabilidad completa va en `auditoria.eventos`, no en estas columnas.

## 6. Borrar o no borrar

| Tipo | Ejemplos | Regla |
|---|---|---|
| Catálogos y maestros | clientes, proveedores, usuarios | **Desactivar** (`activo`) o borrado lógico (`eliminado_en`). Nunca borrar: los documentos viejos dicen quién o qué fue |
| Documentos fiscales | facturas, notas de crédito, retenciones | **Inmutables**. Se anulan con el documento que corresponde; solo cambia su estado, y cada cambio es un evento |
| Movimientos | pagos, asientos, liquidaciones | **Solo agregar**. Un error se corrige con el movimiento inverso |

- Retención mínima de **7 años** (SRI). Sin purgas de documentos fiscales. Confirmar con el negocio si su regulador pide más.
- **Único entre los activos**: un `@unique` normal impide recrear algo desactivado con el mismo dato. Se usa un **índice único parcial** (`WHERE activo` o `WHERE eliminado_en IS NULL`), escrito a mano en la migración.
- **Nombres únicos sin importar mayúsculas ni tildes**: función `public.nombre_normalizado(texto)` (minúsculas + `unaccent`, `IMMUTABLE`; creada en la migración `crear_empresas`) y el índice único sobre ella. Ejemplo: `empresas_nombre_activas_key`. El dominio además recorta, junta espacios y normaliza a NFC antes de guardar.
- **Tabla inmutable**: una función que lanza error y dos triggers (`BEFORE UPDATE OR DELETE … FOR EACH ROW` y `BEFORE TRUNCATE … FOR EACH STATEMENT`). La aplicación en producción **no se conecta con el dueño de las tablas** (el dueño puede apagar los triggers). En los e2e, la limpieza los salta con `session_replication_role = replica` solo en la base de pruebas.
- Reglas que la base puede cuidar van como `CHECK` (formato de cédula, montos > 0, "o los dos campos o ninguno"): el dominio valida primero, la base es el último resguardo.

## 7. Fechas y zona horaria

- `TIMESTAMPTZ` guarda el instante; la zona solo decide cómo se muestra. La zona por defecto de la base es `America/Guayaquil` (una migración `ALTER DATABASE … SET timezone`), así cualquier herramienta muestra la hora local.
- **La conexión del backend va siempre en UTC** (`-c TimeZone=UTC` en el adaptador único `crearAdaptadorPg()`). `@prisma/adapter-pg` lo supone: con otra zona, los instantes se guardan corridos 5 horas sin que ninguna prueba lo note. **Nunca crear un `PrismaPg` directo.** Un e2e lo comprueba.
- Prisma Studio sirve para mirar, no para editar fechas.
- En SQL directo: convertir explícitamente a la zona del negocio (`AT TIME ZONE 'America/Guayaquil'`, o la de `ZONA_NEGOCIO` en otra instalación).
- La zona del negocio es **una por instalación** (`ZONA_NEGOCIO`, regla 11) y no se cambia con datos guardados: las columnas `@db.Date` ya guardadas se calcularon con la zona anterior.
- Las fechas fiscales con `FechaFiscal` (`desdeInstante()`, `formatoSri()`, `aFechaDb()`, `desdeFechaDb()`). **Prohibido** `getDate()`, `toISOString().slice(0,10)` o `toLocaleDateString()` sin zona: algo registrado a las 20:00 sale con la fecha de mañana en un servidor UTC. `FechaFiscal` usa la zona del negocio sola.

## 8. Relaciones e índices

- Foreign keys con `onDelete: Restrict`; nunca `Cascade` sobre documentos fiscales. **Toda FK lleva su índice** (PostgreSQL no lo crea solo).
- **Índices solo cuando una búsqueda real los necesita**, nunca por si acaso: fuera de las FK y los únicos de negocio, cada índice responde a un filtro que existe en un endpoint o a una consulta que `pg_stat_statements` mostró lenta.
- Búsqueda de texto en tablas grandes (miles de filas): índice GIN `pg_trgm` sobre `nombre_normalizado(columna)` y la consulta con `LIKE`. Se comprueba con `EXPLAIN ANALYZE` con datos reales.
- FK compuestas cuando dos datos deben ser coherentes (parroquia del mismo cantón).

## 9. Secuenciales (sin huecos, varios usuarios a la vez)

Una fila por (establecimiento, punto de emisión, tipo) con el último número. Se toma con `SELECT … FOR UPDATE` **dentro de la misma transacción** que guarda el documento: dos usuarios no obtienen el mismo número y, si falla, el número no se consume. Un número asignado nunca se reutiliza.

## 10. Enum o catálogo

- **Enum**: estados internos que solo cambian con código (`EstadoSri`).
- **Tabla de catálogo con vigencia** (`vigente_desde`, `vigente_hasta`): lo que define una norma y puede cambiar (tarifas de IVA, retenciones, comisiones reguladas). Un cambio de tarifa es una fila nueva, no un despliegue.

## 11. Alcance: varias empresas

Una instalación atiende a **varias empresas en la misma base** (decisión del 2026-11-05; detalle y motivos en `docs/modulos/empresas.md`).

- Toda tabla de negocio lleva `empresa_id uuid NOT NULL`, con FK a `organizacion.empresas` (`onDelete: Restrict`) e índice.
- Los únicos de negocio llevan la empresa: `UNIQUE (empresa_id, codigo)`, no `UNIQUE (codigo)`.
- Una tabla que otra de la misma empresa referencia tiene `UNIQUE (empresa_id, id)`, y la referencia es una **FK compuesta** `(empresa_id, x_id)`: la base impide que un registro de A apunte a uno de B.
- Los índices de los listados empiezan por `empresa_id`.
- Todo método de repositorio con datos de empresa recibe `empresaId` (del `Actor`) y filtra por él; cada módulo tiene un e2e de aislamiento entre dos empresas.
- Excepciones (sin `empresa_id`, con su motivo en el registro de tablas): `seguridad.usuarios`, `seguridad.permisos` y las tablas técnicas que no son de una empresa.
- Row Level Security: por decidir antes de producción (`docs/modulos/empresas.md`, EMP-D6).

El particionamiento se evalúa cuando el volumen lo pida, no antes.

## 12. Registro de tablas

Una fila por cada tabla creada. **Se actualiza en el PR que crea o cambia la tabla.**

| Tabla | Módulo | Tipo (maestro, documento, movimiento, unión, técnica) | Reglas especiales (índices parciales, CHECK, triggers, excepciones de auditoría) | Migración |
|---|---|---|---|---|
| `auditoria.eventos` | `auditoria` | Bitácora (solo agregar) | Inmutable: triggers `eventos_sin_cambios` (UPDATE/DELETE) y `eventos_sin_vaciar` (TRUNCATE) con `auditoria.impedir_cambios_bitacora()`. Sin FK (AUD-D2). CHECK de la acción `modulo.recurso.accion`, entidad con su id o ninguno, textos no vacíos, `antes`/`despues` objetos. Sin `creado_*`/`actualizado_*` (su hora es `ocurrido_en`). Sin `empresa_id NOT NULL`: hay eventos sin empresa (AUD-D5). `entidad_nombre` (cómo se llamaba el registro, AUD-D10) | `crear_eventos_auditoria` (6.3), `agregar_nombre_registro_eventos` (6.12c0b) |
| `seguridad.usuarios` | `auth` | Maestro (se desactiva) | Único `usuarios_nombre_usuario_key` **normal, no parcial**: el nombre nunca se reutiliza (AUTH-D3). CHECK `usuarios_nombre_usuario_formato_chk` (`^[a-z0-9._-]{3,50}$`), `usuarios_nombre_completo_no_vacio_chk`, `usuarios_intentos_fallidos_chk` (>= 0). **Sin `empresa_id`**: una persona puede trabajar en varias empresas (AUTH-D2); `ultima_empresa_id` (FK con índice) es solo la última usada | `crear_usuarios_roles` (6.4b) |
| `seguridad.roles` | `auth` | Maestro por empresa (se desactiva) | `UNIQUE (empresa_id, id)` para la FK compuesta (sirve también de índice de `empresa_id`). Únicos parciales `roles_nombre_activos_key` (`empresa_id, nombre_normalizado(nombre) WHERE activo`) y `roles_administrador_key` (`empresa_id WHERE es_administrador`: uno por empresa). CHECK `roles_administrador_activo_chk` (el Administrador no se desactiva), `roles_nombre_no_vacio_chk`, `roles_descripcion_no_vacia_chk` | `crear_usuarios_roles` (6.4b) |
| `seguridad.usuarios_roles` | `auth` | Unión | Clave `(usuario_id, rol_id)`. FK compuesta `(empresa_id, rol_id) → roles (empresa_id, id)`: la base impide un rol de otra empresa (EMP-D5). Índices `(empresa_id, usuario_id)` y `rol_id`. Solo `creado_en`/`creado_por` (unión) | `crear_usuarios_roles` (6.4b) |
| `seguridad.permisos` | `auth` | Catálogo técnico (lo escribe el arranque) | Único `permisos_codigo_key`. CHECK `permisos_codigo_formato_chk` (`modulo.recurso.accion`) y `permisos_descripcion_no_vacia_chk`. **Sin `empresa_id`** (el catálogo es del código) y **sin `creado_por`/`actualizado_por`** (no lo escribe una persona). Nunca se borra: el que el código ya no declara queda `obsoleto` | `crear_permisos` (6.6a) |
| `seguridad.roles_permisos` | `auth` | Unión | Clave `(rol_id, permiso_id)`; índice `permiso_id`. Trigger `roles_permisos_sin_administrador`: el rol Administrador no lleva filas (tiene todos, AUTH-D10). Solo `creado_en`/`creado_por` (unión) | `crear_permisos` (6.6a) |
| `seguridad.sesiones` | `auth` | Técnica (sesión) | Enum `seguridad.motivo_cierre_sesion`. Índices **parciales** `sesiones_usuario_abiertas_idx` y `sesiones_empresa_abiertas_idx` (`WHERE cerrada_en IS NULL`): sirven de índice de las dos FK porque usuarios y empresas nunca se borran. CHECK `sesiones_cierre_con_motivo_chk`, `sesiones_fechas_chk` (vence después de empezar), `sesiones_rotacion_chk` (hash anterior con su hora), `sesiones_hash_formato_chk` (SHA-256 en hex: nunca el secreto), `sesiones_ip_navegador_no_vacios_chk`. Sin `creado_*`/`actualizado_*` (excepción de las tablas de sesión). IP y navegador pueden ser `null` (fuera de una petición) | `crear_sesiones` (6.5a) |
| `organizacion.empresas` | `empresas` | Maestro (se desactiva) | Único parcial `empresas_nombre_activas_key` sobre `nombre_normalizado(nombre) WHERE activo`; CHECK `empresas_nombre_no_vacio_chk`. Sin `empresa_id` (es la tabla de empresas). La migración crea también la extensión `unaccent` y `public.nombre_normalizado()` | `crear_empresas` (6.4a) |

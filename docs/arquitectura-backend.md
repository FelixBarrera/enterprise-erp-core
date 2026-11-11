# Arquitectura del backend

API en NestJS 12.3 (TypeScript 6.0, ESM) con Prisma 7.10 sobre PostgreSQL 18, y Redis 7 + BullMQ 6 para colas. Este documento es el **destino**: el código nuevo se escribe ya así.

## Estado

Se actualiza **en el mismo commit** que termina cada pieza.

| Pieza | Estado | Dónde |
|---|---|---|
| Esqueleto: Nest arranca, Prisma conectado | ✅ Hecho (paso 2) | `src/main.ts`, `src/shared/infrastructure/prisma/` |
| Estructura hexagonal y reglas del lint por capas | ✅ Hecho (paso 5.1) | `.oxlintrc.json`; modelos en `prisma/models/` |
| Validación del `.env` (`EnvironmentVariables`) | ✅ Hecho (paso 5.3) | `src/shared/infrastructure/config/` |
| `configureApp()`: helmet, CORS, prefijo `api/v1`, pipes, filtro | ✅ Hecho (paso 5.4) | `src/shared/infrastructure/http/configure-app.ts`; e2e `test/http.e2e-spec.ts` |
| `ok()`, `DomainError`, filtro global, `ID_PIPE`, `CaracterNuloPipe` | ✅ Hecho (paso 5.4); `indiceUnicoViolado()` en el 6.4a | `src/shared/domain/errors/`, `src/shared/infrastructure/http/`, `src/shared/infrastructure/prisma/errores-prisma.ts` |
| Health check (`health`, módulo de referencia mínimo) | ✅ Hecho (paso 5.5); revisa la base, Redis entra con las colas | `src/modules/health/`; `GET /api/v1/health` (200 o 503) |
| `FechaFiscal`, `Dinero`, `RELOJ_PORT` | ✅ Hecho (paso 5.6); pruebas con el proceso en otra zona. Zona configurable (`ZONA_NEGOCIO`, `ZonaNegocioModule`) en el 6.2 | `src/shared/domain/value-objects/`, `src/shared/domain/zona-negocio.ts`, `src/shared/infrastructure/zona/`, `src/shared/application/ports/reloj.port.ts`, `src/shared/infrastructure/reloj/`; e2e `test/hora-fechas-dinero.e2e-spec.ts` |
| Logs con request ID (`nestjs-pino`), `CONTEXTO_PETICION_PORT` | ✅ Hecho (paso 5.7) | `src/shared/infrastructure/logger/`, `src/shared/infrastructure/contexto/`; e2e `test/logs.e2e-spec.ts` |
| Swagger y decoradores `@ApiRespuestaOk` / `@ApiRespuestaError` | ✅ Hecho (paso 5.8) | `src/shared/infrastructure/http/swagger.ts`, `swagger.decorators.ts`; ejemplo en `health`; e2e `test/swagger.e2e-spec.ts` |
| Transacciones (`UNIDAD_DE_TRABAJO_PORT`, `TransaccionPrisma`) | ✅ Hecho (paso 5.9); el lint prohíbe `PrismaService` en los módulos | `src/shared/application/ports/unidad-de-trabajo.port.ts`, `src/shared/infrastructure/transacciones/`; e2e `test/transacciones.e2e-spec.ts` |
| Adaptador único de conexión en UTC (`crearAdaptadorPg()`) y zona de la base | ✅ Hecho (paso 5.3) | `src/shared/infrastructure/prisma/crear-adaptador-pg.ts`; migración `configurar_zona_horaria`; e2e `test/conexion-utc.e2e-spec.ts` |
| Base de datos propia de pruebas (`_test`), `limpiarBd()`, umbrales de cobertura | ✅ Hecho (paso 5.5) | `test/global-setup.ts`, `test/utilidades/`, `vitest.config*.ts` |
| CI en GitHub Actions y Dependabot | ✅ Hecho (paso 5.2); e2e en la base `_test` desde el 5.5 | `.github/workflows/backend.yml`, `.github/dependabot.yml` |
| Paginación (`PaginacionQueryDto`, `Pagina<T>`, `@ApiRespuestaPagina`) | ✅ Hecho (paso 6.7a); la estrena `GET /roles` (6.7b: `roles.prisma.repository.ts`, con filtro de texto sin tildes en SQL a mano); `GET /usuarios` (6.7c: `usuarios.prisma.repository.ts`, con los roles de cada fila en la misma consulta) | `src/shared/application/pagina.ts`, `src/shared/infrastructure/http/paginacion-query.dto.ts`, `swagger.decorators.ts`; e2e `test/swagger.e2e-spec.ts` |
| Colas (`ColasModule`) | ⏳ Pendiente (cuando un módulo lo necesite) | `src/shared/infrastructure/colas/` |
| Subida de archivos (interceptor propio) | ⏳ Pendiente (cuando un módulo lo necesite) | `src/shared/infrastructure/http/` |
| Despliegue por cliente (forma A): imágenes `base-api`, `base-migrador` y `base-web` (Nginx con HTTPS y cabeceras), servicios comunes y la API de cada cliente | ✅ Hecho (pasos 6.16a, 6.16b y 6.16c: scripts de alta, baja, actualización, respaldo, certificados, copia externa, prueba de restauración y recuperación; guía de un servidor nuevo). Falta probarlo en un servidor real | `despliegue/` (ver su `README.md`), `docs/despliegue.md` |
| Sesiones y tokens (`seguridad.sesiones`, `SESIONES_REPOSITORY_PORT`, `GENERADOR_TOKENS_PORT`, `OPCIONES_SESION`) | ✅ Hecho (paso 6.5a); variables `JWT_SECRETO`, `SESION_DURACION_MAXIMA_HORAS`, `SESION_INACTIVIDAD_MINUTOS` | `src/modules/auth/`; migración `crear_sesiones`; e2e `test/auth-sesiones.e2e-spec.ts` |
| Login y refresh (`POST /auth/login`, `POST /auth/refresh`, cookie `token_refresco`, `OrigenPermitidoGuard`) | ✅ Hecho (paso 6.5b); `cookie-parser` en `configureApp()` | `src/modules/auth/`; e2e `test/auth-login.e2e-spec.ts` |
| Guard global (`SesionGuard`, AUTH-D9: la API no arranca si una ruta no tiene exactamente una regla), `@Publico()`, `@SoloSesion()`, `@UsuarioActual()`, AUTH-D14, `POST /auth/logout`, `GET /auth/sesion` | ✅ Hecho (paso 6.5c) | `src/shared/infrastructure/http/acceso/`, `src/modules/auth/`; e2e `test/auth-sesion.e2e-spec.ts` |
| Cambiar de empresa (`POST /auth/empresa`) y cambiar la contraseña (`POST /auth/cambiar-contrasena`); `admin:desactivar-empresa` cierra las sesiones (`DESACTIVAR_EMPRESA_CON_SESIONES_PORT`) | ✅ Hecho (paso 6.5d) | `src/modules/auth/`; e2e `test/auth-cambios-sesion.e2e-spec.ts` y `test/comandos-admin.e2e-spec.ts` |
| Catálogo de permisos (`<modulo>.permisos.ts`, `src/catalogo-permisos.ts`, `seguridad.permisos` y `roles_permisos`, sincronización al arrancar, `permisos` en `GET /auth/sesion`) | ✅ Hecho (paso 6.6a) | `src/catalogo-permisos.ts`, `src/modules/auth/`; migración `crear_permisos`; e2e `test/auth-permisos.e2e-spec.ts` |
| `@RequierePermiso()`, revisión del permiso en el guard (en la misma consulta), revisión al arrancar (permiso fuera del catálogo), `ReglasDeEscalada` (AUTH-D11, AUTH-D12) | ✅ Hecho (paso 6.6b); las reglas de escalada las usan los endpoints del 6.7 | `src/shared/infrastructure/http/acceso/`, `src/modules/auth/`; e2e `test/auth-permiso-rutas.e2e-spec.ts` |
| Auditoría: registro (`REGISTRAR_AUDITORIA_PORT`, `Actor`, `AuditoriaEnMemoria`, `vaciarAuditoria()`) | ✅ Hecho (paso 6.3) | `src/modules/auditoria/`, `src/shared/application/actor.ts`; e2e `test/auditoria.e2e-spec.ts` |
| Auditoría: consulta (`GET /auditoria/eventos` y `/:id`, `CONSULTAR_AUDITORIA_PORT`, rango de 92 días; `entidadNombre` en cada fila y la historia de un registro sin fechas ni tope, 6.12c0b) | ✅ Hecho (pasos 6.8 y 6.12c0b) | `src/modules/auditoria/`; e2e `test/auditoria-consulta.e2e-spec.ts` |
| Roles que se pueden dar (`GET /usuarios/roles-asignables`, `ReglasDeEscalada.puedeDarRol()`): la pantalla bloquea lo mismo que rechaza la API | ✅ Hecho (paso 6.12b0) | `src/modules/auth/`; e2e `test/administracion-usuarios-roles.e2e-spec.ts` |
| Catálogo de la bitácora (`<modulo>.auditoria.ts`, `src/catalogo-auditoria.ts`): las acciones, campos y valores fijos que registra cada módulo, para los textos del frontend (AUD-D9); una prueba lee los `accion: '…'` del código y `AuditoriaEnMemoria` falla con lo que no está | ✅ Hecho (paso 6.13c) | `src/catalogo-auditoria.ts` y su `.spec.ts`, `src/modules/auditoria/domain/catalogo-auditoria.ts`, `auth.auditoria.ts`, `empresas.auditoria.ts` |
| Pie de las fichas (`CONSULTAR_TRAZABILIDAD_PORT`, global): `creado` y `modificado` de la bitácora de la empresa, en las fichas de rol y de usuario | ✅ Hecho (paso 6.12a0) | `src/modules/auditoria/`, `roles-comun.ts` y `usuarios-comun.ts` de `auth`; e2e `test/administracion-roles.e2e-spec.ts` y `test/administracion-usuarios-roles.e2e-spec.ts` |
| Empresas (`organizacion.empresas`, `CONSULTAR_EMPRESAS_PORT`, `CREAR_EMPRESA_PORT`, `DESACTIVAR_EMPRESA_PORT`) y `public.nombre_normalizado()` | ✅ Hecho (paso 6.4a); `GET`/`PATCH /empresa` en el 6.7 | `src/modules/empresas/`; migración `crear_empresas`; e2e `test/empresas.e2e-spec.ts` |
| Usuarios y roles (`seguridad.usuarios`, `roles`, `usuarios_roles`), `Contrasena`, Argon2id (`HASHER_CONTRASENA_PORT`), lista de contraseñas comunes (`CONTRASENAS_COMUNES_PORT`) | ✅ Hecho (paso 6.4b); sin endpoints todavía | `src/modules/auth/`; migración `crear_usuarios_roles`; e2e `test/auth-usuarios.e2e-spec.ts` |
| Límite de peticiones (`LimitePeticionesGuard`, `AlmacenLimiteRedis`, `@LimiteLogin()`, `@SinLimite()`) y la conexión a Redis (`CONEXION_REDIS`) | ✅ Hecho (paso 6.5e): 10 intentos de login por IP, 300 por usuario y 60 por IP sin sesión por minuto (en el `.env`); si Redis cae, deja pasar | `src/shared/infrastructure/limite/`, `src/shared/infrastructure/redis/`; e2e `test/limite-peticiones.e2e-spec.ts` |
| Comandos `pnpm admin:crear-inicial`, `admin:crear-empresa`, `admin:desactivar-empresa`, `admin:renombrar-empresa` | ✅ Hecho (paso 6.4c; renombrar en el 6.15a): se compilan y se corren desde `dist/` (decisión del usuario); desde el 6.5d, desactivar una empresa cierra sus sesiones en la misma transacción | `src/comandos/`, `src/modules/auth/infrastructure/adapters/in/cli/`; e2e `test/comandos-admin.e2e-spec.ts` |

## 1. Estructura de carpetas

```
src/
├── main.ts                       ← crea la app, llama a configureApp() e iniciarWorkers()
├── comandos/                     ← entradas de los comandos admin:* (sin HTTP; corren desde dist/)
├── app.module.ts
├── generated/prisma/             ← cliente generado (no se versiona, no se edita)
├── shared/
│   ├── domain/                   FechaFiscal, Dinero, Cedula, Email, Telefono, Identificacion, DomainError
│   ├── application/              Actor, Pagina, RELOJ_PORT, UNIDAD_DE_TRABAJO_PORT, CONTEXTO_PETICION_PORT
│   └── infrastructure/           config, http, logger, prisma, reloj, transacciones, colas
└── modules/<modulo>/
    ├── <modulo>.module.ts
    ├── <modulo>.permisos.ts      ← permisos del módulo (modulo.recurso.accion)
    ├── <modulo>.auditoria.ts     ← lo que registra en la bitácora (acciones, campos, valores fijos)
    ├── domain/
    │   ├── entities/        <nombre>.entity.ts
    │   ├── value-objects/   <nombre>.vo.ts
    │   ├── services/        <nombre>.service.ts
    │   ├── errors/          <nombre>.errors.ts
    │   └── <nombre>.ts                   ← tipos y constantes simples del módulo
    ├── application/
    │   ├── ports/
    │   │   ├── in/          <operacion>.port.ts      (+ su token Symbol)
    │   │   └── out/         <nombre>.repository.port.ts
    │   └── use-cases/       <operacion>.use-case.ts
    └── infrastructure/adapters/
        ├── in/http/         <modulo>.controller.ts, dtos/
        ├── in/cola/         <nombre>.processor.ts    (si atiende una cola)
        ├── in/cli/          comandos de la terminal (y lectores de CSV)
        └── out/prisma/      <nombre>.prisma.repository.ts  (y out/cola, out/<servicio externo>)
test/                         ← e2e (*.e2e-spec.ts), global-setup, utilidades
prisma/
├── schema.prisma             ← solo generator y datasource
├── models/<modulo>.prisma    ← modelos de cada módulo
└── migrations/
```

**Lo que comparten** los DTOs o controllers de varios módulos va en `shared/infrastructure/http/`, no copiado. **`shared/` no es cajón de sastre**: lo de un módulo se queda en su módulo.

**Módulos de referencia**: `health` (el mínimo) y `auditoria` (completo y pequeño, con listado paginado). Ante la duda, **el código manda**.

## 2. Qué importa cada capa (lo hace cumplir el lint)

| Capa | Puede importar | No puede importar |
|---|---|---|
| `domain/` | Su dominio y `shared/domain/` | NestJS, Prisma, cualquier librería |
| `application/` | Su dominio, `shared/`, los **puertos de entrada** de otros módulos | Prisma, colas, librerías externas, `infrastructure/` |
| `infrastructure/` | Todo lo anterior y las librerías | — |

Se configura con `overrides` en `apps/base-backend/.oxlintrc.json` (regla `no-restricted-imports` por carpeta). Además, en todo el backend: `forwardRef` prohibido, `console.*` prohibido e imports circulares prohibidos (`import/no-cycle`).

**Lo que el lint no alcanza a revisar** (lo revisa el rol Arquitecto de Software): que `domain/` o `application/` de un módulo no importen el `domain/` de **otro** módulo (con rutas relativas no se distingue del propio).

## 3. Entre módulos

- Cada módulo es una **caja cerrada**: su API pública son los tokens de sus **puertos de entrada** que exporta su `.module.ts`. Tipos de otro módulo solo desde su `application/ports/in/`.
- **Cada tabla tiene un solo módulo dueño**; solo su repositorio la toca. Las FK entre módulos sí se permiten. Excepción: el esquema `reportes`, de solo lectura.
- **Inversión de dependencia** cuando B necesita algo de A y A ya depende de B: B declara un puerto de salida, A lo implementa y lo registra en un módulo `@Global` que exporta solo esos tokens. **Nunca `forwardRef`**.
- Sin dependencias circulares. Una operación entre módulos puede ir en una sola transacción.

## 4. Piezas transversales

Cada una con su archivo en `src/shared/`. Cuando una queda hecha se anota en el `CLAUDE.md` de la raíz ("Piezas transversales ya implementadas").

- **Arranque**: `main.ts` llama a `configureApp()`; los e2e llaman a la **misma** función para probar la configuración real.
- **Configuración**: clase `EnvironmentVariables` validada con `class-validator` al arrancar (no arranca si falta algo). Se lee con `ConfigService<EnvironmentVariables, true>`, nunca `process.env` (salvo `prisma.config.ts`; el lint no lo puede marcar: lo revisa el rol Arquitecto de Software). Variable nueva → la clase, `.env.example` y el `env:` del CI.
- **HTTP** (`configureApp()`): helmet, CORS solo a `CORS_ORIGINS`, prefijo `api/v1`, `TRUST_PROXY`, `Cache-Control: no-store` en toda respuesta, `CaracterNuloPipe` y luego `ValidationPipe`, filtro global de errores.
- **`ValidationPipe`** con `whitelist`, `forbidNonWhitelisted` ("El campo x no está permitido", también en objetos anidados: "El campo direccion.calle…"), `stopAtFirstError` y `transform`. Responde 400 con el **primer** mensaje. Como los decoradores se evalúan de abajo hacia arriba, el de tipo (`@IsString`, abajo) es el que ve quien **no manda** el campo: su mensaje sirve para los dos casos ("El nombre es obligatorio y debe ser texto").
- **`CaracterNuloPipe`** antes del `ValidationPipe`: un texto con `\0` responde 400 (PostgreSQL no lo acepta y saldría 500).
- **Respuestas**: `ok(data, mensaje)` → `{ success: true, data, message }`.
- **Errores**: `DomainError` con `TipoErrorDominio`, traducido por el filtro global (nunca en el controller):

  | Tipo | HTTP |
  |---|---|
  | `VALIDACION` | 400 |
  | `NO_AUTENTICADO` | 401 |
  | `NO_AUTORIZADO` | 403 |
  | `NO_ENCONTRADO` | 404 |
  | `CONFLICTO` | 409 |
  | `REGLA_NEGOCIO` | 422 |

  Error no controlado → 500 "Error interno del servidor" y su stack al log. Los errores propios de NestJS y Express (ruta inexistente, JSON mal escrito, cuerpo de más de 100 KB) salen con su estado y un texto en español, nunca el de inglés. Los pipes lanzan `SolicitudInvalidaException` (400 con su mensaje). **`ID_PIPE`** valida el id de la ruta (400 "El id no es válido" en vez de un 500 de PostgreSQL).
- **Prisma**: `PrismaModule` global; adaptador de conexión único `crearAdaptadorPg()` con la conexión **en UTC** (`-c TimeZone=UTC`; ver `docs/modelo-datos.md`). Nunca crear un `PrismaPg` directo. `P2002` (índice único) → el repositorio lo traduce a su error de dominio con `indiceUnicoViolado(error, 'nombre_del_indice')` (`shared/infrastructure/prisma/errores-prisma.ts`; con `@prisma/adapter-pg` el nombre del índice llega también para los escritos a mano). Ejemplo: `EmpresasPrismaRepository`.
- **Hora**: `RELOJ_PORT` (`ahora()`, un instante), global gracias a `RelojModule`; el real es `RelojSistema` (el único que lee la hora del servidor). En pruebas, `RelojFijo` (`src/shared/application/testing/`): `new RelojFijo('2026-07-15T11:00:00-05:00')`, con `fijar()` y `avanzarMinutos()`.
- **Zona del negocio**: una por instalación, `ZONA_NEGOCIO` del `.env` (por defecto `America/Guayaquil`), validada al arrancar. El dominio no lee el `.env`: `ZonaNegocioModule` (global) la fija una vez con `fijarZonaNegocio()` y el resto la lee con `zonaNegocio()` o `partesEnZonaNegocio()`. No se cambia con datos guardados. En pruebas: `fijarZonaNegocio('America/Mexico_City')` y, en el `afterEach`, `fijarZonaNegocio(ZONA_NEGOCIO_POR_DEFECTO)`.
- **Fechas del negocio**: `FechaFiscal` (solo el día, siempre en la zona del negocio): `desdeInstante(reloj.ahora())`, `desdeTexto('aaaa-mm-dd')` (la API), `aFechaDb()` / `desdeFechaDb()` (columna `@db.Date`), `formatoSri()` (`dd/mm/aaaa`), `sumarDias()` (corridos), comparaciones e `inicioDelDia()` (el instante de su 00:00 en la zona del negocio, para buscar en columnas `timestamptz` por días: `>= desde.inicioDelDia()` y `< hasta.sumarDias(1).inicioDelDia()`, sin perder el índice). En el JSON sale `'aaaa-mm-dd'`. Para la hora de un instante en la zona del negocio: `partesEnZonaNegocio()`. **Las pruebas corren con el proceso en `America/New_York`** (`vitest.config*.ts`) y las de `FechaFiscal` en seis zonas más: si algo depende de la zona del servidor, falla.
- **Dinero**: `Dinero` (dólares, exacto al centavo; por dentro centavos en `bigint`, sin librerías). Se crea desde texto (`Dinero.desdeTexto('1234.56')`, hasta 2 decimales; nunca desde `number`); `sumar`, `restar`, `Dinero.total()`, `multiplicar('0.998750')` y `porcentaje('15.0000')` con redondeo al centavo **mitad hacia arriba** (0,005 → 0,01; con negativos se aleja del cero); comparaciones. En el JSON sale como texto `'1234.50'`. En el adaptador: `decimalADinero()` / `dineroADecimal()` (`shared/infrastructure/prisma/conversiones.ts`); si la columna trae más de 2 decimales, falla en vez de redondear a escondidas.
- **Contexto de la petición**: `CONTEXTO_PETICION_PORT` da `requestId()`, `ip()` y `navegador()` a los casos de uso (`null` fuera de una petición). Global (`ContextoModule`, con nestjs-cls).
- **Swagger**: solo fuera de producción, en `/api/v1/docs` (JSON en `/api/v1/docs-json`). Decoradores propios `@ApiRespuestaOk(Dto, mensaje)` (`[Dto]` para listas; tercer argumento `201` en los POST que crean) y `@ApiRespuestaError(status, mensaje, …otrosMensajes)`: **uno por estado**; si un estado tiene varios mensajes, van todos en el mismo decorador (dos con el mismo estado se pisan). Un `@ApiTags('<nombre en español>')` por controller. Lo configura `configurarSwagger()`, que llama `configureApp()`. DTOs de entrada y salida como **clases** con `@ApiProperty` en español (sin el plugin del CLI: SWC no lo procesa).
- **Paginación**: `PaginacionQueryDto` y `Pagina<T>` (sección 9).
- **Autenticación y permisos** (paso 6): guard global (todo exige sesión salvo `@Publico()`), `@UsuarioActual()`, `@RequierePermiso()`, catálogo de permisos por módulo. Desde el 6.5c, cada ruta lleva **exactamente una** de `@Publico()` o `@SoloSesion()` (de `shared/infrastructure/http/acceso/`); si no, la API no arranca. `@SoloSesion()` ya pone en Swagger el candado (`@ApiBearerAuth`), el 401 y el 403 de AUTH-D14. Los controllers de prueba de los e2e también la llevan.
- **Auditoría** (paso 6): `REGISTRAR_AUDITORIA_PORT` dentro de la transacción del cambio.
- **Límite de peticiones** (6.5e, AUTH-D17): `LimitePeticionesGuard` (sobre `@nestjs/throttler`) corre **después** de `SesionGuard` (los dos los registra `AuthModule`, en ese orden: NestJS corre los guards globales en el orden en que se registran). Con sesión cuenta por usuario (`LIMITE_USUARIO_POR_MINUTO`, 300); sin sesión, por IP (`LIMITE_IP_POR_MINUTO`, 60; IPv6 por su red /64); el login (`@LimiteLogin()`) suma su límite por IP (`LIMITE_LOGIN_POR_MINUTO`, 10). Un contador por límite y por quién para toda la API, en ventanas de un minuto; al pasarse, 429 «Demasiadas peticiones…» con `Retry-After` (segundos) y bloqueo hasta que acabe el minuto. Una petición que el guard de sesión rechaza (401) no cuenta. `@SinLimite()` solo en `/health`. Contadores en Redis (`AlmacenLimiteRedis`, un script atómico; claves `<bd>:limite:<límite>:<quién>`). **Si Redis no responde, deja pasar** y lo registra (como mucho una vez por minuto): el bloqueo por usuario, en PostgreSQL, sigue. En los e2e los límites son de 100000 (`vitest.config.e2e.ts`) y `test/limite-peticiones.e2e-spec.ts` pone los suyos con `overrideProvider(OPCIONES_LIMITE)`; `vaciarLimites(redis)` borra los contadores de la base de pruebas.
- **Redis** (6.5e): `RedisModule` (global) da `CONEXION_REDIS` (ioredis, solo para adaptadores de `infrastructure/`), con el nombre de la base como prefijo de las claves, sin cola de espera y con 500 ms como máximo por orden: con Redis caído cada orden falla enseguida y quien la usa decide. Se reconecta sola; el log avisa al caerse y al volver. Se cierra al apagar la API y al terminar un comando.
- **Comandos** (`src/comandos/` y `modules/auth/infrastructure/adapters/in/cli/`): se compilan con `pnpm build` y se corren con `node dist/comandos/<nombre>.js` (`pnpm admin:…`, desde la raíz o el backend). Arrancan la aplicación **sin HTTP** (`ejecutarComando()`: mismo `.env` validado, misma base y zona), solo usan puertos de entrada y escriben con la `Terminal` (nunca `console.*`). Salida 0 bien, 1 no se hizo, 130 cancelado. Las contraseñas se piden ocultas, nunca en la línea de comandos. Todos auditados con `usuario_id = null` y el nombre del comando en `nombre_usuario`.
  - `admin:crear-inicial`: la primera empresa, su rol Administrador y su administrador desde `EMPRESA_INICIAL_NOMBRE` y `ADMIN_INICIAL_*` (contraseña temporal: se cambia al entrar). Si ya hay empresas, no hace nada (no toca usuarios existentes).
  - `admin:crear-empresa`: otra empresa con su Administrador, dado a un usuario existente o a uno nuevo (pregunta por la terminal).
  - `admin:desactivar-empresa`: elige de la lista de activas y confirma escribiendo el nombre.
  - `admin:renombrar-empresa`: elige de la lista de activas, pide el nombre nuevo y confirma (`s`) (6.15a).
  - Más adelante, los de importación.

## 5. Transacciones

- Varias escrituras juntas: el caso de uso usa `UNIDAD_DE_TRABAJO_PORT.ejecutar(async () => …)`. Los repositorios inyectan `TransaccionPrisma` (**nunca `PrismaService`**) y usan `this.txHost.tx`: se unen a la transacción en curso sin pasarla como parámetro. Un error hace rollback; una llamada anidada se une a la externa. Fuera de `ejecutar()`, `this.txHost.tx` es el cliente normal (cada consulta se confirma sola). **El lint prohíbe importar `PrismaService` en `src/modules/*/infrastructure/`**. Funciona también fuera de una petición (colas, comandos).
- `SELECT … FOR UPDATE` solo dentro de `ejecutar()`.
- **Nada de llamadas de red dentro de una transacción** (SRI, correo): se guarda, se confirma y después se encola.
- Índices únicos: el caso de uso pregunta antes (mensaje claro) y el índice cubre la carrera de dos peticiones a la vez.
- Prisma corta una transacción a los **5 s**: un proceso largo (una importación) pasa `{ tiempoMaximoMs }` con una constante en su caso de uso.
- Si un evento debe quedar aunque la operación falle (el intento fallido de login que suma al bloqueo), se confirma **antes** de lanzar el error.
- En unitarios, el puerto se simula con `{ ejecutar: (fn) => fn() }`; el comportamiento real lo prueba un e2e contra PostgreSQL.

## 6. Controllers y Swagger

- `@Controller('recurso')`: el prefijo `api/v1` lo pone `configureApp()`.
- Cada endpoint: `@ApiOperation({ summary, description })`, `@ApiRespuestaOk`, un `@ApiRespuestaError` por cada estado de error posible (con todos sus mensajes), `@ApiBearerAuth` y `@RequierePermiso` en el **método**.
- **Separador entre endpoints**: `// ─── <MÉTODO> /<ruta completa> — <summary> ───` y una línea en blanco encima de cada uno.
- Rutas fijas antes de las rutas con `:id` (`/clientes/tipos` antes de `/clientes/:id`).
- class-validator evalúa los decoradores de abajo hacia arriba: el de tipo (`@IsString`) va **al final**.
- No exponer en Swagger campos internos (hashes, tokens).

## 7. Colas (BullMQ)

- Lo que tarda más que una petición se encola: la petición responde **202** y la pantalla consulta el estado.
- **El estado vive en la base** (en cola, procesando, terminada, fallida, motivo), no en Redis (que guarda solo las últimas 100). Sin reintento automático (`attempts: 1`) salvo que se decida: el usuario ve que falló y la repite.
- Encolar es un **puerto de salida** con adaptador BullMQ (con tiempo máximo: con Redis caído, BullMQ espera sin avisar). Atender es un **adaptador de entrada** (`@Processor`) que solo llama a un puerto de entrada.
- Datos de la tarea: solo lo necesario (ids, rutas, el `Actor` con id y nombre de usuario).
- **Una a la vez** cuando comparten algo: `concurrency: 1` + índice único parcial (la segunda petición recibe 409). Una tarea "en curso" de un servidor caído se da por interrumpida pasado un tiempo.
- Workers solo en el servidor (`iniciarWorkers(app)` en `main.ts`); los comandos y los e2e no toman tareas, salvo el e2e que prueba la cola. Prefijo de las colas = nombre de la base (desarrollo, pruebas y escaneos no se mezclan). Redis con `appendonly`.

## 8. Subida de archivos

- Interceptor propio (no `FileInterceptor`, que responde en inglés): campo, tamaño máximo por ruta (413), extensiones (400), carpeta temporal con **nombre al azar** (el nombre original solo como dato), un archivo por petición. El permiso se revisa antes de recibir el archivo.
- Nada queda tirado: si la petición falla, el interceptor borra el archivo; si sale bien, lo borra quien lo procesa al terminar (también si falla).
- La extensión no basta: se revisa el contenido (la cabecera del archivo) antes de registrar nada.
- Subidas grandes: tiempo de la petición ampliado en `configureApp` y en Nginx solo en esa ruta.

## 9. Listados paginados

- Entrada: `pagina` (desde 1, máximo 1.000.000) y `tamano` (por defecto 20, máximo 100) en un DTO que extiende `PaginacionQueryDto` (`src/shared/infrastructure/http/`). El controller pasa `pedidoPagina(dto)` y los filtros al caso de uso. Salida: `Pagina<T>` (`src/shared/application/pagina.ts`) = `{ elementos, total, pagina, tamano }`, armada con `crearPagina(elementos, total, pedido)`; `mapearPagina()` convierte cada elemento; en el repositorio, `skip: desplazamiento(pedido)` y `take: pedido.tamano`. En Swagger: `@ApiRespuestaPagina(Dto, 'Mensaje')`.
- **Orden estable**: siempre se desempata por `id`.
- `findMany` con `skip`/`take` y `count` con el mismo `where`. Listas con detalle en **una sola consulta**, nunca consultas dentro de un bucle.

## 10. Logs

- Desarrollo, legible: `[10:59:44] WARN: GET /api/v1/usuarios?pagina=2 → 401 (4 ms) [req 057e7236]` y debajo el mensaje que vio el usuario; un 500 con su stack. Producción: una línea JSON por evento.
- Una línea por petición (sin cabeceras ni el cuerpo entero); nivel según la respuesta (5xx error, 4xx warn). `/health` no se registra.
- En desarrollo **no** se escriben las lecturas que salieron bien; en producción sí. El arranque en pocas líneas (sin la lista de rutas: están en Swagger).
- `requestId` en cada petición y en la cabecera `x-request-id` (se acepta el que llegue solo si tiene formato válido).
- **Ocultos** (`[OCULTO]`): cabeceras `authorization`, `cookie`, `set-cookie` y campos de contraseñas, tokens y secretos. Nunca `logger.log(JSON.stringify(dto))`.
- Nivel con `LOG_LEVEL` (los e2e usan `silent`).
- **Cómo está hecho** (paso 5.7):
  - En el código, como siempre: `private readonly logger = new Logger(Clase.name)` de `@nestjs/common`. Por debajo escribe con pino y, dentro de una petición, agrega `requestId`.
  - `configureApp()` monta primero `asignarRequestId` (pone `req.id` y la cabecera) y después el middleware del log (`MIDDLEWARE_LOGS`), **antes** de que NestJS lea el cuerpo: así un JSON mal escrito también queda registrado. Por eso nestjs-pino va con `useExisting`.
  - Las opciones están en `opciones-logs.ts` (`crearOpcionesLogs()`): nivel por estado, `/health` fuera, campos ocultos, hora del formato legible en la zona del negocio.
  - El filtro de errores deja el mensaje que vio el usuario en `res.locals.mensajeUsuario`; la línea de la petición lo muestra debajo (en JSON, campo `mensajeUsuario`).
  - `LoggerNest` quita los avisos de arranque de NestJS (uno por módulo y por ruta).
  - En un e2e, los logs se leen en memoria con `overrideProvider(DESTINO_LOGS).useValue({ destino, nivel: 'info' })` (ver `test/logs.e2e-spec.ts`).

## 11. Campos vacíos y `null` (contrato con el frontend)

| Capa | Controla |
|---|---|
| DTO | Qué campos aceptan `null`. Uno que no se puede quitar responde 400 ("no se puede quitar") |
| Dominio | En un opcional, texto vacío o con espacios → `null`; en un obligatorio → error "es obligatorio" |
| Base | Último resguardo: `NOT NULL` y `CHECK` |

- PATCH: **no mandar el campo = no cambiarlo; mandarlo en `null` = quitarlo** (solo en opcionales; en los demás, `@ValidateIf((_, v) => v !== undefined)`).
- Nunca se guarda `''`. En las respuestas el campo **siempre viene** (con `null`), nunca se omite. Solo los textos se vuelven `null`: un id, fecha, enum o lista vacíos son 400. Las contraseñas no se recortan.
- **Matriz en los e2e**: cada endpoint que escribe tiene un bloque que prueba cada campo ausente, `null`, `''`, solo espacios y tipo incorrecto, y comprueba la respuesta **y lo que quedó en la base**.

| Campo | Ausente | `null` | `''` / espacios | Tipo incorrecto |
|---|---|---|---|---|
| Texto obligatorio (POST) | 400 | 400 | 400 | 400 |
| Texto obligatorio (PATCH) | sin cambios | 400 | 400 | 400 |
| Texto opcional | POST `null`; PATCH sin cambios | `null` | `null` | 400 |
| Id, fecha, enum, lista obligatorios | 400 (PATCH: sin cambios) | 400 | 400 | 400 |
| Id opcional | `null` | `null` | 400 | 400 |

## 12. Documentos con dinero

Aplica a cualquier módulo que mueva dinero o valores (por ejemplo: cobros, pagos, comisiones, contabilidad).

- Saldos y costos se recalculan con la fila bloqueada (`FOR UPDATE`).
- El documento y **todos** sus efectos (detalle, movimientos, asiento, cuenta por cobrar o pagar) en una sola transacción.
- Aprobaciones, anulaciones, reversos y ajustes con su propio evento de auditoría.
- Nada emitido se borra: se anula con el documento que lo revierte.
- **Envío único**: el alta acepta un identificador de envío; si la misma petición llega dos veces (doble clic, red que reintenta), se registra una vez.
- Listados grandes medidos con `EXPLAIN ANALYZE` con datos reales.

## 13. Facturación electrónica SRI (si aplica: por confirmar con el negocio)

- No escribir XML a mano: `sri-ec` con **versión exacta**, revisada a mano antes de producción (manejo del `.p12`, firma XAdES-BES, llamadas de red inesperadas), siempre detrás de puertos (`SriSignerPort`, `SriTransmisorPort`). Plan B si se abandona: una copia propia. Excluida de Dependabot.
- Emisión **asíncrona** con BullMQ; transmisión inmediata. Guardar el XML firmado **antes** de enviar.
- Secuenciales sin huecos (`docs/modelo-datos.md`). Reintentos con espera creciente; timeout → hasta 3 intentos y cola de contingencia; rechazo → guardar motivo y permitir corrección.
- RIDE PDF guardado 7 años. Anular con nota de crédito, nunca borrar.
- Probar primero en el ambiente de pruebas del SRI (`celcer.sri.gob.ec`), un comprobante de cada tipo.
- El `.p12` se carga solo dentro del adaptador; nunca se registra en logs ni se serializa.
- Casos borde: factura sin detalles, sin identificación, consumidor final sobre el monto permitido, total 0, doble clic en "Emitir", dos cajas a la vez.

## 14. Seguridad

Login, permisos y auditoría se diseñan en `docs/modulos/auth-usuarios.md` (paso 6). Lo base, ya decidido:

- **Login**: nombre de usuario en minúsculas; Argon2id (`@node-rs/argon2`) detrás de un puerto (19 MiB, 2 iteraciones, 1 hilo), contraseña normalizada a NFKC; 8 a 128 caracteres sin reglas de composición, rechazando comunes, triviales y las que contienen el usuario o el nombre de la empresa; 5 fallos → 15 minutos de bloqueo; el mismo mensaje para todo ("Credenciales inválidas") y **siempre se verifica un hash**.
- **Tokens**: access JWT HS256 de 15 minutos (`sub` y `sid`), firmado con `JWT_SECRETO` (al menos 64 caracteres) y verificado **solo** con HS256; la hora de emisión y de vencimiento sale de `RELOJ_PORT`. Refresh **opaco** `<sid>.<secreto>.<firma>` (256 bits, en la base solo su SHA-256; la firma, un HMAC-SHA256 con una clave derivada de `JWT_SECRETO`, se revisa antes de buscar la sesión: 6.13f, SEG-05), en la cookie `token_refresco` (`httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`, vence con la sesión), rota en cada uso; reuso → revoca todas las sesiones (60 s de gracia). La fila de la sesión se bloquea (`FOR UPDATE`) mientras se rota: dos refresh a la vez no se pisan. Sesión de una jornada (máximo 13 h, 120 min sin uso; en el `.env`). Tabla, tokens y bloqueo de la fila en el 6.5a; login, refresh y la cookie en el 6.5b (hechos).
- **Cambiar la contraseña** (6.5d): pide la actual; una actual incorrecta **cuenta para el bloqueo** (al quinto, 15 minutos; bloqueada no se revisa lo escrito); la nueva no puede ser igual a la actual; cierra las **otras** sesiones (`CAMBIO_CONTRASENA`). No necesita `Origin`: usa el access token, no la cookie.
- **CSRF**: `SameSite=Strict` + verificar `Origin` contra `CORS_ORIGINS` en refresh y logout (`@UseGuards(OrigenPermitidoGuard)`, hecho en el 6.5b; sin `Origin` también se rechaza).
- **Guard** (6.5c): en cada petición verifica el JWT y, con **una sola consulta** (`ACCESOS_SESION_PORT`), la sesión viva, el usuario activo, la empresa activa y un rol activo en ella; todo fallo es el mismo 401. Con contraseña temporal, solo `GET /auth/sesion`, refresh, logout y cambiar la contraseña: lo demás, 403 (AUTH-D14). No escribe nada (AUTH-D8). Desde el 6.6b, con `@RequierePermiso()` la **misma** consulta dice si uno de sus roles activos tiene el permiso vigente; si no, 403 «No tiene permiso para esta acción» (el Administrador pasa). El orden: 401 → 403 de AUTH-D14 → 403 del permiso. Medida con `EXPLAIN ANALYZE` (50.000 sesiones, 5.000 usuarios): 0,15 ms, todo por índices.
- **Permisos**: roles configurables; solo "Administrador" es fijo y pasa porque tiene todos; sin permisos sueltos por usuario ni súper administrador. Cada módulo declara sus permisos en `<modulo>.permisos.ts` y se suma a `src/catalogo-permisos.ts`; se sincronizan con la base al arrancar (6.6a: crea, actualiza, marca `obsoleto`, nunca borra; con un bloqueo de PostgreSQL por si arrancan dos servidores a la vez; un catálogo mal escrito no deja arrancar). La sincronización va al log, no a la bitácora: el catálogo no es de una empresa ni lo cambia una persona. Un permiso fuera del catálogo, o una ruta `@Publico()` con permiso, **impide arrancar**. Sin escalada: `ReglasDeEscalada` (dominio de `auth`, 6.6b) la revisan los casos de uso que cambian roles, permisos o personas (6.7).
- **Endurecimiento HTTP**: helmet; CORS solo a `CORS_ORIGINS`; `TRUST_PROXY=true` detrás de Nginx; validación con lista blanca; consultas parametrizadas (Prisma); Dependabot y acciones del CI fijadas por SHA.
- **Auditoría**: tabla `auditoria.eventos` inmutable (triggers), sin FK, escrita con `REGISTRAR_AUDITORIA_PORT` dentro de la transacción; acción `modulo.recurso.accion`, entidad e id, `antes`/`despues` solo con lo que cambió, nunca hashes ni tokens; si no cambió nada, no hay evento. `Actor` con IP, navegador y `requestId`. Cada módulo que registra declara en `<modulo>.auditoria.ts` sus acciones, los campos de `antes`/`despues` y los valores fijos (un motivo), y se suma a `src/catalogo-auditoria.ts` (6.13c): es la lista que copia el frontend para sus textos (AUD-D9). No se usa al registrar; lo hacen cumplir las pruebas (`catalogo-auditoria.spec.ts` lee los `accion: '…'` del código, y `AuditoriaEnMemoria` rechaza lo que no está).

## 15. Pruebas

| Qué | Cómo | Mínimo |
|---|---|---|
| Casos de uso | Unitarios con puertos simulados | 80 % (90 % en lo fiscal) |
| Adaptadores / controllers | | 60 % / 40 % |
| API completa | e2e contra PostgreSQL real con `configureApp()` | Flujos críticos y matriz de `null` |

- Vitest con **SWC** (esbuild no emite la metadata de decoradores y la inyección de NestJS falla). Umbrales en `vitest.config.ts`: `pnpm test:cov` y el CI fallan si bajan.
- Unitarios en `src/**/*.spec.ts`; e2e en `test/**/*.e2e-spec.ts`, **en serie**, con su propia configuración.
- **Base propia de pruebas** `<bd>_test` (o `DATABASE_URL_TEST`): si el nombre no termina en `_test`, no arranca; un `global-setup` la crea y migra solo; **nunca tocan la base de desarrollo**. `limpiarBd()` en `beforeEach` de los e2e que escriben; `vaciarAuditoria()` tras la preparación en los que cuentan eventos.
- `RelojFijo` por constructor en unitarios y con `.overrideProvider(RELOJ_PORT)` en e2e. `AuditoriaEnMemoria` en unitarios.
- Casos borde obligatorios del login: usuario inexistente, contraseña incorrecta, bloqueado, **mismo tiempo de respuesta** para inexistente e incorrecta, refresh vencido, refresh reusado.

## 16. CI (GitHub Actions)

Archivos: `.github/workflows/backend.yml`, `.github/workflows/frontend.yml` y `.github/dependabot.yml`. Corre en cada PR y en cada push a `main` que toque sus archivos (o los de la raíz).


- Filtros por ruta (backend y frontend aparte).
- Backend: install → `prisma generate` → `migrate deploy` → lint → tsc → `test:cov` → e2e (con PostgreSQL y Redis de servicio) → build.
- Frontend: install → lint → tsc de las pruebas → `test:cov` → build.
- Acciones fijadas por **SHA**. Variables del CI = valores de prueba.
- Repositorio privado en plan gratuito: la protección de ramas no se aplica (la disciplina es manual) y hay 2.000 minutos al mes. Si se acaban, correr todo en local y mergear avisando.
- **Dependabot** semanal (lunes temprano), agrupado (Angular, NestJS, Prisma, herramientas). Varias menores juntas → un solo PR propio. Las mayores, aparte y leyendo sus notas. Paquetes en pareja, juntos (vitest y su cobertura; Angular y Material). `sri-ec` excluida.

## 17. Antes de producción (despliegue)

No bloquean los merges del día a día; se juntan cuando se elige el servidor.

**Servidor**
- [ ] Decidir dónde corre (nube con internet de respaldo, servidor local con respaldo en la nube, o nube sola). En la nube, **medir la latencia** desde las oficinas antes de contratar.
- [x] Docker Compose; Nginx con TLS, HTTP/2 y compresión; `server_tokens off` (6.16a, `despliegue/`). El certificado de Let's Encrypt de cada cliente lo saca `scripts/alta-cliente.sh` y lo renueva `scripts/renovar-certificados.sh` (6.16b). Con Let's Encrypt de verdad, en el primer servidor real: lista de `docs/despliegue.md`, sección 12.
- [x] (6.16a, `despliegue/web/fragmentos/`; probado en Chrome: login, PWA y fuentes sin bloqueos) Cabeceras del frontend en Nginx: `Content-Security-Policy` (con `frame-ancestors 'none'`, `form-action 'self'`), `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` (probar que la PWA y las fuentes cargan). Para la PWA: `worker-src 'self'` y `manifest-src 'self'` en la política, y `ngsw-worker.js` y `ngsw.json` con `Cache-Control: no-cache`.
- [ ] `TRUST_PROXY=true`, `CORS_ORIGINS` con el dominio real, secretos de 64 caracteres (`JWT_SECRETO` propio de la instalación, generado con `openssl rand -base64 64`). Ya en `despliegue/clientes/ejemplo/api.env.example` (Nginx reemplaza `X-Forwarded-For`, así la IP no se puede inventar); `scripts/alta-cliente.sh` los genera (6.16b). **Cambio (6.16a)**: los secretos van en un archivo por cliente con permisos `600` (`env_file` de Docker), no en variables sueltas del servidor: con varias copias en una máquina, cada una necesita los suyos.
- [x] Usuario de PostgreSQL de la aplicación con permisos mínimos (no dueño de las tablas); migraciones con otro usuario (`prisma migrate deploy`): `<cliente>_app` y `<cliente>_dueno` (6.16a, `despliegue/README.md`; probado: no crea ni borra tablas, no cambia la bitácora ni entra a otra base). `scripts/alta-cliente.sh` lo hace solo (6.16b).
- [x] Redis con `appendonly`, sin puerto público y con contraseña (6.16a).
- [ ] Rutas de subidas grandes con su límite y tiempo en Nginx.
- [x] Aviso de versión nueva del service worker (paso 5.13).

**Datos y operación**
- [x] Respaldos automáticos: `pg_dump` diario, 30 días locales, 7 años externos, restauración probada cada mes. `scripts/respaldar.sh` (diario por cron, comprobado, 30 días en el servidor) y `actualizar.sh` respalda antes de cada migración (6.16b). **6.16c**: `scripts/copia-externa.sh` (restic, cifrada: la última de cada día por 30 días y la de cada mes por 84 meses, con el `.env` de cada cliente) y `scripts/probar-restauracion.sh --copia-externa` (cron mensual); recuperación de un servidor perdido con `recuperar-cliente.sh` (`docs/despliegue.md`, secciones 8, 9 y 11; probado en la PC con una carpeta y con otro servidor por `ssh`). **Falta** elegir el destino y probarlo en el servidor real (sección 12 de esa guía).
- [x] `pg_stat_statements` activado (6.16a: cargado en `despliegue/compose.yml` y creado en cada base al dar de alta al cliente).
- [ ] Monitoreo de `/api/v1/health` con aviso y errores con Sentry. También que avise si fallan los scripts del cron (respaldo, copia externa, certificados, prueba de restauración): hoy se revisan sus logs a mano cada semana (`docs/despliegue.md`, sección 9).
- [ ] Limpieza periódica de sesiones vencidas (cola), con el plazo en que se guardan las cerradas: tienen IP y navegador (OPS-02, OPS-04, CUM-03 del 6.13e).
- [ ] Decidir Row Level Security con la prueba de carga (EMP-P2, SEG-04).
- [ ] Plazo de conservación de la bitácora (AUD-P1) y segundo factor (AUTH-P2): preguntas para el usuario.
- [ ] Migración final con fecha de corte.
- [ ] Despliegues **fuera de horario**.

**Pruebas y seguridad**
- [ ] Prueba de carga con k6 contra el servidor real (de 20 al doble de los usuarios esperados).
- [ ] Revisar límites de peticiones con la carga real.
- [ ] Escaneo OWASP ZAP de la API en un ambiente aparte (nunca contra producción).
- [ ] Un análisis con SonarQube Community en Docker.
- [ ] `/code-review ultra` (lo lanza el usuario) y cierre de los hallazgos aplazados.
- [ ] Todas las pruebas manuales y los E2E de navegador en verde.
- [ ] Cambiar de empresa con la PWA instalada (FS-02 del 6.13e).

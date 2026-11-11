# CLAUDE.md: Base ERP

## 1. El proyecto

El proyecto tiene dos partes: **la base**, que sirve para cualquier negocio, y **el negocio** de este proyecto, que se construye encima.

### 1.1 La base (cualquier negocio)

Los módulos `health`, `empresas`, `auth` (usuarios, roles, permisos y sesión) y `auditoria`, y todo `shared/`, en el backend y en el frontend (pasos 5 y 6).

- **Nada del rubro dentro**: ni tablas, ni campos, ni reglas, ni textos de un negocio en particular. Si un negocio necesita algo distinto, va en su propio módulo, encima de la base.
- **Lo que cambia de una instalación a otra va en el `.env`** (por ejemplo, `ZONA_NEGOCIO`), nunca en el código.
- Varias empresas en la misma base de datos, cada una con sus datos separados (`docs/modulos/empresas.md`).
- Lo que el usuario ve con la marca (nombre, logo, colores, el texto del login) es de cada proyecto: `docs/arquitectura-frontend.md`, 8.6.

### 1.2 El negocio de este proyecto

**Por definir**: qué es el negocio, a qué rubro pertenece, quién lo regula (si alguien lo hace) y si reemplaza a un sistema que ya existe (si es así, su inventario de funciones va en `docs/sistema-actual.md`).

**Reglas de negocio:** todavía no. Se agregan, con sus requerimientos, en una sección nueva de este archivo al diseñar el primer módulo de negocio (paso 7).

El nombre "Base ERP" solo aparece en lo que ve el usuario (login, pestaña, menú, PWA), en las carpetas y en los `package.json`. **Nunca dentro del código** (tablas, clases, funciones, variables).

## 2. Estructura del monorepo

| Carpeta | Qué es | Guía propia |
|---|---|---|
| `apps/base-backend` | API (NestJS) | `apps/base-backend/CLAUDE.md` |
| `apps/base-frontend` | Aplicación web (Angular, PWA) | `apps/base-frontend/CLAUDE.md` |
| `docs/` | Reglas, arquitectura, diseño de módulos y guías de cada paso | ver sección 8 |
| `docker-compose.yml` | PostgreSQL y Redis locales | `docs/manual-docker.md` |
| `despliegue/` | El servidor: imágenes de Docker, Nginx y una copia de la API por cliente | `despliegue/README.md` |

## 3. Stack (versiones fijas)

- **Raíz**: pnpm 12.10.1 (nunca npm), Node 24.21.0 (`.nvmrc`).
- **Backend**: NestJS 12.3 + TypeScript 6.0 (ESM), Prisma 7.10 con `@prisma/adapter-pg`, PostgreSQL 18, Redis 7 + BullMQ 6, `@nestjs/config`, `class-validator`, `helmet`, `@nestjs/swagger`, `@nestjs/throttler`, `nestjs-pino`, `nestjs-cls` + `@nestjs-cls/transactional`, `@nestjs/jwt` + `@node-rs/argon2` (sin Passport). Pruebas con Vitest 4 + SWC y `supertest`. Lint con `oxlint --type-aware`.
- **Frontend**: Angular 21.2 + Signals, Angular Material y CDK 21.2, PWA (`@angular/service-worker`), Vitest 4 + jsdom, oxlint, SCSS.
- **Más adelante**: Playwright + AXE para pruebas en el navegador (antes de producción), `sri-ec` solo si hay factura electrónica.

## 4. Arquitectura hexagonal

Cada módulo, en el backend y en el frontend, tiene tres capas:

| Capa | Qué tiene | Puede usar |
|---|---|---|
| `domain/` | Reglas puras: entidades, value objects, errores | Solo su dominio y `shared/domain/` |
| `application/` | Casos de uso y **puertos** (las "interfaces" que el caso de uso necesita) | Su dominio, `shared/` y los puertos de entrada de otros módulos |
| `infrastructure/` | **Adaptadores**: controllers, pantallas, Prisma, HTTP, colas | Todo lo anterior y las librerías |

Las capas de afuera dependen de las de adentro; el dominio no depende de nada. **El lint lo hace cumplir.** Los puertos se inyectan con un token (`Symbol` en el backend, `InjectionToken` en el frontend). Detalle en `docs/arquitectura-backend.md` y `docs/arquitectura-frontend.md`.

## 5. Orquestación

- **Backend primero, luego frontend**: el frontend se hace cuando el contrato de la API ya existe. Un cambio que toca los dos va en dos pasos.
- Nunca mezclar reglas de un framework en el otro proyecto.

## 6. Reglas transversales (detalle en `docs/reglas-obligatorias.md`)

1. Hexagonal en cada módulo; el lint lo hace cumplir.
2. Prohibido `any` (sin excepciones); `unknown` solo en los bordes.
3. API siempre `{ success, data, message }`: éxito con `ok()`, errores como excepciones que traduce el filtro global.
4. Nombres en español (sin tildes ni ñ en identificadores); en inglés solo sufijos de arquitectura, términos técnicos universales y lo que impone el framework. Archivos en kebab-case.
5. Controllers y componentes sin lógica de negocio.
6. Casos de uso sin infraestructura: usan puertos inyectados con token.
7. Toda entrada validada con `class-validator`, con `message` en español.
8. Secretos en `.env`, validados al arrancar; `.env.example` sin valores reales.
9. Migraciones solo con `prisma migrate`, revisando su SQL; nunca editar una aplicada.
10. Dinero nunca en `number`: `Dinero` en el dominio, `Decimal` en la base; tarifas en catálogo con vigencia; el frontend no recalcula totales.
11. **Hora del negocio siempre, esté donde esté el servidor**: una zona por instalación (`ZONA_NEGOCIO` en el `.env`, por defecto `America/Guayaquil`; no se cambia con datos guardados); fechas del negocio con `FechaFiscal` en esa zona, pantallas en esa zona (el frontend la recibe del backend) (nunca la del navegador ni la del servidor); instantes en `timestamptz` y conexión técnica en UTC; la hora se pide a `RELOJ_PORT`, nunca `new Date()`.
12. Tablas con id UUID v7, `timestamptz`, `creado_en/por` y `actualizado_en/por`; maestros se desactivan; documentos fiscales y movimientos nunca se borran.
13. Access token en memoria, refresh token en cookie `httpOnly`; permiso por endpoint `modulo.recurso.accion`; sin súper administrador.
14. Auditoría de todo cambio en la misma transacción, en una tabla que no se puede modificar.
15. Cobertura de casos de uso ≥ 80 % (90 % en lo fiscal); e2e con base de datos propia; `lint`, `test`, `test:e2e` y `tsc` en verde antes de commitear.
16. Solo español, sin i18n; `<html lang="es">`.
17. Un paso = una rama, un commit, un PR, con su guía en `docs/guias/`.
18. Backend primero, luego frontend.
19. Sin npm y sin `console.*` (en el backend, `Logger`).
20. No commitear `.env`, `.p12`, `.pem`, `node_modules/`, `dist/` ni archivos grandes.

## 7. Roles de revisión

Todo módulo se revisa **sobre el código terminado y con las pruebas en verde**. Obligatorios: Full Stack Senior, Arquitecto de Software, DBA Senior, Arquitecto de Seguridad, Auditor/Contador, DevOps/SRE, QA Senior, Especialista del dominio (el rubro del proyecto), Product Owner. Condicionales: Arquitecto Fiscal SRI, Arquitecto de Datos, Arquitecto de Integraciones, Diseñador UX/UI, Cumplimiento regulatorio (si el rubro tiene regulador). Si uno que aplica rechaza, no se mergea. Detalle y formato en `docs/roles-auditoria.md`.

## 8. Documentación

| Archivo | Qué tiene | Cuándo se actualiza |
|---|---|---|
| `docs/reglas-obligatorias.md` | Las 20 reglas en detalle | Al cambiar una regla (con aviso al usuario) |
| `docs/arquitectura-backend.md` | Estructura, piezas transversales, transacciones, colas, logs, despliegue; **tabla de estado** | En el mismo commit que termina una pieza |
| `docs/arquitectura-frontend.md` | Estructura, reglas, formularios, listados, sesión, experiencia de uso; **tabla de estado** | Igual |
| `docs/modelo-datos.md` | Convenciones de tablas y **registro de tablas** | En el PR que crea o cambia una tabla |
| `docs/plantilla-modulo.md` | Cómo pedir y armar un módulo, con checklists | Al cambiar el molde |
| `docs/roles-auditoria.md` | Roles de revisión y matriz por módulo | Al planificar un módulo |
| `docs/manual-docker.md` | Docker del día a día | Al cambiar `docker-compose.yml` |
| `docs/modulos/<modulo>.md` | Diseño de cada módulo (antes de la primera migración) | En su propio PR, y la revisión de cada fase |
| `docs/guias/` | **Avance de cada paso** (la memoria del proyecto) | En el commit de cada paso |
| `docs/despliegue.md` | Servidor nuevo paso a paso (Ubuntu, Docker, dominio, copia externa, cron, si se pierde el servidor) y lo que falta probar en uno real | Al cambiar `despliegue/` o lo que se hace en el servidor |
| `docs/sistema-actual.md` | Si hay un sistema anterior: lo que hace hoy (inventario de funciones) y lo que choca con las reglas | Cuando el usuario sume funciones; se usa al diseñar cada módulo de negocio |
| `docs/pruebas-manuales/<modulo>.md` | Pruebas a mano en el navegador (lista, orden y reglas comunes en su `README.md`) | Con las pantallas del módulo |

## 9. Comandos (se van sumando)

```bash
# Instalar y levantar
docker compose up -d                 # PostgreSQL (127.0.0.1:5433) y Redis (127.0.0.1:6380)
pnpm install
pnpm dev:backend                     # API en http://localhost:3000/api
pnpm dev:frontend                    # Web en http://localhost:4200 (proxy /api → 3000)

# Calidad
pnpm lint
pnpm test
pnpm test:e2e
pnpm --filter base-backend exec tsc --noEmit
pnpm --filter base-frontend exec tsc --noEmit -p tsconfig.spec.json
pnpm --filter base-frontend test:cov   # cobertura con umbrales (también test:cov en el backend)

# Un solo test
pnpm --filter base-backend exec vitest run src/ruta/al/archivo.spec.ts
pnpm --filter base-backend exec vitest run --config ./vitest.config.e2e.ts test/archivo.e2e-spec.ts
pnpm --filter base-frontend exec ng test --watch=false --include src/ruta/al/archivo.spec.ts

# Base de datos
pnpm --filter base-backend exec prisma migrate dev --name <verbo>_<que>
pnpm --filter base-backend exec prisma migrate dev --name <verbo>_<que> --create-only   # con SQL a mano
pnpm --filter base-backend exec prisma generate     # en Prisma 7, migrate dev ya no lo hace solo
pnpm --filter base-backend exec prisma studio       # para mirar; no editar fechas

# Estado de la API
curl -s http://localhost:3000/api/v1/health          # 200 si todo responde, 503 si la base no

# Empresas y administradores (en una PC, antes pnpm build: se corren desde dist/;
# en el servidor: docker exec -it <cliente>-api node dist/comandos/admin-<nombre>.js)
pnpm admin:crear-inicial         # primera empresa y su administrador, desde ADMIN_INICIAL_* del .env
pnpm admin:crear-empresa         # otra empresa con su administrador (pregunta por la terminal)
pnpm admin:desactivar-empresa    # elige de la lista y confirma escribiendo el nombre
pnpm admin:renombrar-empresa     # elige de la lista, escribe el nombre nuevo y confirma

# Servidor (forma A; servidor nuevo: docs/despliegue.md; scripts: despliegue/README.md). En una PC: --puertos-de-prueba y --certificado-de-prueba
despliegue/scripts/iniciar-servidor.sh --dominio midominio.com --correo yo@midominio.com   # una vez (otra zona: --zona America/Mexico_City)
despliegue/scripts/alta-cliente.sh <cliente>      # base, .env, tablas, API, administrador, certificado y sitio
despliegue/scripts/actualizar.sh [<cliente>]      # tras git pull: respaldar, migrar y reiniciar uno por uno
despliegue/scripts/respaldar.sh [<cliente>]       # cron diario; renovar-certificados.sh, cron diario
despliegue/scripts/baja-cliente.sh <cliente>      # último respaldo y borra todo lo del cliente
despliegue/scripts/copia-externa.sh copiar        # cron diario: copia cifrada fuera del servidor (iniciar, listar, traer)
despliegue/scripts/probar-restauracion.sh --copia-externa   # cron mensual: restaura en bases aparte y revisa
despliegue/scripts/recuperar-cliente.sh <cliente> # servidor nuevo: el cliente desde su respaldo y su .env
```

Documentación de la API (solo fuera de producción): http://localhost:3000/api/v1/docs (JSON en `/api/v1/docs-json`).

Pendientes (se agregan cuando existan): importaciones, frontend abierto a la red con HTTPS para el celular.

## 10. Piezas transversales ya implementadas

Se llena a medida que se hacen (paso 5 en adelante): **dónde está cada una y cómo se usa**, para reutilizarla en vez de reinventarla.

| Pieza | Dónde | Cómo se usa |
|---|---|---|
| Reglas del lint por capas | `apps/base-backend/.oxlintrc.json` | Automático con `pnpm lint`. El patrón con excepciones (`!`) va siempre al final de cada lista |
| CI y Dependabot | `.github/workflows/backend.yml`, `frontend.yml`, `.github/dependabot.yml` | Corre solo en cada PR y push a `main`. Ver el resultado: `gh pr checks <N>`. Acciones fijadas por SHA |
| Prisma (conexión) | `apps/base-backend/src/shared/infrastructure/prisma/` | `PrismaModule` global. Modelos nuevos en `prisma/models/<modulo>.prisma`. La conexión se crea **solo** con `crearAdaptadorPg()` (en UTC) |
| Configuración validada | `apps/base-backend/src/shared/infrastructure/config/` | Leer con `ConfigService<EnvironmentVariables, true>` y `config.get('X', { infer: true })`. Variable nueva → `EnvironmentVariables`, `.env.example` y `env:` del CI |
| Zona horaria de la base | migración `configurar_zona_horaria` | La base muestra hora de Guayaquil a otras herramientas; el backend sigue en UTC. Otra zona: `docs/manual-docker.md` |
| Zona del negocio (`ZONA_NEGOCIO`) | `shared/domain/zona-negocio.ts`, `shared/infrastructure/zona/` | Automático: `ZonaNegocioModule` la fija al arrancar. Leerla: `zonaNegocio()`; hora de un instante: `partesEnZonaNegocio()`. En pruebas, `fijarZonaNegocio('Europe/Madrid')` y en el `afterEach` volver a `ZONA_NEGOCIO_POR_DEFECTO` |
| `configureApp()` | `apps/base-backend/src/shared/infrastructure/http/configure-app.ts` | La llaman `main.ts` y los e2e (`crearApp()` de `test/utilidades/`). Rutas bajo `/api/v1` |
| Respuestas y errores | `shared/infrastructure/http/respuesta-api.ts`, `shared/domain/errors/domain-error.ts` | Controller: `return ok(data, 'Mensaje')`. Error de negocio: una clase que extiende `DomainError` con su `TipoErrorDominio`; el filtro global lo traduce |
| Base de pruebas propia | `apps/base-backend/test/global-setup.ts`, `test/utilidades/` | Automático en `pnpm test:e2e`: usa `<bd>_test` (o `DATABASE_URL_TEST`), la crea y migra. `crearApp({ controllers, providers, sobrescribir })` levanta la API; `limpiarBd(prisma)` en el `beforeEach` de los e2e que escriben |
| Umbrales de cobertura | `apps/base-backend/vitest.config.ts` | `pnpm --filter base-backend test:cov` falla si bajan (casos de uso 80 %, adaptadores 60 %, controllers 40 %) |
| Módulo de referencia `health` | `apps/base-backend/src/modules/health/` | El ejemplo mínimo de las tres capas, puertos con token y pruebas: copiar su forma |
| `ID_PIPE` y `CaracterNuloPipe` | `shared/infrastructure/http/` | `@Param('id', ID_PIPE) id: string`. El de carácter nulo es global (automático) |
| Reloj (`RELOJ_PORT`) | `shared/application/ports/reloj.port.ts`, `shared/infrastructure/reloj/` | `@Inject(RELOJ_PORT) private readonly reloj: RelojPort` y `this.reloj.ahora()`. En pruebas `new RelojFijo('2026-07-15T11:00:00-05:00')` (`shared/application/testing/`); en e2e `overrideProvider(RELOJ_PORT).useValue(reloj)` |
| `FechaFiscal` | `shared/domain/value-objects/fecha-fiscal.vo.ts` | `FechaFiscal.desdeInstante(this.reloj.ahora())` (fecha en la zona del negocio), `desdeTexto('aaaa-mm-dd')`, `aFechaDb()` / `desdeFechaDb()` para `@db.Date`, `formatoSri()`. Buscar por días en una columna `timestamptz`: `>= desde.inicioDelDia()` y `< hasta.sumarDias(1).inicioDelDia()` (ejemplo: `rangoDeConsulta()` de `modules/auditoria/domain/`). Las pruebas corren con el proceso en Nueva York a propósito |
| `Dinero` | `shared/domain/value-objects/dinero.vo.ts`, `shared/infrastructure/prisma/conversiones.ts` | `Dinero.desdeTexto('1234.56')`, `sumar`, `multiplicar('1.5')`, `porcentaje('15')` (redondeo mitad hacia arriba). En el adaptador `decimalADinero()` / `dineroADecimal()`. En el JSON sale como texto |
| Logs con request ID | `shared/infrastructure/logger/`, `shared/infrastructure/contexto/` | `private readonly logger = new Logger(Clase.name)` (de `@nestjs/common`). Cada respuesta trae `x-request-id`. Nivel con `LOG_LEVEL`. Legible en desarrollo, JSON en producción. Nunca registrar un DTO entero |
| Contexto de la petición (`CONTEXTO_PETICION_PORT`) | `shared/application/ports/contexto-peticion.port.ts` | `@Inject(CONTEXTO_PETICION_PORT)`: `requestId()`, `ip()`, `navegador()` (`null` fuera de una petición) |
| Transacciones (`UNIDAD_DE_TRABAJO_PORT`, `TransaccionPrisma`) | `shared/application/ports/unidad-de-trabajo.port.ts`, `shared/infrastructure/transacciones/` | Caso de uso: `@Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort` y `this.unidad.ejecutar(async () => { … })` (proceso largo: `{ tiempoMaximoMs }`). Repositorio: `constructor(private readonly txHost: TransaccionPrisma)` y `this.txHost.tx.<modelo>…`; **nunca `PrismaService`** (el lint lo prohíbe en los módulos). En unitarios `{ ejecutar: (fn) => fn() }`. Ejemplo: `health` (`verificador-base-datos.prisma.ts`) |
| Paginación (`PaginacionQueryDto`, `Pagina<T>`) | `shared/infrastructure/http/paginacion-query.dto.ts`, `shared/application/pagina.ts` | DTO del listado: `class ListarXQueryDto extends PaginacionQueryDto { …filtros }`; controller: `@Query() query` y `execute({ ...filtros }, pedidoPagina(query))`; repositorio: `findMany({ where, orderBy: [..., { id: 'asc' }], skip: desplazamiento(pedido), take: pedido.tamano })` y `count({ where })` con el mismo `where`; caso de uso: `crearPagina(elementos, total, pedido)`. Swagger: `@ApiRespuestaPagina(Dto, 'Mensaje')`. Ejemplo: `GET /roles` (`roles.prisma.repository.ts`: filtro de texto sin mayúsculas ni tildes con `public.nombre_normalizado()` y `%`/`_` escapados); con una lista dentro de cada fila, sin una consulta por fila: `GET /usuarios` (`usuarios.prisma.repository.ts`, roles con `json_agg`) |
| Swagger | `shared/infrastructure/http/swagger.ts`, `swagger.decorators.ts` | En `/api/v1/docs` (solo fuera de producción). En cada endpoint: `@ApiOperation`, `@ApiRespuestaOk(Dto, 'Mensaje')` (`[Dto]` lista, `201` si crea) y `@ApiRespuestaError(400, 'Mensaje 1', 'Mensaje 2')` (uno por estado). Ejemplo: `modules/health/…/health.controller.ts` |
| `Actor` | `shared/application/actor.ts` | Último parámetro de los casos de uso que escriben (`execute(comando, actor: Actor)`). Fuera de una petición: `actorDelSistema({ empresaId, nombreUsuario })` |
| Auditoría (`REGISTRAR_AUDITORIA_PORT`) | `modules/auditoria/` (global) | `@Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort` y, **dentro** del `unidad.ejecutar()` del cambio, `await this.auditoria.registrar({ accion: 'modulo.recurso.accion', entidad, entidadId, entidadNombre, antes, despues }, actor)`: guarda solo lo que cambió y oculta lo sensible. `entidadNombre` es cómo se llama el registro en ese momento (el nombre de usuario, el del rol, el nuevo si se renombró; de una sesión, su usuario): **siempre que haya `entidad`**, porque la lista de la bitácora lo muestra en «Sobre qué». En unitarios `new AuditoriaEnMemoria()` (`modules/auditoria/application/testing/`) y `auditoria.acciones()`; en e2e `vaciarAuditoria(prisma)` tras preparar los datos. Consulta para la pantalla: `GET /auditoria/eventos` (`desde`/`hasta` obligatorios, hasta 92 días, salvo la historia de un registro con `entidad` + `entidadId`, sin fechas ni tope (6.12c0b); `accion` exacta o por grupo) y `/:id` (6.8); quienes aparecen, para el filtro «Usuario»: `GET /auditoria/usuarios` (6.12c0) |
| Catálogo de la bitácora (`CATALOGO_AUDITORIA`) | `src/catalogo-auditoria.ts`, `modules/<modulo>/<modulo>.auditoria.ts`, `modules/auditoria/domain/catalogo-auditoria.ts` | Módulo que registra: `export const AUDITORIA_X: DeclaracionAuditoria = { modulo: 'x', acciones: [...], campos: [...], valores: { motivo: Object.values(MotivoX) } }` en `<modulo>.auditoria.ts` y una línea en `src/catalogo-auditoria.ts`. Acción, campo de `antes`/`despues` o valor fijo nuevo: agregarlo ahí y su texto en el frontend (`acciones.ts`, `cambios.ts` del módulo `auditoria`, AUD-D9). No cambia lo que se guarda: `catalogo-auditoria.spec.ts` falla si un `accion: '…'` del código no está (o sobra) y `AuditoriaEnMemoria` rechaza lo que no está; con datos inventados, `new AuditoriaEnMemoria(reloj, { catalogo: null })` |
| Pie de una ficha (`CONSULTAR_TRAZABILIDAD_PORT`) | `modules/auditoria/application/ports/in/consultar-trazabilidad.port.ts` (global) | Ficha con «Creado / Modificado»: `@Inject(CONSULTAR_TRAZABILIDAD_PORT)` y `trazabilidad.de({ empresaId, entidad, entidadId, accionesAlta: ['x.y.crear'], accionesCambio: ['x.y.editar', …] })` → `{ creado, modificado }` (`{ en, por }` o `null`), de la bitácora de esa empresa; en la respuesta, `HuellaRespuestaDto` (`modules/auth/…/dtos/huella-respuesta.dto.ts`). Llamarlo **después** de `auditoria.registrar()` del cambio. Ejemplo: `vistaDeRol()` de `roles-comun.ts`. En unitarios, la misma `AuditoriaEnMemoria` |
| Empresas (`CONSULTAR_EMPRESAS_PORT`) | `modules/empresas/` | Importar `EmpresasModule` en el módulo que lo use e `@Inject(CONSULTAR_EMPRESAS_PORT)`: `buscarActiva(id)`, `nombres(ids)`, `hayAlguna()`. `GET`/`PATCH /empresa` (la activa de la sesión, nunca por id) van por `EMPRESA_ACTIVA_PORT`. Crear, desactivar y renombrar (`CREAR_EMPRESA_PORT`, `DESACTIVAR_EMPRESA_PORT`, `RENOMBRAR_EMPRESA_PORT`) solo desde los comandos. En unitarios, `EmpresasEnMemoria` e `idDePrueba(n)` (`modules/empresas/application/testing/`) |
| Filtro «empieza por» con Prisma | `modules/auditoria/infrastructure/adapters/out/prisma/eventos-auditoria.prisma.repository.ts` | `startsWith` y `contains` son un `LIKE` y **Prisma no escapa** `%`, `_` ni `\`: `texto.replace(/[\\%_]/gu, '\\$&')` antes de pasarlo (comprobado en el e2e del 6.8) |
| Índice único → error de dominio | `shared/infrastructure/prisma/errores-prisma.ts` | En el repositorio: `catch (e) { if (indiceUnicoViolado(e, 'x_key')) throw new XDuplicadoError(); throw e; }`. Nombres únicos sin mayúsculas ni tildes: índice sobre `public.nombre_normalizado(col)` (ejemplo en la migración `crear_empresas`) |
| Contraseñas (`Contrasena`, `HASHER_CONTRASENA_PORT`, `CONTRASENAS_COMUNES_PORT`) | `modules/auth/domain/value-objects/contrasena.vo.ts`, `modules/auth/infrastructure/adapters/out/argon2/`, `…/contrasenas/` | Contraseña nueva: `Contrasena.crear(texto, { nombreUsuario, nombresEmpresas, esComun: (t) => comunes.esComun(t) })` (rechaza cortas, comunes, triviales y las que contienen el usuario o la empresa) y `hasher.calcularHash(contrasena)`. Verificar: `hasher.verificar(hash, escrita)` (normaliza solo; un hash dañado da `false`). Nunca se muestra: sale `[OCULTO]`. Lista: `contrasenas-comunes.txt` (origen y licencia al lado) |
| Comandos `admin:*` | `src/comandos/` (entradas), `modules/auth/infrastructure/adapters/in/cli/` | Comando nuevo: una clase que implementa `ComandoAdmin` (en `in/cli/`, usa solo puertos de entrada y `Terminal`), su entrada en `src/comandos/<nombre>.ts` con `ejecutarComando((app, terminal) => new Comando(app.get(PUERTO), terminal))` y su script en los dos `package.json` (`node dist/comandos/<nombre>.js`). Dentro: `correr()` (errores del negocio y Ctrl+C en español), `preguntarHasta()` (3 intentos), `terminal.preguntarOculto()` para contraseñas y `actorDelComando('admin:<nombre>')`. En pruebas, `TerminalDePrueba(['respuesta 1', …])` |
| Sesión: login y refresh | `modules/auth/infrastructure/adapters/in/http/` (`auth.controller.ts`, `cookie-refresco.ts`, `origen-permitido.guard.ts`) | Una ruta que use la cookie `token_refresco` (refresh, logout): `@UseGuards(OrigenPermitidoGuard)` (CSRF: `Origin` dentro de `CORS_ORIGINS`). Leer, poner o borrar la cookie solo con `leerCookieRefresco()`, `ponerCookieRefresco()` y `borrarCookieRefresco()` |
| Acceso a las rutas (`@Publico()`, `@SoloSesion()`, `@RequierePermiso()`, `@UsuarioActual()`) | `shared/infrastructure/http/acceso/`; el guard en `modules/auth/infrastructure/adapters/in/http/sesion.guard.ts` | **Cada** ruta lleva exactamente una: `@Publico()`, `@SoloSesion()` o `@RequierePermiso('modulo.recurso.accion')` (si falta o sobra, o el permiso no está en ningún `<modulo>.permisos.ts`, la API no arranca). Sin el permiso: 403 «No tiene permiso para esta acción»; el Administrador pasa siempre. `@SoloSesion({ conContrasenaTemporal: true })` solo en las rutas de AUTH-D14. Quién opera: `@UsuarioActual() actor: Actor` (último parámetro del caso de uso). Ya pone en Swagger el candado, el 401 y el 403 (si la ruta tiene otro 403, su `@ApiRespuestaError(403, …)` repite esos mensajes). En los e2e, los controllers de prueba también llevan su regla |
| Reglas contra la escalada (`ReglasDeEscalada`) | `modules/auth/domain/services/reglas-de-escalada.ts` | En un caso de uso que cambia roles, permisos o datos de una persona, **antes** de escribir: `revisarCambioDeRoles({ quien, usuarioId, actuales, nuevos })`, `revisarCambioDePermisosDeRol({ quien, rol, nuevos })`, `revisarQueQuedeAdministrador(n)`, `revisarCambioDePersona({ empresasDelUsuario, empresasDondePuede })` (en el caso de uso, `revisarCambioDePersona()` de `usuarios-comun.ts` junta los datos) y `revisarAccionSobrePersona({ empresas, daSuPoder })` (temporal, desactivar y reactivar: lo que puede cada uno en cada empresa sale de `poderEnEmpresa()` de `roles-comun.ts`). Cada una lanza su error (`EscaladaError`, `UltimoAdministradorError`, `UsuarioDeOtraEmpresaError`) |
| Contraseña temporal (`GENERADOR_CONTRASENA_TEMPORAL_PORT`) | `modules/auth/application/ports/out/generador-contrasena-temporal.port.ts`, `domain/value-objects/contrasena-temporal.ts`, `infrastructure/adapters/out/contrasenas/generador-contrasena-temporal.crypto.ts` | AUTH-D13: `generador.generar()` da 12 caracteres legibles con `crypto.randomInt`; pasarla siempre por `Contrasena.crear()` (con el usuario y sus empresas) y reintentar si la rechaza (ya hecho: `generarContrasenaTemporal(nombre, empresaIds, { empresas, generador, comunes })` de `usuarios-comun.ts`, fuera de la transacción). La respuesta que la trae lleva `@Header('Cache-Control', 'no-store')`; en la bitácora, `claveTemporal: true` (nunca el valor). En unitarios, `GeneradorContrasenaDePrueba([...])` |
| Límite de peticiones (`@LimiteLogin()`, `@SinLimite()`) | `shared/infrastructure/limite/` (el guard lo registra `AuthModule` después de `SesionGuard`) | Automático en toda la API: por usuario con sesión, por IP sin ella. `@LimiteLogin()` solo en el login; `@SinLimite()` solo en `/health`. Números en `LIMITE_*_POR_MINUTO`. En e2e: `overrideProvider(OPCIONES_LIMITE).useValue({ … })` y `vaciarLimites(app.get(CONEXION_REDIS))` en el `beforeEach` |
| Redis (`CONEXION_REDIS`) | `shared/infrastructure/redis/` | Solo en adaptadores: `@Inject(CONEXION_REDIS) private readonly redis: Redis` (de `ioredis`). Claves con el nombre de la base delante (lo pone la conexión; en `KEYS` va a mano). Cada orden falla enseguida si Redis cae: decidir qué hacer en ese caso |
| Catálogo de permisos (`CATALOGO_PERMISOS`) | `src/catalogo-permisos.ts`, `modules/<modulo>/<modulo>.permisos.ts`, `modules/auth/` | Módulo con permisos: `export const PERMISOS_X = { 'x.recurso.accion': 'Descripción' } as const;` en `<modulo>.permisos.ts` (en el orden en que se verán al armar un rol) y una línea `{ modulo: 'x', nombre: 'Título del grupo', permisos: PERMISOS_X }` en `src/catalogo-permisos.ts` (`GET /permisos` los da agrupados con ese nombre, en ese orden). Se copian solos a `seguridad.permisos` al arrancar (nunca se borran: el que sale queda obsoleto). Código mal escrito, repetido o de otro módulo: la API no arranca. En e2e, `limpiarBd()` los borra: `await app.get(SINCRONIZAR_PERMISOS_PORT).execute()` si la prueba los necesita |
| Frontend: lint por capas | `apps/base-frontend/.oxlintrc.json` | Automático con `pnpm lint` (`--type-aware`). Mismas reglas que el backend: el patrón con `!` va al final; si dos `overrides` tocan un archivo, gana el último |
| Frontend: URL de la API | `src/app/shared/infrastructure/http/url-api.ts`, `respuesta-api.ts` | En el `<modulo>.api.ts`: `` this.http.get<RespuestaApi<Dto>>(`${URL_API}/recurso`) ``. Nunca `http://…` |
| Frontend: módulo de referencia `health` | `apps/base-frontend/src/app/modules/health/` | Tres capas, puertos con `InjectionToken`, `health.providers.ts` en la ruta lazy, pruebas de cada capa: copiar su forma |
| Frontend: cobertura y presupuesto | `apps/base-frontend/vitest.config.mts`, `angular.json` | `pnpm --filter base-frontend test:cov` falla si bajan (casos de uso 80 %, stores 60 %, pantallas 40 %). `pnpm build` falla si el paquete inicial pasa de 600 kB |
| Frontend: errores HTTP (`ErrorHttp`) | `src/app/shared/infrastructure/http/errores.interceptor.ts`, `shared/domain/errors/error-http.ts` | Automático (en `app.config.ts`). La pantalla recibe un `ErrorHttp`: muestra `error.message` solo si `!error.avisado`. Sin aviso global para una petición: `context: new HttpContext().set(SIN_AVISO_GLOBAL, true)` |
| Frontend: avisos y confirmaciones | `src/app/shared/infrastructure/avisos/` | `inject(NotificacionesService)`: `exito('…')`, `error('…')`. `inject(ConfirmacionService)`: `if (!(await this.confirmacion.confirmar({ titulo, mensaje, textoConfirmar, peligro: true }))) return;` |
| Frontend: layout y menú | `src/app/shared/infrastructure/layout/`, `src/app/app.menu.ts`, `src/app/pantallas.routes.ts` | Pantalla nueva: su ruta lazy dentro de `PANTALLAS_ROUTES` (sale ya con cabecera, menú y pie) y su opción en `MENU` (`{ texto, ruta, icono }` dentro de una sección). El menú del usuario (`menu-usuario/`, con `@defer`) y la empresa activa del menú lateral leen `USUARIO_CABECERA` (`nombreCompleto`, `nombreUsuario`, `nombreEmpresa`, `empresas`, `empresaActivaId`, `esAdministrador`, `cambiarEmpresa()`, `irACambiarContrasena()`, `salir()`). «Cambiar de empresa»: `inject(SelectorEmpresaService).abrir()` (`layout/selector-empresa/`). En la PC el menú se encoge a 72 px (`menu.estrecho` en el navegador); en el modo estrecho, un nombre que solo se ve al pasar el mouse o con Tab: `[appEtiquetaLateral]="estrecho() ? 'Texto' : null"` |
| Frontend: tema, marca e íconos | `src/styles.scss`, `public/marca/`, `public/iconos.svg`, `shared/infrastructure/layout/marca/` | Colores y medidas solo con las variables (`var(--color-primario)`, `--radio`, `--radio-tarjeta`, `--estado-peligro`…). Clases comunes en la tabla de `docs/arquitectura-frontend.md`, 8.5 (`.encabezado-pagina`, `.tarjeta`, `.filtros`, `.celda-doble`, `.numero`, `.estado estado--exito`, `.iniciales`, `.boton-peligro`, `.enlace` (un enlace dentro de un texto), `.mensaje-error`, `.oculto-visual`…). Fuente Inter dentro del proyecto. Ícono (de línea): `<app-icono nombre="inicio" />` (uno nuevo: su `<symbol>` y su nombre en `NombreIcono`). Logo: `<app-marca />` (`tono="claro"` sobre el azul oscuro). Nombre y textos de la marca: solo en `MARCA` (`layout/marca/marca.ts`; en el backend, `src/marca.ts`), nunca escritos en otro archivo (DOM-01). Marca provisional: cambiarla según la sección 8.6. |
| Frontend: PWA | `ngsw-config.json`, `public/manifest.webmanifest`, `public/iconos-app/`, `src/app/shared/infrastructure/pwa/` | Automático en `pnpm build` (solo producción; en `ng serve` no hay service worker). Un endpoint de solo lectura que deba verse sin conexión: un `dataGroups` con `freshness` en `ngsw-config.json`, nunca uno que emita. Íconos nuevos: `docs/marca/README.md` |
| Frontend: sesión (`AuthStore`, `SesionFacade`, `sesionInterceptor`, `sesionGuard`) | `apps/base-frontend/src/app/modules/auth/` | Automático: el layout pide sesión y cada petición a `/api/v1` lleva el token (ante un 401 renueva una vez y repite). Quién está: `inject(AuthStore).sesion()`; permiso: `tienePermiso(sesion, 'x.y.z')` (`domain/sesion.ts`). Una petición que no debe llevar token: `SIN_INTERCEPTOR_SESION`. La cabecera, por `USUARIO_CABECERA` (el nombre de la empresa sale de la sesión: uno nuevo, al recargar). Con contraseña temporal, `sesionGuard` lleva solo a `/contrasena-temporal`. Ir a una pantalla y volver después: `?volver=` con `volverDesde(router.url)` y, al llegar, `destinoTrasIngreso(volver)` (`domain/destino-tras-ingreso.ts`; nunca a otro sitio ni a una pantalla de la sesión). En pruebas, `sesionDePrueba()` y `tokenDePrueba()` (`application/testing/`) y `store.fijar({ token, sesion })` |
| Frontend: permisos (`permisoGuard`, `*appConPermiso`, `permiso` en el menú) | `src/app/shared/infrastructure/permisos/`, `shared/infrastructure/layout/menu.ts` | Ruta: `{ path: 'usuarios', canMatch: [permisoGuard('auth.usuario.ver')], loadChildren: … }` (sin el permiso, aviso y al inicio sin descargar la pantalla). Opción del menú: `{ texto, ruta, icono, permiso: 'auth.usuario.ver' }` (el mismo de la ruta; las secciones vacías se ocultan solas). Botón: `<button *appConPermiso="'auth.usuario.crear'">` (importar `ConPermisoDirective`). En pruebas, `{ provide: PERMISOS_SESION, useValue: new PermisosDePrueba(['x.y.z']) }`. Ocultar no es proteger |
| Frontend: contraseña temporal en pantalla (`ContrasenaTemporalService`) | `src/app/modules/auth/infrastructure/adapters/in/contrasena-temporal/` | Tras crear un usuario o darle otra contraseña: `await inject(ContrasenaTemporalService).mostrar({ titulo: 'Usuario creado', nombreUsuario, contrasena, textoListo: 'Listo, ir a su ficha' })` (termina al cerrarla; solo con su botón). Nunca guardar la contraseña en la URL, el estado ni el navegador. En pruebas de una pantalla, `{ provide: ContrasenaTemporalService, useValue: { mostrar: vi.fn(() => Promise.resolve()) } }` |
| Frontend: validador `obligatorio` | `src/app/shared/infrastructure/formularios/validadores.ts` | `new FormControl('', { nonNullable: true, validators: [obligatorio] })`; en la plantilla, `hasError('obligatorio')` |
| Frontend: listados (`crearListado()`) | `src/app/shared/infrastructure/listados/` | En la pantalla: `protected readonly listado = crearListado({ leer, escribir, cargar: (c) => … })` (filtros y página en la URL; `leer`/`escribir` en su `filtros-url.ts` con `textoDeUrl()`, `booleanoDeUrl()`, `opcionDeUrl()` y `filtroAUrl()`). `listado.filtrar({ … })`, `listado.buscar({ … })` (espera 300 ms). Lo de la URL que no es un filtro (no se limpia ni cuenta): `fijos: (parametros) => ({ … })` (ejemplo: la historia de un registro en `bitacora/`, 6.12c2). En la plantilla: `<app-barra-carga [activa]="listado.cargando()" />`, `<app-estado-lista [listado]="listado" vacio="No hay …" />`, `<app-paginador [listado]="listado" />`; en el celular (`segunPantalla(CELULAR)`), tarjetas con `.lista-tarjetas` y `.tarjeta-fila`. En pruebas, `ListadoDePrueba` |
| Frontend: fichas y migas de pan | `src/app/shared/infrastructure/fichas/`, `shared/infrastructure/layout/migas/` | `<app-encabezado-ficha titulo volverA="/roles" textoVolver="Roles">` con `fichaSimbolo`, `fichaEstado`, `fichaDetalle` y `fichaAcciones`; `<app-pie-ficha [creado] [modificado] />` (un enlace a la derecha: `<a pieAccion class="enlace pie-ficha__enlace">`; ejemplo «Ver historia» en `ficha-rol/`) (un botón de `fichaAcciones` en un `@if`: único elemento de ese `@if`, sin anidar otro). Más de dos acciones: un menú «Acciones» con `<mat-menu class="menu-acciones">` (las que quitan algo, tras `.menu-acciones__separador`, con `.menu-acciones__peligro`); en el celular «⋮» y `[accionesEnLinea]="enCelular()"` en el encabezado (ejemplo: `ficha-usuario/`, 6.12b3). Molde de lista, ficha y alta: `modules/auth/…/lista-roles/`, `ficha-rol/` (pestañas con `mat-tab-group` y una sola barra «N cambios sin guardar») y `nuevo-rol/` (las mismas pestañas, un solo «Registrar…»). Migas: `data: { miga: 'Roles' }` en la ruta y, en la ficha, `mostrarMigaActual(() => this.x()?.nombre ?? null)` |
| Frontend: fechas (`fechaHora`, `ZONA_NEGOCIO`, `RELOJ`) | `src/app/shared/infrastructure/fechas/`, `shared/domain/fechas.ts` | `{{ x.en \| fechaHora }}` («02/11/2026 10:15») o `fechaHora: 'dia'` (con segundos, `'segundos'`), dentro de `<span class="numero">`. En la zona que manda el backend (la entrega `auth`); en pruebas, `{ provide: ZONA_NEGOCIO, useValue: signal('Europe/Madrid') }`. Hoy en la zona del negocio: `diaEnZona(inject(RELOJ).ahora(), zona())` (`aaaa-mm-dd`; con `sumarDias()`, `esDia()` y `diaATexto()`); nunca `new Date()` suelto; en pruebas, `{ provide: RELOJ, useValue: relojFijo('2026-11-07T10:00:00-05:00') }`. Ejemplo: `modules/auditoria/…/bitacora/` (6.12c1) |
| Frontend: opciones de Material | `src/app/shared/infrastructure/material/material.providers.ts` | Se agregan a `PROVIDERS_MATERIAL` (lazy). **Nunca** importar algo de `@angular/material` en `app.config.ts`. Ya trae `ErrorAlTocar`: el error de un campo se ve si está mal y se tocó (al enviar, `markAllAsTouched()`; un campo vaciado con `reset('')` queda sin error) |
| Despliegue por cliente (forma A) | `despliegue/` (`README.md`, `compose.yml`, `cliente.compose.yml`, `api/` y `web/Dockerfile`) | Una imagen de la API para todos los clientes, cada uno con su `clientes/<cliente>/api.env` y su contenedor `<cliente>-api`; Nginx (`web`) entra por subdominio y pasa `/api` a esa copia. Cabeceras de seguridad y caché en `web/fragmentos/` (un `add_header` en un `location` borra los de afuera: incluir `cabeceras.conf` en cada uno). Variable nueva del `.env` → también `clientes/ejemplo/api.env.example`. Base del cliente con dos usuarios: `_dueno` (migraciones) y `_app` (la API, sin cambiar tablas ni la bitácora). Todo con los scripts de `despliegue/scripts/` (funciones comunes en `comun.sh`: un `docker compose exec`/`run` que no lee nada va con `</dev/null`, si no se come las respuestas del script). Migración que crea un esquema o tabla que la API no debe cambiar: agregar su `REVOKE` en `quitar_permisos_tras_migrar()`. La zona de la base de cada cliente la pone `fijar_zona_base()` (de su `ZONA_NEGOCIO`) después de migrar y de restaurar: un ajuste de la base (`ALTER DATABASE … SET`) no viaja en el respaldo. Base de un cliente creada a mano para restaurar: `cerrar_base()` (lo de quién se conecta no viaja en el respaldo). Un archivo que un contenedor necesita y puede no existir: montar su carpeta, no el archivo (si falta, Docker crea una carpeta con su nombre). Copia externa (restic) y recuperación: `docs/despliegue.md`, secciones 8 y 11 |

## 11. Cómo trabajar con Claude

- Abrir Claude en la raíz del proyecto.
- **Hablar siempre en español, claro y sin tecnicismos.** Si hace falta un término técnico, explicarlo en una frase.
- **Antes de cada paso, leer los `docs/` que tocan.** Si un patrón está desactualizado, contradice el código o no encaja, **avisar** (qué, dónde, qué se propone) en vez de corregirlo en silencio; al final del paso, sección "Patrones a corregir" en la guía.
- Si algo no está claro, **preguntar antes de asumir**.
- Si el paso es grande, primero proponer la lista de sub-pasos y **esperar el visto bueno**.
- Antes de algo difícil de deshacer (borrar, migrar, hacer push, crear o mergear un PR), avisar y esperar el visto bueno.
- **Un paso = una rama (`feat/<modulo>-<que>`, `fix/…`, `docs/…`) = un commit = un PR.** Commits en español. Nunca push directo a `main`. Merge con merge commit.
- Al empezar la sesión y al cerrar cada paso: `gh pr list --state open`; los PR no se acumulan.
- Al terminar un paso: decir qué se hizo, qué quedó pendiente y cuál es el siguiente.

### Reglas de GitHub: antes y después de cada merge (obligatorio)

Si el repositorio es privado en el plan gratuito, GitHub **no** aplica protección de ramas: estas reglas se cumplen a mano, siempre (y aunque la aplique, se cumplen igual).

Configuración recomendada del repositorio (está en GitHub, no en archivos): alertas de Dependabot y sus actualizaciones de seguridad (abre PRs solo), **solo merge commit** (sin squash ni rebase) y borrar la rama al mergear.

**Antes de mergear un PR** (si algo no cuadra, **no se mergea** y se avisa):
1. `gh pr checks <N>`: el CI en verde.
2. En local: `pnpm lint`, `tsc`, `pnpm test` y `pnpm test:e2e` (si tocó la API) en verde.
3. `gh pr view <N> --json mergeable,mergeStateStatus`: `MERGEABLE` y `CLEAN`.
4. Si el PR cierra un módulo: revisión de roles hecha (`docs/roles-auditoria.md`); y revisión visual si tiene pantallas.
5. Visto bueno del usuario. El merge se hace con `gh pr merge <N> --merge --delete-branch` (merge commit), a la vista, nunca dentro de un script.

**Después del merge:**
1. `git switch main && git pull`.
2. Comprobar que el CI de `main` quedó en verde (`gh run list --branch main --limit 3`).
3. Guía del paso y memoria al día.
4. `gh pr list --state open`: los PR no se acumulan.

**Siempre:**
- Nunca push directo a `main`. Push, PR y merge solo con el visto bueno del usuario.
- PRs apilados: si el 2.º sale de la rama del 1.º, **antes** de mergear el 1.º cambiar la base del 2.º a `main` (`gh pr edit <2.º> --base main`); si no, `--delete-branch` cierra el 2.º.
- Nada de PRs de una línea solo de docs: va dentro del PR del paso en curso.
- Correr todo en local antes de subir (lint, tsc, test, e2e, build): el CI confirma, no reemplaza. En un repositorio privado del plan gratuito, además, los minutos de Actions son limitados (2.000 al mes).

### Guardar el avance y avisar cuándo hacer `/clear` (obligatorio)

La memoria de Claude se borra con `/clear` y es por máquina. **Lo que no está en `docs/guias/`, se pierde.**

1. **Al empezar una sesión**: leer `docs/guias/README.md` y la guía del último paso para saber dónde se quedó.
2. **Durante el paso**: mantener al día su guía en `docs/guias/` (plantilla en `docs/guias/README.md`): qué se hizo, decisiones y por qué, cómo probarlo, qué falta.
3. **Al terminar el paso**: completar la guía y marcarla en el índice de `docs/guias/README.md`, **dentro del mismo commit del paso**.
4. **Avisar con una línea clara al final del mensaje:**
   - Paso terminado y guardado: «✅ Paso guardado: puedes hacer `/clear`.» (si el PR sigue abierto: «cuando mergees el PR»).
   - Sesión larga a mitad de paso: guardar primero el estado en la guía (sección «Estado actual» con lo que sigue) y decir: «✅ Avance guardado. Puedes hacer `/clear`; para seguir, dime: *continúa el paso N*».
   - Si el contexto crece mucho a mitad de un paso, sugerir `/compact`.
   - **Nunca decir que puede hacer `/clear` si la guía no está guardada.** Claude no ejecuta `/clear` ni `/compact`: los escribe la persona.

## 12. Prohibiciones absolutas

- npm o yarn.
- `any`.
- Credenciales, RUC, cédulas, datos de personas o URLs reales en el código.
- Borrar documentos fiscales o movimientos.
- Editar una migración ya aplicada; `db push` en producción.
- Commitear `.env`, `.p12`, `.pem` o el kit de arranque (`docs/kit-arranque-*.md`, solo local).
- Copiar código, documentos o datos de otros proyectos o empresas, o mencionarlas en archivos o commits. Este repositorio es solo de Base ERP.

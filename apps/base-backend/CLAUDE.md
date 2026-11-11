# CLAUDE.md: backend (base-backend)

Lee primero el `CLAUDE.md` de la raíz y `docs/reglas-obligatorias.md`. Detalle completo en `docs/arquitectura-backend.md`; la receta de módulos en `docs/plantilla-modulo.md`; las tablas en `docs/modelo-datos.md`.

> **Estado:** la base está hecha (pasos 5 y 6): las piezas transversales (tabla de la sección 10 del `CLAUDE.md` raíz) y los módulos `health`, `auditoria`, `empresas` y `auth`. Módulos de referencia para copiar su forma: `health` (el mínimo) y, con listado paginado, auditoría y transacción, `auth` (roles: `roles.controller.ts`, `administrar-roles.use-case.ts`, `roles.prisma.repository.ts`). **Ante la duda, el código manda.**

## Stack

NestJS 12.3 · TypeScript 6.0 **ESM** · Prisma 7.10 + `@prisma/adapter-pg` · PostgreSQL 18 · Redis 7 + BullMQ 6 · `nestjs-pino` · `nestjs-cls` + `@nestjs-cls/transactional` · `@nestjs/jwt` + `@node-rs/argon2` (sin Passport) · Vitest 4 + SWC · oxlint · Prettier.

## Estructura de un módulo

```
src/modules/<modulo>/
├── <modulo>.module.ts
├── <modulo>.permisos.ts
├── <modulo>.auditoria.ts   (lo que registra en la bitácora; se junta en src/catalogo-auditoria.ts)
├── domain/            entities/ value-objects/ services/ errors/
├── application/
│   ├── ports/in/      <operacion>.port.ts       (+ token Symbol)
│   ├── ports/out/     <nombre>.repository.port.ts
│   └── use-cases/     <operacion>.use-case.ts
└── infrastructure/adapters/
    ├── in/http/       <modulo>.controller.ts, dtos/
    ├── in/cola/       <nombre>.processor.ts
    ├── in/cli/
    └── out/prisma/    <nombre>.prisma.repository.ts
```

Lo común va en `src/shared/` (`domain/`, `application/`, `infrastructure/`). `shared/` no es cajón de sastre.

## Reglas de dependencias

- `domain/`: solo su dominio y `shared/domain/`. Nada de NestJS, Prisma ni librerías.
- `application/`: su dominio, `shared/` y los **puertos de entrada** de otros módulos. Nada de Prisma, colas, librerías ni `infrastructure/`.
- `infrastructure/`: todo.
- Entre módulos: solo los tokens de sus puertos de entrada que exporta su `.module.ts`. Cada tabla tiene **un solo módulo dueño**. Si hay ciclo, inversión de dependencia con un módulo `@Global`; **nunca `forwardRef`**.

## Ejemplo de cada pieza (resumido; el código real está en los módulos de referencia)

```ts
// application/ports/in/registrar-cliente.port.ts
export const REGISTRAR_CLIENTE_PORT = Symbol('REGISTRAR_CLIENTE_PORT');
export interface RegistrarClientePort {
  execute(comando: RegistrarClienteComando, actor: Actor): Promise<ClienteVista>;
}

// application/ports/out/cliente.repository.port.ts
export const CLIENTE_REPOSITORY_PORT = Symbol('CLIENTE_REPOSITORY_PORT');
export interface ClienteRepositoryPort {
  existeIdentificacion(identificacion: string): Promise<boolean>;
  guardar(cliente: Cliente): Promise<void>;
}

// application/use-cases/registrar-cliente.use-case.ts
@Injectable()
export class RegistrarClienteUseCase implements RegistrarClientePort {
  constructor(
    @Inject(CLIENTE_REPOSITORY_PORT) private readonly clientes: ClienteRepositoryPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
  ) {}

  async execute(comando: RegistrarClienteComando, actor: Actor): Promise<ClienteVista> {
    if (await this.clientes.existeIdentificacion(comando.identificacion)) {
      throw new ClienteYaExisteError(comando.identificacion); // DomainError CONFLICTO → 409
    }
    const cliente = Cliente.crear(comando, this.reloj.ahora());
    return this.unidad.ejecutar(async () => {
      await this.clientes.guardar(cliente);
      await this.auditoria.registrar({ accion: 'clientes.cliente.crear', actor, /* … */ });
      return ClienteVista.desde(cliente);
    });
  }
}

// infrastructure/adapters/out/prisma/cliente.prisma.repository.ts
@Injectable()
export class ClientePrismaRepository implements ClienteRepositoryPort {
  constructor(private readonly txHost: TransaccionPrisma) {}   // nunca PrismaService
  async guardar(cliente: Cliente): Promise<void> {
    await this.txHost.tx.cliente.create({ data: ClienteMapper.aPersistencia(cliente) });
  }
}

// infrastructure/adapters/in/http/clientes.controller.ts

// ─── POST /api/v1/clientes — Registrar un cliente ───
@Post()
@ApiOperation({ summary: 'Registrar un cliente', description: '…' })
@ApiRespuestaOk(ClienteRespuestaDto, 'Cliente registrado', 201)
@ApiRespuestaError(409, 'Ya existe un cliente con esa identificación')
@RequierePermiso('clientes.cliente.crear')
async registrar(@Body() dto: RegistrarClienteDto, @UsuarioActual() actor: Actor) {
  return ok(await this.registrarCliente.execute(dto, actor), 'Cliente registrado');
}
```

## Lo que más se olvida

- **ESM**: los imports relativos llevan `.js` (`import { X } from './x.js'`).
- **Respuestas**: `ok(data, mensaje)`; nunca armar `{ success… }` a mano.
- **Errores**: `DomainError` con `TipoErrorDominio` (VALIDACION 400, NO_AUTENTICADO 401, NO_AUTORIZADO 403, NO_ENCONTRADO 404, CONFLICTO 409, REGLA_NEGOCIO 422). Los traduce el filtro global, nunca el controller. Lo no controlado → 500 "Error interno del servidor" y el stack al log. `P2002` (índice único) → el repositorio lo traduce a su error de dominio (`indiceUnicoViolado()` dice cuál).
- **Transacciones**: `UNIDAD_DE_TRABAJO_PORT.ejecutar()` en el caso de uso; repositorios con `TransaccionPrisma` y `this.txHost.tx` (el lint prohíbe `PrismaService` en los módulos). Nada de red dentro de una transacción. Límite de 5 s: un proceso largo pasa `{ tiempoMaximoMs }`.
- **Hora**: `RELOJ_PORT`; `RelojFijo` en pruebas. Prohibido `new Date()` y `Date.now()` en dominio y casos de uso (el lint no lo detecta: lo revisa el Arquitecto de Software). Fecha del negocio: `FechaFiscal.desdeInstante(this.reloj.ahora())`.
- **Dinero**: `Dinero`, nunca `number`; se crea desde texto (`Dinero.desdeTexto('10.50')`) y en el JSON sale como texto. `Prisma.Decimal` solo en el adaptador (`decimalADinero()` / `dineroADecimal()`).
- **Configuración**: `ConfigService<EnvironmentVariables, true>`; nunca `process.env` (salvo `prisma.config.ts`). Variable nueva → clase `EnvironmentVariables`, `.env.example` y el `env:` del CI.
- **Prisma**: conexión siempre por `crearAdaptadorPg()` (en UTC); nunca `new PrismaPg()` directo. Cliente en `src/generated/prisma/` (no se versiona, no se edita). En Prisma 7, después de `migrate dev`, correr `prisma generate`.
- **Validación**: cada decorador de `class-validator` con `message` en español; el de tipo (`@IsString`) va **al final** (se evalúan de abajo hacia arriba). Por eso el mensaje del de tipo es el que ve quien no manda el campo: escribirlo para los dos casos ("El nombre es obligatorio y debe ser texto"). Números de la URL con `@Type(() => Number)`.
- **`null`**: PATCH sin el campo = no cambia; con `null` = lo quita (solo opcionales). Nunca se guarda `''`. En la respuesta el campo siempre viene.
- **Swagger** (`/api/v1/docs`, fuera de producción): `@ApiTags` en el controller; `@ApiOperation`, `@ApiRespuestaOk`, un `@ApiRespuestaError` por cada **estado** de error posible (varios mensajes del mismo estado en un solo decorador), `@ApiBearerAuth` (ya lo ponen `@SoloSesion()` y `@RequierePermiso()`) y la regla de acceso en el **método**. DTOs como clases con `@ApiProperty` en español (sin el plugin del CLI). Separador `// ─── <MÉTODO> /<ruta> — <summary> ───` con una línea en blanco encima. Rutas fijas antes de las rutas con `:id`. Nunca exponer hashes ni tokens.
- **Acceso**: cada endpoint con **exactamente una** de `@Publico()`, `@SoloSesion()` o `@RequierePermiso('modulo.recurso.accion')`; si falta o sobra, la API no arranca. `@SoloSesion()` ya pone `@ApiBearerAuth`, el 401 y el 403 de AUTH-D14; `@RequierePermiso()`, lo mismo con el 403 «No tiene permiso para esta acción». El permiso se declara en `<modulo>.permisos.ts` (uno que no esté ahí no deja arrancar).
- **Límite de peticiones**: automático (por usuario con sesión, por IP sin ella). Solo `/health` lleva `@SinLimite()`; `@LimiteLogin()`, solo el login.
- **Logs**: `new Logger(Clase.name)` de `@nestjs/common` (por debajo, nestjs-pino con el número de petición). Sin `console.*`. Nunca `JSON.stringify(dto)` al log. Datos de la petición para un caso de uso: `CONTEXTO_PETICION_PORT`.
- **Listados**: DTO que extiende `PaginacionQueryDto`; respuesta `Pagina<T>`; desempate por `id`; nada de consultas dentro de un bucle.

## Nombres de archivos

| Qué | Nombre |
|---|---|
| Entidad | `cliente.entity.ts` |
| Value object | `cedula.vo.ts` |
| Errores | `clientes.errors.ts` |
| Puerto de entrada / salida | `registrar-cliente.port.ts` / `cliente.repository.port.ts` |
| Caso de uso | `registrar-cliente.use-case.ts` (+ `.spec.ts` al lado) |
| Controller y DTO | `clientes.controller.ts`, `dtos/registrar-cliente.dto.ts` |
| Repositorio Prisma | `cliente.prisma.repository.ts` |
| Permisos | `clientes.permisos.ts` |
| Lo que registra en la bitácora | `clientes.auditoria.ts` |
| Modelos de Prisma | `prisma/models/<modulo>.prisma` |
| e2e | `test/clientes.e2e-spec.ts` |

## Pruebas

- Unitarios en `src/**/*.spec.ts` (puertos simulados; la unidad de trabajo como `{ ejecutar: (fn) => fn() }`; `AuditoriaEnMemoria`; `RelojFijo`).
- e2e en `test/**/*.e2e-spec.ts`, en serie, contra la base `<bd>_test` (si el nombre no termina en `_test`, no arranca), usando **la misma `configureApp()`** que `main.ts`. `limpiarBd()` en `beforeEach` de los que escriben.
- Cada endpoint que escribe tiene su **matriz de `null`** (ausente, `null`, `''`, espacios, tipo incorrecto), revisando la respuesta y lo que quedó en la base.

## Comandos (desde esta carpeta o con `pnpm --filter base-backend`)

```bash
pnpm start:dev       # API con recarga
pnpm lint            # oxlint --type-aware
pnpm test            # unitarios
pnpm test:cov        # unitarios con cobertura (falla si baja de los umbrales)
pnpm test:e2e        # e2e con la base de pruebas
pnpm exec tsc --noEmit
pnpm prisma:generate
pnpm build
pnpm admin:crear-inicial        # después de pnpm build (corren desde dist/comandos/)
pnpm admin:crear-empresa
pnpm admin:desactivar-empresa
pnpm admin:renombrar-empresa
```

## Módulos existentes

| Módulo | Qué hace |
|---|---|
| `health` | Estado del servicio para el monitoreo (`GET /api/v1/health`). **Módulo de referencia mínimo** |
| `auditoria` | Bitácora inmutable (`REGISTRAR_AUDITORIA_PORT`, global); consulta de la empresa activa, `GET /api/v1/auditoria/eventos` y `/:id` (6.8, `CONSULTAR_AUDITORIA_PORT`), `GET /api/v1/auditoria/usuarios` para el filtro «Usuario» (6.12c0); `entidadNombre` en cada evento y la historia de un registro sin tope de días (6.12c0b); el pie de las fichas de otros módulos (6.12a0, `CONSULTAR_TRAZABILIDAD_PORT`, global) |
| `empresas` | Empresas de la instalación (`CONSULTAR_EMPRESAS_PORT`, `CREAR_EMPRESA_PORT`, `DESACTIVAR_EMPRESA_PORT`); `GET`/`PATCH /api/v1/empresa` de la empresa activa (`EMPRESA_ACTIVA_PORT`, 6.7a); renombrar cualquier empresa por comando (`RENOMBRAR_EMPRESA_PORT`, 6.15a) |
| `auth` | Usuarios, roles, contraseñas (6.4b), los comandos `admin:*` (6.4c, `CREAR_EMPRESA_CON_ADMINISTRADOR_PORT`, `CREAR_INSTALACION_INICIAL_PORT`), sesiones y tokens (6.5a), login y refresh (6.5b, `POST /api/v1/auth/login` y `/refresh`), guard global, logout y `GET /api/v1/auth/sesion` (6.5c), `POST /api/v1/auth/empresa` y `/cambiar-contrasena`, y `DESACTIVAR_EMPRESA_CON_SESIONES_PORT` (6.5d); registra el límite de peticiones (`shared/infrastructure/limite/`) después del guard de sesión (6.5e); catálogo de permisos sincronizado al arrancar y `permisos` en `GET /auth/sesion` (6.6a); `@RequierePermiso()` en el guard y `ReglasDeEscalada` (6.6b); `GET /api/v1/permisos`, el catálogo por módulo para armar roles (6.7a); `/api/v1/roles` de la empresa activa: lista, ficha, crear, editar, permisos, desactivar y reactivar (6.7b); `/api/v1/usuarios` de la empresa activa: lista, ficha y editar el nombre (6.7c); crear con contraseña temporal, fijar roles y quitar acceso (6.7d; agregar uno existente se quitó en el 6.12b6); contraseña temporal, desbloquear, cerrar sesiones, desactivar y reactivar (6.7e, `ACCIONES_USUARIOS_PORT`); `GET /api/v1/usuarios/roles-asignables`, los roles activos con `sePuedeDar` (6.12b0, `ReglasDeEscalada.puedeDarRol()`); `debeCambiarContrasena` en cada fila de `GET /usuarios` (6.12b4) |

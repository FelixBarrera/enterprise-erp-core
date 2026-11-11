# Plantilla de módulo

Cómo se pide, se diseña, se construye y se revisa un módulo. El detalle técnico está en `docs/arquitectura-backend.md`, `docs/arquitectura-frontend.md` y `docs/modelo-datos.md`.

## 1. Mensaje para pedirle un módulo a Claude

Copiar y cambiar `<nombre>`:

> Módulo <nombre>: primero el diseño en `docs/modulos/<nombre>.md` siguiendo `docs/plantilla-modulo.md` (cómo se hace hoy, decisiones, tablas, endpoints y permisos, pantallas, pasos para Jira y revisión de los roles) y espera mi visto bueno. Después, un PR por paso: backend primero, luego pantallas, y al final la revisión de los roles sobre el código.

## 2. Orden de trabajo

1. **Diseño** en `docs/modulos/<modulo>.md`, en su propio PR. Se aprueba **antes** de la primera migración.
2. **Backend**, en pasos (un PR cada uno). Si un paso pasa de unas **2.000 líneas** (sin contar CSV o datos), se parte en dos: tabla + dominio + repositorio, y después casos de uso + controller + e2e.
3. **Frontend**, con el contrato de la API ya hecho.
4. **Revisión de los roles sobre el código** (`docs/roles-auditoria.md`), con las pruebas en verde.

## 3. Documento de diseño (`docs/modulos/<modulo>.md`)

1. **Punto de partida**: cómo se hace hoy, cuántos registros, qué problemas tiene.
2. **Decisiones**: tabla `# | Tema | Decisión | Motivo`.
3. **Tablas**, y de dónde sale cada columna. Cada campo con un **uso concreto** (quién lo lee y para qué); si no, no se pone ni se migra. Obligatorios, según el caso y opcionales; listas en vez de texto libre; lo calculable no se escribe. Medir el uso real en el sistema anterior antes de decidir.
4. **Dominio**: entidades, value objects, reglas, errores.
5. **Importación** del sistema anterior (si aplica).
6. **Endpoints y permisos**; **pantallas**.
7. **Fuera de alcance**.
8. **Preguntas** para el negocio o el área.
9. **Pasos** (subtareas, con su número de Jira cuando exista).
10. **Revisión del diseño** por los roles. Después, la revisión del código de cada fase.

**Funcionalidad, no copia**: el ERP cubre lo que hace el sistema anterior o lo mejora; no se copia su estructura.

## 4. Documentos que se mantienen con el módulo

| Documento | Cuándo |
|---|---|
| `docs/guias/<modulo>-backend.md` y `-frontend.md` | En el commit de cada paso: tabla de avance (paso, Jira, estado, PR); por paso: rama, qué se hizo, archivos, por qué, cómo comprobarlo |
| `docs/guias/<modulo>-explicado.md` | En el commit de cada paso: en una frase; qué puede hacer; "Dónde está cada endpoint" (endpoint → método del controller → `*.api.ts` y componente que lo llama); cada endpoint línea por línea en pasos cortos; por qué archivos pasa cada flujo; preguntas frecuentes |
| `docs/pruebas-manuales/<modulo>.md` | Con las pantallas |
| `docs/modelo-datos.md` (registro de tablas) | En el PR que crea la tabla |
| `CLAUDE.md` del backend (módulos existentes) | Al crear el módulo |
| Matriz de `docs/roles-auditoria.md` | Al planificar el módulo |

## 5. Estructura

**Backend** (`apps/base-backend/src/modules/<modulo>/`):

```
<modulo>.module.ts
<modulo>.permisos.ts
<modulo>.auditoria.ts   (si registra en la bitácora)
domain/            entities/ value-objects/ services/ errors/
application/       ports/in/ ports/out/ use-cases/
infrastructure/adapters/
  in/http/         <modulo>.controller.ts, dtos/
  out/prisma/      <nombre>.prisma.repository.ts
```

Modelos en `prisma/models/<modulo>.prisma`; e2e en `test/<modulo>.e2e-spec.ts`.

**Frontend** (`apps/base-frontend/src/app/modules/<modulo>/`):

```
<modulo>.providers.ts
<modulo>.routes.ts
domain/            entities/ value-objects/ errors/
application/       ports/in/ ports/out/ use-cases/
infrastructure/
  adapters/in/<pantalla>/
  adapters/out/http/   <modulo>.api.ts, <nombre>.http.adapter.ts
  presentation/        stores/ facades/
```

## 6. Ejemplo mínimo (backend)

Ejemplos completos de cada pieza en `apps/base-backend/CLAUDE.md`. El recorrido de una petición:

```
POST /api/v1/clientes
  → ClientesController.registrar()          valida el DTO, llama al puerto de entrada
  → RegistrarClienteUseCase.execute()       reglas; UNIDAD_DE_TRABAJO_PORT.ejecutar(…)
      → CLIENTE_REPOSITORY_PORT.guardar()   → ClientePrismaRepository (txHost.tx)
      → REGISTRAR_AUDITORIA_PORT.registrar() (misma transacción)
  ← ok(vista, 'Cliente registrado')         → { success: true, data, message }
```

Permisos en `<modulo>.permisos.ts`:

```ts
export const PERMISOS_CLIENTES = {
  'clientes.cliente.ver': 'Ver clientes',
  'clientes.cliente.crear': 'Registrar clientes',
  'clientes.cliente.editar': 'Editar clientes',
  'clientes.cliente.desactivar': 'Desactivar y reactivar clientes',
} as const;
```

## 7. Ejemplo mínimo (frontend)

```
lista-clientes.component  → ClientesFacade.buscar(filtros)   (filtros desde la URL con filtros-url.ts)
  → BUSCAR_CLIENTES (puerto de entrada) → BuscarClientesUseCase
      → CLIENTES_REPOSITORY (puerto de salida) → ClienteHttpAdapter → clientes.api.ts → GET /api/v1/clientes
```

## 8. Checklist del backend

- [ ] Diseño aprobado en `docs/modulos/<modulo>.md`.
- [ ] Hexagonal; el lint por capas en verde.
- [ ] Sin `any`.
- [ ] Puertos con token `Symbol`; casos de uso sin Prisma.
- [ ] Repositorios con `TransaccionPrisma`; varias escrituras en `UNIDAD_DE_TRABAJO_PORT.ejecutar()`; nada de red dentro.
- [ ] Errores como `DomainError` con su tipo; `P2002` traducido.
- [ ] Respuestas con `ok()`.
- [ ] DTOs validados con mensajes en español; decorador de tipo al final; regla de `null`.
- [ ] Swagger completo y separador entre endpoints; rutas fijas antes de `:id`.
- [ ] `@RequierePermiso` en cada endpoint; permisos en `<modulo>.permisos.ts`.
- [ ] Auditoría de cada cambio en la misma transacción; sus acciones, campos y valores fijos en `<modulo>.auditoria.ts` (y una línea en `src/catalogo-auditoria.ts`); el frontend suma sus textos (AUD-D9).
- [ ] Hora con `RELOJ_PORT`; dinero con `Dinero`; fechas fiscales con `FechaFiscal`.
- [ ] Migración revisada; esquema propio; tipos, FK con índice, únicos parciales, `CHECK`; registro de tablas al día.
- [ ] Listados paginados con orden estable y sin N+1.
- [ ] Variables nuevas en `EnvironmentVariables`, `.env.example` y CI.
- [ ] Casos de uso ≥ 80 % (90 % en lo fiscal); e2e de flujos críticos y matriz de `null`.
- [ ] `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `tsc` en verde.
- [ ] Guías del módulo al día.

## 9. Checklist del frontend

- [ ] Contrato de la API ya hecho.
- [ ] Hexagonal; el lint por capas en verde; no importa otros módulos.
- [ ] Standalone, `OnPush`, `inject()`, signals; store solo si se comparte.
- [ ] `HttpClient` solo en `adapters/out/http/`; URL relativa `/api/v1`.
- [ ] Formularios: etiqueta arriba, errores al enviar con foco, botón no deshabilitado por inválido, `sin-autollenado`, regla de `null`, PATCH con solo lo cambiado.
- [ ] Listados: filtros en la URL, espera de 300 ms, última respuesta, paginador en español, estados cargando/vacío/error, tarjetas en el celular.
- [ ] Molde común (mismos botones, íconos y pestañas); lo que quita algo se confirma.
- [ ] Barra de progreso con alto reservado; botones que dicen lo que pasa.
- [ ] Botones y rutas por permiso.
- [ ] Letra ≥ 14 px, contraste AA, `aria-label`, AXE.
- [ ] Textos de las acciones auditadas nuevas en español, con test.
- [ ] Casos de uso ≥ 80 %, stores 60 %, componentes 40 %.
- [ ] Revisión visual en PC y celular; pruebas manuales del módulo corridas.
- [ ] `pnpm lint`, `pnpm test` y `tsc -p tsconfig.spec.json` en verde; paquete inicial dentro del presupuesto.

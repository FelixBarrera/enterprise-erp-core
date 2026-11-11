# CLAUDE.md: frontend (base-frontend)

Lee primero el `CLAUDE.md` de la raíz y `docs/reglas-obligatorias.md`. Detalle completo en `docs/arquitectura-frontend.md` (incluye la experiencia de uso); la receta de módulos en `docs/plantilla-modulo.md`.

> **Estado:** estructura, lint por capas, URL `/api/v1`, presupuesto y cobertura listos (paso 5.10); interceptor de errores, avisos y confirmaciones (paso 5.11); layout, tema compacto, marca provisional e íconos (paso 5.12); PWA con aviso de versión nueva (paso 5.13); tema 2026 (paso 6.9); sesión, login y «Salir» (paso 6.10a, `src/app/modules/auth/`); tema nuevo, menú del usuario y login rehecho (paso 6.10b0); cambiar la contraseña, la temporal y la voluntaria (paso 6.10b1); cambiar de empresa y menú lateral estrecho en la PC (paso 6.10b2); permisos en rutas, menú y botones (paso 6.11, `src/app/shared/infrastructure/permisos/`); piezas de listas y fichas y migas de pan (paso 6.12a1, `src/app/shared/infrastructure/listados/`, `fichas/`; la ficha de la empresa de ese paso se quitó en el 6.15b); roles, lista y ficha con «Datos» (paso 6.12a2, `src/app/modules/auth/administracion.routes.ts`: el molde de listas y fichas); pestaña «Permisos» y alta «Nuevo rol» (paso 6.12a3: el molde del alta con las mismas pestañas); usuarios, lista y ficha con «Datos», «Roles» y «Sesiones» (paso 6.12b1); alta «Nuevo usuario» y la ventana de la contraseña temporal (paso 6.12b2); menú «Acciones» de la ficha de usuario (paso 6.12b3); bitácora, la lista (paso 6.12c1, `src/app/modules/auditoria/`); detalle de un evento, historia de un registro y «Ver historia» en las fichas (paso 6.12c2). **Módulo de referencia: `src/app/modules/health/`** (copiar su forma). El resto de piezas base, en el paso 5; la sesión, en el paso 6. Los ejemplos se reemplazan por código real cuando exista el primer módulo. **Ante la duda, el código manda.**

## Stack

Angular 21.2 · TypeScript 6.0 · Signals · Angular Material y CDK 21.2 · PWA (`@angular/service-worker`) · Vitest 4 + jsdom · oxlint · SCSS. AG Grid solo si hace falta una grilla densa.

## Estructura de un módulo

```
src/app/modules/<modulo>/
├── <modulo>.providers.ts       ← en la ruta lazy del módulo
├── <modulo>.routes.ts
├── domain/                     entities/ value-objects/ errors/  (TypeScript puro, con tests)
├── application/
│   ├── ports/in/, ports/out/   (+ InjectionToken)
│   └── use-cases/
└── infrastructure/
    ├── adapters/in/<pantalla>/ componente + html (+ filtros-url.ts)
    ├── adapters/in/http/, adapters/in/guards/   interceptores y guards (ejemplo: auth)
    ├── adapters/out/http/      <modulo>.api.ts (HTTP crudo) + <nombre>.http.adapter.ts
    ├── adapters/out/navegador/ APIs del navegador (cachés, pestañas, recargar)
    └── presentation/           stores/, facades/
```

Lo común en `src/app/shared/`. Un módulo **no importa nada de otro módulo**: si necesita sus datos, su propio puerto de salida al endpoint; entre pantallas, el router. La sesión vive en `auth` y la conecta `app.config.ts`.

## Reglas (detalle en `docs/arquitectura-frontend.md`)

1. Standalone (sin escribir `standalone: true`), `OnPush`, `inject()`, `input()`/`output()`, `@if`/`@for`/`@switch`. Sin lógica compleja en la plantilla.
2. **Estado con Signals**; nunca `BehaviorSubject` para estado de pantalla. RxJS solo para HTTP, espera de búsqueda y cancelación. `effect()` solo si no hay otra forma.
3. **Facade** orquesta caso de uso + store + navegación; no captura errores.
4. **Store solo si varias pantallas comparten el estado**: signal privado + `computed`, expuesto `readonly`. Lo de una pantalla vive en su componente.
5. Sin NgRx. En memoria solo catálogos que casi no cambian; saldos, estados y lo que se va a editar, siempre del backend.
6. Lint: `domain/` sin Angular ni RxJS; `application/` sin `HttpClient`, router, formularios, Material ni RxJS (solo `@angular/core` para `inject()` y tokens); `shared/` sin los módulos.
7. El frontend valida la **forma**; el backend, las reglas.
8. Errores: el interceptor convierte todo en `ErrorHttp`. Sin red, 5xx y 403 → aviso global; 400/404/409/422/429 → los muestra la pantalla; 401 → interceptor de auth. **Sin reintentos automáticos.** La pantalla no repite lo que ya se avisó (`error.avisado`); `SIN_AVISO_GLOBAL` para la que muestra ella misma la falla. Avisos con `NotificacionesService`; lo que quita algo, con `ConfirmacionService`.
9. URL de la API **relativa** (`/api/v1`).
10. Paquete inicial con presupuesto (aviso 500 kB, **error 600 kB**): nada de Material en `app.config.ts` (ni un token): sus opciones en `PROVIDERS_MATERIAL`, que entrega `pantallas.routes.ts` (lazy). La ruta de un módulo nuevo va en `pantallas.routes.ts` y su opción del menú en `app.menu.ts`.
11. `tsc --noEmit -p tsconfig.spec.json` para revisar los tipos de las pruebas.

## Ejemplo: store y facade (ilustrativo)

```ts
// infrastructure/presentation/stores/tipos-cliente.store.ts
@Injectable()
export class TiposClienteStore {
  private readonly _tipos = signal<readonly TipoCliente[]>([]);
  readonly tipos = this._tipos.asReadonly();
  readonly activos = computed(() => this._tipos().filter((t) => t.activo));
  reemplazar(tipos: readonly TipoCliente[]): void { this._tipos.set(tipos); }
}

// infrastructure/presentation/facades/clientes.facade.ts
@Injectable()
export class ClientesFacade {
  private readonly registrar = inject(REGISTRAR_CLIENTE);   // InjectionToken del puerto de entrada
  private readonly router = inject(Router);
  async registrarYAbrir(datos: NuevoCliente): Promise<void> {
    const cliente = await this.registrar.execute(datos);     // el error lo maneja la pantalla
    await this.router.navigate(['/clientes', cliente.id]);
  }
}
```

## Formularios

ReactiveForms tipados; **etiqueta arriba** (`<label class="etiqueta" for="…">`, sin `mat-label` flotante); errores al enviar y foco en el primero; mensaje del backend en `role="alert"`; botón de enviar **no** deshabilitado por inválido, solo mientras envía (`[disabledInteractive]="true"`); `autocomplete="sin-autollenado"` en fichas; validador `obligatorio` que recorta; PATCH con **solo lo que cambió**; `null` se muestra vacío o con guion.

## Listados

Filtros y página **en la URL** (`filtros-url.ts` con test); búsqueda con espera de 300 ms y `replaceUrl`; solo se muestra la última respuesta; `mat-paginator` en español; estados cargando / vacío / error; en el celular, tarjetas. El buscador de una lista no despliega sugerencias; `campo-buscador` para catálogos largos.

## Sesión y permisos (paso 6)

Hecho en el 6.10a (`modules/auth/`): access token en un signal del `AuthStore`; al recargar, `/auth/refresh` desde el guard; un solo refresh compartido ante varios 401, y entre pestañas con Web Locks + `BroadcastChannel`. En el 6.10b1: con contraseña temporal, todo lleva a `/contrasena-temporal` (fuera del layout); la voluntaria en `/cambiar-contrasena?volver=…`. En el 6.10b2: cambiar de empresa (`SelectorEmpresaService`, solo con más de una) recarga todas las pestañas en el inicio. Cerrar sesión recargando la página. **Por permiso, nunca por rol** (6.11): `canMatch: [permisoGuard('x.y.z')]` en la ruta, `permiso: 'x.y.z'` en su opción de `app.menu.ts` (las secciones vacías se ocultan solas) y `*appConPermiso="'x.y.z'"` en cada botón; todo lee `PERMISOS_SESION` (lo entrega `auth`). Ocultar no es proteger. Nada sensible en `localStorage` ni `sessionStorage`.

## Experiencia de uso (resumen de la sección de pantallas en `docs/arquitectura-frontend.md`)

- Usuarios de 20 a 65 años: menos pasos, acciones visibles, **letra mínima de 14 px**, contraste AA, palabras del área. **Siempre de usted** («Revise», «Elija su…»), como el backend.
- **Un solo molde**: listas, altas y fichas iguales. Fichas en pestañas; el alta usa las mismas pestañas. Mismos íconos para las mismas acciones; lo que quita algo se confirma.
- Barra de progreso arriba con su alto reservado; botones que dicen lo que pasa ("Guardando…").
- **Tema sobre Material** (sin Bootstrap; rehecho en el 6.10b0 según la maqueta aprobada): fuente Inter (dentro del proyecto), campos y botones de 40 px, esquinas de 10 px (tarjetas 12), fondo gris y tarjetas blancas, menú azul muy oscuro con la marca, la empresa activa y la opción actual con el ícono en dorado, menú del usuario en la cabecera, íconos de línea, tablas de encabezado claro sin rayas. Todo sale de las variables de `src/styles.scss` (`--color-primario`, `--color-texto`, `--radio`, `--estado-…`): nunca un color ni una medida escritos a mano en una pantalla. Clases comunes (tabla en la sección 8.5): `.encabezado-pagina`, `.titulo-pagina`, `.subtitulo-pagina`, `.tarjeta`, `.filtros`, `.contador`, `.etiqueta` + `.opcional`, `.numero`, `.alinear-derecha`, `.celda-doble`, `.estado estado--exito`, `.boton-peligro`, `.pie-ficha`, `.enlace`, `.iniciales`, `.mensaje-error`, `.oculto-visual`. Íconos con `<app-icono nombre="…" />` (`public/iconos.svg`); la marca con `<app-marca />`.
- Accesibilidad WCAG AA medida (AXE), `aria-label` en botones de solo ícono.
- Dispositivos: PC 1366, tablet 800, celular 390; botones táctiles de 44 px; campos a 16 px en el celular.

## Solo español, PWA y recursos

`<html lang="es">`, sin i18n. Fechas en la zona del negocio (la manda el backend en `GET /auth/sesion`; nunca la del navegador ni una escrita aquí), formato `es-EC`. El dinero llega como texto y no se recalcula. Service worker solo en producción (`ngsw-config.json`; `/api/**` fuera de sus navegaciones); versión nueva: `ActualizacionesService` pregunta antes de recargar; la API no se cachea salvo lecturas agregadas una por una; nunca emitir sin conexión. **Fuentes, imágenes e íconos dentro del proyecto** (`public/`, o un paquete instalado como la fuente Inter), nunca de internet. Lo que ve el usuario dice "Base ERP"; dentro del código, no.

## Pruebas

Casos de uso ≥ 80 %, stores 60 %, componentes 40 % (umbrales en `vitest.config.mts` cargado por `runnerConfig`, sin `include` ni `exclude` de Vitest; los archivos medidos, en `coverageInclude`/`coverageExclude` de `angular.json`). HTTP con `provideHttpClientTesting()`. Casos borde: credenciales inválidas, vacíos, lista vacía, sin red, token vencido, refresh fallido, doble clic, cambio de tamaño.

## Nombres de archivos

| Qué | Nombre |
|---|---|
| Entidad / value object | `cliente.entity.ts` / `cedula.vo.ts` |
| Puerto | `registrar-cliente.port.ts` |
| Caso de uso | `registrar-cliente.use-case.ts` (+ `.spec.ts`) |
| HTTP crudo / adaptador | `clientes.api.ts` / `cliente.http.adapter.ts` |
| Store / facade | `tipos-cliente.store.ts` / `clientes.facade.ts` |
| Pantalla | `adapters/in/lista-clientes/lista-clientes.component.ts` |
| Rutas y providers | `clientes.routes.ts`, `clientes.providers.ts` |

## Comandos (desde esta carpeta o con `pnpm --filter base-frontend`)

```bash
pnpm start        # http://localhost:4200 (proxy /api → http://localhost:3000)
pnpm lint
pnpm test
pnpm test:cov   # con cobertura y umbrales (lo corre el CI)
pnpm exec tsc --noEmit -p tsconfig.spec.json
pnpm build
```

# Arquitectura del frontend

Aplicación web en Angular 21.2 con Signals, Angular Material 21.2 y PWA. Este documento es el **destino**: el código nuevo se escribe ya así. Incluye las reglas comunes de las pantallas (experiencia de uso).

## Estado

Se actualiza **en el mismo commit** que termina cada pieza.

| Pieza | Estado | Dónde |
|---|---|---|
| Esqueleto: Angular arranca, proxy `/api` → 3000 | ✅ Hecho (paso 2) | `proxy.conf.json` |
| Estructura hexagonal y reglas del lint por capas | ✅ Hecho (paso 5.10) | `.oxlintrc.json` |
| Módulo de referencia `health` (tres capas, puertos con token, pruebas) | ✅ Hecho (paso 5.10) | `src/app/modules/health/` |
| URL de la API relativa `/api/v1` | ✅ Hecho (paso 5.10) | `src/app/shared/infrastructure/http/url-api.ts` |
| Interceptor de errores (`ErrorHttp`, `SIN_AVISO_GLOBAL`) | ✅ Hecho (paso 5.11) | `src/app/shared/infrastructure/http/errores.interceptor.ts`, `shared/domain/errors/error-http.ts` |
| Avisos globales (`NotificacionesService`) y confirmaciones (`ConfirmacionService`) | ✅ Hecho (paso 5.11) | `src/app/shared/infrastructure/avisos/` |
| Layout: cabecera, menú lateral por secciones (recordadas en el navegador), pie | ✅ Hecho (paso 5.12) | `src/app/shared/infrastructure/layout/`, opciones en `src/app/app.menu.ts` |
| Tema compacto y marca provisional (variables en `styles.scss`) | ✅ Hecho (paso 5.12) | `src/styles.scss`, `public/marca/` |
| Tema 2026: fuente Inter, menú azul marino, tablas claras, tarjetas, piezas comunes (sección 8.5) | ✅ Hecho (paso 6.9) | `src/styles.scss`, `layout/menu-lateral/` |
| Tema nuevo (maqueta aprobada el 2026-11-06): colores, logo provisional con `<app-marca>`, íconos de línea, marca y empresa en el menú lateral, menú del usuario (`@defer`), login rehecho, error de un campo solo si se tocó (`ErrorAlTocar`) | ✅ Hecho (paso 6.10b0) | `src/styles.scss`, `shared/infrastructure/layout/`, `shared/infrastructure/material/error-al-tocar.ts`, `public/` |
| Opciones por defecto de Material (`PROVIDERS_MATERIAL`), en la ruta lazy de las pantallas | ✅ Hecho (paso 5.12) | `src/app/shared/infrastructure/material/`, `src/app/pantallas.routes.ts` |
| Íconos SVG en un solo archivo (`<app-icono>`) | ✅ Hecho (paso 5.12) | `public/iconos.svg`, `src/app/shared/infrastructure/layout/icono/` |
| Paginador en español, fechas en la zona del negocio (la de `GET /auth/sesion`, `ZONA_NEGOCIO` y el pipe `fechaHora`) | ✅ Hecho (paso 6.12a1) | `src/app/shared/infrastructure/material/paginador-en-espanol.ts`, `shared/infrastructure/fechas/`, `shared/domain/fechas.ts` |
| Listados: `crearListado()` (filtros y página en la URL, espera de búsqueda, última respuesta), barra de carga, estados vacío y error, paginador, tarjetas en el celular | ✅ Hecho (paso 6.12a1) | `src/app/shared/infrastructure/listados/`, `src/styles.scss` |
| Fichas: encabezado con «Volver», pie «Creado / Modificado»; migas de pan en la cabecera | ✅ Hecho (paso 6.12a1) | `src/app/shared/infrastructure/fichas/`, `shared/infrastructure/layout/migas/` |
| `campo-buscador` | ⏳ Pendiente | `src/app/shared/` |
| PWA: manifest, íconos, service worker solo en producción, aviso de versión nueva | ✅ Hecho (paso 5.13) | `ngsw-config.json`, `public/manifest.webmanifest`, `public/iconos-app/`, `src/app/shared/infrastructure/pwa/` |
| Presupuesto del paquete inicial (500 / 600 kB) | ✅ Hecho (paso 5.10) | `angular.json` |
| CI (lint, tipos de las pruebas, pruebas, compilación) | ✅ Hecho (paso 5.2) | `.github/workflows/frontend.yml` |
| Umbrales de cobertura (y cobertura en el CI) | ✅ Hecho (paso 5.10) | `vitest.config.mts`, `angular.json` |
| Sesión: `AuthStore`, interceptor de sesión (un refresh compartido, entre pestañas), guards, login partido, «Salir» en la cabecera | ✅ Hecho (paso 6.10a) | `src/app/modules/auth/`, `shared/infrastructure/layout/usuario-cabecera.ts` |
| Cambiar la contraseña: la temporal fuera del layout (`contrasenaTemporalGuard`, `sesionGuard` lleva a ella), la voluntaria desde el menú del usuario, barra de fuerza por el largo; menú del usuario blanco | ✅ Hecho (paso 6.10b1) | `src/app/modules/auth/` (`adapters/in/cambiar-contrasena/`, `domain/fuerza-contrasena.ts`) |
| Cambiar de empresa (menú del usuario y recuadro del menú lateral; ventana en la PC, hoja desde abajo en el celular) y menú lateral que se encoge a una franja de 72 px en la PC | ✅ Hecho (paso 6.10b2) | `src/app/modules/auth/` (`cambiar-empresa.use-case.ts`), `shared/infrastructure/layout/` (`selector-empresa/`, `etiqueta-lateral/`, `menu-lateral/menu-estrecho.ts`) |
| Permisos: `permisoGuard(codigo)` en las rutas (`canMatch`), menú sin las opciones ni secciones sin permiso, `*appConPermiso` en los botones (`PERMISOS_SESION`, lo entrega `auth`) | ✅ Hecho (paso 6.11) | `src/app/shared/infrastructure/permisos/`, `shared/infrastructure/layout/menu.ts` (`menuVisible()`) |
| Ficha de la empresa (`/empresa`) | ❌ Quitada en el 6.15b (estaba desde el 6.12a1): el cliente no ve una pantalla de la empresa; se renombra en el servidor con `pnpm admin:renombrar-empresa` y el nombre nuevo se ve al recargar. Se fueron también `empresaRenombrada()` de `USUARIO_CABECERA`, `conEmpresaRenombrada()` y el mensaje `empresa-renombrada` entre pestañas. La API (`GET`/`PATCH /empresa`) se queda | (ya no existe `src/app/modules/empresas/`) |
| Roles: lista (`/roles`, con `auth.rol.ver`; buscar y estado en la URL, tarjetas en el celular) y ficha con «Datos» (siempre editable con `auth.rol.editar`, barra «N cambios sin guardar», el Administrador y sin permiso en solo lectura), desactivar (confirmado) y reactivar | ✅ Hecho (paso 6.12a2) | `src/app/modules/auth/` (`administracion.routes.ts`, `administracion.providers.ts`, `domain/rol.ts`, `adapters/in/lista-roles/`, `adapters/in/ficha-rol/`) |
| Roles: pestaña «Permisos» de la ficha (por módulo, «N de M», buscador, «Solo los marcados», marcar todo el grupo, «Se agrega / Se quita», sin escalada) y alta «Nuevo rol» (`/roles/nuevo`, con `auth.rol.crear`; las mismas pestañas, todo en un `POST`) | ✅ Hecho (paso 6.12a3) | `src/app/modules/auth/` (`domain/permisos-rol.ts`, `adapters/in/editor-permisos/`, `datos-rol/`, `nuevo-rol/`) |
| Usuarios: lista (`/usuarios`, con `auth.usuario.ver`; buscar, rol y estado en la URL, tarjetas en el celular) y ficha con «Datos», «Roles» (lo que no se puede dar, bloqueado con el motivo, de `roles-asignables`) y «Sesiones» (a la vista); una barra de cambios para el nombre y los roles; «Quitar acceso» (confirmado); su propia ficha sin cambiar sus roles | ✅ Hecho (paso 6.12b1) | `src/app/modules/auth/` (`domain/usuario.ts`, `adapters/in/lista-usuarios/`, `ficha-usuario/`, `editor-roles-usuario/`) |
| Usuarios: alta «Nuevo usuario» (`/usuarios/nuevo`, con `auth.usuario.crear`): una persona nueva (con su contraseña temporal, que se ve una sola vez con «Copiar»); al menos un rol, sin escalada; al terminar, su ficha. Dar acceso a alguien que ya tiene usuario se quitó en el 6.12b5 (decisión del usuario) | ✅ Hecho (pasos 6.12b2 y 6.12b5) | `src/app/modules/auth/` (`adapters/in/nuevo-usuario/`, `contrasena-temporal/`) |
| Usuarios: acciones de la ficha en el menú «Acciones» (en el celular, «⋮»): reactivar, desbloquear, dar una contraseña temporal (en su ventana, una sola vez), cerrar sus sesiones y, en rojo, quitar el acceso y desactivar; solo las que aplican al usuario y a quien opera; las que cortan algo se confirman | ✅ Hecho (paso 6.12b3) | `src/app/modules/auth/` (`adapters/in/ficha-usuario/`, `domain/usuario.ts`: `accionesDeUsuario()`) |
| Bitácora: lista (`/bitacora`, con `auditoria.evento.ver`; últimos 7 días de la zona del negocio, fechas, usuario y «Qué hizo» por acción o grupo en la URL, marca «Seguridad», tarjetas en el celular), textos de las acciones (AUD-D9), «Debe cambiar su contraseña» en la lista de usuarios; «hoy» con `RELOJ` | ✅ Hecho (paso 6.12c1) | `src/app/modules/auditoria/`, `shared/infrastructure/fechas/reloj.ts`, `shared/domain/fechas.ts` |
| Bitácora: detalle de un evento (`/bitacora/:id`: «Qué cambió» con el antes y el después de cada dato en español, listas con lo agregado y lo quitado, «Oculto», permisos con su descripción si se tiene «Ver roles»; «Datos del evento» con «Ver su ficha» y «Ver su historia»), filas que lo abren, historia de un registro (`?entidad=…&entidadId=…`, sin fechas) y «Ver historia» en el pie de las fichas de usuario y de rol; `fijos` en `crearListado()`, `fechaHora: 'segundos'`, clase `.enlace` | ✅ Hecho (paso 6.12c2) | `src/app/modules/auditoria/`, `shared/infrastructure/listados/listado.ts`, `shared/infrastructure/fichas/pie-ficha.component.ts` |
| Validador `obligatorio` | ✅ Hecho (paso 6.10a) | `src/app/shared/infrastructure/formularios/validadores.ts` |

## 1. Estructura

```
src/app/
├── app.config.ts                 ← providers globales (livianos)
├── app.routes.ts                 ← layout (y el login, fuera de él, en el paso 6)
├── pantallas.routes.ts           ← lazy: PROVIDERS_MATERIAL y la ruta lazy de cada módulo
├── app.menu.ts                   ← opciones del menú lateral, por secciones
├── shared/                       ← interceptores, avisos, layout, pipes, componentes comunes
└── modules/<modulo>/
    ├── <modulo>.providers.ts     ← en la ruta lazy del módulo
    ├── <modulo>.routes.ts
    ├── domain/                   entities/, value-objects/, errors/   (TypeScript puro, con tests)
    ├── application/
    │   ├── ports/in/, ports/out/ (+ InjectionToken)
    │   └── use-cases/
    └── infrastructure/
        ├── adapters/in/<pantalla>/   componente + html (+ filtros-url.ts)
        ├── adapters/out/http/        <modulo>.api.ts (HTTP crudo) + <nombre>.http.adapter.ts
        └── presentation/stores/, facades/
```

## 2. Reglas

1. Componentes standalone (sin escribir `standalone: true`), `OnPush`, `inject()`, `input()`/`output()`, `@if`/`@for`/`@switch`. Sin lógica compleja en la plantilla.
2. **Estado con Signals**; nunca `BehaviorSubject` para estado de pantalla. RxJS solo para HTTP, espera de búsqueda y cancelación. `effect()` solo si no hay otra forma.
3. **Facade orquesta** caso de uso + store + navegación; no captura errores (la pantalla decide cómo mostrarlos).
4. **Store solo si varias pantallas comparten el estado.** El estado de una pantalla (`enviando`, error, página) vive en su componente. Un signal privado + `computed`; se expone `readonly`.
5. **Qué se guarda en memoria** (sin NgRx): catálogos que casi no cambian (roles, tipos, bancos), pedidos una vez y al día con cada cambio. Lo que cambia solo o es de seguridad (saldos, estados, permisos) siempre del backend, mostrando la última página mientras llega la nueva. Antes de editar, siempre del backend. Al cerrar sesión se recarga la página y se borra todo.
6. Un módulo **no importa nada de otro módulo**: si necesita sus datos, su propio puerto de salida al endpoint; entre pantallas, el router. Lo común en `shared/`. La sesión vive en `auth` y la conecta `app.config.ts`.
7. Lint: `domain/` sin Angular ni RxJS; `application/` sin `HttpClient`, router, formularios, Material ni RxJS (solo `@angular/core` para `inject()` y tokens, y `@angular/core/testing` en sus pruebas); `shared/` sin los módulos. Lo que el lint **no** alcanza: que un módulo importe otro con rutas relativas (lo revisa el rol Arquitecto de Software). Ejemplo a copiar: `modules/health/`.
8. No duplicar validación del backend: el frontend valida **forma**; el backend, **reglas**.
9. **Errores**: un interceptor convierte todo error en `ErrorHttp`.

   | Respuesta | Quién la muestra |
   |---|---|
   | Sin red | Aviso global |
   | 5xx | Aviso genérico (502/503/504: "El servidor no está disponible") |
   | 403 | Aviso global con el mensaje del backend |
   | 401 | Lo resuelve el interceptor de auth |
   | 400 / 404 / 409 / 422 / 429 | La pantalla |

   **Sin reintentos automáticos** (repetir un POST duplicaría).

   La pantalla recibe siempre un `ErrorHttp` (`tipo`, `message` en español, `estado`, `requestId`) y nunca un `HttpErrorResponse`. Si `error.avisado` es `true`, el interceptor ya mostró el aviso: la pantalla no lo repite. En los 5xx el texto es siempre genérico (nunca el del servidor); un 5xx que no tiene la forma `{ success: false }` (proxy de desarrollo con la API apagada, Nginx) cuenta como "servidor no disponible". Una petición que muestra ella misma su falla (la pantalla de `health`) se marca con `new HttpContext().set(SIN_AVISO_GLOBAL, true)`.
10. **Avisos globales** en un modal pequeño: el de éxito se cierra solo (2,5 a 8 s según el texto); el de error espera "Aceptar" (o Escape; un clic afuera no lo cierra) y el mismo texto no se abre dos veces a la vez. `await avisos.exito('Cliente registrado')`. **Confirmaciones**: `if (!(await confirmacion.confirmar({ titulo, mensaje, textoConfirmar, peligro }))) return;`, con el foco en "Cancelar"; Escape o un clic afuera es "no". Los dos usan el diálogo del CDK cargado con `import()` (no pesa en el paquete inicial).
11. URL de la API **relativa** (`/api/v1`): en desarrollo la resuelve el proxy y en producción Nginx (mismo dominio: sin CORS y cookie `SameSite=Strict`).
12. **Paquete inicial** con presupuesto en `angular.json` (aviso 500 kB, **error 600 kB**): nada de Material en `app.config.ts`, **ni siquiera un token** (importar `MAT_FORM_FIELD_DEFAULT_OPTIONS` ahí metió 60 kB de campos al arranque en cuanto una pantalla los usó); sus providers en `PROVIDERS_MATERIAL`, que entrega `pantallas.routes.ts` (lazy); lo que hace falta al arrancar pero no al abrir, con `import()`.
13. Tipos de las pruebas: `tsc --noEmit -p tsconfig.spec.json` (ni `ng build` ni `ng test` las revisan). Cobertura: umbrales por carpeta en `vitest.config.mts` (cargado por `runnerConfig`), **sin `include` ni `exclude` de Vitest** (si no, todo sale 0 %); qué archivos se miden va en `angular.json` (`coverageInclude` / `coverageExclude`), para que un archivo **sin pruebas** cuente como 0 % y frene. `pnpm test:cov` y el CI fallan si bajan.

## 3. Formularios

- ReactiveForms tipados. **Etiqueta arriba** (`<label class="etiqueta" for="id">`, sin `mat-label` flotante); un `mat-select` con `aria-labelledby`.
- Errores al enviar (`markAllAsTouched()`) y foco en el primer campo con error. El mensaje del backend en un elemento `role="alert"`; lo que ya avisó el interceptor no se repite.
- El botón de enviar **no se deshabilita por formulario inválido**; mientras envía, `[disabled]` con `[disabledInteractive]="true"` (no se envía dos veces y no pierde el foco).
- **Sin autollenado del navegador**: `autocomplete="sin-autollenado"` en las fichas (Chrome ignora `"off"`). Solo login y cambio de contraseña usan `username`, `current-password`, `new-password`. axe lo marca como valor inválido (`autocomplete-valid`): es una **excepción aceptada** (6.13e, UX-03), porque WCAG 1.3.5 pide el propósito de los campos con datos **de quien usa la pantalla**, y estas fichas son de otras personas, de un rol o de la empresa. En un campo con datos propios del usuario (su perfil), el valor de la lista de WCAG (`name`, `email`…).
- **Regla de `null`**: al cargar, `null` → `''`; al enviar, se limpia en el dominio (recortar; opcional vacío → `null`; obligatorio con solo espacios no se envía: validador `obligatorio` que recorta, porque `Validators.required` deja pasar `'   '`); el PATCH manda **solo lo que cambió** y sin cambios no llama al backend; al mostrar, `null` es vacío o un guion, nunca "null". Con tests de cada combinación.

## 4. Listados

- **Filtros y página en la URL** (`?activo=false&pagina=2`): cambiar un filtro es navegar; volver, recargar o compartir el enlace muestra lo mismo. Valores iniciales no se escriben; uno que no se entiende se ignora. Conversión en `filtros-url.ts` con test.
- Búsqueda con espera de 300 ms y `replaceUrl`; cambiar un filtro vuelve a la página 1. **Respuestas en desorden**: cada consulta lleva un número y solo se muestra la última.
- **El buscador de una lista no despliega sugerencias**: filtra la tabla y nada más. Los campos que eligen de un **catálogo largo** sí se buscan escribiendo y muestran opciones (`campo-buscador`, `placeholder="Todos"`). Pocas opciones fijas: `mat-select`.
- Paginación del backend con `mat-paginator` en español. Fechas en la zona del negocio (una por instalación, la manda el backend en `GET /auth/sesion`).
- Estados: cargando, vacío (con "Limpiar filtros" si hay filtros), error (400 con el mensaje del backend; sin red o 5xx con "Reintentar").
- En el celular, la tabla pasa a **tarjetas** (`segunPantalla(CELULAR)`, `.lista-tarjetas` y `.tarjeta-fila`).
- **Cómo se arma** (6.12a): `protected readonly listado = crearListado({ leer: filtrosDeUrl, escribir: filtrosAUrl, cargar: (c) => … })` en la pantalla (sus `filtros-url.ts` con `textoDeUrl()`, `booleanoDeUrl()`, `opcionDeUrl()` y `filtroAUrl()` de `shared/infrastructure/listados/parametros-url.ts`); un filtro con `listado.filtrar({ … })`, el buscador con `listado.buscar({ … })`; arriba `<app-barra-carga [activa]="listado.cargando()" />`, debajo de las filas `<app-estado-lista [listado]="listado" vacio="…" />` y `<app-paginador [listado]="listado" />`. En las pruebas de la pantalla, `ListadoDePrueba`. Lo de la URL que no es un filtro y se conserva al filtrar y al limpiar (la historia de un registro en la bitácora): `fijos: (parametros) => ({ … })` (6.12c2; no cuenta en «N activos»).
- **Migas de pan** (solo en la PC): `data: { miga: 'Roles' }` en la ruta de la lista (y del alta); la sección sale del menú; la ficha suma el nombre con `mostrarMigaActual(() => this.rol()?.nombre ?? null)`.

## 5. Árboles (catálogos jerárquicos que llegan completos)

`mat-tree` con `childrenAccessor` y `trackBy` por id; armar y filtrar el árbol en el dominio (con test); ramas abiertas como signal del componente; acciones en cada fila **siempre visibles** con tooltip y `aria-label`, atajos de teclado (F2, Suprimir, +); editar en la fila o en una ventana sin salir del árbol, y después resaltar la fila.

## 6. Autenticación (paso 6)

- Access token en un signal del `AuthStore`; al recargar se recupera con `/auth/refresh` desde el guard (`sesionGuard` en el layout; `sinSesionGuard` en `/login`, que entra solo si la cookie todavía sirve). Los providers de `auth` van en `app.config.ts` (`AUTH_PROVIDERS`, sin Material); el login, lazy.
- `sesionInterceptor` va antes que `erroresInterceptor` y pone el token en todo `/api/v1`. Una petición que no debe tocar (login, refresh, sesión con su propio token): `SIN_INTERCEPTOR_SESION` en su `context`. Después de entrar se vuelve a `?volver=` solo si es una ruta de la aplicación (`destinoTrasIngreso()`).
- La cabecera recibe el usuario y «Salir» por `USUARIO_CABECERA` (lo entrega `auth`).
- Ante un 401: **un** refresh compartido por las peticiones que fallaron juntas, que se repiten una vez. **Entre pestañas**: renueva una sola (Web Locks) y pasa el token a las demás (`BroadcastChannel`), porque dos pestañas usando la misma cookie a la vez parecen un robo.
- Refresh con 401 → limpiar, avisar a las demás pestañas e ir al login. **Sin conexión, la sesión se mantiene.**
- **Contraseña temporal** (6.10b1): `sesionGuard` lleva toda pantalla del layout a `/contrasena-temporal?volver=…` (fuera del layout, sin menú, con «Salir»; la protege `contrasenaTemporalGuard`) hasta cambiarla; al guardar, a `volver` o al inicio. La **voluntaria** es `/cambiar-contrasena?volver=…`, dentro del layout, desde el menú del usuario (`irACambiarContrasena()`), y al guardar vuelve a la pantalla en la que estaba. Mismo componente (`data: { temporal }`). `destinoTrasIngreso()` nunca vuelve a una de las pantallas de la sesión (`/login`, `/contrasena-temporal`, `/cambiar-contrasena`); `volverDesde(url)` arma el `volver`. Después de guardar no se vuelve a pedir la sesión (solo cambia que ya no es temporal: `conContrasenaCambiada()`) y se avisa a las otras pestañas; la que esperaba en `/contrasena-temporal` sigue sola. Los errores de `POST /auth/cambiar-contrasena` (también la cuenta bloqueada y sin conexión) los muestra el formulario (`SIN_AVISO_GLOBAL`).
- **Cambiar de empresa** (6.10b2): `POST /auth/empresa` (el mismo token sigue sirviendo), se borran los datos locales, se avisa a las otras pestañas (`empresa-cambiada`) y **todas recargan en el inicio** (comparten la sesión). El 403 «No tiene acceso a esa empresa» y la falta de conexión van con el aviso global; la lista queda abierta para elegir otra. Elegir la activa solo cierra la lista. `USUARIO_CABECERA` da `empresas`, `empresaActivaId` y `cambiarEmpresa()`; la lista la abre `SelectorEmpresaService` (shared/, lazy), solo si trabaja en más de una.
- Cerrar sesión **recargando la página**. Si el logout falla, la sesión se mantiene.
- **Por permiso, nunca por rol** (6.11): los permisos llegan con la sesión y se renuevan con cada refresh. Las tres piezas viven en `shared/infrastructure/permisos/` (un módulo no importa `auth`) y leen `PERMISOS_SESION` (`tiene(codigo)`, `sesionLista()`), que entrega `auth` desde `app.config.ts`:
  - **Rutas**: `canMatch: [permisoGuard('auth.usuario.ver')]`. Sin el permiso: aviso «No tiene permiso para ver esta pantalla» y al inicio, **sin descargar la pantalla** (por eso `canMatch`: corre antes de descargarla y antes que `sesionGuard`, así que al recargar recupera la sesión él mismo). Sin sesión, con contraseña temporal o sin conexión, deja seguir y `sesionGuard` se encarga.
  - **Menú**: cada opción de `app.menu.ts` lleva el mismo `permiso` que su ruta; `menuVisible()` oculta las opciones sin permiso y las secciones que quedan vacías. Sin `permiso`, la ve todo el que tiene sesión (el inicio).
  - **Botones**: `<button *appConPermiso="'auth.usuario.crear'">` (`ConPermisoDirective`); sin el permiso no se dibuja. Ocultar, no deshabilitar.
  - Si los permisos cambian al renovar la sesión, el menú y los botones se actualizan solos; la pantalla abierta no se cierra (el backend responde 403). En pruebas, `new PermisosDePrueba(['x.y.z'])` y `fijar([...])`.
  - **Ocultar no es proteger**: el backend responde 403.

## 7. PWA, recursos y dispositivos

- Service worker solo en producción (`serviceWorker` en la configuración `production` de `angular.json`; `enabled: !isDevMode()` en `app.config.ts`). En `ng serve` y en las pruebas no existe. **La API no se cachea** salvo endpoints de solo lectura agregados uno por uno con `freshness` (un `dataGroups` en `ngsw-config.json`); nunca operaciones que emiten, anulan o pagan. **Nada se emite sin conexión.**
- `ngsw-config.json`: el grupo `aplicacion` (`prefetch`) guarda todo el código, los estilos, `iconos.svg` y la marca, así la aplicación abre sin conexión (las pantallas muestran "No hay conexión con el servidor"); el grupo `recursos` (`lazy`) guarda los íconos de la PWA e imágenes. `navigationUrls` excluye `/api/**`: abrir `/api/v1/docs` en el navegador va al backend, no a la aplicación.
- **Versión nueva**: `ActualizacionesService` (`shared/infrastructure/pwa/`, arrancado en `app.config.ts`) busca una versión al abrir la página y cada hora. Cuando está lista, pregunta "Hay una versión nueva de Base ERP" con "Actualizar" (recarga) o "Cancelar" (entra la próxima vez que se abra). Si el service worker queda sin arreglo, avisa y recarga.
- Manifest en `public/manifest.webmanifest` ("Base ERP", color de la marca, `lang: es`); íconos PNG en `public/iconos-app/` (192 y 512, normales y `maskable`; 180 para el iPhone). Cómo regenerarlos: `docs/marca/README.md`.
- En el servidor (al desplegar): `ngsw-worker.js` y `ngsw.json` **sin caché** (`Cache-Control: no-cache`), y la política de contenido con `worker-src 'self'` y `manifest-src 'self'`.
- **Fuentes, imágenes e íconos dentro del proyecto** (`public/`, o un paquete instalado con pnpm como `@fontsource-variable/inter`, que Angular copia a `media/`), nunca de internet (Google Fonts, CDN). Los del login van en el grupo `prefetch` del service worker (la fuente: `/media/*.woff2`). Confirmar la licencia antes de incluir una fuente o imagen.
- Dispositivos: PC (1366), tablet (800) y celular (390). Breakpoints 600, 960, 1280, 1920. Botones táctiles de 44 px; texto de los campos a 16 px en el celular (con menos, el iPhone agranda la página).

## 8. Pantallas: experiencia de uso

### 8.1 Usuarios de 20 a 65 años
- **Lo más simple, con menos pasos**: cada tarea se cuenta en clics y pantallas; si se puede hacer donde está la persona (en la fila, en una ventana), no se abre otra pantalla.
- **Las acciones se ven, no se explican**: sin instrucciones largas ni datos técnicos (ids, niveles).
- **Letra mínima de 14 px** en todo lo que se lee (también ayudas y errores) y contraste AA.
- Textos en español, cortos, con las palabras del área, y **siempre de usted** («Revise los datos», «No tiene permiso», «Elija su contraseña»), igual que los mensajes del backend (6.13b).

### 8.2 Un solo molde para todas las pantallas
- Todas las listas, altas y fichas iguales: mismo orden, mismos botones en el mismo lugar, mismas pestañas, mismos mensajes.
- Antes de una pantalla nueva, se toma como molde la ya hecha; si algo se aparta, se avisa; si una mejora cambia el molde, se aplica en todas.
- **Fichas en pestañas**; el **alta usa las mismas pestañas que la ficha** y un solo botón "Registrar…" (el backend recibe todo en una transacción). Encabezado de la ficha: código, nombre y estado. "Volver" con solo la flecha a la izquierda del nombre.
- **Mismos íconos para las mismas acciones**: editar (tooltip "Editar"), desactivar en rojo, reactivar, agregar. En la PC el ícono con tooltip; en el celular, con texto. **Lo que quita algo se confirma siempre.**

### 8.3 Indicadores de espera
- Cargar una pantalla, pestaña o lista: barra de progreso arriba, **con su alto reservado** (nada salta). Mientras carga por primera vez no se muestra "No hay datos".
- Refrescar lo que ya se ve: los datos anteriores quedan a la vista con la barra encima.
- Botones que envían: dicen lo que pasa ("Guardando…") y quedan deshabilitados, junto con los demás botones; una ventana no se cierra mientras envía.
- Algo que tarda: un texto bajo la barra ("Importando 504 registros…"). Lo que tarda minutos va a una cola y la pantalla muestra su estado.
- Lectores de pantalla: `aria-label` en la barra y `aria-busy` en el contenedor. Cada pantalla prueba que la barra aparece y que el botón se deshabilita.

### 8.4 Accesibilidad
WCAG AA medida, no supuesta: contraste (también sobre fondos de color), foco visible, `aria-label` en botones de solo ícono, `aria-current` en la navegación, nada que dependa solo del color. Debe pasar AXE.

### 8.5 Tema 2026 (Material con aspecto compacto)
Componentes de Angular Material con un aspecto propio, todo con variables en `src/styles.scss`. **No se instala Bootstrap** (choca con Material). Nunca un color ni una medida escritos a mano en una pantalla: siempre `var(--…)`. Aprobado por el usuario el 2026-11-05 y hecho en el paso 6.9; **rehecho en el 6.10b0** según la maqueta que el usuario aprobó el 2026-11-06 (el anterior le pareció básico) (login, aplicación con el menú del usuario, cambiar la contraseña temporal y celular).

**Base**
- Fuente **Inter** (licencia OFL, paquete `@fontsource-variable/inter`), dentro del proyecto: funciona sin conexión y el service worker la baja al instalarse. Solo letras latinas, un archivo variable para todos los gruesos. Letra mínima de **14 px** en todo.
- Títulos en Inter negrita con las letras un poco más juntas (`.titulo-pagina`: 26 px, 22 en el celular), sin otra fuente.
- Fondo gris muy claro (`--color-fondo`) y **tarjetas blancas** (`.tarjeta`) con borde fino y sombra suave; esquinas de **10 px** (`--radio`) en campos, botones y opciones del menú, **12 px** en tarjetas y menús (`--radio-tarjeta`) y **16 px** en las tarjetas sueltas como la de cambiar la contraseña (`--radio-grande`).
- Campos y botones de 40 px (44 px en el celular; el login, 46 y 48); botones en semi-negrita; borde de campo `#8792a4` (`--color-borde-campo`, 3,2:1: un control necesita 3:1 para verse; la maqueta lo tenía más claro y no llegaba); las líneas decorativas usan `--color-borde`; anillo de foco azul translúcido; etiqueta en semi-negrita arriba a 6 px (`.etiqueta`); 12 px entre filas de campos. `appearance: 'outline'`, `subscriptSizing: 'dynamic'` y `ErrorAlTocar` (el error de un campo se ve si está mal y se tocó; al enviar se tocan todos) por defecto en `PROVIDERS_MATERIAL` (`shared/infrastructure/material/`).
- Texto `#0f172a`, secundario `#526075`, tenue `#6b7789` solo para datos que acompañan (los tres llegan a AA sobre el blanco y el fondo).
- Menú lateral **azul muy oscuro** (`--color-menu`), de arriba abajo: la **marca** (`<app-marca tono="claro">`, lleva al inicio), la **empresa activa** en un recuadro con sus iniciales en dorado (si trabaja en varias, es un botón con ⇅ que abre «Cambiar de empresa») y las opciones por secciones. La opción actual con fondo más claro, letra blanca en negrita y el **ícono en dorado** (`--color-acento`). Sobre el azul oscuro, el foco se dibuja en dorado.
- En la PC el menú **no se oculta**: el botón de la cabecera lo deja **estrecho** (72 px: el símbolo, las iniciales de la empresa y los íconos, sin títulos de sección; los nombres siguen para el lector de pantalla) o ancho, y el navegador lo recuerda (`menu.estrecho`). El nombre de cada opción aparece a la derecha al pasar el mouse o con Tab (`[appEtiquetaLateral]`, `.etiqueta-lateral`). En el celular sigue oculto y se abre encima, siempre ancho.
- Cabecera blanca de 64 px: el botón del menú, la marca solo en el celular (en la PC está siempre en el menú) y, a la derecha, el **menú del usuario**: un botón redondo con las iniciales, el nombre y, debajo, «Administrador» o su usuario (en el celular, solo las iniciales). Al abrirlo (fondo blanco): quién es, la empresa activa, «Cambiar de empresa» con cuántas tiene (si son más de una), «Cambiar contraseña» y «Salir» en rojo. Se descarga apenas termina de cargar la página (`@defer`, 27 kB); mientras, el mismo botón sin acción.
- Íconos **de línea** (dibujos propios, trazo de 2) en `public/iconos.svg`.
- Estados con un punto del mismo color delante del texto; personas con un círculo de **iniciales** (`.iniciales`, `iniciales()` de `shared/domain/`).
- Cifras del mismo ancho en fechas, montos y códigos (`.numero`; dentro de las tablas, siempre). Montos a la derecha (`.alinear-derecha`, en la celda y en su encabezado).

**Piezas comunes (clases de `styles.scss`)**
| Qué | Cómo |
|---|---|
| Encabezado de la pantalla | `<header class="encabezado-pagina">` con `<h1 class="titulo-pagina">`, debajo `<p class="subtitulo-pagina">` (una línea que explica la pantalla) y a la derecha la acción principal |
| Tarjeta | `.tarjeta`; con su título: `.tarjeta__cabecera` + `.tarjeta__titulo`; con una tabla dentro: `tarjeta tarjeta--tabla` (sin relleno, se desliza de lado si no cabe) |
| Filtros de una lista | En una tarjeta, título «Filtros» con `.contador` («2 activos») y los campos en `.filtros` (grilla alineada a la base, 200 px mínimo por campo) |
| Tabla | Encabezado **claro** (gris muy suave, texto secundario en semi-negrita), **sin rayas**, líneas finas, resaltado suave al pasar el mouse; 48 px por fila |
| Celda de dos líneas | `<span class="celda-doble"><span>Nombre</span><span class="celda-doble__secundario">correo</span></span>` |
| Estado | `<span class="estado estado--exito">Activo</span>`: chip redondo de color suave (`--exito`, `--neutro`, `--aviso`, `--peligro`, cada uno con su `-fondo`). El texto dice el estado |
| Contador | `<span class="contador">5 de 12</span>` |
| Campo no obligatorio | `<label class="etiqueta" for="x">Teléfono <span class="opcional">(opcional)</span></label>` |
| Acción que quita algo | `<button matButton="outlined" class="boton-peligro">Desactivar</button>` (borde y texto rojos), arriba a la derecha de la ficha; se confirma siempre |
| Menú «Acciones» de una ficha (más de dos acciones) | `<mat-menu class="menu-acciones">` con `mat-menu-item` (ícono y texto); después de `<div class="menu-acciones__separador" role="separator">`, las que quitan algo con `class="menu-acciones__peligro"` (rojo). En el celular, el botón es solo «⋮» (`<app-icono nombre="mas" />`, con `aria-label`) y el encabezado lleva `[accionesEnLinea]="true"` para que quede a la derecha del nombre. Mientras corre una, el botón dice qué hace («Desbloqueando…»). Ejemplo: `ficha-usuario/` (6.12b3) |
| Pie de la ficha | `<app-pie-ficha>` con «Creado el … por …» y «Modificado el … por …»; a la derecha, un enlace con el atributo `pieAccion` (`<a pieAccion class="enlace pie-ficha__enlace">Ver historia</a>`). Sin nada, no se ve |
| Enlace dentro de un texto | `<a class="enlace" routerLink="…">Ver su ficha</a>`: color de la marca, semi-negrita, subrayado al pasar el mouse (nunca el azul del navegador) |
| Iniciales de una persona | `<span class="iniciales" aria-hidden="true">{{ iniciales(nombre) }}</span>` (más grande: `iniciales--grande`); el nombre siempre al lado |
| Error del backend en un formulario | Dentro del `<div role="alert">`, `<p class="mensaje-error"><app-icono nombre="alerta" [tamano]="18" /><span>{{ mensaje }}</span></p>` (recuadro rojo suave) |
| Texto solo para el lector de pantalla | `<span class="oculto-visual">(cumplido)</span>` |
| Marca | `<app-marca />` sobre fondo claro, `<app-marca tono="claro" />` sobre el azul oscuro (`tamano="grande"` en el login) |

**Patrones de pantalla (se hacen con su primera pantalla)**
- **Ficha** (6.12): volver con la flecha, círculo con las **iniciales**, nombre y estado; la acción peligrosa con borde rojo arriba a la derecha; pestañas y, dentro, bloques en tarjetas con título; pie con creado y modificado. Con `<app-encabezado-ficha>` (atributos `fichaSimbolo`, `fichaEstado`, `fichaDetalle`, `fichaAcciones`; «Volver» regresa a la lista con sus filtros si se llegó desde ella); **un botón de `fichaAcciones` dentro de un `@if` tiene que ser el único elemento de ese `@if`** (con dos `@if` anidados, Angular no lo coloca y el botón no aparece) y `<app-pie-ficha [creado] [modificado]>` (`shared/infrastructure/fichas/`).
- **Cambios sin guardar** (6.12a2, ficha de rol): la ficha siempre editable (con el permiso); al cambiar algo aparece abajo, pegada al borde, la barra «N cambios sin guardar» con «Descartar» y «Guardar cambios», que manda solo lo que cambió. Sin el permiso (o el Administrador), los datos se muestran como texto, no como campos.
- **Permisos de un rol** (6.12a3): agrupados por módulo con «N de M» marcados, un buscador (sin mayúsculas ni tildes) y el interruptor «Solo los marcados»; la casilla del grupo marca lo que se puede marcar y, si no queda nada, lo desmarca; «Se agrega» o «Se quita» junto a cada cambio (no en el alta). **Sin escalada**: lo que quien opera no tiene se ve bloqueado con «Usted no tiene este permiso», salvo que el rol ya lo tuviera (quitar nunca da más poder). En solo lectura (el Administrador, sin permiso de editar) las casillas conservan su color para que se lean. Con `<app-editor-permisos>` (`modules/auth/…/editor-permisos/`).
- **Roles de un usuario** (6.12b1): una casilla por rol con su descripción; lo que quien opera no puede dar se ve bloqueado con el motivo que dice el backend (`sePuedeDar`), quitar siempre se puede salvo el Administrador (solo un administrador); los desactivados que ya tiene, al final y en gris. Nadie cambia sus propios roles. Con `<app-editor-roles-usuario>` (`modules/auth/…/editor-roles-usuario/`); en el alta, `[mostrarCambios]="false"` (todo es nuevo).
- **Acciones de una ficha** (6.12b3): con una o dos, botones a la vista (la que quita algo con borde rojo); con más, un solo menú «Acciones» (decisión del usuario, 2026-11-06), el mismo en la PC y en el celular, con solo las que tienen sentido para ese registro y quien opera (sin opciones bloqueadas). Se confirma lo que corta algo (quitar, desactivar, cerrar sesiones, dar otra contraseña); lo que solo devuelve (desbloquear, reactivar) se hace directo, con su aviso.
- **Contraseña temporal** (6.12b2): una ventana con la contraseña en letra de ancho fijo, «Copiar» (dice «Copiada» o, si el navegador no deja, que la copie a mano) y el aviso de que se ve **esta sola vez**; se cierra solo con su botón (ni Escape ni un clic afuera). `inject(ContrasenaTemporalService).mostrar({ titulo, nombreUsuario, contrasena, textoListo })` (`modules/auth/…/contrasena-temporal/`).
- **Alta con dos caminos** (6.12b2, «Nuevo usuario»): la pregunta arriba («¿A quién le da acceso?») con dos opciones grandes como tarjetas (un `<input type="radio">` dentro de cada `<label>`); lo escrito se queda al cambiar de opción y el botón dice lo que hace en cada una («Registrar usuario» o «Dar acceso»). Una sola página (como la maqueta aprobada), sin pestañas: son dos campos y los roles.
- **Pestañas de una ficha** (6.12a3): `mat-tab-group` con `animationDuration="0ms"`, `[mat-stretch-tabs]="enCelular()"` y `[(selectedIndex)]`; el tema les da 44 px, semi-negrita y la raya azul de 3 px (`mat.tabs-overrides` en `styles.scss`). La cifra al lado del título va en `<ng-template mat-tab-label>`; en el celular las pestañas estiradas llevan menos relleno (`styles.scss`) para que tres con su cifra quepan en 390 px. Una sola barra de cambios para todas las pestañas; si al guardar hay un error en otra pestaña, se va a ella y al campo (`afterNextRender`).
- **Login partido** (6.10a, rehecho en el 6.10b0): a la izquierda, la marca en azul oscuro con una cuadrícula y dos líneas tenues que suben (un gráfico genérico, de la marca), el lema y «Cada acción queda registrada»; a la derecha, «Ingrese a su cuenta», campos con ícono, el error del backend en un recuadro rojo suave y la ayuda para la contraseña olvidada. En el celular, solo el formulario con la marca arriba.
- **Selector de empresa** (6.10b2): en el recuadro de la empresa activa, **arriba del menú lateral** (no en la cabecera: decisión del usuario al aprobar la maqueta, 2026-11-06), y «Cambiar de empresa» en el menú del usuario. En la PC, una ventana al centro; en el celular, la misma lista subiendo desde abajo (`panel-hoja`) con su asa y «Cancelar» a todo el ancho. La activa con borde azul, «Empresa activa» y ✓, y el foco en ella al abrir; al elegir otra, «Cambiando…» y no se puede cerrar hasta que recarga.
- **Cambiar la contraseña** (6.10b1): el formulario en una tarjeta (actual o temporal, nueva con barra de fuerza de cuatro rayas y su texto, repetirla; «Mostrar» muestra las dos nuevas) y al costado las reglas (largo y que coincidan se marcan al escribir; las demás se revisan al guardar) y el aviso de que se cierran las sesiones en otros equipos. La temporal, fuera del layout con la marca y «Salir», «Elija su contraseña» y «Guardar y continuar»; la voluntaria, dentro del layout con «Guardar contraseña» y «Cancelar».

### 8.6 Marca (color y logo por confirmar con el negocio)
Hoy es **provisional** (pasos 5.12, 5.13, 6.9 y 6.10b0): azul de acción `#1f4fbf` (`--color-primario`; oscuro `#173c93`, suave `#e8eefb`), azul muy oscuro `#0a1a33` de la marca y el menú (`--color-menu*`) y dorado `#c9a646` solo como detalle (`--color-acento`; sobre fondo claro `#8a6a1f`, `--color-acento-texto`), en `styles.scss`. Logo: un cuadrado con tres barras que suben (la última dorada) y «Base **ERP**»; en la aplicación lo dibuja `<app-marca>` (`shared/infrastructure/layout/marca/`, con la fuente Inter: una imagen SVG no puede usar las fuentes de la página); fuera de ella, `public/marca/logo.svg`, `logo-claro.svg` (fondo oscuro) y `simbolo.svg` (favicon). Para cambiarla: esas variables, `<app-marca>`, el dibujo de fondo del lado de la marca del login (`login.component.html`), los tres SVG, el color en `manifest.webmanifest` y en `<meta name="theme-color">` de `index.html`, `docs/marca/icono-pwa-maskable.svg` y los PNG de `public/iconos-app/` (receta en `docs/marca/README.md`). Revisar el contraste AA de cada par (los valores están anotados al lado de cada variable).
- Color principal de la empresa en el tema; logos en **SVG** en `public/marca/` (los originales de diseño en `docs/marca/`); íconos de la PWA y favicon con el símbolo del logo; la fuente del logo solo en el logo.
- Manifest con el nombre visible ("Base ERP") y el color de la marca.
- Textos de la empresa (pie de página, razón social) desde la configuración del backend.
- **Los textos de la marca, en un solo lugar** (DOM-01, 6.14a): `MARCA` en `shared/infrastructure/layout/marca/marca.ts` (el nombre, cómo se parte en el logo y el lado de la marca del login: antetítulo, lema y descripción, lo único del rubro dentro de la base, sección 1.1 del `CLAUDE.md`). Lo leen el logo, el login, el layout y el aviso de versión nueva. Fuera de TypeScript el nombre sigue escrito en `index.html`, `manifest.webmanifest` y los SVG de `public/marca/`. En el backend, `src/marca.ts` (Swagger). Nunca escribir el nombre ni el rubro en otro archivo.

## 9. Pruebas

| Qué | Mínimo |
|---|---|
| Casos de uso | 80 % |
| Stores / componentes | 60 % / 40 % |

- Unitarios de casos de uso, facades, stores y dominio; componentes con facades simulados; HTTP con `provideHttpClientTesting()` y `HttpTestingController`.
- Casos borde: credenciales inválidas, campos vacíos, lista vacía, error de red, token vencido (un solo refresh y se repite), refresh fallido (al login), doble clic (botón deshabilitado), cambio de tamaño de pantalla.
- **Revisión visual antes del merge**: Claude revisa las pantallas nuevas con la extensión de Chrome o, si no conecta, con Chrome sin ventana (`--headless=new`), simulando las respuestas de la API, con capturas en PC (1366–1600) y celular (390). Sin contraseña real ni tocar la base. El script va en una carpeta temporal, nunca en el repo.
- **Pruebas manuales**: `docs/pruebas-manuales/<modulo>.md` (necesita antes, casos numerados con una letra del módulo, `E1`, `U1`…, celular, teclado, accesibilidad, al terminar), y en su `README.md` la lista, el orden, el tiempo y las reglas comunes. Se corre la del módulo antes de su PR; todas, antes de producción.
- **E2E en el navegador** (antes de producción): paquete `apps/base-e2e` con Playwright y AXE, base propia `<bd>_e2e`, solo Chromium en escritorio y celular, buscando por rol y etiqueta (sin `data-testid`).

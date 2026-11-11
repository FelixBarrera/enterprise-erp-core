# Módulo `empresas` (diseño)

Paso 6.1 · Estado: **diseño aprobado**; tabla, dominio y puertos hechos en el 6.4a; comandos en el 6.4c; endpoints en el 6.7a; selector de empresa en el 6.10b2; ficha de la empresa en el 6.12a1, que se quitó en el 6.15b (se renombra con `admin:renombrar-empresa`).

Una instalación atiende a **varias empresas en la misma base** (decisión del usuario del 2026-11-05). Este módulo es el dueño de la tabla de empresas y de la regla que separa los datos de cada una. Lo usan todos los demás módulos.

## 1. Punto de partida

No hay sistema anterior que migrar: es parte de la base. El objetivo es que la base sirva para **cualquier negocio**: el módulo no sabe nada del rubro (ni de sus clientes ni de sus productos). Lo propio de cada negocio (datos tributarios, establecimientos, sucursales) lo agrega su propio módulo en sus propias tablas, apuntando a `organizacion.empresas`.

## 2. Decisiones

| # | Tema | Decisión | Motivo |
|---|---|---|---|
| EMP-D1 | Una o varias empresas | **Varias en la misma base.** Toda tabla de negocio lleva `empresa_id` | Decisión del usuario. Se decide antes de la primera tabla porque agregarlo después obliga a migrar datos reales |
| EMP-D2 | Quién crea empresas | **Solo por comando en el servidor** (`pnpm admin:crear-empresa`), nunca desde una pantalla | La regla 13 prohíbe el súper administrador: si una pantalla creara empresas, alguien tendría poder sobre todas. Crear una empresa es raro y lo hace quien administra el servidor |
| EMP-D3 | Qué crea el comando | La empresa, su rol "Administrador" y el acceso de un usuario (nuevo o existente) a ese rol, en una sola transacción y auditado | Una empresa sin administrador quedaría inservible |
| EMP-D4 | Separación de datos (capa 1, obligatoria) | El `Actor` de cada petición trae la **empresa activa**; todo método de repositorio que lee o escribe datos de empresa recibe `empresaId` y filtra por él. Cada módulo tiene un e2e de aislamiento ("la empresa A no ve, no edita y no cuenta lo de B") | Explícito y revisable en el código; no depende de magia oculta |
| EMP-D5 | Separación de datos (capa 2) | **FK compuestas** `(empresa_id, x_id)` → `(empresa_id, id)` entre tablas de negocio de la misma empresa | La base impide, aunque el código se equivoque, que una factura de A apunte a un cliente de B |
| EMP-D6 | Separación de datos (capa 3, por decidir antes de producción) | Evaluar **Row Level Security** de PostgreSQL (la base filtra por empresa sola) | Es la defensa más fuerte, pero con Prisma obliga a abrir una transacción en cada consulta para fijar la empresa. Se mide el costo antes de decidir (pregunta EMP-P2) |
| EMP-D7 | Zona horaria | **Una por instalación** (`ZONA_NEGOCIO` en el `.env`, sub-paso 6.2), común a todas las empresas | Una zona por empresa obligaría a pasar la empresa a cada `FechaFiscal`. Si un día hay empresas en países distintos, se revisa (pregunta EMP-P1) |
| EMP-D8 | Moneda | Sigue siendo dólares (`Dinero`) | Ecuador usa dólares. Otra moneda es un cambio aparte, anotado en "Fuera de alcance" |
| EMP-D9 | Desactivar una empresa | Se desactiva (`activo = false`), nunca se borra. Nadie puede entrar a una empresa desactivada; sus datos quedan | Regla 12 y conservación de 7 años. También por comando (`pnpm admin:desactivar-empresa`) |

## 3. Tablas

Esquema `organizacion` (el del área; `docs/modelo-datos.md`).

### `organizacion.empresas` (maestro)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` (v7) | La clave que llevan todas las tablas de negocio |
| `nombre` | `varchar(150)` | Lo que ve el usuario en el selector de empresa y en la cabecera; también se usa para rechazar contraseñas que lo contienen |
| `activo` | `boolean` | Una empresa desactivada no deja entrar (EMP-D9) |
| `creado_en`, `creado_por`, `actualizado_en`, `actualizado_por` | `timestamptz`, `uuid` | Convención (regla 12) |

- Único entre las activas, sin importar mayúsculas ni tildes: índice único parcial sobre `public.nombre_normalizado(nombre) WHERE activo` (SQL a mano en la migración).
- `CHECK (length(trim(nombre)) > 0)`.
- No lleva RUC, dirección ni logo: **nadie los usa todavía** (`docs/plantilla-modulo.md`, sección 3). Los agrega el módulo que los necesite (por ejemplo, facturación) en su propia tabla.

### Convención para todas las tablas de negocio (desde ya)

Se agrega a `docs/modelo-datos.md`:

- `empresa_id uuid NOT NULL` con FK a `organizacion.empresas` (`onDelete: Restrict`) e índice.
- Los únicos de negocio llevan la empresa: `UNIQUE (empresa_id, codigo)`, no `UNIQUE (codigo)`.
- Un `UNIQUE (empresa_id, id)` en cada tabla que otra tabla de la misma empresa referencia, para poder hacer la FK compuesta (EMP-D5).
- Los índices de los listados empiezan por `empresa_id`.
- **Excepciones** (sin `empresa_id`, con su motivo en el registro de tablas): `seguridad.usuarios` (una persona puede trabajar en varias empresas), `seguridad.permisos` (el catálogo es del código) y las tablas técnicas que no son de una empresa.

## 4. Dominio

- Entidad `Empresa` (`id`, `nombre`, `activo`). Value object `NombreEmpresa` (recortado, 1 a 150 caracteres, obligatorio).
- Errores: `EmpresaNoEncontradaError` (404), `EmpresaInactivaError` (422 "La empresa está desactivada"), `NombreEmpresaDuplicadoError` (409 "Ya existe una empresa con ese nombre").
- Puertos de entrada que usan otros módulos: `CONSULTAR_EMPRESAS_PORT` (`buscarActiva(id)`, `nombres(ids)` y `hayAlguna()`, este para `admin:crear-inicial`). El login lo usa para armar la lista de empresas del usuario. `CREAR_EMPRESA_PORT`, `DESACTIVAR_EMPRESA_PORT` y `RENOMBRAR_EMPRESA_PORT` (6.15a) los usan solo los comandos de `auth` (ARQ-02): se unen a la transacción del comando.
- Los eventos `empresas.empresa.crear` y `empresas.empresa.desactivar` van con `empresa_id` = la empresa afectada, para que su administrador los vea en la bitácora. Desactivar dos veces no cambia nada ni registra otro evento (OPS-03).
- `NombreEmpresa` también junta los espacios repetidos y normaliza a NFC.

## 5. Endpoints y permisos

Crear y desactivar van **solo por comando** (EMP-D2); renombrar cualquier empresa, también (6.15a). Por la API:

| Método | Ruta | Qué hace | Permiso |
|---|---|---|---|
| `GET` | `/empresa` | Datos de la empresa activa: `{ id, nombre }` | Solo sesión (la ve todo usuario de esa empresa) |
| `PATCH` | `/empresa` | Cambia el nombre de la empresa activa (sin el campo, queda igual; si no cambia, no se registra). Bitácora: `empresas.empresa.editar` con el nombre de antes y el de después. Nunca otra empresa: la ruta no lleva id | `empresas.empresa.editar` |

`empresas.permisos.ts`:

```ts
export const PERMISOS_EMPRESAS = {
  'empresas.empresa.editar': 'Editar los datos de la empresa',
} as const;
```

Comandos (`apps/base-backend`):

| Comando | Qué hace |
|---|---|
| `pnpm admin:crear-inicial` | Primera instalación: crea la primera empresa y su primer administrador desde `ADMIN_INICIAL_*` y `EMPRESA_INICIAL_NOMBRE`. Si ya hay alguna empresa, no hace nada |
| `pnpm admin:crear-empresa` | Crea otra empresa y da su rol "Administrador" a un usuario existente (activo) o a uno nuevo (pide los datos por la terminal; la contraseña, dos veces y sin que se vea, nunca en la línea de comandos; es temporal) |
| `pnpm admin:desactivar-empresa` | Muestra las activas; se elige una por su número y se confirma escribiendo su nombre. La desactiva y cierra las sesiones abiertas en ella (desde el 6.5d), en la misma transacción; dice cuántas cerró |
| `pnpm admin:renombrar-empresa` | Muestra las activas; se elige una por su número, se escribe el nombre nuevo y se confirma (`s`). Mismas reglas que `PATCH /empresa` (obligatorio, hasta 150, sin repetir el de otra activa); con el mismo nombre no cambia ni registra nada (OPS-03). Quienes estén dentro lo ven al recargar (6.15a) |

Todos quedan en la auditoría con `usuario_id = null` (proceso del sistema), el nombre del comando en `nombre_usuario` (`admin:crear-empresa`) y la acción `empresas.empresa.crear`, `empresas.empresa.desactivar` o `empresas.empresa.editar` (renombrar, con el nombre de antes y el de después); crear suma `auth.rol.crear` y `auth.usuario.crear` (o `auth.usuario.dar_acceso` si el usuario ya existía), todos en la empresa nueva.

## 6. Pantallas

- **Selector de empresa** en la cabecera, solo si el usuario tiene más de una. Al entrar no se pregunta: se entra a la última empresa usada (AUTH-D4 en `auth-usuarios.md`). Al cambiar, la página se recarga.
- **Datos de la empresa** (solo el nombre por ahora), con el permiso `empresas.empresa.editar`.

## 7. Fuera de alcance

- Crear empresas desde una pantalla (EMP-D2).
- Datos tributarios, establecimientos y logo por empresa (los agrega su módulo).
- Otra moneda que no sea el dólar.
- Zona horaria por empresa (EMP-D7).
- Datos compartidos entre empresas (catálogos comunes): si un módulo los necesita, lo decide en su propio diseño.

## 8. Preguntas

| # | Pregunta | Para |
|---|---|---|
| EMP-P1 | ¿Alguna vez habrá empresas en otro país o zona horaria en la misma instalación? | Usuario |
| EMP-P2 | ¿Se activa Row Level Security antes de producción (EMP-D6)? Se propone medirlo con la prueba de carga | Usuario, antes de producción |
| EMP-P3 | ¿Hay catálogos que deban ser comunes a todas las empresas? | Cada módulo de negocio |

## 9. Pasos

| Sub-paso | Qué |
|---|---|
| 6.4a | Tabla, dominio, repositorio, puertos de entrada (✅) |
| 6.4c | Comandos (✅) |
| 6.5d | `admin:desactivar-empresa` cierra las sesiones abiertas en la empresa, en la misma transacción (✅; caso de uso en `auth`, ARQ-02) |
| 6.7a | `GET` y `PATCH /empresa` (✅) |
| 6.10b2 | Selector de empresa en pantalla (junto con la sesión) (✅) |
| 6.15a | `admin:renombrar-empresa` (`RENOMBRAR_EMPRESA_PORT`; la misma regla que `PATCH /empresa`, en `renombrarEmpresa()`) (✅) |
| 6.12a1 | Ficha de la empresa (`/empresa`, con `empresas.empresa.editar`): editar el nombre; el nuevo se ve enseguida en el menú y la cabecera, también en las otras pestañas (✅; **quitada en el 6.15b**) |
| 6.15b | Frontend sin la ficha «Empresa»: ni menú, ni ruta, ni «Ver su ficha» en la bitácora (el Administrador pasa todos los permisos, así que no bastaba con no darlo). La API se queda (✅) |

## 10. Revisión del diseño

Ver la revisión conjunta en `docs/modulos/auth-usuarios.md` (sección 11): los tres módulos del paso 6 se revisan juntos porque dependen unos de otros.

## 11. Revisión del código (paso 6.13e)

Ver la revisión conjunta en `docs/modulos/auth-usuarios.md` (sección 12).

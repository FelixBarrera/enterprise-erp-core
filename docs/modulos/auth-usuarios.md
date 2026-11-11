# Módulo `auth`: login, usuarios, roles y permisos (diseño)

Paso 6.1 · Estado: **diseño aprobado**; tablas `usuarios`, `roles` y `usuarios_roles`, `Contrasena` y Argon2id hechos en el 6.4b; comandos `admin:*` en el 6.4c; tabla `sesiones` y tokens en el 6.5a; login y refresh en el 6.5b; guard global, logout y `GET /auth/sesion` en el 6.5c; cambiar empresa y contraseña en el 6.5d; límite de peticiones en el 6.5e; catálogo de permisos en el 6.6a; `@RequierePermiso()` y `ReglasDeEscalada` en el 6.6b; paginación y `GET /permisos` en el 6.7a; roles (lista, ficha, crear, editar, permisos, desactivar y reactivar) en el 6.7b; usuarios (lista, ficha y editar el nombre) en el 6.7c; crear con contraseña temporal, agregar uno existente, fijar roles y quitar acceso en el 6.7d; agregar uno existente se quitó en el 6.12b6.

Relacionados: `docs/modulos/empresas.md` (varias empresas en la misma base) y `docs/modulos/auditoria.md` (bitácora). Lo que ya estaba decidido antes de este diseño (Argon2id, tokens, CSRF, bloqueo) está en `docs/arquitectura-backend.md` (sección 14) y `docs/arquitectura-frontend.md` (sección 6); aquí se completa y no se repite.

## 1. Punto de partida

No hay sistema anterior que migrar: es parte de la base. Tiene que servir para **cualquier negocio**:

- El módulo no sabe nada del rubro. Si un negocio necesita saber a qué área o sucursal pertenece un usuario, eso lo guarda **su** módulo, en **su** tabla, apuntando a `seguridad.usuarios`. Nunca al revés.
- Los permisos los declara cada módulo; este módulo solo los sincroniza y los revisa.
- Lo que cambia de un negocio a otro va en el `.env` (duración de la sesión, primer administrador), no en el código.

## 2. Decisiones

| # | Tema | Decisión | Motivo |
|---|---|---|---|
| AUTH-D1 | Un módulo o varios | Un módulo `auth`, dueño de todo el esquema `seguridad` (usuarios, roles, permisos, sesiones) | El guard necesita los cuatro en cada petición; partirlos obligaría a puertos entre módulos para lo mismo |
| AUTH-D2 | Usuarios y empresas | **El usuario es uno solo** (una cuenta, una contraseña) y **sus roles son por empresa**. Tener acceso a una empresa = tener al menos un rol en ella | Una persona que trabaja en dos empresas (el contador de un grupo) no maneja dos claves. Sin tabla de "accesos" aparte: el rol ya dice la empresa. **2026-11-07** (decisión del usuario): desde la aplicación ya no se da acceso a alguien que ya tiene usuario («Nuevo usuario» solo crea personas nuevas; la pantalla en el 6.12b5, la ruta `POST /usuarios/existente` se quitó en el 6.12b6). Una persona entra a otra empresa solo como administrador de una empresa nueva, con `admin:crear-empresa` |
| AUTH-D3 | Nombre de usuario | Único en toda la instalación, en minúsculas (`a-z`, `0-9`, `.`, `_`, `-`; de 3 a 50) y **nunca se reutiliza**, aunque el usuario se desactive | La bitácora guarda el nombre: si se reutilizara, dos personas quedarían con el mismo nombre en la historia |
| AUTH-D4 | Empresa al entrar | Se entra a la **última empresa usada**; si ya no tiene acceso a ella, a la primera por nombre. Se cambia desde la cabecera | Menos pasos: el que trabaja en una sola empresa nunca ve el selector |
| AUTH-D5 | Empresa en el token | El access token lleva solo `sub` (usuario) y `sid` (sesión). La empresa activa vive en la **sesión**, en la base | El guard ya lee la sesión en cada petición: cambiar de empresa no necesita otro token, y una sesión cerrada deja de valer al instante |
| AUTH-D6 | Refresh token | Opaco, con forma `<sid>.<secreto de 256 bits>.<firma>`; en la base, solo el SHA-256 del secreto. La firma es un HMAC-SHA256 de `<sid>.<secreto>` con una clave derivada de `JWT_SECRETO` (HKDF); se revisa **antes** de buscar la sesión (6.13f, SEG-05) | Con el `sid` se encuentra la sesión de cualquier token viejo: **todo reuso se detecta**, no solo el del token anterior. La firma impide que alguien que vio el `sid` (en la ficha o en la bitácora) invente un token que cierre las sesiones de otro |
| AUTH-D7 | Reuso del refresh | El token anterior vale **60 s** después de rotar (si se perdió la respuesta, la pantalla reintenta). Después, presentar un token viejo **cierra todas las sesiones del usuario** y queda en la bitácora | Lo decidido en la arquitectura; los 60 s cubren una red que reintenta |
| AUTH-D8 | Sesión sin uso | `ultimo_uso_en` se actualiza en cada **refresh** (cada 15 minutos de uso como mucho), no en cada petición | Medir la inactividad de 120 minutos con un margen de 15 no cambia la seguridad y evita una escritura por petición |
| AUTH-D9 | Rutas sin permiso | Cada ruta lleva **exactamente uno** de tres decoradores: `@Publico()`, `@SoloSesion()` o `@RequierePermiso('…')`. Si falta o sobra, **la API no arranca** | Nadie puede olvidar proteger un endpoint. `@SoloSesion()` es para lo que ve todo usuario de la empresa (su sesión, el nombre de la empresa) |
| AUTH-D10 | Rol "Administrador" | Uno por empresa, creado con la empresa (`es_administrador`), con todos los permisos de **esa** empresa. No se edita ni se desactiva. No hay súper administrador: el de la empresa A no ve nada de B | Regla 13 |
| AUTH-D11 | Sin escalada | (1) Nadie edita sus propios roles. (2) Quien no es administrador solo asigna roles cuyos permisos él tiene, y solo agrega a un rol permisos que él tiene. (3) Solo un administrador da o quita el rol "Administrador" (quitar: decisión del usuario, 6.6b). (4) No se puede dejar a una empresa sin administrador activo. **6.7d** (decisión del usuario, 2026-11-06): no se **da** un rol desactivado (422); el que ya lo tenía puede quedárselo al fijar sus roles. Para contar los administradores se bloquea la fila del rol Administrador: dos que se lo quitan uno al otro a la vez dejan uno. Con una sola petición no puede pasar (quien opera es un administrador activo y no se cambia a sí mismo). **6.7e** (decisión del usuario, 2026-11-06): contraseña temporal y reactivar a alguien piden que, en **cada** empresa activa suya, sus permisos sean parte de los de quien actúa (403 «No puede hacer este cambio a alguien que tiene permisos que usted no tiene»); a un administrador solo lo toca otro administrador, también al desactivarlo (403 «Solo un administrador puede hacer este cambio a otro administrador»). Nadie se pone una temporal ni se desactiva a sí mismo. Desactivar cuenta los administradores de cada empresa donde lo es, con la fila del rol bloqueada (en el orden de las empresas) | Regla 13: "sin escalada" |
| AUTH-D12 | Usuario que trabaja en varias empresas | Lo que es de la empresa (sus roles en ella, quitarle el acceso) lo maneja cada empresa. Lo que es de la persona (nombre, contraseña temporal, desactivar) solo lo puede hacer quien tiene ese permiso en **todas** las empresas del usuario. **6.7c** (decisión del usuario, 2026-11-06): cuentan las empresas **activas** donde tiene algún rol, **aunque el rol esté desactivado** (puede volver); una empresa desactivada no cuenta (ahí nadie entra, y si contara lo de la persona no se podría cambiar nunca más). Se revisa aunque el cambio no cambie nada. **6.7e** (decisión del usuario): desbloquear y cerrar sesiones no dan acceso a nadie: basta el permiso en la empresa activa | Si no, el administrador de A podría poner una contraseña temporal y entrar como esa persona a B |
| AUTH-D13 | Contraseña temporal | La **genera el sistema** (12 caracteres legibles, sin `0/O`, `1/l/I`), se muestra **una sola vez** a quien la pidió y obliga a cambiarla al entrar. **6.7d**: alfabeto de 57 símbolos (unos 70 bits) con `crypto.randomInt`; pasa por `Contrasena` (se genera otra si sale común o con el nombre del usuario o de la empresa); la respuesta lleva `Cache-Control: no-store` y la bitácora solo `claveTemporal: true` | Así el administrador no elige una débil, y nadie la ve después |
| AUTH-D14 | Mientras debe cambiar la contraseña | Solo funcionan `GET /auth/sesion`, `POST /auth/cambiar-contrasena`, `POST /auth/refresh` y `POST /auth/logout`; todo lo demás responde 403 "Debe cambiar su contraseña antes de continuar" | Lo decidido en el frontend ("todo lleva a Cambiar contraseña"), cumplido también por la API |
| AUTH-D15 | Mensaje del login | Siempre el mismo: "Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador." (inexistente, contraseña mal, bloqueado o desactivado) | No dice si el usuario existe, y el bloqueado igual sabe qué hacer |
| AUTH-D16 | Usuario sin empresa | Con la contraseña correcta pero sin ningún rol en una empresa activa: 403 "Su usuario no tiene acceso a ninguna empresa. Pida ayuda al administrador." Queda en la bitácora como `auth.sesion.fallido` con el motivo `SIN_EMPRESA`, en su última empresa (sin empresa si nunca entró), **sin sumar al bloqueo** (6.13f, AUD-01) | Solo lo ve quien ya sabe la contraseña; con el mensaje genérico el usuario y el administrador no sabrían qué pasa |
| AUTH-D17 | Límite de peticiones | En **Redis** (decisión del usuario), con `@nestjs/throttler` y un almacenamiento propio sobre la conexión de Redis. Login: 10 por minuto por IP. General: 300 por minuto por usuario, 60 por IP sin sesión. `/health` exento. Si Redis no responde, **deja pasar** y lo registra como error. **6.5e** (decisiones del usuario, 2026-11-06): los tres números van en el `.env` (`LIMITE_LOGIN_POR_MINUTO`, `LIMITE_USUARIO_POR_MINUTO`, `LIMITE_IP_POR_MINUTO`) y se cuenta **después** del guard de sesión (una petición rechazada con 401 no cuenta). Al pasarse, 429 con `Retry-After` | El bloqueo por usuario (5 fallos) vive en PostgreSQL y sigue protegiendo; cortar el login entero porque cayó Redis dejaría a todos sin trabajar. Los números se revisan con la prueba de carga |
| AUTH-D18 | Segundo factor | **Preparado, no hecho** (decisión del usuario). Llegará como tabla aparte (`seguridad.segundos_factores`) y un paso más en el login (`POST /auth/segundo-factor`). El caso de uso del login del frontend se arma ya pensando en un paso intermedio | No crece el paso 6; agregarlo después no cambia las tablas de hoy |
| AUTH-D19 | Recuperar contraseña por correo | No: la restablece el administrador (AUTH-D13) | No hay correo todavía; un "olvidé mi contraseña" mal hecho es la puerta más usada para robar cuentas |
| AUTH-D20 | Lista de contraseñas comunes | Las 10.000 más comunes de **SecLists** (MIT), guardadas solo las de 8 a 128 caracteres (2.087; las más cortas ya las rechaza el largo). Origen, commit y licencia en `LICENCIA-contrasenas-comunes.md`, al lado del archivo. Se carga al arrancar | Rechazar las comunes es lo que más ayuda; reglas de composición ("una mayúscula") no |

## 3. Tablas

Esquema `seguridad`. Todas con id UUID v7 y `timestamptz` (regla 12).

### `seguridad.usuarios` (maestro, **sin `empresa_id`**: una persona puede estar en varias empresas)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` | `sub` del token; `usuario_id` de la bitácora |
| `nombre_usuario` | `varchar(50)` | Con lo que entra. `UNIQUE` (normal, no parcial: AUTH-D3) y `CHECK (nombre_usuario ~ '^[a-z0-9._-]{3,50}$')` |
| `nombre_completo` | `varchar(150)` | Lo que se ve en la cabecera, en las listas y en la bitácora |
| `hash_contrasena` | `varchar(255)` | Argon2id en formato PHC. **Nunca sale de la API** ni va a la bitácora |
| `debe_cambiar_contrasena` | `boolean` | AUTH-D13 y AUTH-D14 |
| `intentos_fallidos` | `smallint` | Cuenta para el bloqueo; vuelve a 0 al entrar bien. `CHECK (intentos_fallidos >= 0)` |
| `bloqueado_hasta` | `timestamptz` null | Bloqueo de 15 minutos; la pantalla de usuarios lo muestra y deja desbloquear |
| `ultima_empresa_id` | `uuid` null, FK a `organizacion.empresas` | AUTH-D4 |
| `ultimo_ingreso_en` | `timestamptz` null | La pantalla de usuarios lo muestra: sirve para encontrar cuentas que nadie usa y desactivarlas |
| `activo` | `boolean` | Desactivado = no entra en ninguna empresa (regla 12: nunca se borra) |
| `creado_en/por`, `actualizado_en/por` | | Convención (`creado_por` null = comando del sistema) |

### `seguridad.permisos` (catálogo técnico: lo llena el código al arrancar)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` | |
| `codigo` | `varchar(100)` | `modulo.recurso.accion`. `UNIQUE` y `CHECK (codigo ~ '^[a-z0-9_]+\.[a-z0-9_]+\.[a-z0-9_]+$')` |
| `descripcion` | `varchar(150)` | El texto que ve quien arma un rol ("Ver usuarios") |
| `obsoleto` | `boolean` | El código ya no lo declara: no cuenta para el guard ni sale en pantalla, pero no se borra (su historia queda) |
| `creado_en`, `actualizado_en` | | Sin `*_por`: lo escribe el arranque, no una persona (excepción anotada en el registro de tablas) |

### `seguridad.roles` (maestro, por empresa)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` | |
| `empresa_id` | `uuid`, FK | De qué empresa es el rol. Índice |
| `nombre` | `varchar(80)` | Lo que se ve al asignar roles |
| `descripcion` | `varchar(250)` null | Explica para qué es el rol en la pantalla de roles |
| `es_administrador` | `boolean` | AUTH-D10 |
| `activo` | `boolean` | Un rol desactivado no da permisos; sus asignaciones quedan por si se reactiva |
| `creado_en/por`, `actualizado_en/por` | | |

- `UNIQUE (empresa_id, id)` para la FK compuesta de `usuarios_roles`.
- Único entre los activos, sin mayúsculas ni tildes: `(empresa_id, nombre_normalizado(nombre)) WHERE activo`.
- Un solo administrador por empresa: único parcial `(empresa_id) WHERE es_administrador`.
- `CHECK (NOT es_administrador OR activo)`: el administrador no se desactiva.

### `seguridad.roles_permisos` (unión)

`rol_id`, `permiso_id`, `creado_en`, `creado_por`. Clave `(rol_id, permiso_id)`; índice en `permiso_id`. El rol administrador **no lleva filas**: tiene todos por su marca (AUTH-D10); lo cuida el trigger `roles_permisos_sin_administrador` (6.6a).

### `seguridad.usuarios_roles` (unión)

| Columna | Uso concreto |
|---|---|
| `usuario_id` | FK a `usuarios` |
| `empresa_id` | Copia de la empresa del rol: hace rápido "los usuarios de esta empresa" y, con la FK compuesta `(empresa_id, rol_id) → roles (empresa_id, id)`, la base impide que no coincida |
| `rol_id` | |
| `creado_en`, `creado_por` | |

Clave `(usuario_id, rol_id)`; índices `(empresa_id, usuario_id)` y `rol_id`.

### `seguridad.sesiones` (técnica)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` | El `sid` del access token y la primera parte del refresh (AUTH-D6) |
| `usuario_id` | `uuid`, FK | Índice parcial `WHERE cerrada_en IS NULL` (cerrar todas las de un usuario) |
| `empresa_id` | `uuid`, FK | La empresa activa (AUTH-D5). Índice parcial `WHERE cerrada_en IS NULL` (cerrar las de una empresa desactivada) |
| `hash_refresh` | `char(64)` | SHA-256 del secreto vigente |
| `hash_refresh_anterior` | `char(64)` null | El anterior, para los 60 s de gracia (AUTH-D7) |
| `rotado_en` | `timestamptz` null | Desde cuándo corren esos 60 s |
| `iniciada_en` | `timestamptz` | Con `vence_en`, el máximo de 13 horas |
| `vence_en` | `timestamptz` | `iniciada_en` + `SESION_DURACION_MAXIMA_HORAS` |
| `ultimo_uso_en` | `timestamptz` | Inactividad de `SESION_INACTIVIDAD_MINUTOS` (AUTH-D8) |
| `cerrada_en` | `timestamptz` null | Sesión cerrada (por el motivo que sea) |
| `motivo_cierre` | enum `MotivoCierreSesion` null | `SALIDA`, `CAMBIO_CONTRASENA`, `REUSO`, `ADMINISTRADOR`, `USUARIO_DESACTIVADO`, `EMPRESA_DESACTIVADA`, `ACCESO_QUITADO`. `CHECK ((cerrada_en IS NULL) = (motivo_cierre IS NULL))` |
| `ip` | `varchar(45)` null | La pantalla "sesiones abiertas" del usuario y la bitácora. `null` solo si no hay petición (6.5a: nunca se guarda `''`) |
| `navegador` | `varchar(300)` null | Igual ("Chrome en Windows"); se recorta a 300 caracteres |

Sin `creado_*`/`actualizado_*` (tabla técnica de sesión, excepción ya prevista en `docs/modelo-datos.md`). Las sesiones vencidas se limpian con una tarea periódica antes de producción; la historia queda en la bitácora.

## 4. Dominio

**Value objects**: `NombreUsuario` (recorta, pasa a minúsculas, valida el formato), `NombreCompleto`, `Contrasena` (NFKC, 8 a 128, no recorta; rechaza comunes, triviales y las que contienen el usuario o el nombre de alguna de sus empresas), `CodigoPermiso` (formato `modulo.recurso.accion`), `NombreRol`.

**Entidades**: `Usuario` (con `registrarFallo(ahora)`, `estaBloqueado(ahora)`, `ingresoExitoso(ahora)`), `Rol`, `Sesion` (con `rotar()`, `estaViva(ahora, inactividad)`, `cerrar(motivo)`), `Permiso`.

**Servicio de dominio**: `ReglasDeEscalada` (AUTH-D11 y AUTH-D12, 6.6b): recibe los permisos de quien actúa y los del rol o usuario afectado, y lanza el error si no se puede. Decisiones del usuario (6.6b): dar **o quitar** el rol Administrador es solo de un administrador; «solo lo que usted tiene» se revisa al **dar** (quitar un rol o un permiso nunca da más poder).

**Puertos de salida**: `HASHER_CONTRASENA_PORT` (Argon2id), `GENERADOR_TOKENS_PORT` (JWT y secretos al azar), `CONTRASENAS_COMUNES_PORT`, repositorios de usuarios, roles, permisos y sesiones. **Lo que usan otros módulos**: los decoradores `@Publico()`, `@SoloSesion()`, `@RequierePermiso()` y `@UsuarioActual()` (que entrega el `Actor`). El permiso lo revisa el guard global dentro de `AUTENTICAR_PETICION_PORT`, en la misma consulta que la sesión (6.6b: no hace falta un `VERIFICAR_PERMISO_PORT` aparte).

**`Actor`** (en `shared/application/`, lo usan todos los casos de uso): `usuarioId`, `nombreUsuario`, `empresaId`, `ip`, `navegador`, `requestId`. Fuera de una petición (comandos, colas) lo arma quien llama, con `usuarioId = null` si es el sistema.

**Errores** (todos `DomainError`):

| Error | Tipo | Mensaje |
|---|---|---|
| `CredencialesInvalidasError` | `NO_AUTENTICADO` | AUTH-D15 |
| `SinEmpresaError` | `NO_AUTORIZADO` | AUTH-D16 |
| `SesionInvalidaError` | `NO_AUTENTICADO` | "Su sesión terminó. Vuelva a ingresar." |
| `DebeCambiarContrasenaError` | `NO_AUTORIZADO` | AUTH-D14 |
| `SinPermisoError` | `NO_AUTORIZADO` | "No tiene permiso para esta acción" |
| `ContrasenaDebilError` | `VALIDACION` | Uno por motivo ("La contraseña es demasiado común", "… no puede contener su nombre de usuario"…) |
| `ContrasenaActualIncorrectaError` | `VALIDACION` | "La contraseña actual no es correcta" |
| `CuentaBloqueadaError` | `NO_AUTORIZADO` | "Demasiados intentos fallidos. Espere 15 minutos o pida ayuda al administrador." (cambiar la contraseña con la cuenta bloqueada; 6.5d) |
| `SinAccesoEmpresaError` | `NO_AUTORIZADO` | "No tiene acceso a esa empresa" (cambiar a una empresa sin rol activo, desactivada o inexistente; 6.5d) |
| `NombreUsuarioDuplicadoError` | `CONFLICTO` | "Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro" (6.12b6: ya no hay forma de dar acceso a alguien que ya tiene usuario) |
| `NombreRolDuplicadoError` | `CONFLICTO` | "Ya existe un rol con ese nombre" |
| `EscaladaError` | `NO_AUTORIZADO` | "No puede dar permisos que usted no tiene" / "No puede cambiar sus propios roles" / "Solo un administrador puede dar o quitar el rol Administrador" |
| `UsuarioDeOtraEmpresaError` | `NO_AUTORIZADO` | "Este usuario también trabaja en otra empresa: solo puede hacer este cambio quien lo administre en todas" |
| `UltimoAdministradorError` | `REGLA_NEGOCIO` | "La empresa no puede quedarse sin administrador" |
| `RolAdministradorFijoError` | `REGLA_NEGOCIO` | "El rol Administrador no se puede cambiar" |
| `RolNoEncontradoError` | `NO_ENCONTRADO` | "El rol no existe" (también uno de otra empresa; 6.7b) |
| `PermisoDesconocidoError` | `VALIDACION` | "El permiso «x» no existe" (no está entre los vigentes; 6.7b) |
| `RolDesconocidoError` | `VALIDACION` | "Alguno de los roles elegidos no existe" (uno de otra empresa tampoco; 6.7d) |
| `RolDesactivadoError` | `REGLA_NEGOCIO` | "No se puede dar un rol desactivado" (6.7d) |
| `SinRolesError` | `VALIDACION` | "Debe elegir al menos un rol" (crear) / "Para quitarle todos los roles use Quitar acceso" (fijar roles; 6.7d) |
| `UsuarioYaTieneAccesoError` | `CONFLICTO` | "Ese usuario ya tiene acceso a esta empresa. Para cambiar sus roles, use su ficha" (decisión del usuario, 6.7d) |
| `UsuarioInactivoError` | `REGLA_NEGOCIO` | "El usuario «x» está desactivado" (hacerlo administrador de una empresa nueva con `admin:crear-empresa`) |
| `UsuarioNoEncontradoError` | `NO_ENCONTRADO` | "El usuario no existe" (también uno sin ningún rol en la empresa activa; 6.7c). Los comandos: "No existe el usuario «x»" |

## 5. Flujos clave

**Login** (`POST /auth/login`, público, límite estricto):
1. Normaliza el nombre de usuario y la contraseña. Busca el usuario.
2. **Siempre verifica un hash**: si el usuario no existe, contra un hash de relleno, para que tarde lo mismo.
3. Si falla, o está bloqueado, o desactivado: suma el fallo (y bloquea al quinto), **confirma eso y el evento antes** de responder 401 (AUTH-D15).
4. Elige la empresa (AUTH-D4); sin ninguna: registra `auth.sesion.fallido` (`SIN_EMPRESA`, sin sumar al bloqueo) y 403 (AUTH-D16).
5. Crea la sesión, actualiza `ultimo_ingreso_en`, `ultima_empresa_id` y pone los fallos en 0; registra `auth.sesion.iniciar`. Todo en una transacción.
6. Responde el access token en el cuerpo y el refresh en la cookie (`httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`).

**Guard global** (cada petición): verifica el JWT → lee la sesión (viva, no vencida, sin cerrar) → usuario activo → empresa activa y con al menos un rol del usuario → si debe cambiar la contraseña, solo deja las rutas de AUTH-D14 → revisa el permiso de la ruta (el administrador pasa) → deja el `Actor` listo. Una consulta con los datos juntos, no varias.

**Refresh** (`POST /auth/refresh`, público): revisa `Origin` contra `CORS_ORIGINS` → separa `sid`, secreto y firma; si la firma no es del servidor, 401 sin buscar la sesión (SEG-05) → si el secreto es el vigente, rota; si es el anterior y no pasaron 60 s, rota igual; si no, cierra **todas** las sesiones del usuario con `REUSO` y registra `auth.sesion.reuso` → revisa los vencimientos → responde un token nuevo y la cookie nueva.

**Cambiar de empresa** (`POST /auth/empresa`): revisa que tenga rol en la empresa pedida y que esté activa → cambia `empresa_id` de la sesión (con la fila bloqueada) y `ultima_empresa_id` del usuario → registra `auth.sesion.cambiar_empresa` **en la empresa nueva**, con la anterior en `antes` (decisión del usuario, 6.5d) → responde la sesión nueva (permisos de esa empresa). A la misma empresa: no cambia nada ni registra.

**Cambiar la contraseña** (`POST /auth/cambiar-contrasena`, 6.5d): si la cuenta está bloqueada, 403 sin revisar nada → verifica la actual; si no es, suma el fallo (al quinto bloquea 15 minutos, como el login: decisión del usuario), registra `auth.usuario.cambiar_contrasena_fallido` (y `auth.usuario.bloquear`), confirma eso y responde 400 → valida la nueva (`Contrasena`, con sus empresas) y que **no sea igual a la actual** (decisión del usuario) → en una transacción: hash nuevo, quita la temporal y los fallos, cierra las **otras** sesiones (`CAMBIO_CONTRASENA`) y registra `auth.usuario.cambiar_contrasena` (con cuántas cerró).

**Desactivar una empresa** (`admin:desactivar-empresa`, 6.5d): `DESACTIVAR_EMPRESA_CON_SESIONES_PORT` desactiva con el puerto de `empresas` y cierra sus sesiones abiertas (`EMPRESA_DESACTIVADA`) en la misma transacción; si cerró alguna, registra `auth.sesion.cerrar` sobre la empresa.

## 6. Endpoints y permisos

Todos bajo `/api/v1`. Las listas son paginadas (`PaginacionQueryDto`, `Pagina<T>`, hechos en el 6.7a).

**Sesión** (`/auth`):

| Método | Ruta | Qué hace | Acceso |
|---|---|---|---|
| `POST` | `/auth/login` | Entrar | `@Publico()` |
| `POST` | `/auth/refresh` | Renovar el access token | `@Publico()` (con cookie y `Origin`) |
| `POST` | `/auth/logout` | Salir (cierra esta sesión) | `@SoloSesion()` (con `Origin`) |
| `GET` | `/auth/sesion` | Usuario, empresa activa, sus empresas, si es administrador (`esAdministrador`), sus permisos vigentes en la activa (`permisos`, desde el 6.6a: los de sus roles activos; el Administrador, todos), la zona horaria del negocio (`zonaNegocio`, para que el frontend muestre las fechas; decisión del usuario en el 6.2) y cuándo vence la sesión (`sesionVenceEn`) | `@SoloSesion()` |
| `POST` | `/auth/empresa` | Cambiar la empresa activa | `@SoloSesion()` |
| `POST` | `/auth/cambiar-contrasena` | Cambiar la propia contraseña (pide la actual; cierra las otras sesiones) | `@SoloSesion()` |

**Usuarios** (`/usuarios`, siempre de la empresa activa):

| Método | Ruta | Qué hace | Permiso |
|---|---|---|---|
| `GET` | `/usuarios` | Lista paginada de los que tienen algún rol en la empresa activa (6.7c): filtros `texto` (en el nombre completo o el nombre de usuario, sin mayúsculas ni tildes), `activo` (la persona) y `rolId`; por nombre completo; cada fila con sus roles en esta empresa, `bloqueadoHasta` (`null` si no está bloqueado ahora), `ultimoIngresoEn` y `debeCambiarContrasena` (6.12b4) | `auth.usuario.ver` |
| `GET` | `/usuarios/roles-asignables` | Los roles **activos** de la empresa activa, para elegir los de un usuario (6.12b0): el Administrador primero, luego por nombre; cada uno con `sePuedeDar` según quien consulta (`ReglasDeEscalada.puedeDarRol()`, lo mismo que revisa la API al dar). Sin paginar. Pide «Ver usuarios» y no «Ver roles»: quien asigna roles ya ve los de cada usuario, y así no hace falta un segundo permiso | `auth.usuario.ver` |
| `GET` | `/usuarios/:id` | Ficha: datos, roles en esta empresa, bloqueo, último ingreso, `debeCambiarContrasena` y sus sesiones abiertas **solo en esta empresa**, con `trabajaEnOtrasEmpresas` (sí/no, sin decir cuáles; decisión del usuario, 6.7c). Uno sin roles en la empresa activa: 404 | `auth.usuario.ver` |
| `POST` | `/usuarios` | Crear usuario nuevo con sus roles (**al menos uno**: decisión del usuario, 6.7c); responde la ficha y la contraseña temporal **una vez** (`{ usuario, contrasenaTemporal }`, 201) | `auth.usuario.crear` |
| `PATCH` | `/usuarios/:id` | Cambiar el nombre completo (AUTH-D12) | `auth.usuario.editar` |
| `PUT` | `/usuarios/:id/roles` | Fijar sus roles en esta empresa (AUTH-D11). La lista vacía es 400 «Para quitarle todos los roles use Quitar acceso» (decisión del usuario, 6.7c: quitar el acceso también cierra sus sesiones) | `auth.usuario.asignar_roles` |
| `POST` | `/usuarios/:id/quitar-acceso` | Quitarle todos sus roles en esta empresa (cierra sus sesiones en ella con `ACCESO_QUITADO`; las de otras empresas siguen). Responde `{ id, sesionesCerradas }` | `auth.usuario.asignar_roles` |
| `POST` | `/usuarios/:id/contrasena-temporal` | Generar una contraseña temporal (AUTH-D12, AUTH-D13): quita el bloqueo y cierra todas sus sesiones (`ADMINISTRADOR`). Responde `{ usuario, contrasenaTemporal }` con `no-store`. No a uno mismo (403, usa «Cambiar contraseña») ni a un desactivado (422) (6.7e) | `auth.usuario.restablecer` |
| `POST` | `/usuarios/:id/desbloquear` | Quitar el bloqueo por intentos (y los fallos); basta el permiso en la empresa activa (decisión del usuario, 6.7e). Responde la ficha | `auth.usuario.restablecer` |
| `POST` | `/usuarios/:id/cerrar-sesiones` | Cerrar todas sus sesiones, en todas sus empresas (equipo perdido o robado; `ADMINISTRADOR`); basta el permiso en la empresa activa. Sobre uno mismo, la actual sigue (6.7e). Responde `{ id, sesionesCerradas }` | `auth.usuario.restablecer` |
| `POST` | `/usuarios/:id/desactivar` | Desactivar a la persona en todas sus empresas (AUTH-D12; cierra sus sesiones con `USUARIO_DESACTIVADO`; sus roles quedan). No a uno mismo; en cada empresa donde es administrador tiene que quedar otro (AUTH-D11 (4)). Responde la ficha | `auth.usuario.desactivar` |
| `POST` | `/usuarios/:id/reactivar` | Reactivar: vuelve a entrar con los roles que tenía (AUTH-D12). Responde la ficha | `auth.usuario.desactivar` |

**Roles y permisos**:

| Método | Ruta | Qué hace | Permiso |
|---|---|---|---|
| `GET` | `/roles` | Lista paginada de la empresa activa (decisión del usuario, 6.7b): filtros `texto` (en el nombre, sin mayúsculas ni tildes) y `activo`; el Administrador primero y luego por nombre; cada fila con `cantidadPermisos` y `cantidadUsuarios` (activos) | `auth.rol.ver` |
| `GET` | `/roles/:id` | Ficha con sus permisos y cuántos usuarios lo tienen | `auth.rol.ver` |
| `POST` | `/roles` | Crear, con sus `permisos` opcionales en la misma petición (decisión del usuario, 6.7b; mismas reglas que `PUT /roles/:id/permisos`) | `auth.rol.crear` |
| `PATCH` | `/roles/:id` | Nombre y descripción | `auth.rol.editar` |
| `PUT` | `/roles/:id/permisos` | Fijar sus permisos (AUTH-D11) | `auth.rol.editar` |
| `POST` | `/roles/:id/desactivar`, `/reactivar` | Desactivar o reactivar. Reactivar devuelve sus permisos a quienes lo tienen: quien no es administrador tiene que tenerlos todos (decisión del usuario, 6.7b) | `auth.rol.desactivar` |
| `GET` | `/permisos` | Catálogo vigente, agrupado por módulo, para armar roles: `[{ modulo, nombre, permisos: [{ codigo, descripcion }] }]`, en el orden de `src/catalogo-permisos.ts` y de cada `<modulo>.permisos.ts`. El `nombre` del grupo («Usuarios y roles») lo declara cada módulo (decisión del usuario, 6.7a). Sale del código, no de la base (son los mismos tras la sincronización) y sin paginar | `auth.rol.ver` |

`auth.permisos.ts`:

```ts
export const PERMISOS_AUTH = {
  'auth.usuario.ver': 'Ver usuarios',
  'auth.usuario.crear': 'Crear usuarios',
  'auth.usuario.editar': 'Editar el nombre de los usuarios',
  'auth.usuario.asignar_roles': 'Asignar y quitar roles',
  'auth.usuario.restablecer': 'Dar contraseña temporal, desbloquear y cerrar sesiones',
  'auth.usuario.desactivar': 'Desactivar y reactivar usuarios',
  'auth.rol.ver': 'Ver roles',
  'auth.rol.crear': 'Crear roles',
  'auth.rol.editar': 'Editar roles y sus permisos',
  'auth.rol.desactivar': 'Desactivar y reactivar roles',
} as const;
```

**Eventos de la bitácora** de este módulo (acción `modulo.recurso.accion`, sin contraseñas, hashes ni tokens): `auth.sesion.iniciar`, `auth.sesion.fallido`, `auth.sesion.cerrar`, `auth.sesion.reuso`, `auth.sesion.cambiar_empresa`, `auth.usuario.bloquear` (automático), `auth.usuario.crear`, `auth.usuario.dar_acceso` (desde el 6.12b6, solo `admin:crear-empresa` con un usuario que ya existe; quedan los eventos de antes), `auth.usuario.editar`, `auth.usuario.asignar_roles`, `auth.usuario.quitar_acceso`, `auth.usuario.contrasena_temporal`, `auth.usuario.cambiar_contrasena`, `auth.usuario.cambiar_contrasena_fallido` (6.5d), `auth.usuario.desbloquear`, `auth.usuario.cerrar_sesiones`, `auth.usuario.desactivar`, `auth.usuario.reactivar`, `auth.rol.crear`, `auth.rol.editar`, `auth.rol.permisos`, `auth.rol.desactivar`, `auth.rol.reactivar`. Un intento con un usuario que no existe se registra sin empresa ni usuario, solo con la IP y el navegador: **no se guarda lo que escribió**, porque a veces es la contraseña puesta en el campo equivocado. El de un usuario que existe, en su última empresa.

**Variables nuevas** (`EnvironmentVariables`, `.env.example` y CI): `JWT_SECRETO` (al menos 64 caracteres), `SESION_DURACION_MAXIMA_HORAS` (13), `SESION_INACTIVIDAD_MINUTOS` (120). Solo para los comandos: `ADMIN_INICIAL_USUARIO`, `ADMIN_INICIAL_NOMBRE`, `ADMIN_INICIAL_CONTRASENA`, `EMPRESA_INICIAL_NOMBRE`.

## 7. Pantallas

| Pantalla | Qué tiene |
|---|---|
| **Login** (fuera del layout) | Usuario, contraseña (con botón para verla), "Entrar". El mensaje de error arriba del botón |
| **Cambiar contraseña** | Actual, nueva y repetir; la lista de reglas a la vista. Obligatoria con contraseña temporal; voluntaria desde el menú del usuario |
| **Menú del usuario** (cabecera) | Nombre, empresa activa, "Cambiar de empresa" (si tiene más de una), "Cambiar contraseña", "Salir" |
| **Usuarios** | Lista con filtros (texto, activo, rol) y tarjetas en el celular. Ficha con pestañas: datos, roles en esta empresa, sesiones abiertas. Acciones según el permiso; las que quitan algo se confirman. La contraseña temporal se muestra en un diálogo con "Copiar", una sola vez |
| **Roles** | Lista; ficha con los permisos agrupados por módulo (casillas, con su descripción). El Administrador se ve, pero no se edita. Quien no es administrador ve bloqueado lo que él no tiene, con «Usted no tiene este permiso» (lo que el rol ya tenía se puede quitar; decisión del usuario, 6.12a3) |

**Pie de las fichas** (decisión del usuario, 6.12a0): «Creado» y «Modificado» salen de la **bitácora de la empresa activa**, no de `creado_por`/`actualizado_por`: la fila del usuario es una para todas las empresas y la escribe cada ingreso. En el usuario, «creado» es la última vez que lo crearon o le dieron acceso **en esta empresa** y «modificado», el último cambio hecho por una persona después (editar, roles, contraseña temporal, desbloquear, cerrar sesiones, desactivar, reactivar, cambiar su contraseña); no cuentan los ingresos, los intentos fallidos ni el bloqueo automático. En el rol: crearlo, y editar, permisos, desactivar o reactivar. Listas en `roles-comun.ts` y `usuarios-comun.ts`.

Al cambiar de empresa o salir: se borran los datos guardados por el service worker y se **recarga la página**, para que nada de una empresa quede a la vista en la otra.

## 8. Fuera de alcance

- Segundo factor (AUTH-D18), recuperación por correo (AUTH-D19), ingreso con cuentas de Google o Microsoft.
- Permisos sueltos por usuario (regla 13: solo por roles).
- Vencimiento de la contraseña temporal (se puede agregar si la revisión de seguridad lo pide).
- Permisos por registro ("solo sus propios clientes"): si un módulo de negocio lo necesita, lo resuelve en su diseño.
- **Permisos por centro de costo** (decisión del usuario, 2026-11-06): no los prepara la base. Los resuelve el módulo de contabilidad en su diseño (por ejemplo, su propia tabla «usuario ↔ centros de costo»), como los permisos por registro. Los del 6.6 siguen siendo por rol y por empresa.
- **Sucursal** (establecimiento y punto de emisión del SRI; decisión del usuario, 2026-11-06): no va en la sesión. Será un catálogo del módulo de negocio y cada documento guarda la suya; login, sesión y permisos no cambian.

## 9. Preguntas

| # | Pregunta | Para |
|---|---|---|
| AUTH-P1 | ¿Los valores de la sesión (13 h, 120 min) sirven para el horario real? | Usuario / cada negocio |
| AUTH-P2 | ¿Algún regulador pide segundo factor para ciertos usuarios? Si sí, el segundo factor pasa al paso 6 | Usuario (regulador) |
| AUTH-P3 | ¿La contraseña temporal debe vencer (por ejemplo, a las 72 horas)? | Usuario |

## 10. Pasos

| Sub-paso | Qué |
|---|---|
| 6.4a | `organizacion.empresas` (✅, ver `empresas.md`) |
| 6.4b | Tablas `usuarios`, `roles` y `usuarios_roles` (adelantadas del 6.6, completas como en la sección 3: decisión del usuario del 2026-11-05, para que los comandos dejen cada empresa con su administrador); `NombreUsuario`, `NombreCompleto`, `NombreRol`, `Contrasena` (lista de SecLists), hasher Argon2id; repositorios (✅) |
| 6.4c | Comandos `admin:crear-inicial`, `admin:crear-empresa`, `admin:desactivar-empresa` (se compilan y se corren desde `dist/`) (✅) |
| 6.5a | `sesiones` y su repositorio (con bloqueo de fila); `Sesion`; `GENERADOR_TOKENS_PORT` (JWT y secretos); hash de relleno; variables de la sesión (✅) |
| 6.5b | Login y refresh con la cookie y la revisión del `Origin` (✅) |
| 6.5c | Guard global con `@Publico()` / `@SoloSesion()` (la API no arranca si falta o sobra); `@UsuarioActual()`; AUTH-D14; logout y `GET /auth/sesion` (con `esAdministrador` y `permisos`, vacía hasta el 6.6) (✅) |
| 6.5d | Cambiar empresa y cambiar contraseña; `admin:desactivar-empresa` cierra las sesiones (✅) |
| 6.5e | Límite de peticiones en Redis (AUTH-D17) (✅) |
| 6.6a | `permisos`, `roles_permisos`; `<modulo>.permisos.ts` y `src/catalogo-permisos.ts`; sincronización al arrancar; `permisos` reales en `GET /auth/sesion` (✅) |
| 6.6b | `@RequierePermiso()`; el guard revisa el permiso de la ruta; revisión al arrancar (AUTH-D9: permiso fuera del catálogo o `@Publico()` con permiso); `ReglasDeEscalada` (AUTH-D11, AUTH-D12) (✅) |
| 6.7a | Paginación; `GET /permisos`; `GET` y `PATCH /empresa` (✅) |
| 6.7b | Roles: lista, ficha, crear, editar, fijar permisos (AUTH-D11), desactivar y reactivar (✅) |
| 6.7c | Usuarios: lista, ficha y editar el nombre (AUTH-D12) (✅) |
| 6.7d | Usuarios: crear (con contraseña temporal), dar acceso, fijar roles y quitar acceso (AUTH-D11) (✅) |
| 6.7e | Usuarios: contraseña temporal, desbloquear, cerrar sesiones, desactivar y reactivar (AUTH-D12, escalada sobre la persona) (✅) |
| 6.12b0 | `GET /usuarios/roles-asignables` con `sePuedeDar` (AUTH-D11 en la pantalla) (✅) |
| 6.12b4 | `debeCambiarContrasena` en cada fila de `GET /usuarios`; texto del 409 de `POST /usuarios` con el nombre de la opción en pantalla (✅) |
| 6.10a | Frontend: sesión (store, interceptor con un refresh compartido y entre pestañas, guards), login partido, «Salir» (✅) |
| 6.10b1 | Frontend: cambiar la contraseña (la temporal fuera del layout, la voluntaria desde el menú del usuario) (✅) |
| 6.10b2 | Frontend: selector de empresa (menú del usuario y recuadro del menú lateral), menú lateral que se encoge a una franja (✅) |
| 6.11 | Frontend: `permisoGuard`, menú y botones por permiso (✅) |
| 6.12a0 | Backend: `creado` y `modificado` (cuándo y quién) en la ficha de rol y de usuario, de la bitácora de la empresa activa (✅) |
| 6.12a1 | Frontend: piezas comunes de listas y fichas, ficha de la empresa (✅) |
| 6.12a2 | Frontend: roles, lista y ficha con «Datos», desactivar y reactivar (✅) |
| 6.12a3 | Frontend: roles, pestaña «Permisos» y alta «Nuevo rol» (✅) |
| 6.12b1 | Frontend: usuarios, lista y ficha (datos, roles, sesiones a la vista, quitar acceso) (✅) |
| 6.12b2 | Frontend: alta de usuarios (nuevo con su contraseña temporal, o uno que ya existe) (✅) |
| 6.12b3 | Frontend: acciones sobre usuarios (contraseña temporal, desbloquear, cerrar sesiones, desactivar y reactivar) |
| 6.12c | Frontend: bitácora |

## 11. Revisión del diseño (paso 6.1)

Revisión conjunta de los tres diseños del paso 6 (`auth`, `empresas`, `auditoria`). Es la revisión **del plan**: la del código se hace en el 6.13, con las pruebas en verde (`docs/roles-auditoria.md`).

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 1 | Full Stack Senior | Aprobado con observaciones | **FS-01**: el contrato de `GET /auth/sesion` se fija en el 6.5 y el frontend (6.10) no empieza antes. **FS-02**: al cambiar de empresa se recarga la página y se borran las cachés del service worker; probarlo con la PWA instalada (6.10) |
| 2 | Arquitecto de Software | Aprobado con observaciones | **ARQ-01**: `Actor` va en `shared/application/` porque lo usan todos los módulos; el guard llama a `VERIFICAR_PERMISO_PORT`, no a los repositorios. **ARQ-02**: `empresas` no depende de `auth`; el comando que crea empresa y administrador vive en `auth` y usa `CONSULTAR_EMPRESAS_PORT` y un puerto de entrada de `empresas` para crearla (sin dependencia circular) |
| 3 | DBA Senior | Aprobado con observaciones | **DBA-01**: FK compuesta `usuarios_roles (empresa_id, rol_id)`; revisar el SQL de cada migración (índices parciales y `CHECK` a mano). **DBA-02**: el guard hace una sola consulta por petición; medirla con `EXPLAIN ANALYZE` con 10.000 usuarios y 50.000 sesiones antes de producción |
| 4 | Arquitecto de Seguridad | Aprobado con observaciones | **SEG-01**: `POST /usuarios/existente` revela que un nombre de usuario existe a quien tiene `auth.usuario.crear`; riesgo aceptado (solo un administrador) y no muestra su nombre completo ni sus otras empresas (la ruta se quitó en el 6.12b6; el 409 de `POST /usuarios` sigue diciendo que el nombre existe, como en todo sistema con nombres únicos). **SEG-02**: AUTH-D17 deja pasar si Redis cae; el bloqueo por usuario en PostgreSQL sigue. **SEG-03**: AUTH-D16 dice "sin empresa" solo con la contraseña correcta. **SEG-04**: Row Level Security queda por decidir antes de producción (EMP-D6) |
| 5 | Auditor / Contador | Aprobado | Todo cambio de usuarios, roles, permisos y empresas tiene su evento; los intentos fallidos también. Conservación: ver `docs/modulos/auditoria.md` (AUD-P1) |
| 6 | DevOps / SRE | Aprobado con observaciones | **OPS-01**: variables nuevas en `.env.example` y en el CI (6.4, 6.5). **OPS-02**: limpieza de sesiones vencidas antes de producción. **OPS-03**: los comandos `admin:*` se pueden correr dos veces sin romper nada |
| 7 | QA Senior | Aprobado con observaciones | **QA-01**: e2e obligatorios del login (inexistente, contraseña mal, bloqueado, mismo tiempo, refresh vencido, reusado, dentro de los 60 s). **QA-02**: e2e de aislamiento entre dos empresas y de cada regla de AUTH-D11 y AUTH-D12. **QA-03**: matriz de `null` en cada endpoint que escribe |
| 8 | Especialista del dominio | Aprobado | La base no trae nada del rubro, a propósito. Lo propio de cada negocio (por ejemplo, separar quién registra de quién aprueba) se arma con roles y con sus propios módulos. Ver AUTH-P2 |
| 9 | Product Owner | Aprobado con observaciones | **PO-01**: el usuario de una sola empresa no ve nunca el selector (AUTH-D4). **PO-02**: la contraseña temporal se copia con un botón; no se envía por correo (no hay) |
| 10 | Arquitecto Fiscal SRI | N/A | No toca comprobantes ni firma |
| 11 | Arquitecto de Datos | Aprobado con observaciones | **DAT-01**: varias empresas desde la primera tabla, con la convención de `empresa_id` en `docs/modelo-datos.md`. **DAT-02**: registro de tablas al día en cada PR que cree una |
| 12 | Arquitecto de Integraciones | Aprobado | Redis detrás de un puerto, con tiempo máximo, y qué pasa si cae (AUTH-D17). No hay servicios externos |
| 13 | Diseñador UX/UI | Aprobado con observaciones | **UX-01**: el login y el cambio de contraseña se revisan en PC y celular, con lector de pantalla y la lista de reglas a la vista (6.10). **UX-02**: la ficha de rol con muchos permisos: agrupados por módulo, con "marcar todo el grupo" |
| 14 | Cumplimiento regulatorio | Aprobado con observaciones | **CUM-01**: los usuarios son datos personales (LOPDP): nombre, IP y navegador. La bitácora inmutable se justifica por obligación legal de conservación; confirmar el plazo (AUD-P1). **CUM-02**: AUTH-P2 (segundo factor para operadores) |

## 12. Revisión del código (paso 6.13e)

Revisión conjunta de los tres módulos del paso 6 (`auth`, `empresas`, `auditoria`) y de `shared/`, en el backend y en el frontend, **sobre el código terminado** (2026-11-07, `main` en `8e5167d`) y con todo en verde: `lint`, los dos `tsc`, backend 831 pruebas (cobertura 94,4 %), frontend 717 (96,8 %), e2e 345, umbrales de cobertura y `build` (446 kB de paquete inicial). Los hallazgos de la revisión del diseño (sección 11) que siguen abiertos se anotan aquí con su estado.

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 1 | Full Stack Senior | Aprobado con observaciones | `{ success, data, message }` en todas las rutas y regla de `null` en los dos lados (QA-03 en los e2e; pruebas de cada formulario). FS-01 cumplido. **FS-02** (cambiar de empresa con la PWA instalada) **aplazado**: antes de producción, con las pruebas de navegador (lista de la sección 17 de `docs/arquitectura-backend.md`). **FS-03**: los tipos del frontend son una copia a mano de los DTO del backend (Swagger manda); aceptado mientras sean pocos, revisarlo si crecen |
| 2 | Arquitecto de Software | Aprobado con observaciones | Capas cumplidas en los dos proyectos (el lint lo hace cumplir y está en verde). ARQ-01 y ARQ-02 cumplidos. **ARQ-03**: el guard lee `organizacion.empresas` directamente (solo `activo`, en un adaptador, anotado en `accesos-sesion.prisma.repository.ts`): **excepción aceptada**, porque pasar por `CONSULTAR_EMPRESAS_PORT` sumaría una consulta a cada petición; si `empresas` cambia cómo se desactiva una empresa, hay que tocar también esa consulta (los e2e de empresa desactivada lo detectan) |
| 3 | DBA Senior | Aprobado con observaciones | Sin `timestamp` sin zona ni números con decimales flotantes (consultado en la base). DBA-01 cumplido. **DBA-02 cerrado** en el 6.6b (consulta del guard: 0,15 ms con 50.000 sesiones y 5.000 usuarios, todo por índices). **DBA-03**: la FK compuesta `usuarios_roles (empresa_id, rol_id)` no tiene un índice que empiece por esas dos columnas; la cubre `usuarios_roles_rol_id_idx` (el id del rol ya es único) y los roles nunca se borran: no hace falta otro |
| 4 | Arquitecto de Seguridad | **Rechazado** (resuelto en el 6.13f: ver abajo) | **SEG-05**: el `sid` de una sesión aparece en `GET /usuarios/:id` (con solo `auth.usuario.ver`) y en la bitácora (`entidadId` de los eventos de sesión). Con él, cualquiera arma una cookie `<sid>.<secreto inventado>`, la manda a `POST /auth/refresh` con un `Origin` permitido, y el reuso (AUTH-D7) cierra **todas** las sesiones de esa persona en todas sus empresas, una y otra vez, también las del administrador. No da acceso, pero es una escalada (hace «Cerrar sesiones» sin el permiso, y en otras empresas). **Decisión del usuario (2026-11-07): firmar la cookie** (un HMAC del servidor sobre `sid` y secreto): una cookie inventada solo recibe 401 y no cierra nada; una cookie vieja de verdad sigue contando como reuso. Lo demás, aprobado: Argon2id, access token en memoria, cookie `httpOnly`, `secure`, `SameSite=Strict` y solo en `/api/v1/auth`, `Origin` revisado, `helmet`, límites de peticiones, ni hashes ni tokens en los logs ni en la bitácora, permiso en cada ruta revisado al arrancar, reglas contra la escalada. SEG-01 a SEG-03, como en la sección 11. **SEG-04** (Row Level Security, EMP-P2) sigue para antes de producción: se sumó a la lista |
| 5 | Auditor / Contador | Aprobado con observaciones | Todo cambio con su evento en la misma transacción; la bitácora tiene sus dos triggers (`eventos_sin_cambios` y `eventos_sin_vaciar`, consultados en la base) y su catálogo (6.13c). **AUD-01**: con la contraseña correcta pero sin empresa (AUTH-D16) no queda nada en la bitácora. **Decisión del usuario: registrarlo** como `auth.sesion.fallido` con el motivo «sin empresa», en la última empresa que usó, **sin sumar al bloqueo** (la contraseña era correcta); en el 6.13f. AUD-P1 (plazo de conservación) sigue abierta, para el usuario antes de producción |
| 6 | DevOps / SRE | Aprobado con observaciones | Cada variable está en `EnvironmentVariables`, en `.env.example` y en el `env:` del CI (comparado). Health check, logs con request ID y CI en verde. OPS-01 y OPS-03 cumplidos (`comandos-admin.e2e-spec.ts`). **OPS-02** (limpiar las sesiones vencidas) sigue en la lista de producción; **OPS-04**: esa limpieza fija también cuánto se guardan las sesiones cerradas (ver CUM-03) |
| 7 | QA Senior | Aprobado | Cobertura sobre los umbrales en los dos proyectos; QA-01 a QA-03 cumplidos (login, aislamiento entre empresas y matriz de `null` en los e2e). Pruebas manuales de los tres módulos al día y corridas: 131 de 131 con la excepción UX-03 |
| 8 | Especialista del dominio | Aprobado con observaciones | Nada del rubro en tablas, campos, reglas ni catálogos (buscado en el código y las migraciones); la zona va en el `.env`. Lo único del rubro son textos de la marca: el lado de la marca del login (8.6 de `docs/arquitectura-frontend.md`) y la descripción de Swagger (`swagger.ts`). **DOM-01**: juntar los textos de la marca en un solo lugar por proyecto, para que `nuevo-proyecto.sh` los cambie; **cerrado en el 6.14a** (`marca.ts` en cada app) |
| 9 | Product Owner | Aprobado | PO-01 y PO-02 cumplidos. «Nuevo usuario» solo para personas nuevas (6.12b5) y el pie «Creado / Modificado» de cada ficha sale de la bitácora |
| 10 | Arquitecto Fiscal SRI | N/A | No toca comprobantes ni firma |
| 11 | Arquitecto de Datos | Aprobado | Registro de tablas al día (las 8 de la base están en `docs/modelo-datos.md`); varias empresas en cada tabla que lo necesita (DAT-01, DAT-02 cumplidos); migraciones solo con `prisma migrate` |
| 12 | Arquitecto de Integraciones | Aprobado | Redis detrás de su conexión, con tiempo máximo; si cae, el límite deja pasar y lo registra (e2e de `limite-peticiones`). Sin servicios externos |
| 13 | Diseñador UX/UI | Aprobado con observaciones | Pruebas manuales en PC, celular y con teclado; accesibilidad medida con axe (WCAG 2.1 AA). UX-01 y UX-02 cumplidos. **UX-03**: `autocomplete="sin-autollenado"` es un valor que axe marca como inválido (AA1, EA1). **Decisión del usuario: excepción aceptada**: WCAG 1.3.5 pide el propósito de los campos con datos de quien usa la pantalla, y estas fichas son de otras personas, de un rol o de la empresa (anotado en la sección 3 de `docs/arquitectura-frontend.md` y en AA1 y EA1) |
| 14 | Cumplimiento regulatorio | Aprobado con observaciones | En la base, solo lo común (`docs/roles-auditoria.md`). CUM-01 y CUM-02 siguen abiertas (AUD-P1 y AUTH-P2, preguntas para el usuario). **CUM-03**: las sesiones guardan IP y navegador (datos personales, LOPDP) sin plazo: la limpieza de OPS-02 fija cuánto se guardan las cerradas (la bitácora conserva el ingreso por su propia obligación) |

**Resultado del 6.13e**: no se cierra el paso 6 hasta que el 6.13f resuelva SEG-05 y AUD-01 y el Arquitecto de Seguridad vuelva a revisar.

**Segunda revisión (6.13f, 2026-11-07), sobre el código terminado y con las pruebas en verde:**

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 4 | Arquitecto de Seguridad | **Aprobado** | **SEG-05 cerrado**. El refresh token lleva un HMAC-SHA256 de `<sid>.<secreto>` (AUTH-D6) con una clave de 256 bits derivada de `JWT_SECRETO` por HKDF (`derivarClaveRefresco()`: firmar un tipo de token no sirve para el otro y no suma variables al `.env`). La firma se compara en tiempo constante (`timingSafeEqual`) y se revisa **antes** de abrir la transacción y buscar la sesión: un token inventado no toca la base, no cuenta como reuso y solo recibe el 401 de siempre. Lo prueban los unitarios del adaptador (otra clave, otro secreto, la firma de otro `sid`, sin firma) y del caso de uso, y un e2e con el `sid` real: cinco cookies inventadas, ninguna sesión cerrada, ningún `auth.sesion.reuso`, y las de verdad siguen sirviendo. Un token viejo **de verdad** sigue cerrando todas las sesiones (AUTH-D7, e2e de reuso sin cambios). **SEG-06** (aceptado): si `JWT_SECRETO` se filtra, se pueden firmar los dos tokens, igual que antes con el access token; cambiarlo cierra a todos a la vez (anotado en `derivarClaveRefresco()`). Las cookies de antes (sin firma) dejan de servir: cada uno vuelve a ingresar una vez al desplegar (no hay producción). AUD-01 no cambia la respuesta (el mismo 403 de SEG-03) y el evento no da nada nuevo a quien prueba; lo limita el límite del login (10 por minuto por IP) |
| 5 | Auditor / Contador | **Aprobado** | **AUD-01 cerrado**: `auth.sesion.fallido` con `SIN_EMPRESA`, en la última empresa del usuario, en su propia transacción antes del 403, sin tocar `intentos_fallidos` ni el bloqueo (unitario y e2e). El valor está en el catálogo de la bitácora (`MotivoLoginFallido`). **AUD-02 cerrado en el 6.13g**: la pantalla lo muestra como «Sin acceso a ninguna empresa» |

**Resultado**: aprobados los 14 roles (con sus observaciones). Con el 6.13g (el texto del motivo nuevo en la pantalla) se cierra el paso 6.

## 13. Revisión de la plantilla (paso 6.18)

Revisión de los 14 roles de **lo que se sumó después del 6.13e** (6.14 marca en un solo lugar y `nuevo-proyecto.sh`, 6.15 `admin:renombrar-empresa` y la empresa sin ficha, 6.16 la instalación por cliente, 6.17 librerías al día), **sobre esta plantilla en `base-v4`** (2026-11-11), que es de donde arranca un proyecto nuevo. El código de `apps/` es el del proyecto de origen en `base-v4` con los nombres cambiados (comparado archivo por archivo: solo cambian nombres y comentarios), así que lo revisado en la sección 12 sigue valiendo.

Con todo en verde en la plantilla: `lint`, los dos `tsc`, backend 859 pruebas (94,5 %), frontend 685 (96,8 %), umbrales de cobertura, e2e 348 y `build`. Además, **un proyecto nuevo de punta a punta**: `nuevo-proyecto.sh` completo en un clon limpio con «Clínica Ñandú» (tilde y eñe → `clinica-nandu`), sin ningún nombre de la plantilla que quede; su propio Docker en otros puertos, `prisma migrate deploy`, e2e 348, `admin:crear-inicial` (rechazó una contraseña con una palabra del nombre de la empresa, como debe), la API arriba con `/health` 200 y login correcto, Swagger con el nombre nuevo, y el frontend con `<title>`, `lang="es"` y el manifiesto de la PWA con el nombre nuevo. Todo borrado después.

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 1 | Full Stack Senior | Aprobado | Sin cambios de contrato desde la sección 12 salvo `admin:renombrar-empresa` (comando, no ruta). El proyecto nuevo responde `{ success, data, message }` en `/health` y el login |
| 2 | Arquitecto de Software | Aprobado | Capas cumplidas (lint en verde en la plantilla y en el proyecto nuevo). El comando de renombrar usa solo el puerto de entrada `RENOMBRAR_EMPRESA_PORT` |
| 3 | DBA Senior | Aprobado | Mismas migraciones que en la sección 12. En el servidor, cada cliente en su base con `_dueno` (migraciones) y `_app` (sin cambiar tablas ni la bitácora), `pg_stat_statements` activado (6.16a) |
| 4 | Arquitecto de Seguridad | Aprobado con observaciones | Sin secretos, `.env`, `.p12`, `.pem`, datos personales ni URLs reales en la plantilla (buscado en todos sus archivos). `nuevo-proyecto.sh` crea los `.env` con contraseña y `JWT_SECRETO` nuevos y permisos `600`; los scripts del servidor, con `umask 077`. `pnpm audit --prod`: sin vulnerabilidades. **SEG-06** (aceptado): dos moderadas (`glob`, `minimatch`) dentro de `@angular/cli`, solo en la PC del programador, nunca en el servidor; se van con la próxima versión de Angular |
| 5 | Auditor / Contador | Aprobado | El renombre queda en la bitácora (`empresas.empresa.editar`, con el nombre de antes y el de después) dentro de su transacción (6.15a). La bitácora, igual que en la sección 12 |
| 6 | DevOps / SRE | Aprobado con observaciones | CI de la plantilla en verde; Dependabot apagado allí y lo activa el script. Scripts del servidor en modo estricto (`set -Eeuo pipefail` en `comun.sh`). **OPS-05** (menor, aceptado): `shellcheck` avisa en `comun.sh` (sin `#!`, porque se carga con `source`) y en un `cd` de `construir-imagenes.sh` (ya lo corta el modo estricto); falta lo del servidor real (`docs/despliegue.md`, sección 12) |
| 7 | QA Senior | Aprobado | Cobertura sobre los umbrales; el proyecto nuevo pasa todas las pruebas sin tocar nada |
| 8 | Especialista del dominio | **Rechazado** (resuelto en este mismo paso: ver abajo) | **DOM-02**: las pruebas del frontend usaban como empresa de ejemplo un nombre de un rubro en particular (seis archivos de prueba y el comentario de `iniciales.ts`): texto del rubro dentro de la base. Lo demás, genérico: el `CLAUDE.md` de la plantilla deja el negocio «por definir» y los roles 8 y 14 sin rubro. La zona `America/Guayaquil` y `formatoSri()` son de Ecuador, no del rubro (decididos antes) |
| 9 | Product Owner | Aprobado | Un proyecto nuevo sale con un clic en GitHub y un comando; el `README.md` de la plantilla dice qué necesita y qué hacer después |
| 10 | Arquitecto Fiscal SRI | N/A | No toca comprobantes ni firma |
| 11 | Arquitecto de Datos | Aprobado | Sin tablas nuevas desde la sección 12; una base por cliente en el servidor (forma A) |
| 12 | Arquitecto de Integraciones | Aprobado | Sin servicios externos nuevos en el código; la copia externa (restic) va en los scripts del servidor, con su prueba mensual de restauración |
| 13 | Diseñador UX/UI | Aprobado | Sin pantallas nuevas (el 6.15b quitó la ficha de la empresa); la marca provisional se cambia con `nuevo-proyecto.sh` y la sección 8.6 de `docs/arquitectura-frontend.md` |
| 14 | Cumplimiento regulatorio | Aprobado con observaciones | Igual que en la sección 12: CUM-01 y CUM-02 (plazo de la bitácora y segundo factor) siguen como preguntas para antes de producción; CUM-03 con la limpieza de sesiones |

**DOM-02 resuelto en el 6.18** (rama `fix/base-sin-rubro-en-pruebas`, etiqueta `base-v5`): ahora «Comercial Ejemplo» (mismas iniciales «CE»). Frontend en verde (685 pruebas). **El Especialista del dominio aprueba.**

**Resultado**: aprobados los 14 roles (con sus observaciones). La plantilla sirve para empezar cualquier proyecto; lo que falta es lo de antes de producción (`docs/arquitectura-backend.md`, sección 17) y el servidor real.

**Segunda pasada (6.19, 2026-11-11, a pedido del usuario: «vuelve a revisar»)**, sobre `base-v5` (etiqueta `base-v6` con el arreglo): referencias a archivos en los documentos (ninguna rota), más palabras de rubros en particular y el texto de los logos, las variables del `.env` en los cuatro lugares (validación, `.env.example`, CI y el ejemplo del servidor: cuadran), y la zona horaria de un proyecto en otro país, **probada en un PostgreSQL 18 aparte**.

| # | Rol | Veredicto | Observaciones |
|---|---|---|---|
| 6 | DevOps / SRE | **Rechazado** (resuelto en el 6.19: ver abajo) | **OPS-06**: en un servidor con otra zona (`ZONA_NEGOCIO`), la base de un cliente nuevo quedaba en `America/Guayaquil` (la migración `configurar_zona_horaria` la fija y `alta-cliente.sh` no la corregía) y, al recuperarlo de un respaldo, pasaba a la del servidor (un `ALTER DATABASE … SET` no viaja en `pg_dump`). La API no se equivoca (trabaja en UTC y con `ZONA_NEGOCIO`), pero psql, DBeaver o Power BI mostraban otra hora: contradice la regla 11 con cualquier zona que no sea la de por defecto. Además, `docs/despliegue.md` decía que la zona la pone cada cliente; es una por servidor |
| 8 | Especialista del dominio | Aprobado con observaciones | **DOM-03**: el dibujo de fondo del lado de la marca del login se describía con un término de un rubro en particular y no estaba en la lista de lo que se cambia con la marca (8.6 de `docs/arquitectura-frontend.md`). El dibujo es genérico (dos líneas que suben); se corrigen la descripción y la lista |

**OPS-06 resuelto en el 6.19** (`fix/despliegue-zona-base`): `fijar_zona_base()` en `comun.sh` (la zona del `api.env` del cliente, revisada con `validar_zona()` porque va dentro de SQL) después de cada migración (`migrar_cliente()`: alta y `actualizar.sh`) y de cada recuperación (`recuperar-cliente.sh`); `iniciar-servidor.sh --zona` (revisa que exista en `/usr/share/zoneinfo`); `probar-restauracion.sh` falla si la base en uso no muestra la zona de su API. Probado en la PC con un servidor en `America/Mexico_City`: zonas inválidas rechazadas (también una con SQL dentro) sin crear nada; alta → la base en México; respaldo y prueba mensual en verde; base desfasada a mano → la prueba mensual lo detecta y `actualizar.sh` lo corrige; baja, recuperación desde la copia guardada → la base en México y la API respondiendo por HTTPS. `shellcheck` sin avisos. **El DevOps / SRE aprueba.** **DOM-03 resuelto** en el mismo PR.

**Resultado de la segunda pasada**: aprobados los 14 roles (con sus observaciones).

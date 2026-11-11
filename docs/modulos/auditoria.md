# Módulo `auditoria`: la bitácora (diseño)

Paso 6.1 · Estado: **diseño aprobado**; registro hecho en el 6.3 y consulta en el 6.8 (pantallas en el 6.12); nombre del registro e historia sin tope de días en el 6.12c0b; la lista en la pantalla en el 6.12c1 (frontend `modules/auditoria/`).

Cumple la regla 14: **todo cambio y todo evento de seguridad queda registrado, en la misma transacción, en una tabla que no se puede modificar.** Lo ya decidido está en `docs/arquitectura-backend.md` (sección 14) y en `docs/modelo-datos.md` (tabla inmutable); aquí se completa.

## 1. Punto de partida

No hay sistema anterior. Es la pieza que usan **todos** los módulos que escriben, así que se hace antes que el login (sub-paso 6.3): el login ya registra sus eventos. No sabe nada del rubro: guarda acciones con la forma `modulo.recurso.accion`, sean del negocio que sean.

## 2. Decisiones

| # | Tema | Decisión | Motivo |
|---|---|---|---|
| AUD-D1 | Inmutable | Triggers que impiden `UPDATE`, `DELETE` y `TRUNCATE`. Además, en producción el usuario de la aplicación solo tiene `INSERT` y `SELECT` sobre la tabla | Dos barreras: si una falla, queda la otra. Lo de los permisos de la base va en la lista de producción |
| AUD-D2 | Sin FK | `empresa_id` y `usuario_id` sin FK; se guarda también `nombre_usuario` tal como era en ese momento | La bitácora no puede impedir nada ni depender de otra tabla; dentro de 7 años tiene que decir quién fue aunque el usuario cambie |
| AUD-D3 | Qué se guarda de un cambio | `antes` y `despues` solo con los campos que cambiaron. Si nada cambió, no hay evento | Lo decidido en la arquitectura; una bitácora llena de ruido no se lee |
| AUD-D4 | Lo que nunca entra | Contraseñas, hashes, tokens y secretos. El puerto reemplaza su valor por `[OCULTO]` aunque un módulo los mande (por el nombre del campo, en cualquier nivel) y una prueba lo comprueba. Si lo único que cambió es la contraseña, el evento queda (se sabe que cambió, no a qué) | Defensa doble: la regla en cada módulo y el filtro en el puerto |
| AUD-D5 | Por empresa | Cada evento lleva la empresa activa de quien lo hizo. En pantalla, cada empresa ve solo los suyos. Los eventos sin empresa (intento con un usuario que no existe, comandos del servidor que no son de una empresa) **no se ven en la aplicación**: se consultan en la base | Varias empresas en la misma base: el administrador de A no ve lo de B |
| AUD-D6 | Misma transacción | `REGISTRAR_AUDITORIA_PORT` escribe con `TransaccionPrisma`: si el cambio se deshace, el evento también; si el evento falla, el cambio se deshace | Regla 14 |
| AUD-D7 | Eventos que deben quedar aunque falle la operación | El caso de uso los confirma **antes** de lanzar el error (el intento fallido de login) | `docs/arquitectura-backend.md`, sección 5 |
| AUD-D8 | Rango de la consulta | Hasta 92 días por búsqueda (las fechas son del negocio, con `FechaFiscal`). **Excepción** (usuario, 2026-11-07, 6.12c0b): la historia de un registro (`entidad` + `entidadId`) no pide fechas ni tiene tope; si se mandan, solo se revisa que no estén al revés | La tabla será la más grande del sistema; un rango sin límite la recorre entera. La historia de un registro va por `eventos_empresa_entidad_idx` y lee solo sus eventos |
| AUD-D9 | Textos de las acciones | La API devuelve el código (`auth.usuario.crear`); el frontend tiene la lista de textos en español ("Creó un usuario"), con una prueba que falla si falta uno. Desde el 6.13c, lo que registra cada módulo (acciones, campos y valores fijos) está en `src/catalogo-auditoria.ts` del backend, con pruebas que fallan si el código registra algo que no está: el frontend copia esa lista | Checklist del frontend (`docs/plantilla-modulo.md`) |
| AUD-D10 | Lo que trae la lista (usuario, 2026-11-06; nombre del registro, 2026-11-07) | Sin `antes` ni `despues`: están en el detalle. El registro va por tipo, id y **el nombre que tenía en ese momento** (`entidad_nombre`, lo manda el módulo al registrar, como `nombre_usuario`); nunca se busca su nombre actual en otras tablas. Los eventos de antes del 6.12c0b no lo tienen (`null`) | La lista pesa menos y dice «Usuario jorge.vera» sin abrir el detalle; la bitácora no depende de otros módulos (AUD-D2) |
| AUD-D11 | Filtro por acción (usuario, 2026-11-06) | Exacta (`auth.usuario.crear`) o por grupo (`auth.usuario`, `auth`): el grupo trae las que empiezan por `grupo.` | «Todo lo que pasó con usuarios» sin elegir acción por acción |

## 3. Tabla

### `auditoria.eventos` (bitácora, inmutable)

| Columna | Tipo | Uso concreto |
|---|---|---|
| `id` | `uuid` (v7) | Desempate del orden |
| `ocurrido_en` | `timestamptz` | Cuándo pasó (de `RELOJ_PORT`) |
| `empresa_id` | `uuid` null, sin FK | AUD-D5 |
| `usuario_id` | `uuid` null, sin FK | Quién (null = proceso del sistema o usuario que no existe) |
| `nombre_usuario` | `varchar(50)` null | Quién, tal como se llamaba (AUD-D2) |
| `accion` | `varchar(100)` | `modulo.recurso.accion`. `CHECK` del formato |
| `entidad` | `varchar(60)` null | Qué tipo de registro (`usuario`, `rol`…) |
| `entidad_id` | `uuid` null | Cuál. `CHECK ((entidad IS NULL) = (entidad_id IS NULL))` |
| `entidad_nombre` | `varchar(150)` null | Cómo se llamaba el registro en ese momento (AUD-D10, 6.12c0b): de un usuario, su nombre de usuario; de un rol o una empresa, su nombre (el nuevo si se renombró); de una sesión, su usuario. Solo con `entidad`; `null` en los eventos anteriores |
| `antes` | `jsonb` null | AUD-D3 |
| `despues` | `jsonb` null | AUD-D3 |
| `ip` | `varchar(45)` null | Desde dónde |
| `navegador` | `varchar(300)` null | Con qué |
| `request_id` | `varchar(64)` null | Para cruzarlo con los logs del servidor |

- Sin `creado_*`/`actualizado_*`: su hora es `ocurrido_en` y quién es `usuario_id` (excepción ya prevista en `docs/modelo-datos.md`).
- Índices, solo los que piden las búsquedas de la pantalla: `(empresa_id, ocurrido_en DESC, id DESC)` (el listado), `(empresa_id, entidad, entidad_id, ocurrido_en DESC)` ("historia de este registro") y `(empresa_id, usuario_id, ocurrido_en DESC)` ("qué hizo esta persona"). El filtro por acción va con el rango de fechas; se agrega un índice solo si `EXPLAIN ANALYZE` lo pide.
- Particionar por mes se evalúa cuando el volumen lo pida (`docs/modelo-datos.md`, sección 11).

## 4. Dominio y puertos

- **Puerto de entrada** `REGISTRAR_AUDITORIA_PORT`, global (lo usan todos los módulos):

  ```ts
  registrar(evento: {
    accion: string;               // 'auth.usuario.crear'
    entidad?: string;             // 'usuario'
    entidadId?: string;
    entidadNombre?: string | null; // 'jorge.vera': cómo se llama en ese momento (6.12c0b)
    antes?: Record<string, unknown>;
    despues?: Record<string, unknown>;
  }, actor: Actor): Promise<void>;
  ```

  Calcula qué cambió, quita lo sensible (AUD-D4), no escribe nada si no cambió nada y toma la hora de `RELOJ_PORT`.
- **Puerto de entrada** `CONSULTAR_AUDITORIA_PORT` (para la pantalla).
- **Puerto de entrada** `CONSULTAR_TRAZABILIDAD_PORT` (global, 6.12a0): el pie de las fichas de otros módulos («Creado el … por …», «Modificado el … por …»). `de({ empresaId, entidad, entidadId, accionesAlta, accionesCambio })` da la última alta y el último cambio **después** de ella (o `null`), con el nombre de usuario de quien lo hizo; solo mira la bitácora de esa empresa y las acciones que se le piden (así no cuentan los ingresos ni lo que hace el sistema solo). Dos lecturas por el índice `eventos_empresa_entidad_idx`; dentro de una transacción ve el evento recién registrado. `AuditoriaEnMemoria` también lo implementa con sus eventos.
- **Para las pruebas**: `AuditoriaEnMemoria` (unitarios, en `modules/auditoria/application/testing/`: `shared/` no puede depender de un módulo) y `vaciarAuditoria()` en `test/utilidades/` (e2e: salta los triggers solo en la base `_test`, con `session_replication_role = replica`).
- **Errores**: `RangoFechasInvalidoError` (400 "El rango no puede pasar de 92 días" / "La fecha desde no puede ser mayor que la fecha hasta" / "Las fechas desde y hasta son obligatorias, salvo en la historia de un registro"), `EventoNoEncontradoError` (404).

## 5. Endpoints y permisos

| Método | Ruta | Qué hace | Permiso |
|---|---|---|---|
| `GET` | `/auditoria/eventos` | Lista de la empresa activa, paginada, del más nuevo al más viejo (desempate por id), sin `antes`/`despues`. Cada fila trae `entidadNombre`. Filtros: `desde` y `hasta` (obligatorios, `aaaa-mm-dd`, días del negocio incluidos, hasta 92; en la historia de un registro, opcionales y sin tope: AUD-D8), `usuarioId`, `accion` (exacta o grupo, AUD-D11), `entidad` (sola: todos los de ese tipo) + `entidadId` (solo con `entidad`) | `auditoria.evento.ver` |
| `GET` | `/auditoria/usuarios` | Quienes hicieron algo en la empresa activa, en toda su historia (también quien ya no tiene acceso), por nombre de usuario: `[{ usuarioId, nombreUsuario }]`, las opciones del filtro «Usuario» (6.12c0). Sale de la propia bitácora (no pide «Ver usuarios» ni lee tablas de `auth`); salta por `eventos_empresa_usuario_idx` (una lectura por persona: 0,8 ms con 300.000 eventos) | `auditoria.evento.ver` |
| `GET` | `/auditoria/eventos/:id` | Un evento con su `antes` y `despues` | `auditoria.evento.ver` |

`auditoria.permisos.ts`:

```ts
export const PERMISOS_AUDITORIA = {
  'auditoria.evento.ver': 'Ver la bitácora de cambios',
} as const;
```

Consultar la bitácora **no** se registra en la bitácora (sería una por cada búsqueda); queda en el log del servidor.

## 6. Pantallas

- **Bitácora**: filtros (rango de fechas, por defecto los últimos 7 días; usuario, de `GET /auditoria/usuarios`; acción), lista con fecha y hora en la zona del negocio, quién, qué y sobre qué registro. Tarjetas en el celular.
- **Detalle**: antes y después lado a lado, solo los campos que cambiaron.
- **"Ver historia"** en las fichas de usuario y de rol: abre la bitácora filtrada por ese registro.

## 7. Fuera de alcance

- Exportar la bitácora (CSV o PDF): se agrega si un regulador o el auditor externo lo pide.
- Purgas: nunca dentro del plazo de conservación (AUD-P1).
- Alertas automáticas (por ejemplo, muchos intentos fallidos): después, con el monitoreo de producción.

## 8. Preguntas

| # | Pregunta | Para |
|---|---|---|
| AUD-P1 | ¿Cuánto tiempo se conserva la bitácora? El mínimo es 7 años (SRI); confirmar si el regulador del rubro pide más | Usuario / Cumplimiento |
| AUD-P2 | ¿El auditor externo necesita exportarla? | Usuario |

## 9. Pasos

| Sub-paso | Qué |
|---|---|
| 6.3 | Tabla con triggers, `Actor`, `REGISTRAR_AUDITORIA_PORT`, `AuditoriaEnMemoria`, `vaciarAuditoria()` |
| 6.8 | Consulta: `GET /auditoria/eventos` y `/:id` |
| 6.12a0 | `CONSULTAR_TRAZABILIDAD_PORT`: el pie de las fichas de rol y de usuario sale de la bitácora |
| 6.12c0 | `GET /auditoria/usuarios`: las opciones del filtro «Usuario» |
| 6.12c | Pantallas de bitácora y detalle (maqueta, 6.12c1 lista y 6.12c2 detalle e historia) |

## 10. Revisión del diseño

Ver la revisión conjunta en `docs/modulos/auth-usuarios.md` (sección 11).

## 11. Revisión del código (paso 6.13e)

Ver la revisión conjunta en `docs/modulos/auth-usuarios.md` (sección 12).

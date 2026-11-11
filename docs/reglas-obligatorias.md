# Reglas obligatorias

Todo módulo, backend y frontend, las cumple. **Si no, no se aprueba.** Si una regla no encaja con un caso real, se avisa y se discute; no se salta en silencio.

## 1. Arquitectura hexagonal

Cada módulo tiene `domain/` (puro, sin frameworks) → `application/` (puertos y casos de uso) → `infrastructure/` (adaptadores). Las capas de afuera dependen de las de adentro; el dominio no depende de nada. **El lint lo hace cumplir** (`overrides` de `.oxlintrc.json` con imports prohibidos por carpeta).

## 2. Prohibido `any`

Sin excepciones, tampoco con un comentario que apague el lint. `unknown` solo en los bordes: `JSON.parse`, `catch`, respuestas externas sin tipos y utilidades genéricas. Una librería sin tipos: un `.d.ts` dentro de su adaptador, o `unknown` + una función que compruebe el tipo (type guard).

## 3. Respuestas de la API

Siempre `{ success, data, message }`. Éxito con `ok(data, mensaje)`; errores como excepciones que un filtro global convierte. **Nunca armar `{ success… }` a mano.**

## 4. Nombres en español

Tablas, columnas, esquemas, entidades, variables, métodos, mensajes, documentos y commits (`facturas.fecha_emision`, `registrarIntentoFallido()`).

En inglés solo:
- Sufijos de arquitectura: `Port`, `UseCase`, `Repository`, `Adapter`, `Module`, `Controller`, `Dto`.
- Términos técnicos universales: `id`, `email`, `hash`, `ip`, `token`, `user_agent`.
- Lo que impone el framework: `execute()`, `onModuleInit()`, `@updatedAt`.

Sin tildes ni ñ en identificadores (`contrasena`, `codigo`). Archivos en kebab-case, clases en PascalCase, variables en camelCase, constantes en UPPER_SNAKE_CASE.

## 5. Adaptadores de entrada sin lógica de negocio

Un controller recibe, valida, llama al puerto y responde. Un componente muestra y dispara eventos; nunca llama a `HttpClient`.

## 6. Casos de uso sin infraestructura

No tocan Prisma ni `HttpClient`. Usan puertos inyectados con un token (`Symbol` en el backend, `InjectionToken` en el frontend), **nunca un texto suelto**.

## 7. Toda entrada validada

Con `class-validator`, cada decorador con su `message` en español (si no, el usuario ve el inglés de la librería).

## 8. Secretos en `.env`

Validados al arrancar: si falta uno, el backend no arranca. `.env.example` versionado sin valores reales. **Nunca** credenciales, RUC, cédulas ni URLs en el código.

## 9. Migraciones solo con `prisma migrate`

Se revisa su SQL antes de commitear. Nunca editar una migración ya aplicada; nunca `db push` en producción.

## 10. Dinero nunca en `number`

Value object `Dinero` en el dominio, `Decimal` en la base. Tarifas de impuestos y porcentajes en un **catálogo con vigencia**, nunca en el código. El frontend no recalcula totales: muestra los del backend.

## 11. Hora del negocio siempre, esté donde esté el servidor

**Toda fecha y hora del negocio, y todo lo que ve el usuario, va en la zona del negocio**: la que dice `ZONA_NEGOCIO` en el `.env` del backend (por defecto `America/Guayaquil`), aunque el servidor esté en otro país o en la nube con otra zona. Nada depende de la zona del servidor ni del navegador.

- **Una zona por instalación** (EMP-D7), común a todas las empresas. Se elige al instalar y **no se cambia con datos guardados**: las fechas ya calculadas no se recalculan. Se valida al arrancar: solo nombres exactos de zona (`America/Guayaquil`, `Europe/Madrid`, `UTC`), nunca `-05:00` ni `EST`.

- Los **instantes** se guardan como `timestamptz` (un momento exacto, sin zona). La conexión del backend va en UTC solo por un motivo técnico (`crearAdaptadorPg()`); no cambia la hora que ve nadie.
- Las **fechas del negocio** (de emisión, de negociación, de liquidación, de corte) se calculan en la zona del negocio con el value object `FechaFiscal`. Una operación de las 20:00 en Guayaquil es de ese día, aunque en UTC ya sea el día siguiente.
- **Al mostrar**, el frontend usa siempre la zona del negocio, que le manda el backend en `GET /auth/sesion` (paso 6.5), y el formato `es-EC`; nunca la del navegador ni una escrita en el frontend.
- La base tiene `America/Guayaquil` como zona por defecto, para que psql, DBeaver o Power BI también muestren la hora local. En una instalación con otra zona se cambia a mano (`docs/manual-docker.md`).
- "Ahora" se pide a `RELOJ_PORT`; **nunca `new Date()`** en casos de uso ni dominio. Prohibido `getDate()`, `toISOString().slice(0,10)` o `toLocaleDateString()` sin zona.
- Las pruebas de fechas corren con el proceso en **otra zona horaria** a propósito, para demostrar que no dependen del servidor (desde el paso 5.6).

## 12. Base de datos

Id UUID v7, `timestamptz`, campos `creado_en`, `actualizado_en`, `creado_por`, `actualizado_por`. Maestros con borrado lógico o desactivación. Documentos fiscales y movimientos **nunca se borran**: se anulan o se revierten. Detalle en `docs/modelo-datos.md`.

## 13. Seguridad

Access token en memoria, refresh token en cookie `httpOnly`; nada sensible en `localStorage`. Permiso por endpoint (`modulo.recurso.accion`), **sin súper administrador**.

## 14. Auditoría

Todo cambio y evento de seguridad queda registrado **dentro de la misma transacción**, en una tabla que no se puede modificar.

## 15. Pruebas

Casos de uso con **80 %** de cobertura mínima (**90 %** en lo fiscal); e2e con una base de datos propia de pruebas. `pnpm lint`, `pnpm test`, `pnpm test:e2e` y `tsc` en verde antes de commitear.

## 16. Solo español

Sin i18n, sin librerías de traducción, sin selector de idioma. `<html lang="es">`.

## 17. Trabajo por pasos

Un paso = una rama, un commit, un PR; guía del paso en `docs/guias/`; **nunca push directo a `main`**.

## 18. Backend primero, luego frontend

El frontend se hace con el contrato de la API ya hecho. Un cambio que toca los dos va en dos pasos. Nunca mezclar reglas de un framework en el otro proyecto.

## 19. Sin npm y sin `console.*`

Siempre pnpm. El lint marca `console.*`: en el backend se usa `Logger`.

## 20. No commitear

`.env`, `.p12`, `.pem`, `node_modules/`, `dist/`, ni archivos grandes (videos, PDF escaneados, respaldos, exportaciones del sistema anterior). Tampoco el kit de arranque (`docs/kit-arranque-*.md`).

---

## Checklist rápida al crear un módulo

hexagonal · sin `any` · respuestas estándar · nombres · adaptadores sin lógica · casos de uso con puertos · DTOs validados · secretos en `.env` · migración revisada · pruebas al 80 %.

La checklist completa (backend y frontend) está en `docs/plantilla-modulo.md`.

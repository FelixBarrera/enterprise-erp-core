# Pruebas manuales

Pruebas que una persona hace a mano en el navegador, paso a paso. Cada caso tiene una columna **Debe pasar**: si lo que ve no coincide, el caso falla. Anote el número del caso y lo que vio.

## Cuándo se hacen

- **La del módulo que cambió, antes de su PR** (la de todos los módulos que tienen pantallas).
- **Todas, antes de producción.**
- Las tres de la base (abajo), antes de la revisión de los roles del paso 6 (6.13e). Lo que falle se arregla en su propio PR.

## Lista y orden

Se hacen en este orden: cada una usa lo que dejó la anterior.

| # | Archivo | Qué prueba | Tiempo aproximado |
|---|---|---|---|
| 1 | [`auth-usuarios.md`](auth-usuarios.md) | Entrar, contraseña, cambiar de empresa, permisos, roles y usuarios | 75 min |
| 2 | [`empresas.md`](empresas.md) | La empresa sin pantalla: su nombre, «Cambiar de empresa» y renombrarla por comando | 10 min |
| 3 | [`auditoria.md`](auditoria.md) | La bitácora: lista, filtros, detalle e historia (usa lo que hicieron las dos anteriores) | 30 min |

## Última corrida

| Fecha | Quién y cómo | Resultado |
|---|---|---|
| 2026-11-07 | Claude, en Chrome sin ventana y con una base de datos aparte (`<bd>_manual`, creada para la prueba), con las tres pruebas en orden; accesibilidad con axe (el motor de Lighthouse) en lugar de Lighthouse | 129 de 131 casos pasan. Fallan AA1 y EA1: `autocomplete="sin-autollenado"` en los campos de las fichas, que axe marca como valor inválido (WCAG 1.3.5). En el 6.13e se aceptó como excepción (UX-03): con eso, 131 de 131 |

## Reglas para todas

- **Dos ventanas**: una normal con un administrador y otra **de incógnito** con el usuario de prueba. Así las dos sesiones no se mezclan.
- **Nombres de prueba con la fecha al final** (mes y día), para no chocar con los de otra vez: `prueba.1107`, «Rol de prueba 1107».
- **Las contraseñas nunca se escriben en estos documentos** ni en el informe de la prueba: ni la temporal ni la que elija.
- **Al terminar, lo creado se desactiva, no se borra** (regla 12): cada archivo tiene su sección «Al terminar».
- **Celular**: F12 → el ícono de celular (barra de dispositivos) → 390 × 844, y recargar.
- La hora que se ve es siempre la de la zona del negocio (`ZONA_NEGOCIO`, por defecto Guayaquil), aunque el equipo esté en otra.

## Antes de empezar (una vez)

1. Levantar todo: `docker compose up -d`, `pnpm dev:backend` y `pnpm dev:frontend`.
2. Abrir http://localhost:4200.
3. Tener un **administrador** que trabaje en **dos empresas** (para cambiar de empresa). Si no hay segunda empresa: en el servidor, `pnpm build` y `pnpm admin:crear-empresa`, y responder con el usuario del administrador que ya existe.

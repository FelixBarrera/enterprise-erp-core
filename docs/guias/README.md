# Guías de cada paso

Aquí se guarda el avance del proyecto. **Es la memoria del proyecto**: después de un `/clear`, Claude empieza leyendo este índice y la guía del último paso.

## Índice

| Paso | Qué | Estado | Guía |
|---|---|---|---|
| 1 a 6 | La base: esqueleto, reglas y documentación, base del sistema, empresas, login, roles y permisos, administración y bitácora | ✅ Vienen hechos con la plantilla (`base-v6`; revisada por los 14 roles: `docs/modulos/auth-usuarios.md`, secciones 12 y 13) | (las guías de esos pasos quedaron en el proyecto de origen) |
| 0 | Crear el proyecto desde la plantilla (`./nuevo-proyecto.sh`) | ⏳ | |
| 7 | Reglas de negocio de este proyecto | ⏳ | |

**Sobre las referencias a pasos viejos**: los `docs/` y los comentarios del código citan sub-pasos como «6.12c2» o «5.13»: son los de la construcción de la base. Lo que dicen sigue valiendo; solo no hay guía que leer.

**Lo primero en un proyecto nuevo**: completar la sección 1.2 del `CLAUDE.md` (qué es el negocio), la marca (`docs/arquitectura-frontend.md`, 8.6) y, si reemplaza a un sistema que ya existe, `docs/sistema-actual.md`.

## Hoja de ruta técnica (en este orden)

| Bloque | Qué incluye | Paso |
|---|---|---|
| A. Esqueleto | Monorepo; backend y frontend arrancan; Docker; Prisma conectado | 2 |
| B. Reglas y docs | `CLAUDE.md` raíz, backend y frontend; `docs/` técnicos | 4 |
| C. Backend base | Hexagonal y lint; `.env` validado; `configureApp()`; `ok()`; health; errores de dominio; `FechaFiscal`; `RELOJ_PORT`; logs con request ID; Swagger; transacciones; base de pruebas; CI | 5 |
| D. Frontend base | Hexagonal y lint; proxy; interceptor de errores; avisos; layout; tema y marca; PWA; presupuesto del paquete | 5 |
| E. Login | Empresas, usuarios, contraseñas, sesiones, bloqueo, primer administrador | 6 |
| F. Roles y permisos | Catálogo sincronizado, roles configurables, guard, menú filtrado | 6 |
| G. Administración y auditoría | Alta y edición de usuarios, bitácora inmutable y su pantalla | 6 |
| H. Negocio | Un módulo a la vez | 7 en adelante |

Los pasos 5 y 6 van en sub-pasos pequeños, un PR cada uno.

## Nombres de las guías

- Pasos de arranque (1 a 7): `paso-NN-descripcion.md`.
- Módulos: `<modulo>-backend.md`, `<modulo>-frontend.md` y `<modulo>-explicado.md` (ver `docs/plantilla-modulo.md`).

## Plantilla de guía (`paso-NN-descripcion.md`)

```markdown
# Paso N: <título>

Rama: `<tipo>/paso-N-...` · PR: #<número> · Fecha: AAAA-MM-DD

## Estado actual
(terminado / a medias: qué falta y por dónde seguir)

## Qué se hizo
## Decisiones y por qué
## Cómo probarlo
## Revisión por roles   (si aplica: tabla de hallazgos de docs/roles-auditoria.md)
## Patrones a corregir   (patrones de docs/ que no encajaron, avisados al usuario)
## Pendientes para después
```

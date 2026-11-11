# Modelos de Prisma

Un archivo por módulo: `<modulo>.prisma` (por ejemplo `auditoria.prisma`).

- `../schema.prisma` tiene solo `generator` y `datasource`.
- `prisma.config.ts` apunta a la carpeta `prisma/`, así Prisma junta todos los `.prisma`.
- Cada modelo y enum lleva `@@schema("<area>")`: nada de negocio en `public`.

Convenciones completas en `docs/modelo-datos.md`.

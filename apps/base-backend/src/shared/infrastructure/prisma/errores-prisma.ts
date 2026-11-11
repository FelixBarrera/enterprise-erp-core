import { Prisma } from '../../../generated/prisma/client.js';

/**
 * Dice si `error` es un índice único violado (`P2002`) y, si se pasa `indice`, si fue ese.
 * Lo usa el repositorio para traducirlo a su error de dominio:
 *
 * ```ts
 * catch (error) {
 *   if (indiceUnicoViolado(error, 'empresas_nombre_activas_key')) throw new NombreEmpresaDuplicadoError();
 *   throw error;
 * }
 * ```
 *
 * Con `@prisma/adapter-pg` el nombre llega en `meta.driverAdapterError.cause.constraint.index`
 * (índices escritos a mano, como los parciales). Si Prisma solo trae los campos, el nombre no
 * se sabe y solo coincide la llamada sin `indice`.
 */
export function indiceUnicoViolado(error: unknown, indice?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }
  return indice === undefined || nombreIndice(error.meta) === indice;
}

function nombreIndice(meta: Record<string, unknown> | undefined): string | null {
  const causa = objeto(objeto(meta?.['driverAdapterError'])?.['cause']);
  const restriccion = objeto(causa?.['constraint']);
  const indice = restriccion?.['index'];
  return typeof indice === 'string' ? indice : null;
}

function objeto(valor: unknown): Record<string, unknown> | undefined {
  return typeof valor === 'object' && valor !== null
    ? (valor as Record<string, unknown>)
    : undefined;
}

import { Injectable } from '@nestjs/common';
import type {
  OpcionesTransaccion,
  UnidadDeTrabajoPort,
} from '../../application/ports/unidad-de-trabajo.port.js';
import { TransaccionPrisma } from './transaccion-prisma.js';

/**
 * Abre una transacción de Prisma con nestjs-cls. Si ya hay una abierta, se une a ella
 * (propagación "Required", la de por defecto). Funciona también fuera de una petición
 * (una cola, un comando).
 */
@Injectable()
export class UnidadDeTrabajoCls implements UnidadDeTrabajoPort {
  constructor(private readonly txHost: TransaccionPrisma) {}

  ejecutar<T>(fn: () => Promise<T>, opciones: OpcionesTransaccion = {}): Promise<T> {
    if (opciones.tiempoMaximoMs === undefined) {
      return this.txHost.withTransaction(fn);
    }
    return this.txHost.withTransaction({ timeout: opciones.tiempoMaximoMs }, fn);
  }
}

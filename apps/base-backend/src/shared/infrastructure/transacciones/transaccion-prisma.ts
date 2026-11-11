import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '../prisma/prisma.service.js';

/** El adaptador de nestjs-cls para nuestro cliente de Prisma. */
export type AdaptadorTransaccionPrisma = TransactionalAdapterPrisma<PrismaService>;

/**
 * Lo que inyectan los repositorios para hablar con la base (**nunca `PrismaService`**):
 *
 * ```ts
 * constructor(private readonly txHost: TransaccionPrisma) {}
 * await this.txHost.tx.cliente.create({ … });
 * ```
 *
 * `this.txHost.tx` es la transacción en curso si el caso de uso abrió una con
 * `UNIDAD_DE_TRABAJO_PORT.ejecutar()`, o el cliente normal si no.
 *
 * Es el mismo `TransactionHost` de nestjs-cls con otro nombre: el valor sirve para que NestJS
 * lo inyecte por la clase y el tipo, para que `tx` tenga los modelos de Prisma.
 */
export const TransaccionPrisma = TransactionHost;
export type TransaccionPrisma = TransactionHost<AdaptadorTransaccionPrisma>;

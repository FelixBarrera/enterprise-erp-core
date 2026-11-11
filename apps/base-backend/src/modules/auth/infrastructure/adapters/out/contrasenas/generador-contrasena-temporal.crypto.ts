import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GeneradorContrasenaTemporalPort } from '../../../../application/ports/out/generador-contrasena-temporal.port.js';
import { armarContrasenaTemporal } from '../../../../domain/value-objects/contrasena-temporal.js';

/** Con `crypto.randomInt` (sin sesgo y seguro para criptografía), nunca con `Math.random`. */
@Injectable()
export class GeneradorContrasenaTemporalCrypto implements GeneradorContrasenaTemporalPort {
  generar(): string {
    return armarContrasenaTemporal((n) => randomInt(n));
  }
}

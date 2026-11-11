import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type Algorithm, hash, verify } from '@node-rs/argon2';
import type { HasherContrasenaPort } from '../../../../application/ports/out/hasher-contrasena.port.js';
import {
  type Contrasena,
  normalizarContrasena,
} from '../../../../domain/value-objects/contrasena.vo.js';

/** `Algorithm.Argon2id` (es un `const enum`: con `isolatedModules` no se puede leer de la librería). */
const ARGON2ID: Algorithm = 2;

/**
 * Parámetros de docs/arquitectura-backend.md (sección 14), los mínimos que recomienda OWASP para
 * Argon2id: 19 MiB, 2 pasadas, 1 hilo. Van dentro del hash (formato PHC): si un día se suben,
 * los hashes viejos se siguen verificando con los suyos.
 */
export const OPCIONES_ARGON2 = {
  algorithm: ARGON2ID,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Argon2id con `@node-rs/argon2` (corre fuera del hilo principal: no frena otras peticiones). */
@Injectable()
export class HasherArgon2 implements HasherContrasenaPort {
  /**
   * Hash de una contraseña al azar que nadie conoce, con los mismos parámetros: se calcula una
   * vez, la primera vez que se necesita, y se reutiliza.
   */
  private relleno: Promise<string> | null = null;

  calcularHash(contrasena: Contrasena): Promise<string> {
    return hash(contrasena.valor, OPCIONES_ARGON2);
  }

  async verificar(hashGuardado: string, escrita: string): Promise<boolean> {
    try {
      return await verify(hashGuardado, normalizarContrasena(escrita));
    } catch {
      // Un hash dañado o que no es Argon2: no coincide (nunca un 500 en el login).
      return false;
    }
  }

  async verificarRelleno(escrita: string): Promise<false> {
    this.relleno ??= hash(randomBytes(32).toString('base64url'), OPCIONES_ARGON2);
    await this.verificar(await this.relleno, escrita);
    return false;
  }
}

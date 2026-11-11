import { readFileSync } from 'node:fs';
import { Injectable } from '@nestjs/common';
import type { ContrasenasComunesPort } from '../../../../application/ports/out/contrasenas-comunes.port.js';

/** Al lado de este archivo; `nest build` lo copia a `dist/` (`assets` en `nest-cli.json`). */
export const ARCHIVO_CONTRASENAS_COMUNES = new URL('./contrasenas-comunes.txt', import.meta.url);

/**
 * La lista de contraseñas comunes (AUTH-D20; origen y licencia en
 * `LICENCIA-contrasenas-comunes.md`), una por línea y en minúsculas. Se lee una sola vez, al
 * crear el provider: si el archivo falta, la API no arranca (mejor que aceptar cualquier cosa).
 */
@Injectable()
export class ContrasenasComunesArchivo implements ContrasenasComunesPort {
  private readonly lista: ReadonlySet<string>;

  constructor() {
    this.lista = ContrasenasComunesArchivo.leer(ARCHIVO_CONTRASENAS_COMUNES);
  }

  static leer(archivo: URL): ReadonlySet<string> {
    return ContrasenasComunesArchivo.desdeTexto(readFileSync(archivo, 'utf8'));
  }

  /** Una por línea; sin líneas vacías ni el `\r` de los archivos de Windows. */
  static desdeTexto(texto: string): ReadonlySet<string> {
    const lineas = texto.split(/\r?\n/u);
    return new Set(lineas.map((linea) => linea.trim()).filter((linea) => linea !== ''));
  }

  get cantidad(): number {
    return this.lista.size;
  }

  esComun(contrasena: string): boolean {
    return this.lista.has(contrasena.toLowerCase());
  }
}

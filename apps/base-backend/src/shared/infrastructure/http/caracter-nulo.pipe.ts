import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { SolicitudInvalidaException } from './solicitud-invalida.exception.js';

const TIPOS_REVISADOS = new Set<ArgumentMetadata['type']>(['body', 'query', 'param']);

/**
 * Rechaza (400) cualquier texto con el carácter nulo (`\0`): PostgreSQL no lo acepta y
 * la petición terminaría en un 500. Va antes del `ValidationPipe` y revisa el cuerpo,
 * la query y los parámetros de la ruta, incluidos objetos y listas anidados.
 */
@Injectable()
export class CaracterNuloPipe implements PipeTransform<unknown, unknown> {
  transform(valor: unknown, metadata: ArgumentMetadata): unknown {
    if (TIPOS_REVISADOS.has(metadata.type)) {
      const campo = buscarCaracterNulo(valor, metadata.data ?? '');
      if (campo !== null) {
        const donde = campo === '' ? 'Un campo' : `El campo ${campo}`;
        throw new SolicitudInvalidaException(`${donde} tiene un carácter no permitido`);
      }
    }
    return valor;
  }
}

/** Devuelve la ruta del primer campo con `\0` (`''` si es el valor mismo) o `null` si no hay. */
function buscarCaracterNulo(valor: unknown, ruta: string): string | null {
  if (typeof valor === 'string') {
    return valor.includes('\0') ? ruta : null;
  }
  if (Array.isArray(valor)) {
    for (const [indice, elemento] of valor.entries()) {
      const encontrado = buscarCaracterNulo(elemento, `${ruta}[${indice}]`);
      if (encontrado !== null) return encontrado;
    }
    return null;
  }
  if (typeof valor === 'object' && valor !== null) {
    for (const [clave, elemento] of Object.entries(valor)) {
      if (clave.includes('\0')) return ruta === '' ? clave : `${ruta}.${clave}`;
      const encontrado = buscarCaracterNulo(elemento, ruta === '' ? clave : `${ruta}.${clave}`);
      if (encontrado !== null) return encontrado;
    }
  }
  return null;
}

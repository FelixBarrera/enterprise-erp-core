import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CATALOGO_AUDITORIA } from './catalogo-auditoria.js';
import { erroresDelCatalogoAuditoria } from './modules/auditoria/domain/catalogo-auditoria.js';
import { FORMATO_ACCION } from './modules/auditoria/domain/evento-auditoria.js';
import { MotivoLoginFallido } from './modules/auth/application/use-cases/iniciar-sesion.use-case.js';
import { MotivoCierreSesion } from './modules/auth/domain/entities/sesion.entity.js';

const MODULOS = join(import.meta.dirname, 'modules');

/** El código de los módulos, sin pruebas ni ayudas de prueba (`testing/`). */
function archivosDelCodigo(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) {
      return entrada.name === 'testing' ? [] : archivosDelCodigo(ruta);
    }
    return entrada.name.endsWith('.ts') && !entrada.name.endsWith('.spec.ts') ? [ruta] : [];
  });
}

/**
 * Las acciones escritas como `accion: '…'` (también `accion: 'a' | 'b'`), sin los comentarios:
 * lo que se le pasa a `auditoria.registrar()`. Solo los textos con forma de acción (un mensaje de
 * validación con la clave `accion` no cuenta); una mal escrita ya la rechaza `registrar()`.
 */
function accionesEscritas(): Map<string, string> {
  const encontradas = new Map<string, string>();
  for (const archivo of archivosDelCodigo(MODULOS)) {
    const codigo = readFileSync(archivo, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//gu, '')
      .replace(/^\s*\/\/.*$/gmu, '');
    for (const [, literales = ''] of codigo.matchAll(/\baccion\s*:\s*((?:'[^']*'\s*\|?\s*)+)/gu)) {
      for (const [, accion = ''] of literales.matchAll(/'([^']*)'/gu)) {
        if (FORMATO_ACCION.test(accion)) {
          encontradas.set(accion, relative(MODULOS, archivo));
        }
      }
    }
  }
  return encontradas;
}

const DEL_CATALOGO = CATALOGO_AUDITORIA.flatMap((d) => d.acciones);

describe('catálogo de la bitácora (src/catalogo-auditoria.ts)', () => {
  it('está bien escrito', () => {
    expect(erroresDelCatalogoAuditoria(CATALOGO_AUDITORIA)).toEqual([]);
  });

  it('tiene cada acción que registra el código', () => {
    const faltan = [...accionesEscritas()]
      .filter(([accion]) => !DEL_CATALOGO.includes(accion))
      .map(([accion, archivo]) => `${accion} (${archivo})`);
    expect(faltan, 'agregarlas en el <modulo>.auditoria.ts y su texto en el frontend').toEqual([]);
  });

  it('no tiene acciones que el código ya no registra', () => {
    const escritas = accionesEscritas();
    expect(DEL_CATALOGO.filter((accion) => !escritas.has(accion))).toEqual([]);
  });

  it('la búsqueda encuentra las acciones (no pasa en vacío)', () => {
    const escritas = accionesEscritas();
    expect(escritas.get('auth.rol.reactivar')).toBe(
      join('auth', 'application', 'use-cases', 'administrar-roles.use-case.ts'),
    );
    expect(escritas.has('empresas.empresa.crear')).toBe(true);
  });

  it('los motivos son los de sus tipos (no una copia)', () => {
    const auth = CATALOGO_AUDITORIA.find((d) => d.modulo === 'auth');
    expect(auth?.valores).toEqual({
      motivo: Object.values(MotivoLoginFallido),
      motivoCierre: Object.values(MotivoCierreSesion),
    });
  });
});

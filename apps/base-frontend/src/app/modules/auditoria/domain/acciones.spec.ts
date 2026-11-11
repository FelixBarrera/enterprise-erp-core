import { esDeSeguridad, esFiltroDeAccion, GRUPOS_ACCIONES, textoAccion } from './acciones';

/**
 * Copia de las `acciones` de `apps/base-backend/src/catalogo-auditoria.ts` (allí una prueba falla
 * si el código registra una que no está). Una acción nueva allá se copia aquí y en `acciones.ts`,
 * con su texto (AUD-D9).
 */
const REGISTRADAS_EN_EL_BACKEND = [
  'auth.usuario.crear',
  'auth.usuario.dar_acceso',
  'auth.usuario.editar',
  'auth.usuario.asignar_roles',
  'auth.usuario.contrasena_temporal',
  'auth.usuario.desbloquear',
  'auth.usuario.cerrar_sesiones',
  'auth.usuario.quitar_acceso',
  'auth.usuario.desactivar',
  'auth.usuario.reactivar',
  'auth.usuario.cambiar_contrasena',
  'auth.usuario.cambiar_contrasena_fallido',
  'auth.usuario.bloquear',
  'auth.rol.crear',
  'auth.rol.editar',
  'auth.rol.permisos',
  'auth.rol.desactivar',
  'auth.rol.reactivar',
  'auth.sesion.iniciar',
  'auth.sesion.fallido',
  'auth.sesion.cambiar_empresa',
  'auth.sesion.cerrar',
  'auth.sesion.reuso',
  'empresas.empresa.crear',
  'empresas.empresa.editar',
  'empresas.empresa.desactivar',
];

const TODAS = GRUPOS_ACCIONES.flatMap((g) => g.acciones);

describe('textos de las acciones de la bitácora (AUD-D9)', () => {
  it.each(REGISTRADAS_EN_EL_BACKEND)('%s tiene su texto en español', (codigo) => {
    expect(textoAccion(codigo)).not.toBe(codigo);
  });

  it('no hay textos de más ni repetidos', () => {
    expect(TODAS.map((a) => a.codigo).sort()).toEqual([...REGISTRADAS_EN_EL_BACKEND].sort());
    expect(new Set(TODAS.map((a) => a.texto)).size).toBe(TODAS.length);
  });

  it('cada acción está en el grupo que le corresponde', () => {
    for (const grupo of GRUPOS_ACCIONES) {
      for (const accion of grupo.acciones)
        expect(accion.codigo.startsWith(`${grupo.codigo}.`)).toBe(true);
    }
  });

  it('una acción que la pantalla no conoce sale con su código', () => {
    expect(textoAccion('ventas.factura.emitir')).toBe('ventas.factura.emitir');
    expect(textoAccion('auth.usuario.crear')).toBe('Creó un usuario');
  });

  it('lo de seguridad lleva la marca', () => {
    expect(REGISTRADAS_EN_EL_BACKEND.filter(esDeSeguridad).sort()).toEqual([
      'auth.sesion.fallido',
      'auth.sesion.reuso',
      'auth.usuario.bloquear',
      'auth.usuario.cambiar_contrasena_fallido',
    ]);
    expect(esDeSeguridad('otra.cosa.rara')).toBe(false);
  });

  it('el filtro acepta una acción o un grupo conocidos', () => {
    expect(esFiltroDeAccion('auth.usuario.crear')).toBe(true);
    expect(esFiltroDeAccion('auth.usuario')).toBe(true);
    expect(esFiltroDeAccion('auth')).toBe(false);
    expect(esFiltroDeAccion('auth.usuario.inventada')).toBe(false);
  });
});

import { AuditoriaEnMemoria } from '../../../auditoria/application/testing/auditoria-en-memoria.js';
import { actorDelSistema } from '../../../../shared/application/actor.js';
import type { Rol } from '../../domain/entities/rol.entity.js';
import { RolNoEncontradoError } from '../../domain/errors/auth.errors.js';
import { idDePrueba, PermisosEnMemoria, RolesEnMemoria } from '../testing/auth-en-memoria.js';
import { ConsultarRolesUseCase } from './consultar-roles.use-case.js';

const E1 = idDePrueba(1);
const E2 = idDePrueba(2);
const actor = actorDelSistema({ empresaId: E1 });
const PRIMERA = { pagina: 1, tamano: 20 };

describe('ConsultarRolesUseCase', () => {
  let roles: RolesEnMemoria;
  let permisos: PermisosEnMemoria;
  let casoDeUso: ConsultarRolesUseCase;
  let administrador: Rol;
  let caja: Rol;

  beforeEach(async () => {
    roles = new RolesEnMemoria();
    permisos = new PermisosEnMemoria(roles);
    permisos.agregar('auth.rol.ver');
    permisos.agregar('ventas.factura.crear');
    permisos.agregar('viejo.cosa.hacer', 'x', true);
    caja = await roles.darRol(idDePrueba(90), E1, { nombre: 'Caja' });
    permisos.darPermiso(caja.id, 'ventas.factura.crear');
    permisos.darPermiso(caja.id, 'viejo.cosa.hacer');
    await roles.darRol(idDePrueba(91), E1, { nombre: 'Ámbar', activo: false });
    administrador = await roles.darRol(idDePrueba(92), E1, {
      nombre: 'Administrador',
      esAdministrador: true,
    });
    await roles.darRol(idDePrueba(93), E2, { nombre: 'Caja de Zeta' });
    casoDeUso = new ConsultarRolesUseCase(roles, permisos, new AuditoriaEnMemoria());
  });

  it('listar: los de su empresa, el Administrador primero y luego por nombre sin tildes', async () => {
    const pagina = await casoDeUso.listar({}, PRIMERA, actor);
    expect(pagina.total).toBe(3);
    expect(pagina.elementos.map((r) => r.nombre)).toEqual(['Administrador', 'Ámbar', 'Caja']);
    expect(pagina.elementos[0]).toMatchObject({ esAdministrador: true, cantidadPermisos: 2 });
    // El obsoleto no cuenta.
    expect(pagina.elementos[2]).toEqual({
      id: caja.id,
      nombre: 'Caja',
      descripcion: null,
      esAdministrador: false,
      activo: true,
      cantidadPermisos: 1,
      cantidadUsuarios: 1,
    });
  });

  it('listar: filtros y páginas', async () => {
    const activos = await casoDeUso.listar({ activo: true }, PRIMERA, actor);
    expect(activos.elementos.map((r) => r.nombre)).toEqual(['Administrador', 'Caja']);
    const texto = await casoDeUso.listar({ texto: ' AMB ' }, PRIMERA, actor);
    expect(texto.elementos.map((r) => r.nombre)).toEqual(['Ámbar']);
    const segunda = await casoDeUso.listar({}, { pagina: 2, tamano: 2 }, actor);
    expect(segunda).toMatchObject({ total: 3, pagina: 2, tamano: 2 });
    expect(segunda.elementos.map((r) => r.nombre)).toEqual(['Caja']);
  });

  it('listar: sin el Administrador en la página no pide el catálogo', async () => {
    const vigentes = vi.spyOn(permisos, 'codigosVigentes');
    await casoDeUso.listar({ activo: false }, PRIMERA, actor);
    expect(vigentes).not.toHaveBeenCalled();
  });

  it('ver: la ficha con sus permisos vigentes; el Administrador, todos', async () => {
    expect(await casoDeUso.ver(caja.id, actor)).toMatchObject({
      nombre: 'Caja',
      permisos: ['ventas.factura.crear'],
      cantidadUsuarios: 1,
    });
    expect((await casoDeUso.ver(administrador.id, actor)).permisos).toEqual([
      'auth.rol.ver',
      'ventas.factura.crear',
    ]);
  });

  it('ver: uno de otra empresa, o sin empresa activa: 404', async () => {
    const deZeta = [...roles.roles.values()].find((r) => r.empresaId === E2);
    await expect(casoDeUso.ver(deZeta?.id ?? '', actor)).rejects.toThrow(RolNoEncontradoError);
    await expect(casoDeUso.ver(caja.id, actorDelSistema())).rejects.toThrow(RolNoEncontradoError);
  });
});

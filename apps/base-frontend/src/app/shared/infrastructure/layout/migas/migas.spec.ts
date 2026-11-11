import type { SeccionMenu } from '../menu';
import { armarMigas } from './migas';

const MENU: readonly SeccionMenu[] = [
  { id: 'general', titulo: 'General', opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio' }] },
  {
    id: 'administracion',
    titulo: 'Administración',
    opciones: [
      { texto: 'Roles', ruta: '/roles', icono: 'escudo' },
      { texto: 'Empresa', ruta: '/empresa', icono: 'empresa' },
    ],
  },
];

describe('armarMigas', () => {
  it('la lista: la sección sin enlace y la pantalla actual sin enlace', () => {
    expect(
      armarMigas(MENU, '/roles?activo=false', [{ texto: 'Roles', url: '/roles' }], null),
    ).toEqual([
      { texto: 'Administración', url: null },
      { texto: 'Roles', url: null },
    ]);
  });

  it('la ficha: la lista con enlace y el nombre del registro al final', () => {
    expect(
      armarMigas(MENU, '/roles/0193', [{ texto: 'Roles', url: '/roles' }], 'Jefe de oficina'),
    ).toEqual([
      { texto: 'Administración', url: null },
      { texto: 'Roles', url: '/roles' },
      { texto: 'Jefe de oficina', url: null },
    ]);
  });

  it('un alta con su propio nombre en la ruta', () => {
    const niveles = [
      { texto: 'Roles', url: '/roles' },
      { texto: 'Nuevo rol', url: '/roles/nuevo' },
    ];
    expect(armarMigas(MENU, '/roles/nuevo', niveles, null).map((m) => m.url)).toEqual([
      null,
      '/roles',
      null,
    ]);
  });

  it('sin niveles con nombre (el inicio), sin migas', () => {
    expect(armarMigas(MENU, '/', [], null)).toEqual([]);
  });

  it('no confunde una ruta que empieza igual ni toma el inicio como sección', () => {
    expect(armarMigas(MENU, '/rolesx', [{ texto: 'Otra', url: '/rolesx' }], null)).toEqual([
      { texto: 'Otra', url: null },
    ]);
  });

  it('un nombre vacío no suma una miga', () => {
    expect(armarMigas(MENU, '/roles/1', [{ texto: 'Roles', url: '/roles' }], '  ')).toHaveLength(2);
  });
});

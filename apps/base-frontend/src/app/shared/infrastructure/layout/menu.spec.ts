import { menuVisible, type SeccionMenu } from './menu';

const MENU: readonly SeccionMenu[] = [
  { id: 'general', titulo: 'General', opciones: [{ texto: 'Inicio', ruta: '/', icono: 'inicio' }] },
  {
    id: 'administracion',
    titulo: 'Administración',
    opciones: [
      { texto: 'Usuarios', ruta: '/usuarios', icono: 'menu', permiso: 'auth.usuario.ver' },
      { texto: 'Roles', ruta: '/roles', icono: 'menu', permiso: 'auth.rol.ver' },
    ],
  },
];

const con =
  (...codigos: string[]) =>
  (codigo: string) =>
    codigos.includes(codigo);

describe('menuVisible', () => {
  it('con todos los permisos, muestra todo', () => {
    expect(menuVisible(MENU, con('auth.usuario.ver', 'auth.rol.ver'))).toEqual(MENU);
  });

  it('oculta las opciones sin permiso y deja las demás en su orden', () => {
    const visible = menuVisible(MENU, con('auth.rol.ver'));
    expect(visible.map((s) => s.id)).toEqual(['general', 'administracion']);
    expect(visible[1]?.opciones.map((o) => o.texto)).toEqual(['Roles']);
  });

  it('oculta la sección que queda vacía; la opción sin permiso la ve todo el que tiene sesión', () => {
    const visible = menuVisible(MENU, con());
    expect(visible.map((s) => s.id)).toEqual(['general']);
    expect(visible[0]?.opciones.map((o) => o.texto)).toEqual(['Inicio']);
  });

  it('no cambia el menú que recibe', () => {
    menuVisible(MENU, con());
    expect(MENU[1]?.opciones).toHaveLength(2);
  });
});

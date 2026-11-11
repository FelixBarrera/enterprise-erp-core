import { DESTINO_POR_DEFECTO, destinoTrasIngreso, volverDesde } from './destino-tras-ingreso';

describe('destinoTrasIngreso', () => {
  it.each([
    ['/usuarios', '/usuarios'],
    ['/usuarios?pagina=2', '/usuarios?pagina=2'],
    ['  /roles  ', '/roles'],
  ])('una ruta de la aplicación (%s) se respeta', (volver, esperado) => {
    expect(destinoTrasIngreso(volver)).toBe(esperado);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['usuarios'],
    ['//otro-sitio.com'],
    ['/\\otro-sitio.com'],
    ['https://otro-sitio.com'],
    ['javascript:alert(1)'],
    ['/login'],
    ['/login?volver=/x'],
    ['/contrasena-temporal'],
    ['/contrasena-temporal?volver=/usuarios'],
    ['/cambiar-contrasena'],
    ['/cambiar-contrasena?volver=/roles'],
  ])('lo que no es una ruta de la aplicación (%s) va al inicio', (volver) => {
    expect(destinoTrasIngreso(volver)).toBe(DESTINO_POR_DEFECTO);
  });
});

describe('volverDesde', () => {
  it('una pantalla de la aplicación se lleva tal cual', () => {
    expect(volverDesde('/usuarios?pagina=2')).toBe('/usuarios?pagina=2');
  });

  it('el inicio y las pantallas de la sesión no se llevan', () => {
    expect(volverDesde('/')).toBeNull();
    expect(volverDesde('/login')).toBeNull();
    expect(volverDesde('/cambiar-contrasena?volver=/roles')).toBeNull();
  });
});

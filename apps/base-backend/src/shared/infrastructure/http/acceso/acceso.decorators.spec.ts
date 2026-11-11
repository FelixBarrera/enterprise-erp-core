import { Publico, reglasDeAcceso, RequierePermiso, SoloSesion } from './acceso.decorators.js';

class Rutas {
  @Publico()
  publica(this: void): void {}

  @SoloSesion()
  conSesion(this: void): void {}

  @SoloSesion({ conContrasenaTemporal: true })
  conTemporal(this: void): void {}

  @RequierePermiso('auth.usuario.ver')
  conPermiso(this: void): void {}

  @Publico()
  @SoloSesion()
  conDos(this: void): void {}

  sinNada(this: void): void {}
}

describe('@Publico(), @SoloSesion() y @RequierePermiso()', () => {
  it('cada uno deja su regla; sin ninguno, la lista vacía', () => {
    expect(reglasDeAcceso(Rutas.prototype.publica)).toEqual([{ tipo: 'publico' }]);
    expect(reglasDeAcceso(Rutas.prototype.conPermiso)).toEqual([
      { tipo: 'permiso', codigo: 'auth.usuario.ver' },
    ]);
    expect(reglasDeAcceso(Rutas.prototype.conSesion)).toEqual([
      { tipo: 'sesion', conContrasenaTemporal: false },
    ]);
    expect(reglasDeAcceso(Rutas.prototype.conTemporal)).toEqual([
      { tipo: 'sesion', conContrasenaTemporal: true },
    ]);
    expect(reglasDeAcceso(Rutas.prototype.sinNada)).toEqual([]);
  });

  it('dos en la misma ruta quedan los dos (así la revisión al arrancar ve que sobra uno)', () => {
    expect(reglasDeAcceso(Rutas.prototype.conDos)).toHaveLength(2);
  });
  // Lo que agrega en Swagger (candado, 401 y 403) se prueba en test/swagger.e2e-spec.ts.
});

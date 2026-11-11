import type {
  CrearEmpresaConAdministradorComando,
  CrearEmpresaConAdministradorPort,
  ResultadoCrearEmpresaConAdministrador,
  UsuarioResumen,
} from '../../../../application/ports/in/crear-empresa-con-administrador.port.js';
import {
  ContrasenaDebilError,
  NombreUsuarioInvalidoError,
} from '../../../../domain/errors/auth.errors.js';
import { ComandoCrearEmpresa } from './comando-crear-empresa.js';
import { SALIDA_CANCELADO, SALIDA_ERROR, SALIDA_OK } from './comun.js';
import { TerminalDePrueba } from './terminal-de-prueba.js';

const LUIS: UsuarioResumen = {
  id: 'u1',
  nombreUsuario: 'luis',
  nombreCompleto: 'Luis Mora',
  activo: true,
};
const BUENA = 'Margarita-Lunes-47';

class PuertoDePrueba implements CrearEmpresaConAdministradorPort {
  readonly comandos: CrearEmpresaConAdministradorComando[] = [];
  /** Errores para las primeras llamadas a `crear`, en orden. */
  readonly errores: Error[] = [];

  constructor(private readonly usuarios: UsuarioResumen[] = []) {}

  buscarUsuario(nombreUsuario: string): Promise<UsuarioResumen | null> {
    const nombre = nombreUsuario.trim().toLowerCase();
    if (nombre.includes(' ')) {
      return Promise.reject(new NombreUsuarioInvalidoError('El nombre de usuario no es válido'));
    }
    return Promise.resolve(this.usuarios.find((u) => u.nombreUsuario === nombre) ?? null);
  }

  crear(
    comando: CrearEmpresaConAdministradorComando,
  ): Promise<ResultadoCrearEmpresaConAdministrador> {
    this.comandos.push(comando);
    const error = this.errores.shift();
    if (error !== undefined) return Promise.reject(error);
    const existente = comando.administrador.tipo === 'existente';
    return Promise.resolve({
      empresa: { id: 'e1', nombre: comando.nombreEmpresa, activo: true },
      administrador: existente
        ? LUIS
        : { ...LUIS, id: 'u2', nombreUsuario: comando.administrador.nombreUsuario },
      usuarioNuevo: !existente,
    });
  }
}

describe('ComandoCrearEmpresa', () => {
  it('con un usuario nuevo: pide nombre y contraseña dos veces, ocultas, y crea', async () => {
    const puerto = new PuertoDePrueba();
    const terminal = new TerminalDePrueba([
      ' Acme ',
      ' Ana.Perez ',
      'Ana Pérez',
      BUENA,
      BUENA,
      's',
    ]);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_OK);
    expect(puerto.comandos).toEqual([
      {
        nombreEmpresa: 'Acme',
        administrador: {
          tipo: 'nuevo',
          nombreUsuario: 'ana.perez',
          nombreCompleto: 'Ana Pérez',
          contrasena: BUENA,
        },
      },
    ]);
    expect(terminal.ocultas).toHaveLength(2);
    expect(terminal.texto()).toContain('No existe: se creará un usuario nuevo.');
    expect(terminal.texto()).toContain('tendrá que cambiar la contraseña');
    expect(terminal.texto()).not.toContain(BUENA);
  });

  it('con un usuario existente: no pide contraseña', async () => {
    const puerto = new PuertoDePrueba([LUIS]);
    const terminal = new TerminalDePrueba(['Acme', 'LUIS', 'sí']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_OK);
    expect(puerto.comandos[0]?.administrador).toEqual({ tipo: 'existente', nombreUsuario: 'luis' });
    expect(terminal.ocultas).toHaveLength(0);
    expect(terminal.texto()).toContain('Ya existe: Luis Mora');
    expect(terminal.texto()).toContain('su contraseña de siempre');
  });

  it('un usuario existente desactivado: no sigue', async () => {
    const puerto = new PuertoDePrueba([{ ...LUIS, activo: false }]);
    const terminal = new TerminalDePrueba(['Acme', 'luis']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_ERROR);
    expect(terminal.texto()).toContain('está desactivado');
    expect(puerto.comandos).toHaveLength(0);
  });

  it('vuelve a preguntar lo vacío, el usuario mal escrito y las contraseñas distintas', async () => {
    const puerto = new PuertoDePrueba();
    const terminal = new TerminalDePrueba([
      '',
      'Acme',
      'ana perez',
      'ana',
      'Ana',
      BUENA,
      'otra',
      BUENA,
      BUENA,
      's',
    ]);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_OK);
    const texto = terminal.texto();
    expect(texto).toContain('Es obligatorio.');
    expect(texto).toContain('El nombre de usuario no es válido.');
    expect(texto).toContain('Las contraseñas no coinciden.');
  });

  it('a los tres intentos fallidos se rinde sin crear nada', async () => {
    const puerto = new PuertoDePrueba();
    const terminal = new TerminalDePrueba(['', ' ', '']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_ERROR);
    expect(terminal.texto()).toContain('Demasiados intentos');
  });

  it('una contraseña débil: la pide otra vez y vuelve a intentar', async () => {
    const puerto = new PuertoDePrueba();
    puerto.errores.push(new ContrasenaDebilError('La contraseña es demasiado común'));
    const terminal = new TerminalDePrueba([
      'Acme',
      'ana',
      'Ana',
      'Password123',
      'Password123',
      's',
      BUENA,
      BUENA,
    ]);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_OK);
    expect(puerto.comandos.map((c) => c.administrador)).toMatchObject([
      { contrasena: 'Password123' },
      { contrasena: BUENA },
    ]);
    expect(terminal.texto()).toContain('La contraseña es demasiado común.');
  });

  it('tres contraseñas débiles: se rinde', async () => {
    const puerto = new PuertoDePrueba();
    const debil = () => new ContrasenaDebilError('La contraseña es demasiado común');
    puerto.errores.push(debil(), debil(), debil());
    const respuestas = ['Acme', 'ana', 'Ana', 'x1', 'x1', 's', 'x2', 'x2', 'x3', 'x3'];
    const terminal = new TerminalDePrueba(respuestas);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_ERROR);
    expect(puerto.comandos).toHaveLength(3);
    expect(terminal.texto()).toContain('Demasiados intentos');
  });

  it('otro error del negocio (usuario duplicado) termina sin repetir', async () => {
    const puerto = new PuertoDePrueba([LUIS]);
    const { NombreUsuarioDuplicadoError } =
      await import('../../../../domain/errors/auth.errors.js');
    puerto.errores.push(new NombreUsuarioDuplicadoError());
    const terminal = new TerminalDePrueba(['Acme', 'luis', 's']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_ERROR);
    expect(puerto.comandos).toHaveLength(1);
    expect(terminal.texto()).toContain('No se pudo: Ese nombre de usuario ya existe');
  });

  it('si no confirma, no crea', async () => {
    const puerto = new PuertoDePrueba([LUIS]);
    const terminal = new TerminalDePrueba(['Acme', 'luis', 'n']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_ERROR);
    expect(puerto.comandos).toHaveLength(0);
    expect(terminal.texto()).toContain('No se hizo ningún cambio.');
  });

  it('Ctrl+C a mitad: cancelado (130), sin crear', async () => {
    const puerto = new PuertoDePrueba();
    const terminal = new TerminalDePrueba(['Acme']);
    expect(await new ComandoCrearEmpresa(puerto, terminal).ejecutar()).toBe(SALIDA_CANCELADO);
    expect(terminal.texto()).toContain('Cancelado: no se hizo ningún cambio.');
    expect(puerto.comandos).toHaveLength(0);
  });
});

import type { Actor } from '../../../../../../shared/application/actor.js';
import { ContrasenaDebilError } from '../../../../domain/errors/auth.errors.js';
import type {
  CrearInstalacionInicialComando,
  CrearInstalacionInicialPort,
  ResultadoInstalacionInicial,
} from '../../../../application/ports/in/crear-instalacion-inicial.port.js';
import { ComandoCrearInicial, type DatosInstalacionInicial } from './comando-crear-inicial.js';
import { SALIDA_ERROR, SALIDA_OK } from './comun.js';
import { TerminalDePrueba } from './terminal-de-prueba.js';

const DATOS: DatosInstalacionInicial = {
  EMPRESA_INICIAL_NOMBRE: 'Mi Empresa',
  ADMIN_INICIAL_USUARIO: 'admin',
  ADMIN_INICIAL_NOMBRE: 'Administrador',
  ADMIN_INICIAL_CONTRASENA: ' Margarita-Lunes-47 ',
};

const CREADA: ResultadoInstalacionInicial = {
  creada: true,
  empresa: { id: 'e1', nombre: 'Mi Empresa', activo: true },
  administrador: {
    id: 'u1',
    nombreUsuario: 'admin',
    nombreCompleto: 'Administrador',
    activo: true,
  },
  usuarioNuevo: true,
};

function armar(resultado: Promise<ResultadoInstalacionInicial>, datos = DATOS) {
  const llamadas: { comando: CrearInstalacionInicialComando; actor: Actor }[] = [];
  const puerto: CrearInstalacionInicialPort = {
    crear: (comando, actor) => {
      llamadas.push({ comando, actor });
      return resultado;
    },
  };
  const terminal = new TerminalDePrueba();
  return { comando: new ComandoCrearInicial(puerto, datos, terminal), terminal, llamadas };
}

describe('ComandoCrearInicial', () => {
  it('crea con los datos del .env (la contraseña sin recortar) y avisa que la borre', async () => {
    const { comando, terminal, llamadas } = armar(Promise.resolve(CREADA));
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(llamadas[0]?.comando).toEqual({
      nombreEmpresa: 'Mi Empresa',
      nombreUsuario: 'admin',
      nombreCompleto: 'Administrador',
      contrasena: ' Margarita-Lunes-47 ',
    });
    expect(llamadas[0]?.actor).toMatchObject({
      usuarioId: null,
      nombreUsuario: 'admin:crear-inicial',
    });
    expect(terminal.texto()).toContain('Empresa «Mi Empresa» creada');
    expect(terminal.texto()).toContain('borre ADMIN_INICIAL_CONTRASENA');
    expect(terminal.texto()).not.toContain('Margarita');
  });

  it('si ya hay empresas, no hace nada y termina bien (se puede correr dos veces)', async () => {
    const { comando, terminal } = armar(Promise.resolve({ creada: false }));
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('Ya hay empresas');
  });

  it('dice qué variables faltan (vacías o con espacios cuentan como faltantes)', async () => {
    const { comando, terminal, llamadas } = armar(Promise.resolve(CREADA), {
      ...DATOS,
      ADMIN_INICIAL_USUARIO: '  ',
      ADMIN_INICIAL_CONTRASENA: undefined,
    });
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(terminal.texto()).toContain(
      'Faltan en el .env: ADMIN_INICIAL_USUARIO, ADMIN_INICIAL_CONTRASENA',
    );
    expect(llamadas).toHaveLength(0);
  });

  it('un error del negocio se muestra en español y termina con 1', async () => {
    const { comando, terminal } = armar(
      Promise.reject(new ContrasenaDebilError('La contraseña es demasiado común')),
    );
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(terminal.texto()).toBe(
      'No se pudo: La contraseña es demasiado común. No se guardó ningún cambio.',
    );
  });

  it('un error inesperado sigue (lo registra quien corre el comando)', async () => {
    const { comando } = armar(Promise.reject(new Error('se cayó la base')));
    await expect(comando.ejecutar()).rejects.toThrow('se cayó la base');
  });
});

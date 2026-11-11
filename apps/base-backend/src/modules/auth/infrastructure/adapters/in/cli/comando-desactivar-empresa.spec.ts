import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../../../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { DesactivarEmpresaConSesionesPort } from '../../../../application/ports/in/desactivar-empresa-con-sesiones.port.js';
import { ComandoDesactivarEmpresa } from './comando-desactivar-empresa.js';
import { SALIDA_ERROR, SALIDA_OK } from './comun.js';
import { TerminalDePrueba } from './terminal-de-prueba.js';

const ACME: EmpresaConsultada = { id: 'e1', nombre: 'Acme', activo: true };
const CAFE: EmpresaConsultada = { id: 'e2', nombre: 'Café Ríos', activo: true };

function armar(
  activas: EmpresaConsultada[],
  respuestas: string[],
  yaEstaba = false,
  sesionesCerradas = 0,
) {
  const consultar: ConsultarEmpresasPort = {
    buscarActiva: () => Promise.resolve(null),
    nombres: () => Promise.resolve([]),
    listarActivas: () => Promise.resolve(activas),
    hayAlguna: () => Promise.resolve(activas.length > 0),
  };
  const desactivar = vi.fn<DesactivarEmpresaConSesionesPort['desactivar']>((id) =>
    Promise.resolve({
      empresa: { ...(activas.find((e) => e.id === id) ?? ACME), activo: false },
      yaEstabaDesactivada: yaEstaba,
      sesionesCerradas,
    }),
  );
  const terminal = new TerminalDePrueba(respuestas);
  const comando = new ComandoDesactivarEmpresa(consultar, { desactivar }, terminal);
  return { comando, desactivar, terminal };
}

describe('ComandoDesactivarEmpresa', () => {
  it('lista, elige por número y confirma con el nombre (sin mayúsculas ni tildes)', async () => {
    const { comando, desactivar, terminal } = armar([ACME, CAFE], ['2', ' cafe  rios ']);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(desactivar).toHaveBeenCalledWith(
      'e2',
      expect.objectContaining({ usuarioId: null, nombreUsuario: 'admin:desactivar-empresa' }),
    );
    expect(terminal.texto()).toContain('  1. Acme  (id e1)');
    expect(terminal.texto()).toContain('«Café Ríos» quedó desactivada');
    expect(terminal.texto()).not.toContain('única empresa activa');
    expect(terminal.texto()).toContain('No había sesiones abiertas en ella.');
  });

  it('dice cuántas sesiones cerró', async () => {
    const { comando, terminal } = armar([ACME], ['1', 'Acme'], false, 3);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('Se cerraron 3 sesiones abiertas en ella.');
  });

  it('un número fuera de la lista se vuelve a preguntar', async () => {
    const { comando, terminal } = armar([ACME, CAFE], ['0', 'dos', '1', 'Acme']);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('Escriba un número del 1 al 2.');
  });

  it('a los tres números malos se rinde', async () => {
    const { comando, desactivar } = armar([ACME], ['9', '9', '9']);
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(desactivar).not.toHaveBeenCalled();
  });

  it('si el nombre no coincide, no desactiva', async () => {
    const { comando, desactivar, terminal } = armar([ACME, CAFE], ['1', 'Café']);
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(desactivar).not.toHaveBeenCalled();
    expect(terminal.texto()).toContain('El nombre no coincide');
  });

  it('avisa si es la única empresa activa', async () => {
    const { comando, terminal } = armar([ACME], ['1', 'acme']);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('es la única empresa activa');
  });

  it('si otro la desactivó mientras tanto, lo dice', async () => {
    const { comando, terminal } = armar([ACME], ['1', 'Acme'], true);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('ya estaba desactivada');
  });

  it('sin empresas activas no pregunta nada', async () => {
    const { comando, terminal } = armar([], []);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('No hay empresas activas');
  });
});

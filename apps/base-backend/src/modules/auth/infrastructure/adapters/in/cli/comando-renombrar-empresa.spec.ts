import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../../../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { RenombrarEmpresaPort } from '../../../../../empresas/application/ports/in/renombrar-empresa.port.js';
import { NombreEmpresaDuplicadoError } from '../../../../../empresas/domain/errors/empresas.errors.js';
import { ComandoRenombrarEmpresa } from './comando-renombrar-empresa.js';
import { SALIDA_ERROR, SALIDA_OK } from './comun.js';
import { TerminalDePrueba } from './terminal-de-prueba.js';

const ACME: EmpresaConsultada = { id: 'e1', nombre: 'Acme', activo: true };
const CAFE: EmpresaConsultada = { id: 'e2', nombre: 'Café Ríos', activo: true };

function armar(
  activas: EmpresaConsultada[],
  respuestas: string[],
  renombrar: RenombrarEmpresaPort['renombrar'] = (id, nombre) =>
    Promise.resolve({
      empresa: { ...(activas.find((e) => e.id === id) ?? ACME), nombre },
      cambio: true,
    }),
) {
  const consultar: ConsultarEmpresasPort = {
    buscarActiva: () => Promise.resolve(null),
    nombres: () => Promise.resolve([]),
    listarActivas: () => Promise.resolve(activas),
    hayAlguna: () => Promise.resolve(activas.length > 0),
  };
  const espia = vi.fn(renombrar);
  const terminal = new TerminalDePrueba(respuestas);
  const comando = new ComandoRenombrarEmpresa(consultar, { renombrar: espia }, terminal);
  return { comando, renombrar: espia, terminal };
}

describe('ComandoRenombrarEmpresa', () => {
  it('lista, elige por número, pide el nombre nuevo y confirma', async () => {
    const { comando, renombrar, terminal } = armar([ACME, CAFE], ['2', ' Café Ríos S.A. ', 's']);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(renombrar).toHaveBeenCalledWith(
      'e2',
      'Café Ríos S.A.',
      expect.objectContaining({ usuarioId: null, nombreUsuario: 'admin:renombrar-empresa' }),
    );
    expect(terminal.texto()).toContain('  1. Acme  (id e1)');
    expect(terminal.texto()).toContain('Nombre actual: Café Ríos');
    expect(terminal.texto()).toContain('«Café Ríos» ahora se llama «Café Ríos S.A.»');
  });

  it('un número fuera de la lista se vuelve a preguntar', async () => {
    const { comando, terminal } = armar([ACME, CAFE], ['0', 'dos', '1', 'Acme 2', 's']);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('Escriba un número del 1 al 2.');
  });

  it('a los tres números malos se rinde', async () => {
    const { comando, renombrar } = armar([ACME], ['9', '9', '9']);
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(renombrar).not.toHaveBeenCalled();
  });

  it('a los tres nombres vacíos se rinde', async () => {
    const { comando, renombrar, terminal } = armar([ACME], ['1', '', ' ', '']);
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(renombrar).not.toHaveBeenCalled();
    expect(terminal.texto()).toContain('Es obligatorio.');
  });

  it('si no confirma, no renombra', async () => {
    const { comando, renombrar, terminal } = armar([ACME], ['1', 'Otra', 'n']);
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(renombrar).not.toHaveBeenCalled();
    expect(terminal.texto()).toContain('No se hizo ningún cambio.');
  });

  it('si ya tenía ese nombre, lo dice', async () => {
    const { comando, terminal } = armar([ACME], ['1', 'Acme', 's'], () =>
      Promise.resolve({ empresa: ACME, cambio: false }),
    );
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('ya tenía ese nombre');
  });

  it('un nombre repetido se explica y termina sin cambios', async () => {
    const { comando, terminal } = armar([ACME, CAFE], ['1', 'cafe rios', 's'], () =>
      Promise.reject(new NombreEmpresaDuplicadoError()),
    );
    expect(await comando.ejecutar()).toBe(SALIDA_ERROR);
    expect(terminal.texto()).toContain('No se pudo: Ya existe una empresa con ese nombre.');
  });

  it('sin empresas activas no pregunta nada', async () => {
    const { comando, terminal } = armar([], []);
    expect(await comando.ejecutar()).toBe(SALIDA_OK);
    expect(terminal.texto()).toContain('No hay empresas activas');
  });
});

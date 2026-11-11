import type { TransaccionPrisma } from '../../../../../../shared/infrastructure/transacciones/transaccion-prisma.js';
import { MotivoCierreSesion } from '../../../../domain/entities/sesion.entity.js';
import { SesionesPrismaRepository } from './sesiones.prisma.repository.js';

const SID = '0190a4f2-1c2b-7000-8000-000000000301';
const USUARIO = '0190a4f2-1c2b-7000-8000-000000000101';
const EMPRESA = '0190a4f2-1c2b-7000-8000-000000000001';
const INICIO = new Date('2026-07-15T13:00:00Z');

const FILA = {
  id: SID,
  usuarioId: USUARIO,
  empresaId: EMPRESA,
  hashRefresh: 'a'.repeat(64),
  hashRefreshAnterior: null,
  rotadoEn: null,
  iniciadaEn: INICIO,
  venceEn: new Date('2026-07-16T02:00:00Z'),
  ultimoUsoEn: INICIO,
  cerradaEn: null,
  motivoCierre: null,
  ip: '10.0.0.7',
  navegador: 'Chrome',
};

function repositorio(tx: Record<string, unknown>): SesionesPrismaRepository {
  return new SesionesPrismaRepository({ tx } as unknown as TransaccionPrisma);
}

describe('SesionesPrismaRepository (sin base; con base en test/auth-sesiones.e2e-spec.ts)', () => {
  it('crea la sesión con el último uso = inicio, y recorta IP y navegador (vacío → null)', async () => {
    const create = vi.fn().mockResolvedValue(FILA);
    const sesiones = repositorio({ sesion: { create } });
    const navegador = '🦊'.repeat(400);

    const sesion = await sesiones.crear({
      usuarioId: USUARIO,
      empresaId: EMPRESA,
      hashRefresh: FILA.hashRefresh,
      iniciadaEn: INICIO,
      venceEn: FILA.venceEn,
      ip: '   ',
      navegador,
    });

    expect(sesion.datos()).toEqual(FILA);
    const [{ data }] = create.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(data).toMatchObject({ ultimoUsoEn: INICIO, ip: null });
    // Recortado por carácter, como cuenta PostgreSQL: 300 zorros enteros.
    expect(data['navegador']).toBe('🦊'.repeat(300));
  });

  it('buscarParaActualizar: bloquea la fila antes de leerla; un id que no es UUID no existe', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const findUnique = vi.fn().mockResolvedValueOnce(FILA).mockResolvedValueOnce(null);
    const sesiones = repositorio({ $queryRaw: queryRaw, sesion: { findUnique } });

    expect(await sesiones.buscarParaActualizar('abc')).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
    expect((await sesiones.buscarParaActualizar(SID))?.id).toBe(SID);
    expect(await sesiones.buscarParaActualizar(SID)).toBeNull();
    const [partes] = queryRaw.mock.calls[0] as [TemplateStringsArray];
    expect(partes.join('?')).toContain('FOR UPDATE');
  });

  it('guardar escribe solo lo que puede cambiar', async () => {
    const create = vi.fn().mockResolvedValue(FILA);
    const update = vi.fn().mockResolvedValue(FILA);
    const sesiones = repositorio({ sesion: { create, update } });
    const sesion = await sesiones.crear({ ...FILA });

    await sesiones.guardar(sesion.rotar('b'.repeat(64), INICIO));

    const [{ where, data }] = update.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(where).toEqual({ id: SID });
    expect(Object.keys(data).sort()).toEqual(
      [
        'cerradaEn',
        'empresaId',
        'hashRefresh',
        'hashRefreshAnterior',
        'motivoCierre',
        'rotadoEn',
        'ultimoUsoEn',
      ].sort(),
    );
    expect(data).toMatchObject({
      hashRefresh: 'b'.repeat(64),
      hashRefreshAnterior: 'a'.repeat(64),
    });
  });

  it('cerrarTodasDelUsuario cierra solo las abiertas y dice cuántas', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 3 });
    const sesiones = repositorio({ sesion: { updateMany } });

    expect(await sesiones.cerrarTodasDelUsuario('abc', MotivoCierreSesion.REUSO, INICIO)).toBe(0);
    expect(await sesiones.cerrarTodasDelUsuario(USUARIO, MotivoCierreSesion.REUSO, INICIO)).toBe(3);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO, cerradaEn: null },
      data: { cerradaEn: INICIO, motivoCierre: 'REUSO' },
    });
  });

  it('cerrarOtrasDelUsuario deja fuera la sesión indicada', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const sesiones = repositorio({ sesion: { updateMany } });
    const motivo = MotivoCierreSesion.CAMBIO_CONTRASENA;

    expect(await sesiones.cerrarOtrasDelUsuario('abc', SID, motivo, INICIO)).toBe(0);
    expect(await sesiones.cerrarOtrasDelUsuario(USUARIO, 'abc', motivo, INICIO)).toBe(0);
    expect(await sesiones.cerrarOtrasDelUsuario(USUARIO, SID, motivo, INICIO)).toBe(2);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { usuarioId: USUARIO, cerradaEn: null, id: { not: SID } },
      data: { cerradaEn: INICIO, motivoCierre: 'CAMBIO_CONTRASENA' },
    });
  });

  it('cerrarTodasDeEmpresa cierra las abiertas de la empresa', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 4 });
    const sesiones = repositorio({ sesion: { updateMany } });
    const motivo = MotivoCierreSesion.EMPRESA_DESACTIVADA;

    expect(await sesiones.cerrarTodasDeEmpresa('abc', motivo, INICIO)).toBe(0);
    expect(await sesiones.cerrarTodasDeEmpresa(EMPRESA, motivo, INICIO)).toBe(4);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { empresaId: EMPRESA, cerradaEn: null },
      data: { cerradaEn: INICIO, motivoCierre: 'EMPRESA_DESACTIVADA' },
    });
  });
  it('abiertasDeUsuarioEnEmpresa: las no cerradas del usuario en esa empresa, la más usada primero', async () => {
    const findMany = vi.fn().mockResolvedValue([FILA]);
    const sesiones = repositorio({ sesion: { findMany } });
    expect(await sesiones.abiertasDeUsuarioEnEmpresa('abc', EMPRESA)).toEqual([]);
    expect(await sesiones.abiertasDeUsuarioEnEmpresa(USUARIO, 'abc')).toEqual([]);
    const abiertas = await sesiones.abiertasDeUsuarioEnEmpresa(USUARIO, EMPRESA);
    expect(abiertas.map((s) => s.datos())).toEqual([FILA]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: USUARIO, empresaId: EMPRESA, cerradaEn: null },
        orderBy: [{ ultimoUsoEn: 'desc' }, { id: 'asc' }],
      }),
    );
  });
});

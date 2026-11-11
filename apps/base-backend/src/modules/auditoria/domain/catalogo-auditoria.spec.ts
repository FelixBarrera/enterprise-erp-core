import {
  erroresDelCatalogoAuditoria,
  faltasEnCatalogoAuditoria,
  type DeclaracionAuditoria,
} from './catalogo-auditoria.js';

const VENTAS: DeclaracionAuditoria = {
  modulo: 'ventas',
  acciones: ['ventas.factura.emitir', 'ventas.factura.anular'],
  campos: ['numero', 'estado'],
  valores: { estado: ['EMITIDA', 'ANULADA'] },
};

describe('erroresDelCatalogoAuditoria', () => {
  it('un catálogo bien escrito no tiene errores', () => {
    expect(
      erroresDelCatalogoAuditoria([VENTAS, { modulo: 'otro', acciones: [], campos: [] }]),
    ).toEqual([]);
  });

  it('encuentra módulos y acciones repetidos, de otro módulo o mal escritos', () => {
    expect(
      erroresDelCatalogoAuditoria([
        VENTAS,
        {
          modulo: 'ventas',
          acciones: ['ventas.factura.emitir', 'compras.orden.crear', 'Ventas.mal'],
          campos: ['numero', 'numero'],
          valores: { motivo: ['X'] },
        },
      ]),
    ).toEqual([
      'el módulo "ventas" está dos veces',
      'la acción "ventas.factura.emitir" está dos veces',
      'la acción "compras.orden.crear" no es del módulo "ventas"',
      'la acción "Ventas.mal" no tiene la forma modulo.recurso.accion',
      'el módulo "ventas" repite un campo',
      '"motivo" tiene valores pero no está en los campos de "ventas"',
    ]);
  });
});

describe('faltasEnCatalogoAuditoria', () => {
  it('un evento con lo declarado no tiene faltas', () => {
    expect(
      faltasEnCatalogoAuditoria(
        {
          accion: 'ventas.factura.anular',
          antes: { estado: 'EMITIDA' },
          despues: { estado: 'ANULADA', numero: 7 },
        },
        [VENTAS],
      ),
    ).toEqual([]);
    expect(faltasEnCatalogoAuditoria({ accion: 'ventas.factura.emitir' }, [VENTAS])).toEqual([]);
  });

  it('una acción que no está (de un módulo que sí está o de uno que no)', () => {
    expect(faltasEnCatalogoAuditoria({ accion: 'ventas.factura.borrar' }, [VENTAS])).toEqual([
      'la acción "ventas.factura.borrar"',
    ]);
    expect(faltasEnCatalogoAuditoria({ accion: 'compras.orden.crear' }, [VENTAS])).toEqual([
      'la acción "compras.orden.crear"',
    ]);
  });

  it('un campo o un valor fijo que no está, una sola vez aunque venga en los dos lados', () => {
    expect(
      faltasEnCatalogoAuditoria(
        {
          accion: 'ventas.factura.anular',
          antes: { total: '1', estado: 'EMITIDA' },
          despues: { total: '2', estado: 'BORRADA' },
        },
        [VENTAS],
      ),
    ).toEqual([
      'el campo "total" (en ventas.factura.anular)',
      'el valor "BORRADA" de "estado" (en ventas.factura.anular)',
    ]);
  });

  it('un valor fijo que no es texto (null al quitarlo) no se revisa', () => {
    expect(
      faltasEnCatalogoAuditoria(
        {
          accion: 'ventas.factura.anular',
          antes: { estado: null },
          despues: { estado: 'EMITIDA' },
        },
        [VENTAS],
      ),
    ).toEqual([]);
  });
});

import { CATALOGO_AUDITORIA } from '../../../../catalogo-auditoria.js';
import type { Actor } from '../../../../shared/application/actor.js';
import { RelojFijo } from '../../../../shared/application/testing/reloj-fijo.js';
import type { RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  faltasEnCatalogoAuditoria,
  type DeclaracionAuditoria,
} from '../../domain/catalogo-auditoria.js';
import type { EventoAuditoria } from '../../domain/evento-auditoria.js';
import type {
  ConsultarTrazabilidadPort,
  ConsultaTrazabilidad,
  Trazabilidad,
} from '../ports/in/consultar-trazabilidad.port.js';
import type {
  DatosEventoAuditoria,
  RegistrarAuditoriaPort,
} from '../ports/in/registrar-auditoria.port.js';
import { ConsultarTrazabilidadUseCase } from '../use-cases/consultar-trazabilidad.use-case.js';
import { RegistrarAuditoriaUseCase } from '../use-cases/registrar-auditoria.use-case.js';

/**
 * Bitácora para pruebas unitarias de otros módulos: guarda en memoria lo mismo que guardaría
 * la real (usa la misma lógica: solo lo que cambió, lo sensible oculto, nada si no cambió nada).
 *
 * ```ts
 * const auditoria = new AuditoriaEnMemoria();
 * const casoDeUso = new CrearUsuarioUseCase(repositorio, auditoria, …);
 * expect(auditoria.acciones()).toEqual(['auth.usuario.crear']);
 * ```
 *
 * También da el pie de las fichas (`CONSULTAR_TRAZABILIDAD_PORT`) con sus eventos: el último
 * registrado gana (con `RelojFijo`, todos tienen la misma hora).
 *
 * **Revisa el catálogo** (`src/catalogo-auditoria.ts`): una acción, un campo de `antes`/`despues`
 * o un valor fijo que no está ahí hace fallar el `registrar()`, así un caso de uso que registra algo
 * nuevo rompe su propia prueba hasta que se agregue (y el frontend sume su texto, AUD-D9). Para
 * probar la bitácora con datos inventados: `new AuditoriaEnMemoria(reloj, { catalogo: null })`.
 */
export class AuditoriaEnMemoria implements RegistrarAuditoriaPort, ConsultarTrazabilidadPort {
  readonly eventos: EventoAuditoria[] = [];
  private readonly real: RegistrarAuditoriaUseCase;
  private readonly trazabilidad = new ConsultarTrazabilidadUseCase({
    guardar: () => Promise.reject(new Error('AuditoriaEnMemoria: usar registrar()')),
    listar: () => Promise.reject(new Error('AuditoriaEnMemoria: no lista')),
    usuariosDe: () => Promise.reject(new Error('AuditoriaEnMemoria: no lista')),
    buscarPorId: () => Promise.reject(new Error('AuditoriaEnMemoria: no busca por id')),
    ultimoDe: (busqueda) => {
      const posicion = this.eventos.findLastIndex(
        (e) =>
          e.empresaId === busqueda.empresaId &&
          e.entidad === busqueda.entidad &&
          e.entidadId === busqueda.entidadId &&
          busqueda.acciones.includes(e.accion),
      );
      const evento = this.eventos[posicion];
      return Promise.resolve(
        evento === undefined
          ? null
          : {
              id: String(posicion),
              ocurridoEn: evento.ocurridoEn,
              nombreUsuario: evento.nombreUsuario,
            },
      );
    },
  });

  private readonly catalogo: readonly DeclaracionAuditoria[] | null;

  constructor(
    reloj: RelojPort = new RelojFijo('2026-07-15T11:00:00-05:00'),
    opciones: { catalogo?: readonly DeclaracionAuditoria[] | null } = {},
  ) {
    this.catalogo = opciones.catalogo === undefined ? CATALOGO_AUDITORIA : opciones.catalogo;
    this.real = new RegistrarAuditoriaUseCase(
      { guardar: (evento) => Promise.resolve(void this.eventos.push(evento)) },
      reloj,
    );
  }

  registrar(datos: DatosEventoAuditoria, actor: Actor): Promise<void> {
    const faltas = this.catalogo === null ? [] : faltasEnCatalogoAuditoria(datos, this.catalogo);
    if (faltas.length > 0) {
      return Promise.reject(
        new Error(
          `AuditoriaEnMemoria: ${faltas.join('; ')} no está en src/catalogo-auditoria.ts ` +
            '(agregarlo en el <modulo>.auditoria.ts y su texto en el frontend)',
        ),
      );
    }
    return this.real.registrar(datos, actor);
  }

  de(consulta: ConsultaTrazabilidad): Promise<Trazabilidad> {
    return this.trazabilidad.de(consulta);
  }

  /** Las acciones registradas, en orden. */
  acciones(): string[] {
    return this.eventos.map(({ accion }) => accion);
  }

  /** El último evento (falla si no hay ninguno). */
  ultimo(): EventoAuditoria {
    const evento = this.eventos.at(-1);
    if (evento === undefined) {
      throw new Error('AuditoriaEnMemoria: no se registró ningún evento');
    }
    return evento;
  }
}

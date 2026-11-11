import { FechaInvalidaError } from '../errors/valores.errors.js';
import { partesEnZonaNegocio } from '../zona-negocio.js';

const PATRON_TEXTO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_POR_DIA = 86_400_000;

const dosCifras = (valor: number): string => String(valor).padStart(2, '0');

/**
 * Una fecha del negocio (de emisión, de negociación, de liquidación, de corte), SIEMPRE en la
 * zona del negocio (`ZONA_NEGOCIO`, por defecto Guayaquil; regla 11): una operación de las 20:00
 * en Guayaquil es de ese día, aunque en UTC ya sea el día siguiente y aunque el servidor esté
 * en otro país.
 *
 * Es solo un día del calendario, sin hora. En la base va en una columna `@db.Date`.
 * - Desde "ahora": `FechaFiscal.desdeInstante(this.reloj.ahora())`.
 * - Desde la API: `FechaFiscal.desdeTexto('2026-11-05')`.
 * - Con la base: `fecha.aFechaDb()` al guardar y `FechaFiscal.desdeFechaDb(fila.fecha)` al leer.
 * - En el JSON de la API sale como `'2026-11-05'`.
 */
export class FechaFiscal {
  private constructor(
    readonly anio: number,
    readonly mes: number,
    readonly dia: number,
  ) {}

  /** La fecha en la zona del negocio en ese instante (sin importar la zona del servidor). */
  static desdeInstante(instante: Date): FechaFiscal {
    const { anio, mes, dia } = partesEnZonaNegocio(instante);
    return FechaFiscal.crear(anio, mes, dia);
  }

  /** Desde el texto `aaaa-mm-dd` (el formato de la API). */
  static desdeTexto(texto: string): FechaFiscal {
    const partes = PATRON_TEXTO.exec(texto);
    if (!partes) {
      throw new FechaInvalidaError('La fecha debe tener el formato aaaa-mm-dd');
    }
    return FechaFiscal.crear(Number(partes[1]), Number(partes[2]), Number(partes[3]));
  }

  /**
   * Desde una columna `@db.Date`: Prisma la entrega como la medianoche UTC de ese día,
   * por eso se lee en UTC (la conexión está en UTC, ver `crearAdaptadorPg()`).
   */
  static desdeFechaDb(fecha: Date): FechaFiscal {
    if (Number.isNaN(fecha.getTime())) {
      throw new FechaInvalidaError();
    }
    return FechaFiscal.crear(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, fecha.getUTCDate());
  }

  private static crear(anio: number, mes: number, dia: number): FechaFiscal {
    if (anio < 1900 || anio > 9999 || mes < 1 || mes > 12 || dia < 1) {
      throw new FechaInvalidaError();
    }
    // Date.UTC "corrige" los días de más (31 de febrero → 3 de marzo): si cambió, no existe.
    const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
    if (comprobacion.getUTCMonth() !== mes - 1 || comprobacion.getUTCDate() !== dia) {
      throw new FechaInvalidaError();
    }
    return new FechaFiscal(anio, mes, dia);
  }

  /** Para guardar en una columna `@db.Date` (la medianoche UTC de ese día). */
  aFechaDb(): Date {
    return new Date(this.milisegundosUtc());
  }

  /** `aaaa-mm-dd`: el formato de la API y de la base. */
  aTexto(): string {
    return `${this.anio}-${dosCifras(this.mes)}-${dosCifras(this.dia)}`;
  }

  /** `dd/mm/aaaa`: el formato de los comprobantes del SRI. */
  formatoSri(): string {
    return `${dosCifras(this.dia)}/${dosCifras(this.mes)}/${this.anio}`;
  }

  /** Días corridos (no hábiles): negativo para ir hacia atrás. */
  sumarDias(dias: number): FechaFiscal {
    if (!Number.isInteger(dias)) {
      throw new FechaInvalidaError('Los días a sumar deben ser un número entero');
    }
    return FechaFiscal.desdeFechaDb(new Date(this.milisegundosUtc() + dias * MS_POR_DIA));
  }

  /**
   * El instante en que empieza este día en la zona del negocio (su 00:00 de allá), para buscar
   * en columnas `timestamptz`: los eventos de un día son `>= dia.inicioDelDia()` y
   * `< dia.sumarDias(1).inicioDelDia()`. Así la búsqueda usa el índice de la columna, sin
   * convertir cada fila a la zona. Si ese día la medianoche no existe por un cambio de horario
   * (el reloj salta de 00:00 a 01:00), es el primer instante de ese día.
   */
  inicioDelDia(): Date {
    const medianocheComoUtc = this.milisegundosUtc();
    // Desfase de la zona (en ms) en un instante: lo que su reloj marca menos la hora UTC.
    const desfase = (instante: number): number => {
      const p = partesEnZonaNegocio(new Date(instante));
      return Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo) - instante;
    };
    // Dos intentos cubren los dos desfases posibles alrededor de un cambio de horario; queda el
    // primero que ya es de este día.
    const primero = medianocheComoUtc - desfase(medianocheComoUtc);
    const candidatos = [primero, medianocheComoUtc - desfase(primero)].filter((instante) =>
      FechaFiscal.desdeInstante(new Date(instante)).esIgualA(this),
    );
    return new Date(Math.min(...candidatos));
  }

  /** -1 si es anterior, 0 si es la misma, 1 si es posterior. */
  compararCon(otra: FechaFiscal): -1 | 0 | 1 {
    const diferencia = this.milisegundosUtc() - otra.milisegundosUtc();
    return diferencia < 0 ? -1 : diferencia > 0 ? 1 : 0;
  }

  esIgualA(otra: FechaFiscal): boolean {
    return this.compararCon(otra) === 0;
  }

  esAnteriorA(otra: FechaFiscal): boolean {
    return this.compararCon(otra) < 0;
  }

  esPosteriorA(otra: FechaFiscal): boolean {
    return this.compararCon(otra) > 0;
  }

  /** Así sale en el JSON de la API. */
  toJSON(): string {
    return this.aTexto();
  }

  toString(): string {
    return this.aTexto();
  }

  private milisegundosUtc(): number {
    return Date.UTC(this.anio, this.mes - 1, this.dia);
  }
}

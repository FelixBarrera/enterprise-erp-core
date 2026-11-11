import { createInterface, type Interface } from 'node:readline';
import { type Readable, Writable } from 'node:stream';

/** Quien corre el comando cerró la entrada o apretó Ctrl+C: no se hace ningún cambio. */
export class EntradaCanceladaError extends Error {
  constructor() {
    super('Cancelado: no se hizo ningún cambio.');
  }
}

/** Lo que un comando necesita de la terminal. En las pruebas, `TerminalDePrueba`. */
export interface Terminal {
  /** Escribe el texto y un salto de línea. */
  escribir(texto: string): void;
  /** Pregunta y devuelve lo escrito (sin el salto de línea). `EntradaCanceladaError` si se cancela. */
  preguntar(pregunta: string): Promise<string>;
  /** Igual, pero sin mostrar lo que se escribe (contraseñas). */
  preguntarOculto(pregunta: string): Promise<string>;
  cerrar(): void;
}

/**
 * La terminal real (la del proceso). Las contraseñas no se ven al escribirlas: mientras se
 * pregunta una, lo que readline repite en pantalla se descarta. Si la entrada no es una
 * terminal (un archivo o una tubería), lee una línea por pregunta, sin repetir nada.
 */
export class TerminalDelProceso implements Terminal {
  private silenciada = false;
  private readonly lector: Interface;
  private readonly lineas: AsyncIterator<string>;

  constructor(
    entrada: Readable = process.stdin,
    private readonly salida: NodeJS.WritableStream = process.stdout,
    esTerminal: boolean = process.stdin.isTTY === true,
  ) {
    const eco = new Writable({
      write: (trozo: Buffer | string, _codificacion, listo) => {
        if (!this.silenciada) {
          this.salida.write(trozo);
        }
        listo();
      },
    });
    this.lector = createInterface({ input: entrada, output: eco, terminal: esTerminal });
    // Sin esto, Ctrl+C solo pausa la entrada y el comando queda esperando para siempre.
    this.lector.on('SIGINT', () => this.lector.close());
    this.lineas = this.lector[Symbol.asyncIterator]();
  }

  escribir(texto: string): void {
    this.salida.write(`${texto}\n`);
  }

  preguntar(pregunta: string): Promise<string> {
    this.salida.write(pregunta);
    return this.siguienteLinea();
  }

  async preguntarOculto(pregunta: string): Promise<string> {
    this.salida.write(pregunta);
    this.silenciada = true;
    try {
      return await this.siguienteLinea();
    } finally {
      this.silenciada = false;
      // El Enter no se vio: se baja de línea a mano.
      this.salida.write('\n');
    }
  }

  cerrar(): void {
    this.lector.close();
  }

  private async siguienteLinea(): Promise<string> {
    const { value, done } = await this.lineas.next();
    if (done === true) {
      throw new EntradaCanceladaError();
    }
    return value;
  }
}

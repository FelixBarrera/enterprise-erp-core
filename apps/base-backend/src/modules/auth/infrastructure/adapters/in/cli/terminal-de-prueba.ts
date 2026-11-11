import { EntradaCanceladaError, type Terminal } from './terminal.js';

/**
 * Terminal de las pruebas: responde en orden lo que se le da y guarda lo que se escribió.
 * Sin respuestas, se comporta como si se hubiera apretado Ctrl+C.
 */
export class TerminalDePrueba implements Terminal {
  readonly salida: string[] = [];
  /** Las preguntas ocultas (solo el texto de la pregunta). */
  readonly ocultas: string[] = [];
  cerrada = false;

  constructor(private readonly respuestas: string[] = []) {}

  escribir(texto: string): void {
    this.salida.push(texto);
  }

  preguntar(pregunta: string): Promise<string> {
    this.salida.push(pregunta);
    return this.responder();
  }

  preguntarOculto(pregunta: string): Promise<string> {
    this.salida.push(pregunta);
    this.ocultas.push(pregunta);
    return this.responder();
  }

  cerrar(): void {
    this.cerrada = true;
  }

  /** Todo lo escrito, junto. */
  texto(): string {
    return this.salida.join('\n');
  }

  private responder(): Promise<string> {
    const respuesta = this.respuestas.shift();
    return respuesta === undefined
      ? Promise.reject(new EntradaCanceladaError())
      : Promise.resolve(respuesta);
  }
}

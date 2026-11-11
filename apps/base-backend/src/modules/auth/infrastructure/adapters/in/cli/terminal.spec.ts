import { PassThrough } from 'node:stream';
import { EntradaCanceladaError, TerminalDelProceso } from './terminal.js';

function armar(esTerminal: boolean) {
  const entrada = new PassThrough();
  const salida = new PassThrough();
  let escrito = '';
  salida.on('data', (trozo: Buffer) => {
    escrito += trozo.toString();
  });
  const terminal = new TerminalDelProceso(entrada, salida, esTerminal);
  return { entrada, terminal, escrito: () => escrito };
}

describe('TerminalDelProceso', () => {
  it('lee una línea por pregunta, aunque lleguen todas juntas (tubería)', async () => {
    const { entrada, terminal, escrito } = armar(false);
    entrada.write('Acme\nana\n');
    expect(await terminal.preguntar('Empresa: ')).toBe('Acme');
    expect(await terminal.preguntar('Usuario: ')).toBe('ana');
    terminal.escribir('Listo');
    expect(escrito()).toBe('Empresa: Usuario: Listo\n');
    terminal.cerrar();
  });

  it('en una terminal, lo que se escribe en una pregunta oculta no se ve', async () => {
    const { entrada, terminal, escrito } = armar(true);
    const respuesta = terminal.preguntarOculto('Contraseña: ');
    entrada.write('secreta-123\r');
    expect(await respuesta).toBe('secreta-123');
    expect(escrito()).not.toContain('secreta');
    expect(escrito()).toContain('Contraseña: ');

    const visible = terminal.preguntar('Nombre: ');
    entrada.write('Ana\r');
    expect(await visible).toBe('Ana');
    expect(escrito()).toContain('Ana');
    terminal.cerrar();
  });

  it('si se cierra la entrada (o Ctrl+C), EntradaCanceladaError', async () => {
    const { entrada, terminal } = armar(true);
    const respuesta = terminal.preguntar('Empresa: ');
    entrada.write('\u0003'); // Ctrl+C
    await expect(respuesta).rejects.toThrow(EntradaCanceladaError);
    await expect(terminal.preguntar('Otra: ')).rejects.toThrow('Cancelado');
  });
});

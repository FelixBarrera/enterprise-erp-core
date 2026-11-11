import { Logger, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import type { ComandoAdmin } from '../modules/auth/infrastructure/adapters/in/cli/comun.js';
import {
  TerminalDelProceso,
  type Terminal,
} from '../modules/auth/infrastructure/adapters/in/cli/terminal.js';

/**
 * Arranca la aplicación sin servidor HTTP (con el mismo `.env` validado, la base y la zona del
 * negocio), corre el comando y la cierra. El código de salida queda en `process.exitCode`:
 * 0 bien, 1 no se hizo, 130 cancelado. Los comandos se compilan con `nest build` y se corren
 * con `node dist/comandos/<comando>.js` (decisión del usuario, 6.4b): igual en la PC y en el
 * servidor, sin herramientas de desarrollo.
 */
export async function ejecutarComando(
  armar: (app: INestApplicationContext, terminal: Terminal) => ComandoAdmin,
): Promise<void> {
  // Solo advertencias y errores: los mensajes de arranque de NestJS tapan las preguntas.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const terminal = new TerminalDelProceso();
  try {
    process.exitCode = await armar(app, terminal).ejecutar();
  } catch (error) {
    new Logger('Comando').error('El comando falló (no se guardó ningún cambio)', error);
    process.exitCode = 1;
  } finally {
    terminal.cerrar();
    await app.close();
  }
}

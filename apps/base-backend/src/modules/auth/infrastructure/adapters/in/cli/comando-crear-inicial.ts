import type { CrearInstalacionInicialPort } from '../../../../application/ports/in/crear-instalacion-inicial.port.js';
import { actorDelComando, type ComandoAdmin, correr, SALIDA_ERROR, SALIDA_OK } from './comun.js';
import type { Terminal } from './terminal.js';

/** Las variables del `.env` que usa (las lee quien arma el comando, con `ConfigService`). */
export interface DatosInstalacionInicial {
  readonly EMPRESA_INICIAL_NOMBRE?: string | undefined;
  readonly ADMIN_INICIAL_USUARIO?: string | undefined;
  readonly ADMIN_INICIAL_NOMBRE?: string | undefined;
  readonly ADMIN_INICIAL_CONTRASENA?: string | undefined;
}

const VARIABLES = [
  'EMPRESA_INICIAL_NOMBRE',
  'ADMIN_INICIAL_USUARIO',
  'ADMIN_INICIAL_NOMBRE',
  'ADMIN_INICIAL_CONTRASENA',
] as const;

/**
 * `pnpm admin:crear-inicial`: la primera empresa y su primer administrador, desde el `.env`.
 * No pregunta nada (sirve en un script de instalación). Si ya hay empresas, no hace nada.
 */
export class ComandoCrearInicial implements ComandoAdmin {
  constructor(
    private readonly instalacion: CrearInstalacionInicialPort,
    private readonly datos: DatosInstalacionInicial,
    private readonly terminal: Terminal,
  ) {}

  ejecutar(): Promise<number> {
    return correr(this.terminal, async () => {
      const faltan = VARIABLES.filter((nombre) => (this.datos[nombre] ?? '').trim() === '');
      if (faltan.length > 0) {
        this.terminal.escribir(
          `Faltan en el .env: ${faltan.join(', ')}. Ver .env.example. No se hizo ningún cambio.`,
        );
        return SALIDA_ERROR;
      }
      const resultado = await this.instalacion.crear(
        {
          nombreEmpresa: this.datos.EMPRESA_INICIAL_NOMBRE ?? '',
          nombreUsuario: this.datos.ADMIN_INICIAL_USUARIO ?? '',
          nombreCompleto: this.datos.ADMIN_INICIAL_NOMBRE ?? '',
          // La contraseña no se recorta: un espacio es parte de ella.
          contrasena: this.datos.ADMIN_INICIAL_CONTRASENA ?? '',
        },
        actorDelComando('admin:crear-inicial'),
      );
      if (!resultado.creada) {
        this.terminal.escribir(
          'Ya hay empresas en esta instalación: no se hizo nada. Para otra empresa, use pnpm admin:crear-empresa.',
        );
        return SALIDA_OK;
      }
      this.terminal.escribir(
        `Listo. Empresa «${resultado.empresa.nombre}» creada (id ${resultado.empresa.id}).`,
      );
      this.terminal.escribir(
        `Administrador: ${resultado.administrador.nombreUsuario} (${resultado.administrador.nombreCompleto}). La primera vez que entre tendrá que cambiar la contraseña.`,
      );
      this.terminal.escribir('Ahora borre ADMIN_INICIAL_CONTRASENA del .env.');
      return SALIDA_OK;
    });
  }
}

import type { Actor } from '../../../../../shared/application/actor.js';
import type { ResultadoCrearEmpresaConAdministrador } from './crear-empresa-con-administrador.port.js';

export const CREAR_INSTALACION_INICIAL_PORT = Symbol('CREAR_INSTALACION_INICIAL_PORT');

/** Los datos de `ADMIN_INICIAL_*` y `EMPRESA_INICIAL_NOMBRE` del `.env`. */
export interface CrearInstalacionInicialComando {
  readonly nombreEmpresa: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  readonly contrasena: string;
}

export type ResultadoInstalacionInicial =
  { readonly creada: false } | ({ readonly creada: true } & ResultadoCrearEmpresaConAdministrador);

/**
 * Primera instalación (`admin:crear-inicial`): la primera empresa y su primer administrador,
 * con una contraseña temporal. Si ya hay alguna empresa no hace nada (`creada: false`): se puede
 * correr dos veces (OPS-03) y nunca toca usuarios existentes.
 */
export interface CrearInstalacionInicialPort {
  crear(
    comando: CrearInstalacionInicialComando,
    actor: Actor,
  ): Promise<ResultadoInstalacionInicial>;
}

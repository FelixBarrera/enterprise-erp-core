import type { Actor } from '../../../../../shared/application/actor.js';
import type { EmpresaConsultada } from '../../../../empresas/application/ports/in/consultar-empresas.port.js';

export const CREAR_EMPRESA_CON_ADMINISTRADOR_PORT = Symbol('CREAR_EMPRESA_CON_ADMINISTRADOR_PORT');

/** Quién será el administrador: alguien que ya tiene cuenta o una persona nueva. */
export type AdministradorDeEmpresa =
  | { readonly tipo: 'existente'; readonly nombreUsuario: string }
  | {
      readonly tipo: 'nuevo';
      readonly nombreUsuario: string;
      readonly nombreCompleto: string;
      /** La escribe quien corre el comando; es temporal: se cambia al entrar (AUTH-D13). */
      readonly contrasena: string;
    };

export interface CrearEmpresaConAdministradorComando {
  readonly nombreEmpresa: string;
  readonly administrador: AdministradorDeEmpresa;
}

/** Lo que el comando muestra de un usuario (nunca el hash). */
export interface UsuarioResumen {
  readonly id: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  readonly activo: boolean;
}

export interface ResultadoCrearEmpresaConAdministrador {
  readonly empresa: EmpresaConsultada;
  readonly administrador: UsuarioResumen;
  /** `true` si el usuario se creó ahora (debe cambiar la contraseña al entrar). */
  readonly usuarioNuevo: boolean;
}

/**
 * Crea una empresa con su rol Administrador y le da ese rol a un usuario (nuevo o existente),
 * todo en una transacción y auditado (EMP-D3). Solo la usan los comandos `admin:*` (EMP-D2).
 */
export interface CrearEmpresaConAdministradorPort {
  /** El usuario con ese nombre, activo o no; `null` si no existe. `NombreUsuarioInvalidoError` si el nombre no tiene el formato. */
  buscarUsuario(nombreUsuario: string): Promise<UsuarioResumen | null>;
  crear(
    comando: CrearEmpresaConAdministradorComando,
    actor: Actor,
  ): Promise<ResultadoCrearEmpresaConAdministrador>;
}

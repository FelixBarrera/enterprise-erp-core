import { Inject, Injectable } from '@nestjs/common';
import {
  CONTEXTO_PETICION_PORT,
  type ContextoPeticionPort,
} from '../../../../shared/application/ports/contexto-peticion.port.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  DebeCambiarContrasenaError,
  SesionInvalidaError,
  SinPermisoError,
} from '../../domain/errors/auth.errors.js';
import type {
  AutenticarPeticionComando,
  AutenticarPeticionPort,
  PeticionAutenticada,
} from '../ports/in/autenticar-peticion.port.js';
import {
  ACCESOS_SESION_PORT,
  type AccesosSesionPort,
} from '../ports/out/accesos-sesion.repository.port.js';
import {
  GENERADOR_TOKENS_PORT,
  type GeneradorTokensPort,
} from '../ports/out/generador-tokens.port.js';
import { OPCIONES_SESION, type OpcionesSesion } from '../ports/out/opciones-sesion.port.js';

@Injectable()
export class AutenticarPeticionUseCase implements AutenticarPeticionPort {
  constructor(
    @Inject(GENERADOR_TOKENS_PORT) private readonly tokens: GeneradorTokensPort,
    @Inject(ACCESOS_SESION_PORT) private readonly accesos: AccesosSesionPort,
    @Inject(OPCIONES_SESION) private readonly opciones: OpcionesSesion,
    @Inject(CONTEXTO_PETICION_PORT) private readonly contexto: ContextoPeticionPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
  ) {}

  async execute(comando: AutenticarPeticionComando): Promise<PeticionAutenticada> {
    const datos =
      comando.tokenAcceso === null ? null : await this.tokens.verificarAcceso(comando.tokenAcceso);
    const acceso =
      datos === null ? null : await this.accesos.buscar(datos.sesionId, comando.permisoRequerido);
    // Todo lo que no cuadra es el mismo 401: no se dice por qué (la pantalla vuelve al login).
    if (
      datos === null ||
      acceso === null ||
      acceso.sesion.usuarioId !== datos.usuarioId ||
      !acceso.sesion.estaViva(this.reloj.ahora(), this.opciones.inactividadMinutos) ||
      !acceso.usuario.activo ||
      !acceso.empresaActiva ||
      !acceso.tieneRolActivo
    ) {
      throw new SesionInvalidaError();
    }
    if (acceso.usuario.debeCambiarContrasena && !comando.permiteContrasenaTemporal) {
      throw new DebeCambiarContrasenaError();
    }
    // El Administrador tiene todos los de su empresa (AUTH-D10); los demás, los de sus roles.
    if (comando.permisoRequerido !== null && !acceso.esAdministrador && !acceso.tienePermiso) {
      throw new SinPermisoError();
    }

    const { sesion } = acceso;
    return {
      sesionId: sesion.id,
      esAdministrador: acceso.esAdministrador,
      actor: {
        usuarioId: sesion.usuarioId,
        nombreUsuario: acceso.usuario.nombreUsuario,
        empresaId: sesion.empresaId,
        ip: this.contexto.ip(),
        navegador: this.contexto.navegador(),
        requestId: this.contexto.requestId(),
      },
    };
  }
}

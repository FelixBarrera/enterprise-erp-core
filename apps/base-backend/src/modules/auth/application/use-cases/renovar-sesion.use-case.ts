import { Inject, Injectable } from '@nestjs/common';
import {
  CONTEXTO_PETICION_PORT,
  type ContextoPeticionPort,
} from '../../../../shared/application/ports/contexto-peticion.port.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import { actorDelSistema } from '../../../../shared/application/actor.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import {
  MotivoCierreSesion,
  SecretoPresentado,
  type Sesion,
} from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { SesionInvalidaError } from '../../domain/errors/auth.errors.js';
import type { PartesTokenRefresco } from '../../domain/value-objects/token-refresco.js';
import type { TokensSesion } from '../ports/in/iniciar-sesion.port.js';
import type { RenovarSesionPort } from '../ports/in/renovar-sesion.port.js';
import {
  GENERADOR_TOKENS_PORT,
  type GeneradorTokensPort,
} from '../ports/out/generador-tokens.port.js';
import { OPCIONES_SESION, type OpcionesSesion } from '../ports/out/opciones-sesion.port.js';
import {
  ROLES_REPOSITORY_PORT,
  type RolesRepositoryPort,
} from '../ports/out/roles.repository.port.js';
import {
  SESIONES_REPOSITORY_PORT,
  type SesionesRepositoryPort,
} from '../ports/out/sesiones.repository.port.js';
import {
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../ports/out/usuarios.repository.port.js';
import { actorDeUsuario, empresasDisponibles } from './sesion-comun.js';

type Resultado =
  | { readonly tipo: 'renovada'; readonly sesion: Sesion; readonly usuario: Usuario }
  | { readonly tipo: 'invalida' };

const INVALIDA: Resultado = { tipo: 'invalida' };

@Injectable()
export class RenovarSesionUseCase implements RenovarSesionPort {
  constructor(
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(GENERADOR_TOKENS_PORT) private readonly tokens: GeneradorTokensPort,
    @Inject(OPCIONES_SESION) private readonly opciones: OpcionesSesion,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(CONTEXTO_PETICION_PORT) private readonly contexto: ContextoPeticionPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async execute(tokenRefresco: string | null): Promise<TokensSesion> {
    // Mal formado o con una firma que no es del servidor (SEG-05): ni se busca la sesión, así
    // que un token inventado con un `sid` real no cuenta como reuso ni cierra nada.
    const partes = tokenRefresco === null ? null : this.tokens.abrirRefresco(tokenRefresco);
    if (partes === null) {
      throw new SesionInvalidaError();
    }
    const secretoNuevo = this.tokens.nuevoSecreto();
    // Todo en una transacción con la fila de la sesión bloqueada: dos refresh a la vez con el
    // mismo token se atienden uno detrás del otro (el segundo cae en los 60 s de gracia).
    // Un reuso también se confirma (cierra las sesiones) y recién después se responde el 401.
    const resultado = await this.unidad.ejecutar(() => this.renovar(partes, secretoNuevo));
    if (resultado.tipo === 'invalida') {
      throw new SesionInvalidaError();
    }

    const { sesion, usuario } = resultado;
    const acceso = await this.tokens.firmarAcceso({ usuarioId: usuario.id, sesionId: sesion.id });
    return {
      tokenAcceso: acceso.token,
      expiraEnSegundos: acceso.expiraEnSegundos,
      tokenRefresco: this.tokens.armarRefresco({ sesionId: sesion.id, secreto: secretoNuevo }),
      sesionVenceEn: sesion.venceEn,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
    };
  }

  private async renovar(partes: PartesTokenRefresco, secretoNuevo: string): Promise<Resultado> {
    const ahora = this.reloj.ahora();
    const sesion = await this.sesiones.buscarParaActualizar(partes.sesionId);
    if (sesion === null || !sesion.estaAbierta()) {
      return INVALIDA;
    }

    const presentado = sesion.reconocerSecreto(this.tokens.huella(partes.secreto), ahora);
    if (presentado === SecretoPresentado.DESCONOCIDO) {
      await this.cerrarPorReuso(sesion, ahora);
      return INVALIDA;
    }

    if (!sesion.estaViva(ahora, this.opciones.inactividadMinutos)) {
      return INVALIDA;
    }
    const usuario = await this.usuarios.buscarPorId(sesion.usuarioId);
    if (usuario === null || !usuario.activo || !(await this.tieneAcceso(usuario, sesion))) {
      return INVALIDA;
    }

    const rotada = sesion.rotar(this.tokens.huella(secretoNuevo), ahora);
    await this.sesiones.guardar(rotada);
    return { tipo: 'renovada', sesion: rotada, usuario };
  }

  /** La empresa activa de la sesión sigue activa y el usuario sigue teniendo un rol en ella. */
  private async tieneAcceso(usuario: Usuario, sesion: Sesion): Promise<boolean> {
    const disponibles = await empresasDisponibles(usuario.id, this.roles, this.empresas);
    return disponibles.some((empresa) => empresa.id === sesion.empresaId);
  }

  /**
   * Alguien presentó un token viejo: o lo robaron, o lo usa quien lo robó. No se sabe cuál de
   * los dos es el dueño, así que se cierran **todas** las sesiones del usuario (AUTH-D7).
   */
  private async cerrarPorReuso(sesion: Sesion, ahora: Date): Promise<void> {
    const cerradas = await this.sesiones.cerrarTodasDelUsuario(
      sesion.usuarioId,
      MotivoCierreSesion.REUSO,
      ahora,
    );
    const usuario = await this.usuarios.buscarPorId(sesion.usuarioId);
    const actor =
      usuario === null
        ? actorDelSistema({
            empresaId: sesion.empresaId,
            ip: this.contexto.ip(),
            navegador: this.contexto.navegador(),
            requestId: this.contexto.requestId(),
          })
        : actorDeUsuario(usuario, sesion.empresaId, this.contexto);
    await this.auditoria.registrar(
      {
        accion: 'auth.sesion.reuso',
        entidad: 'sesion',
        entidadId: sesion.id,
        entidadNombre: usuario?.nombreUsuario.valor,
        despues: { sesionesCerradas: cerradas, motivoCierre: MotivoCierreSesion.REUSO },
      },
      actor,
    );
  }
}

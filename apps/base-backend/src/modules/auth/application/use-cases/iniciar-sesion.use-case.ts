import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  CONTEXTO_PETICION_PORT,
  type ContextoPeticionPort,
} from '../../../../shared/application/ports/contexto-peticion.port.js';
import { RELOJ_PORT, type RelojPort } from '../../../../shared/application/ports/reloj.port.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
  type EmpresaConsultada,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import { Sesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { CredencialesInvalidasError, SinEmpresaError } from '../../domain/errors/auth.errors.js';
import { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import type {
  IniciarSesionComando,
  IniciarSesionPort,
  TokensSesion,
} from '../ports/in/iniciar-sesion.port.js';
import {
  GENERADOR_TOKENS_PORT,
  type GeneradorTokensPort,
} from '../ports/out/generador-tokens.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../ports/out/hasher-contrasena.port.js';
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

/** Por qué falló un login (va en la bitácora; la pantalla ve siempre el mismo mensaje). */
export const MotivoLoginFallido = {
  NO_EXISTE: 'NO_EXISTE',
  CONTRASENA_INCORRECTA: 'CONTRASENA_INCORRECTA',
  BLOQUEADO: 'BLOQUEADO',
  DESACTIVADO: 'DESACTIVADO',
  /** Contraseña correcta, pero sin un rol activo en una empresa activa (AUTH-D16, AUD-01). */
  SIN_EMPRESA: 'SIN_EMPRESA',
} as const;
export type MotivoLoginFallido = (typeof MotivoLoginFallido)[keyof typeof MotivoLoginFallido];

@Injectable()
export class IniciarSesionUseCase implements IniciarSesionPort {
  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(HASHER_CONTRASENA_PORT) private readonly hasher: HasherContrasenaPort,
    @Inject(GENERADOR_TOKENS_PORT) private readonly tokens: GeneradorTokensPort,
    @Inject(OPCIONES_SESION) private readonly opciones: OpcionesSesion,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(CONTEXTO_PETICION_PORT) private readonly contexto: ContextoPeticionPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async execute(comando: IniciarSesionComando): Promise<TokensSesion> {
    const usuario = await this.buscarUsuario(comando.nombreUsuario);
    if (usuario === null) {
      // Siempre se verifica un hash: así tarda lo mismo que con un usuario que existe.
      await this.hasher.verificarRelleno(comando.contrasena);
      await this.registrarFalloSinUsuario();
      throw new CredencialesInvalidasError();
    }

    const correcta = await this.hasher.verificar(usuario.hashContrasena, comando.contrasena);
    // La hora después de verificar: Argon2 tarda, y el bloqueo se mide contra este momento.
    const ahora = this.reloj.ahora();
    const motivo = motivoDeFallo(usuario, correcta, ahora);
    if (motivo !== null) {
      await this.registrarFallo(usuario, motivo, ahora);
      throw new CredencialesInvalidasError();
    }

    const empresa = await this.elegirEmpresa(usuario);
    if (empresa === null) {
      await this.registrarSinEmpresa(usuario);
      throw new SinEmpresaError();
    }
    const secreto = this.tokens.nuevoSecreto();
    const sesion = await this.unidad.ejecutar(async () => {
      const nueva = await this.sesiones.crear({
        usuarioId: usuario.id,
        empresaId: empresa.id,
        hashRefresh: this.tokens.huella(secreto),
        iniciadaEn: ahora,
        venceEn: Sesion.vencimiento(ahora, this.opciones.duracionMaximaHoras),
        ip: this.contexto.ip(),
        navegador: this.contexto.navegador(),
      });
      const actual = (await this.usuarios.buscarParaActualizar(usuario.id)) ?? usuario;
      await this.usuarios.guardar(actual.ingresoExitoso(ahora, empresa.id), usuario.id);
      await this.auditoria.registrar(
        {
          accion: 'auth.sesion.iniciar',
          entidad: 'sesion',
          entidadId: nueva.id,
          entidadNombre: usuario.nombreUsuario.valor,
          despues: { empresa: empresa.nombre, venceEn: nueva.venceEn },
        },
        actorDeUsuario(usuario, empresa.id, this.contexto),
      );
      return nueva;
    });

    const acceso = await this.tokens.firmarAcceso({ usuarioId: usuario.id, sesionId: sesion.id });
    return {
      tokenAcceso: acceso.token,
      expiraEnSegundos: acceso.expiraEnSegundos,
      tokenRefresco: this.tokens.armarRefresco({ sesionId: sesion.id, secreto }),
      sesionVenceEn: sesion.venceEn,
      debeCambiarContrasena: usuario.debeCambiarContrasena,
    };
  }

  /** Un nombre que no cumple el formato no puede existir: se trata como "no existe". */
  private async buscarUsuario(escrito: string): Promise<Usuario | null> {
    let nombre: NombreUsuario;
    try {
      nombre = NombreUsuario.crear(escrito);
    } catch {
      return null;
    }
    return this.usuarios.buscarPorNombreUsuario(nombre);
  }

  /**
   * La última empresa usada si todavía tiene acceso; si no, la primera por nombre (AUTH-D4).
   * `null` si no tiene ninguna (AUTH-D16).
   */
  private async elegirEmpresa(usuario: Usuario): Promise<EmpresaConsultada | null> {
    const disponibles = await empresasDisponibles(usuario.id, this.roles, this.empresas);
    const [primera] = disponibles;
    if (primera === undefined) {
      return null;
    }
    return disponibles.find((empresa) => empresa.id === usuario.ultimaEmpresaId) ?? primera;
  }

  /**
   * Contraseña correcta pero sin empresa (AUD-01): el evento queda en su última empresa, para que
   * su administrador vea que alguien a quien le quitó el acceso intentó entrar. **No suma al
   * bloqueo ni toca sus fallos**: la contraseña era correcta, no es alguien adivinándola. En su
   * propia transacción, antes del 403.
   */
  private async registrarSinEmpresa(usuario: Usuario): Promise<void> {
    await this.unidad.ejecutar(() =>
      this.auditoria.registrar(
        {
          accion: 'auth.sesion.fallido',
          entidad: 'usuario',
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          despues: { motivo: MotivoLoginFallido.SIN_EMPRESA },
        },
        actorDeUsuario(usuario, usuario.ultimaEmpresaId, this.contexto),
      ),
    );
  }

  /**
   * Suma el fallo (al quinto, bloquea) y deja el evento en su última empresa. Se confirma en su
   * propia transacción **antes** de responder el 401: si no, el error la desharía.
   */
  private async registrarFallo(
    usuario: Usuario,
    motivo: MotivoLoginFallido,
    ahora: Date,
  ): Promise<void> {
    const actor = actorDeUsuario(usuario, usuario.ultimaEmpresaId, this.contexto);
    await this.unidad.ejecutar(async () => {
      const actual = (await this.usuarios.buscarParaActualizar(usuario.id)) ?? usuario;
      // Un desactivado no suma: no puede entrar igual, y al reactivarlo empieza limpio.
      const { usuario: conFallo, seBloqueo } = actual.activo
        ? actual.registrarFallo(ahora)
        : { usuario: actual, seBloqueo: false };
      if (conFallo !== actual) {
        await this.usuarios.guardar(conFallo, null);
      }
      await this.auditoria.registrar(
        {
          accion: 'auth.sesion.fallido',
          entidad: 'usuario',
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          despues: { motivo, intentosFallidos: conFallo.intentosFallidos },
        },
        actor,
      );
      if (seBloqueo) {
        await this.auditoria.registrar(
          {
            accion: 'auth.usuario.bloquear',
            entidad: 'usuario',
            entidadId: usuario.id,
            entidadNombre: usuario.nombreUsuario.valor,
            despues: { bloqueadoHasta: conFallo.bloqueadoHasta },
          },
          actor,
        );
      }
    });
  }

  /**
   * Un usuario que no existe: sin empresa ni usuario, solo la IP y el navegador. **No se guarda
   * lo que escribió**: a veces es la contraseña puesta en el campo equivocado.
   */
  private async registrarFalloSinUsuario(): Promise<void> {
    const actor: Actor = {
      usuarioId: null,
      nombreUsuario: null,
      empresaId: null,
      ip: this.contexto.ip(),
      navegador: this.contexto.navegador(),
      requestId: this.contexto.requestId(),
    };
    await this.unidad.ejecutar(() =>
      this.auditoria.registrar(
        { accion: 'auth.sesion.fallido', despues: { motivo: MotivoLoginFallido.NO_EXISTE } },
        actor,
      ),
    );
  }
}

/** `null` si puede entrar. El orden importa solo para la bitácora: el motivo más útil primero. */
function motivoDeFallo(
  usuario: Usuario,
  correcta: boolean,
  ahora: Date,
): MotivoLoginFallido | null {
  if (!usuario.activo) {
    return MotivoLoginFallido.DESACTIVADO;
  }
  if (usuario.estaBloqueado(ahora)) {
    return MotivoLoginFallido.BLOQUEADO;
  }
  return correcta ? null : MotivoLoginFallido.CONTRASENA_INCORRECTA;
}

import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
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
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import { MotivoCierreSesion } from '../../domain/entities/sesion.entity.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import {
  ContrasenaActualIncorrectaError,
  ContrasenaDebilError,
  CuentaBloqueadaError,
  SesionInvalidaError,
} from '../../domain/errors/auth.errors.js';
import { Contrasena } from '../../domain/value-objects/contrasena.vo.js';
import type {
  CambiarContrasenaComando,
  CambiarContrasenaPort,
} from '../ports/in/cambiar-contrasena.port.js';
import {
  CONTRASENAS_COMUNES_PORT,
  type ContrasenasComunesPort,
} from '../ports/out/contrasenas-comunes.port.js';
import {
  HASHER_CONTRASENA_PORT,
  type HasherContrasenaPort,
} from '../ports/out/hasher-contrasena.port.js';
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
import { empresasDisponibles } from './sesion-comun.js';

export const MENSAJE_CONTRASENA_REPETIDA = 'La contraseña nueva debe ser distinta de la actual';

@Injectable()
export class CambiarContrasenaUseCase implements CambiarContrasenaPort {
  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(SESIONES_REPOSITORY_PORT) private readonly sesiones: SesionesRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(HASHER_CONTRASENA_PORT) private readonly hasher: HasherContrasenaPort,
    @Inject(CONTRASENAS_COMUNES_PORT) private readonly comunes: ContrasenasComunesPort,
    @Inject(RELOJ_PORT) private readonly reloj: RelojPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async execute(comando: CambiarContrasenaComando, actor: Actor): Promise<void> {
    const usuario = await this.usuarios.buscarPorId(comando.usuarioId);
    if (usuario === null) {
      throw new SesionInvalidaError();
    }
    // Bloqueada: ni se mira lo que escribió (así no se sigue probando desde una sesión abierta).
    if (usuario.estaBloqueado(this.reloj.ahora())) {
      throw new CuentaBloqueadaError();
    }
    if (!(await this.hasher.verificar(usuario.hashContrasena, comando.contrasenaActual))) {
      await this.registrarFallo(usuario.id, actor);
      throw new ContrasenaActualIncorrectaError();
    }

    // Todo lo que tarda (reglas, Argon2), antes de abrir la transacción.
    const disponibles = await empresasDisponibles(usuario.id, this.roles, this.empresas);
    const nueva = Contrasena.crear(comando.contrasenaNueva, {
      nombreUsuario: usuario.nombreUsuario.valor,
      nombresEmpresas: disponibles.map((empresa) => empresa.nombre),
      esComun: (texto) => this.comunes.esComun(texto),
    });
    if (await this.hasher.verificar(usuario.hashContrasena, nueva.valor)) {
      throw new ContrasenaDebilError(MENSAJE_CONTRASENA_REPETIDA);
    }
    const hash = await this.hasher.calcularHash(nueva);

    await this.unidad.ejecutar(async () => {
      const ahora = this.reloj.ahora();
      const actual = (await this.usuarios.buscarParaActualizar(usuario.id)) ?? usuario;
      // La actual fue correcta: los fallos anteriores vuelven a 0, como al entrar bien.
      await this.usuarios.guardar(actual.desbloquear().cambiarContrasena(hash, false), usuario.id);
      const sesionesCerradas = await this.sesiones.cerrarOtrasDelUsuario(
        usuario.id,
        comando.sesionId,
        MotivoCierreSesion.CAMBIO_CONTRASENA,
        ahora,
      );
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.cambiar_contrasena',
          entidad: 'usuario',
          entidadId: usuario.id,
          entidadNombre: usuario.nombreUsuario.valor,
          antes: { debeCambiarContrasena: actual.debeCambiarContrasena },
          despues: { debeCambiarContrasena: false, sesionesCerradas },
        },
        actor,
      );
    });
  }

  /**
   * Suma el fallo (al quinto, bloquea) y lo deja en la bitácora. Se confirma en su propia
   * transacción **antes** de responder el error: si no, el error la desharía.
   */
  private async registrarFallo(usuarioId: string, actor: Actor): Promise<void> {
    await this.unidad.ejecutar(async () => {
      const ahora = this.reloj.ahora();
      const actual: Usuario | null = await this.usuarios.buscarParaActualizar(usuarioId);
      if (actual === null) {
        return;
      }
      const { usuario: conFallo, seBloqueo } = actual.registrarFallo(ahora);
      await this.usuarios.guardar(conFallo, usuarioId);
      await this.auditoria.registrar(
        {
          accion: 'auth.usuario.cambiar_contrasena_fallido',
          entidad: 'usuario',
          entidadId: usuarioId,
          entidadNombre: actual.nombreUsuario.valor,
          despues: { intentosFallidos: conFallo.intentosFallidos },
        },
        actor,
      );
      if (seBloqueo) {
        await this.auditoria.registrar(
          {
            accion: 'auth.usuario.bloquear',
            entidad: 'usuario',
            entidadId: usuarioId,
            entidadNombre: actual.nombreUsuario.valor,
            despues: { bloqueadoHasta: conFallo.bloqueadoHasta },
          },
          actor,
        );
      }
    });
  }
}

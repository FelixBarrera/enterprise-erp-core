import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  UNIDAD_DE_TRABAJO_PORT,
  type UnidadDeTrabajoPort,
} from '../../../../shared/application/ports/unidad-de-trabajo.port.js';
import {
  REGISTRAR_AUDITORIA_PORT,
  type RegistrarAuditoriaPort,
} from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import {
  CREAR_EMPRESA_PORT,
  type CrearEmpresaPort,
} from '../../../empresas/application/ports/in/crear-empresa.port.js';
import type { Usuario } from '../../domain/entities/usuario.entity.js';
import { UsuarioInactivoError, UsuarioNoEncontradoError } from '../../domain/errors/auth.errors.js';
import { Contrasena } from '../../domain/value-objects/contrasena.vo.js';
import { NombreCompleto } from '../../domain/value-objects/nombre-completo.vo.js';
import { NOMBRE_ROL_ADMINISTRADOR, NombreRol } from '../../domain/value-objects/nombre-rol.vo.js';
import { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import type {
  CrearEmpresaConAdministradorComando,
  CrearEmpresaConAdministradorPort,
  ResultadoCrearEmpresaConAdministrador,
  UsuarioResumen,
} from '../ports/in/crear-empresa-con-administrador.port.js';
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
  USUARIOS_REPOSITORY_PORT,
  type UsuariosRepositoryPort,
} from '../ports/out/usuarios.repository.port.js';

export const DESCRIPCION_ROL_ADMINISTRADOR = 'Todos los permisos de la empresa';

/** Lo que se prepara antes de abrir la transacción (validar y calcular el hash tarda). */
type AdministradorPreparado =
  | { readonly tipo: 'existente'; readonly nombreUsuario: NombreUsuario }
  | {
      readonly tipo: 'nuevo';
      readonly nombreUsuario: NombreUsuario;
      readonly nombreCompleto: NombreCompleto;
      readonly hash: string;
    };

@Injectable()
export class CrearEmpresaConAdministradorUseCase implements CrearEmpresaConAdministradorPort {
  constructor(
    @Inject(USUARIOS_REPOSITORY_PORT) private readonly usuarios: UsuariosRepositoryPort,
    @Inject(ROLES_REPOSITORY_PORT) private readonly roles: RolesRepositoryPort,
    @Inject(HASHER_CONTRASENA_PORT) private readonly hasher: HasherContrasenaPort,
    @Inject(CONTRASENAS_COMUNES_PORT) private readonly comunes: ContrasenasComunesPort,
    @Inject(CREAR_EMPRESA_PORT) private readonly crearEmpresa: CrearEmpresaPort,
    @Inject(UNIDAD_DE_TRABAJO_PORT) private readonly unidad: UnidadDeTrabajoPort,
    @Inject(REGISTRAR_AUDITORIA_PORT) private readonly auditoria: RegistrarAuditoriaPort,
  ) {}

  async buscarUsuario(nombreUsuario: string): Promise<UsuarioResumen | null> {
    const usuario = await this.usuarios.buscarPorNombreUsuario(NombreUsuario.crear(nombreUsuario));
    return usuario === null ? null : resumen(usuario);
  }

  async crear(
    comando: CrearEmpresaConAdministradorComando,
    actor: Actor,
  ): Promise<ResultadoCrearEmpresaConAdministrador> {
    // Todo lo que se puede revisar sin la base, antes de abrir la transacción.
    const administrador = await this.preparar(comando);
    const nombreRol = NombreRol.crear(NOMBRE_ROL_ADMINISTRADOR);

    return this.unidad.ejecutar(async () => {
      // Primero el usuario: si no existe o está desactivado, no se crea nada.
      const usuarioNuevo = administrador.tipo === 'nuevo';
      const usuario =
        administrador.tipo === 'existente'
          ? await this.buscarActivo(administrador.nombreUsuario)
          : await this.usuarios.crear(
              {
                nombreUsuario: administrador.nombreUsuario,
                nombreCompleto: administrador.nombreCompleto,
                hashContrasena: administrador.hash,
                debeCambiarContrasena: true,
              },
              actor.usuarioId,
            );

      const empresa = await this.crearEmpresa.crear({ nombre: comando.nombreEmpresa }, actor);
      // Los eventos van en la empresa nueva: así los ve su administrador en la bitácora.
      const enLaEmpresa: Actor = { ...actor, empresaId: empresa.id };

      const rol = await this.roles.crear(
        {
          empresaId: empresa.id,
          nombre: nombreRol,
          descripcion: DESCRIPCION_ROL_ADMINISTRADOR,
          esAdministrador: true,
        },
        actor.usuarioId,
      );
      await this.auditoria.registrar(
        {
          accion: 'auth.rol.crear',
          entidad: 'rol',
          entidadId: rol.id,
          entidadNombre: rol.nombre.valor,
          despues: {
            nombre: rol.nombre.valor,
            descripcion: rol.descripcion,
            esAdministrador: true,
            activo: true,
          },
        },
        enLaEmpresa,
      );

      await this.roles.asignar(usuario.id, rol, actor.usuarioId);
      await this.auditoria.registrar(
        usuarioNuevo
          ? {
              accion: 'auth.usuario.crear',
              entidad: 'usuario',
              entidadId: usuario.id,
              entidadNombre: usuario.nombreUsuario.valor,
              despues: {
                nombreUsuario: usuario.nombreUsuario.valor,
                nombreCompleto: usuario.nombreCompleto.valor,
                // La bitácora oculta todo campo que contenga "contrasena": este dato no es secreto.
                claveTemporal: true,
                activo: true,
                roles: [rol.nombre.valor],
              },
            }
          : {
              accion: 'auth.usuario.dar_acceso',
              entidad: 'usuario',
              entidadId: usuario.id,
              entidadNombre: usuario.nombreUsuario.valor,
              despues: { roles: [rol.nombre.valor] },
            },
        enLaEmpresa,
      );

      return { empresa, administrador: resumen(usuario), usuarioNuevo };
    });
  }

  private async preparar(
    comando: CrearEmpresaConAdministradorComando,
  ): Promise<AdministradorPreparado> {
    const datos = comando.administrador;
    const nombreUsuario = NombreUsuario.crear(datos.nombreUsuario);
    if (datos.tipo === 'existente') {
      return { tipo: 'existente', nombreUsuario };
    }
    const nombreCompleto = NombreCompleto.crear(datos.nombreCompleto);
    const contrasena = Contrasena.crear(datos.contrasena, {
      nombreUsuario: nombreUsuario.valor,
      nombresEmpresas: [comando.nombreEmpresa],
      esComun: (texto) => this.comunes.esComun(texto),
    });
    const hash = await this.hasher.calcularHash(contrasena);
    return { tipo: 'nuevo', nombreUsuario, nombreCompleto, hash };
  }

  private async buscarActivo(nombre: NombreUsuario): Promise<Usuario> {
    const usuario = await this.usuarios.buscarPorNombreUsuario(nombre);
    if (usuario === null) {
      throw new UsuarioNoEncontradoError(nombre.valor);
    }
    if (!usuario.activo) {
      throw new UsuarioInactivoError(nombre.valor);
    }
    return usuario;
  }
}

function resumen(usuario: Usuario): UsuarioResumen {
  return {
    id: usuario.id,
    nombreUsuario: usuario.nombreUsuario.valor,
    nombreCompleto: usuario.nombreCompleto.valor,
    activo: usuario.activo,
  };
}

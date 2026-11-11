import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../../../shared/application/actor.js';
import type { Pagina } from '../../../../../../shared/application/pagina.js';
import {
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  MENSAJE_SIN_PERMISO,
} from '../../../../../../shared/domain/errors/mensajes-acceso.js';
import { RequierePermiso } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import {
  SesionActual,
  type SesionDePeticion,
  UsuarioActual,
} from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import { ID_PIPE } from '../../../../../../shared/infrastructure/http/id.pipe.js';
import { pedidoPagina } from '../../../../../../shared/infrastructure/http/paginacion-query.dto.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
  ApiRespuestaPagina,
} from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import {
  ACCESOS_USUARIOS_PORT,
  type AccesoQuitado,
  type AccesosUsuariosPort,
  type UsuarioCreado,
} from '../../../../application/ports/in/accesos-usuarios.port.js';
import {
  ACCIONES_USUARIOS_PORT,
  type AccionesUsuariosPort,
  type ContrasenaTemporalDada,
  type SesionesCerradas,
} from '../../../../application/ports/in/acciones-usuarios.port.js';
import {
  ADMINISTRAR_USUARIOS_PORT,
  type AdministrarUsuariosPort,
} from '../../../../application/ports/in/administrar-usuarios.port.js';
import {
  CONSULTAR_USUARIOS_PORT,
  type ConsultarUsuariosPort,
  type RolAsignableVista,
  type UsuarioResumenVista,
  type UsuarioVista,
} from '../../../../application/ports/in/consultar-usuarios.port.js';
import { EditarUsuarioDto } from './dtos/editar-usuario.dto.js';
import { ListarUsuariosQueryDto } from './dtos/listar-usuarios-query.dto.js';
import {
  CrearUsuarioDto,
  FijarRolesUsuarioDto,
  MAXIMO_ROLES,
} from './dtos/roles-de-usuario.dto.js';
import {
  AccesoQuitadoRespuestaDto,
  RolAsignableRespuestaDto,
  SesionesCerradasRespuestaDto,
  UsuarioCreadoRespuestaDto,
  UsuarioResumenRespuestaDto,
  UsuarioRespuestaDto,
} from './dtos/usuario-respuesta.dto.js';

const ID_INVALIDO = 'El id no es válido';
const NO_EXISTE = 'El usuario no existe';
/** Los 403 de `@RequierePermiso()` más el de AUTH-D12 (Swagger guarda uno por estado). */
const PROHIBIDO_OTRA_EMPRESA = [
  MENSAJE_SIN_PERMISO,
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  'Este usuario también trabaja en otra empresa: solo puede hacer este cambio quien lo administre en todas',
] as const;
/** Los 403 de `@RequierePermiso()` más los de AUTH-D11. */
const PROHIBIDO_ESCALADA = [
  MENSAJE_SIN_PERMISO,
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  'No puede cambiar sus propios roles',
  'No puede dar permisos que usted no tiene',
  'Solo un administrador puede dar o quitar el rol Administrador',
] as const;
const ROLES_MAL = [
  'Los roles son obligatorios y deben ser una lista',
  'Cada rol debe ser un id válido',
  `No se pueden mandar más de ${MAXIMO_ROLES} roles`,
  'Alguno de los roles elegidos no existe',
] as const;
/** Los 403 de `@RequierePermiso()`, AUTH-D12 y la escalada sobre la persona (6.7e). */
const PROHIBIDO_SOBRE_PERSONA = [
  ...PROHIBIDO_OTRA_EMPRESA,
  'Solo un administrador puede hacer este cambio a otro administrador',
  'No puede hacer este cambio a alguien que tiene permisos que usted no tiene',
] as const;
const ROL_DESACTIVADO = 'No se puede dar un rol desactivado';
const ULTIMO_ADMINISTRADOR = 'La empresa no puede quedarse sin administrador';

/**
 * Los usuarios de la empresa activa (docs/modulos/auth-usuarios.md, sección 6): los que tienen
 * algún rol en ella. Uno sin roles aquí responde 404, igual que uno que no existe.
 */
@ApiTags('Usuarios')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(CONSULTAR_USUARIOS_PORT) private readonly consultar: ConsultarUsuariosPort,
    @Inject(ADMINISTRAR_USUARIOS_PORT) private readonly administrar: AdministrarUsuariosPort,
    @Inject(ACCESOS_USUARIOS_PORT) private readonly accesos: AccesosUsuariosPort,
    @Inject(ACCIONES_USUARIOS_PORT) private readonly acciones: AccionesUsuariosPort,
  ) {}

  // ─── GET /api/v1/usuarios — Lista de usuarios ───
  @Get()
  @RequierePermiso('auth.usuario.ver')
  @ApiOperation({
    summary: 'Lista de usuarios',
    description: 'Los usuarios de la empresa activa, por nombre, con sus roles en ella.',
  })
  @ApiRespuestaPagina(UsuarioResumenRespuestaDto, 'Usuarios')
  @ApiRespuestaError(
    400,
    'El texto a buscar no puede pasar de 150 caracteres',
    'El filtro activo debe ser true o false',
    'El rol a filtrar no es válido',
    'La página empieza en 1',
  )
  async listar(
    @Query() query: ListarUsuariosQueryDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<Pagina<UsuarioResumenVista>>> {
    const pagina = await this.consultar.listar(
      { texto: query.texto, activo: query.activo, rolId: query.rolId },
      pedidoPagina(query),
      actor,
    );
    return ok(pagina, 'Usuarios');
  }

  // ─── GET /api/v1/usuarios/roles-asignables — Roles que se pueden dar ───
  // Ruta fija: va antes de `:id`.
  @Get('roles-asignables')
  @RequierePermiso('auth.usuario.ver')
  @ApiOperation({
    summary: 'Roles que se pueden dar',
    description:
      'Los roles activos de la empresa activa, para elegir los de un usuario (al crearlo, al ' +
      'darle acceso o en su ficha): el Administrador primero, luego por nombre, cada uno con ' +
      '`sePuedeDar` según quien consulta. Pide «Ver usuarios» (no «Ver roles»): quien asigna ' +
      'roles ya ve los de cada usuario.',
  })
  @ApiRespuestaOk([RolAsignableRespuestaDto], 'Roles que se pueden dar')
  async rolesAsignables(@UsuarioActual() actor: Actor): Promise<RespuestaApi<RolAsignableVista[]>> {
    return ok(await this.consultar.rolesAsignables(actor), 'Roles que se pueden dar');
  }

  // ─── POST /api/v1/usuarios — Crear un usuario ───
  @Post()
  @RequierePermiso('auth.usuario.crear')
  // La respuesta trae la contraseña temporal: que nadie la guarde en una caché.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Crear un usuario',
    description:
      'Con sus roles en la empresa activa (al menos uno) y una contraseña temporal generada por ' +
      'el sistema, que se muestra esta sola vez y debe cambiar al entrar. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioCreadoRespuestaDto, 'Usuario creado', 201)
  @ApiRespuestaError(
    400,
    'El nombre de usuario es obligatorio y debe ser texto',
    'El nombre de usuario es obligatorio',
    'El nombre de usuario debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo',
    'El nombre completo es obligatorio y debe ser texto',
    'El nombre completo es obligatorio',
    'El nombre completo no puede pasar de 150 caracteres',
    'Debe elegir al menos un rol',
    ...ROLES_MAL,
  )
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(
    409,
    'Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro',
  )
  @ApiRespuestaError(422, ROL_DESACTIVADO)
  async crear(
    @Body() dto: CrearUsuarioDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioCreado>> {
    const creado = await this.accesos.crear(
      { nombreUsuario: dto.nombreUsuario, nombreCompleto: dto.nombreCompleto, roles: dto.roles },
      actor,
    );
    return ok(creado, 'Usuario creado');
  }

  // ─── GET /api/v1/usuarios/:id — Ficha de un usuario ───
  @Get(':id')
  @RequierePermiso('auth.usuario.ver')
  @ApiOperation({
    summary: 'Ficha de un usuario',
    description:
      'Sus datos, sus roles y sus sesiones abiertas en la empresa activa, el bloqueo y el último ' +
      'ingreso.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Datos del usuario')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(404, NO_EXISTE)
  async ver(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    return ok(await this.consultar.ver(id, actor), 'Datos del usuario');
  }

  // ─── PATCH /api/v1/usuarios/:id — Editar un usuario ───
  @Patch(':id')
  @RequierePermiso('auth.usuario.editar')
  @ApiOperation({
    summary: 'Editar un usuario',
    description:
      'El nombre completo; sin el campo queda igual. Es de la persona: si también trabaja en ' +
      'otra empresa, hace falta este permiso en todas. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Usuario actualizado')
  @ApiRespuestaError(
    400,
    ID_INVALIDO,
    'El nombre completo es obligatorio',
    'El nombre completo es obligatorio y debe ser texto',
    'El nombre completo no puede pasar de 150 caracteres',
  )
  @ApiRespuestaError(403, ...PROHIBIDO_OTRA_EMPRESA)
  @ApiRespuestaError(404, NO_EXISTE)
  async editar(
    @Param('id', ID_PIPE) id: string,
    @Body() dto: EditarUsuarioDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    const usuario = await this.administrar.editar(
      id,
      { nombreCompleto: dto.nombreCompleto },
      actor,
    );
    return ok(usuario, 'Usuario actualizado');
  }

  // ─── PUT /api/v1/usuarios/:id/roles — Fijar los roles de un usuario ───
  @Put(':id/roles')
  @RequierePermiso('auth.usuario.asignar_roles')
  @ApiOperation({
    summary: 'Fijar los roles de un usuario',
    description:
      'Lo deja con exactamente esos roles en la empresa activa (al menos uno; para quitarle ' +
      'todos, «Quitar acceso»). Nadie cambia los suyos. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Roles actualizados')
  @ApiRespuestaError(
    400,
    ID_INVALIDO,
    'Para quitarle todos los roles use Quitar acceso',
    ...ROLES_MAL,
  )
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, ROL_DESACTIVADO, ULTIMO_ADMINISTRADOR)
  async fijarRoles(
    @Param('id', ID_PIPE) id: string,
    @Body() dto: FijarRolesUsuarioDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    return ok(await this.accesos.fijarRoles(id, dto.roles, actor), 'Roles actualizados');
  }

  // ─── POST /api/v1/usuarios/:id/quitar-acceso — Quitar el acceso a la empresa ───
  @Post(':id/quitar-acceso')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.asignar_roles')
  @ApiOperation({
    summary: 'Quitar el acceso a la empresa',
    description:
      'Le quita todos sus roles en la empresa activa y cierra sus sesiones en ella. Sus otras ' +
      'empresas no cambian. Nadie se quita el acceso a sí mismo. Queda en la bitácora.',
  })
  @ApiRespuestaOk(AccesoQuitadoRespuestaDto, 'Acceso quitado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, ULTIMO_ADMINISTRADOR)
  async quitarAcceso(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<AccesoQuitado>> {
    return ok(await this.accesos.quitarAcceso(id, actor), 'Acceso quitado');
  }

  // ─── POST /api/v1/usuarios/:id/contrasena-temporal — Dar una contraseña temporal ───
  @Post(':id/contrasena-temporal')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.restablecer')
  // La respuesta trae la contraseña temporal: que nadie la guarde en una caché.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Dar una contraseña temporal',
    description:
      'Generada por el sistema; se muestra esta sola vez y debe cambiarla al entrar. Quita el ' +
      'bloqueo y cierra todas sus sesiones. Es de la persona: hace falta este permiso en todas ' +
      'sus empresas, y no se da a alguien con permisos que usted no tiene. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioCreadoRespuestaDto, 'Contraseña temporal generada')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(
    403,
    ...PROHIBIDO_SOBRE_PERSONA,
    'Para cambiar su propia contraseña use «Cambiar contraseña»',
  )
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, 'El usuario «ana.perez» está desactivado')
  async darContrasenaTemporal(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<ContrasenaTemporalDada>> {
    return ok(await this.acciones.darContrasenaTemporal(id, actor), 'Contraseña temporal generada');
  }

  // ─── POST /api/v1/usuarios/:id/desbloquear — Desbloquear un usuario ───
  @Post(':id/desbloquear')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.restablecer')
  @ApiOperation({
    summary: 'Desbloquear un usuario',
    description:
      'Quita el bloqueo por intentos fallidos (en todas sus empresas). Si no estaba bloqueado, ' +
      'no cambia nada. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Usuario desbloqueado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(404, NO_EXISTE)
  async desbloquear(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    return ok(await this.acciones.desbloquear(id, actor), 'Usuario desbloqueado');
  }

  // ─── POST /api/v1/usuarios/:id/cerrar-sesiones — Cerrar sus sesiones ───
  @Post(':id/cerrar-sesiones')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.restablecer')
  @ApiOperation({
    summary: 'Cerrar sus sesiones',
    description:
      'Cierra todas sus sesiones, en todas sus empresas (equipo perdido o robado). Sobre uno ' +
      'mismo, la sesión actual sigue abierta. Queda en la bitácora.',
  })
  @ApiRespuestaOk(SesionesCerradasRespuestaDto, 'Sesiones cerradas')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(404, NO_EXISTE)
  async cerrarSesiones(
    @Param('id', ID_PIPE) id: string,
    @SesionActual() sesion: SesionDePeticion,
  ): Promise<RespuestaApi<SesionesCerradas>> {
    return ok(
      await this.acciones.cerrarSesiones(id, sesion.sesionId, sesion.actor),
      'Sesiones cerradas',
    );
  }

  // ─── POST /api/v1/usuarios/:id/desactivar — Desactivar un usuario ───
  @Post(':id/desactivar')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.desactivar')
  @ApiOperation({
    summary: 'Desactivar un usuario',
    description:
      'No entra en ninguna empresa y se cierran sus sesiones; sus roles y su historia quedan. ' +
      'Es de la persona: hace falta este permiso en todas sus empresas. Nadie se desactiva a sí ' +
      'mismo, y cada empresa tiene que quedar con un administrador. Queda en la bitácora.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Usuario desactivado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(
    403,
    ...PROHIBIDO_OTRA_EMPRESA,
    'Solo un administrador puede hacer este cambio a otro administrador',
    'No puede desactivar su propio usuario',
  )
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, ULTIMO_ADMINISTRADOR)
  async desactivar(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    return ok(await this.acciones.desactivar(id, actor), 'Usuario desactivado');
  }

  // ─── POST /api/v1/usuarios/:id/reactivar — Reactivar un usuario ───
  @Post(':id/reactivar')
  @HttpCode(200)
  @RequierePermiso('auth.usuario.desactivar')
  @ApiOperation({
    summary: 'Reactivar un usuario',
    description:
      'Vuelve a entrar con los roles que tenía. Es de la persona: hace falta este permiso en ' +
      'todas sus empresas, y no se reactiva a alguien con permisos que usted no tiene. Queda en ' +
      'la bitácora.',
  })
  @ApiRespuestaOk(UsuarioRespuestaDto, 'Usuario reactivado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(403, ...PROHIBIDO_SOBRE_PERSONA)
  @ApiRespuestaError(404, NO_EXISTE)
  async reactivar(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<UsuarioVista>> {
    return ok(await this.acciones.reactivar(id, actor), 'Usuario reactivado');
  }
}

import {
  Body,
  Controller,
  Get,
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
import { UsuarioActual } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
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
  ADMINISTRAR_ROLES_PORT,
  type AdministrarRolesPort,
} from '../../../../application/ports/in/administrar-roles.port.js';
import {
  CONSULTAR_ROLES_PORT,
  type ConsultarRolesPort,
  type RolResumenVista,
  type RolVista,
} from '../../../../application/ports/in/consultar-roles.port.js';
import { CrearRolDto } from './dtos/crear-rol.dto.js';
import { EditarRolDto } from './dtos/editar-rol.dto.js';
import { FijarPermisosRolDto } from './dtos/fijar-permisos-rol.dto.js';
import { ListarRolesQueryDto } from './dtos/listar-roles-query.dto.js';
import { RolResumenRespuestaDto, RolRespuestaDto } from './dtos/rol-respuesta.dto.js';

const ID_INVALIDO = 'El id no es válido';
const NO_EXISTE = 'El rol no existe';
const DUPLICADO = 'Ya existe un rol con ese nombre';
const ADMINISTRADOR_FIJO = 'El rol Administrador no se puede cambiar';
const PERMISO_NO_EXISTE = 'El permiso «x.y.z» no existe';
/** Los 403 de `@RequierePermiso()` más el de la escalada (Swagger guarda uno por estado). */
const PROHIBIDO_ESCALADA = [
  MENSAJE_SIN_PERMISO,
  MENSAJE_DEBE_CAMBIAR_CONTRASENA,
  'No puede dar permisos que usted no tiene',
] as const;

/**
 * Los roles de la empresa activa (docs/modulos/auth-usuarios.md, sección 6). Nunca los de otra:
 * un id de otra empresa responde 404, igual que uno que no existe.
 */
@ApiTags('Roles y permisos')
@Controller('roles')
export class RolesController {
  constructor(
    @Inject(CONSULTAR_ROLES_PORT) private readonly consultar: ConsultarRolesPort,
    @Inject(ADMINISTRAR_ROLES_PORT) private readonly administrar: AdministrarRolesPort,
  ) {}

  // ─── GET /api/v1/roles — Lista de roles ───
  @Get()
  @RequierePermiso('auth.rol.ver')
  @ApiOperation({
    summary: 'Lista de roles',
    description: 'Los roles de la empresa activa: el Administrador primero, luego por nombre.',
  })
  @ApiRespuestaPagina(RolResumenRespuestaDto, 'Roles')
  @ApiRespuestaError(
    400,
    'El texto a buscar no puede pasar de 80 caracteres',
    'El filtro activo debe ser true o false',
    'La página empieza en 1',
  )
  async listar(
    @Query() query: ListarRolesQueryDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<Pagina<RolResumenVista>>> {
    const pagina = await this.consultar.listar(
      { texto: query.texto, activo: query.activo },
      pedidoPagina(query),
      actor,
    );
    return ok(pagina, 'Roles');
  }

  // ─── POST /api/v1/roles — Crear un rol ───
  @Post()
  @RequierePermiso('auth.rol.crear')
  @ApiOperation({
    summary: 'Crear un rol',
    description:
      'Con sus permisos, si se mandan. Quien no es administrador solo da los que tiene. Queda en ' +
      'la bitácora.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Rol creado', 201)
  @ApiRespuestaError(
    400,
    'El nombre del rol es obligatorio',
    'El nombre del rol es obligatorio y debe ser texto',
    'El nombre del rol no puede pasar de 80 caracteres',
    'La descripción del rol no puede pasar de 250 caracteres',
    'Los permisos deben ser una lista',
    PERMISO_NO_EXISTE,
  )
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(409, DUPLICADO)
  async crear(
    @Body() dto: CrearRolDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    const rol = await this.administrar.crear(
      { nombre: dto.nombre, descripcion: dto.descripcion, permisos: dto.permisos },
      actor,
    );
    return ok(rol, 'Rol creado');
  }

  // ─── GET /api/v1/roles/:id — Ficha de un rol ───
  @Get(':id')
  @RequierePermiso('auth.rol.ver')
  @ApiOperation({
    summary: 'Ficha de un rol',
    description: 'Sus datos, sus permisos y cuántos usuarios activos lo tienen.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Datos del rol')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(404, NO_EXISTE)
  async ver(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    return ok(await this.consultar.ver(id, actor), 'Datos del rol');
  }

  // ─── PATCH /api/v1/roles/:id — Editar un rol ───
  @Patch(':id')
  @RequierePermiso('auth.rol.editar')
  @ApiOperation({
    summary: 'Editar un rol',
    description:
      'Nombre y descripción; un campo que no viene queda igual y `descripcion: null` la quita. ' +
      'Queda en la bitácora.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Rol actualizado')
  @ApiRespuestaError(
    400,
    ID_INVALIDO,
    'El nombre del rol es obligatorio',
    'El nombre del rol es obligatorio y debe ser texto',
    'El nombre del rol no puede pasar de 80 caracteres',
    'La descripción del rol no puede pasar de 250 caracteres',
  )
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(409, DUPLICADO)
  @ApiRespuestaError(422, ADMINISTRADOR_FIJO)
  async editar(
    @Param('id', ID_PIPE) id: string,
    @Body() dto: EditarRolDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    const rol = await this.administrar.editar(
      id,
      { nombre: dto.nombre, descripcion: dto.descripcion },
      actor,
    );
    return ok(rol, 'Rol actualizado');
  }

  // ─── PUT /api/v1/roles/:id/permisos — Fijar los permisos de un rol ───
  @Put(':id/permisos')
  @RequierePermiso('auth.rol.editar')
  @ApiOperation({
    summary: 'Fijar los permisos de un rol',
    description:
      'Queda con exactamente los que se mandan. Quien no es administrador solo agrega los que ' +
      'tiene. Queda en la bitácora.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Permisos del rol actualizados')
  @ApiRespuestaError(
    400,
    ID_INVALIDO,
    'Los permisos son obligatorios y deben ser una lista',
    'Cada permiso debe ser texto',
    PERMISO_NO_EXISTE,
  )
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, ADMINISTRADOR_FIJO)
  async fijarPermisos(
    @Param('id', ID_PIPE) id: string,
    @Body() dto: FijarPermisosRolDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    const rol = await this.administrar.fijarPermisos(id, dto.permisos, actor);
    return ok(rol, 'Permisos del rol actualizados');
  }

  // ─── POST /api/v1/roles/:id/desactivar — Desactivar un rol ───
  @Post(':id/desactivar')
  @HttpCode(200)
  @RequierePermiso('auth.rol.desactivar')
  @ApiOperation({
    summary: 'Desactivar un rol',
    description:
      'Deja de dar sus permisos; quienes lo tienen lo conservan por si se reactiva. Queda en la ' +
      'bitácora.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Rol desactivado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(422, ADMINISTRADOR_FIJO)
  async desactivar(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    return ok(await this.administrar.desactivar(id, actor), 'Rol desactivado');
  }

  // ─── POST /api/v1/roles/:id/reactivar — Reactivar un rol ───
  @Post(':id/reactivar')
  @HttpCode(200)
  @RequierePermiso('auth.rol.desactivar')
  @ApiOperation({
    summary: 'Reactivar un rol',
    description:
      'Vuelve a dar sus permisos a quienes lo tienen: quien no es administrador tiene que tenerlos ' +
      'todos. Queda en la bitácora.',
  })
  @ApiRespuestaOk(RolRespuestaDto, 'Rol reactivado')
  @ApiRespuestaError(400, ID_INVALIDO)
  @ApiRespuestaError(403, ...PROHIBIDO_ESCALADA)
  @ApiRespuestaError(404, NO_EXISTE)
  @ApiRespuestaError(409, DUPLICADO)
  @ApiRespuestaError(422, ADMINISTRADOR_FIJO)
  async reactivar(
    @Param('id', ID_PIPE) id: string,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<RolVista>> {
    return ok(await this.administrar.reactivar(id, actor), 'Rol reactivado');
  }
}

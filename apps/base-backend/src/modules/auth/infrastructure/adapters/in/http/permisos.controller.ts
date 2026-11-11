import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequierePermiso } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import { ApiRespuestaOk } from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import {
  CONSULTAR_CATALOGO_PERMISOS_PORT,
  type ConsultarCatalogoPermisosPort,
  type GrupoPermisosVista,
} from '../../../../application/ports/in/consultar-catalogo-permisos.port.js';
import { GrupoPermisosRespuestaDto } from './dtos/grupo-permisos-respuesta.dto.js';

@ApiTags('Roles y permisos')
@Controller('permisos')
export class PermisosController {
  constructor(
    @Inject(CONSULTAR_CATALOGO_PERMISOS_PORT)
    private readonly consultarCatalogo: ConsultarCatalogoPermisosPort,
  ) {}

  // ─── GET /api/v1/permisos — Catálogo de permisos ───
  // Sin paginar: es corto y la pantalla de roles lo muestra entero, con «N de M» por grupo.
  @Get()
  @RequierePermiso('auth.rol.ver')
  @ApiOperation({
    summary: 'Catálogo de permisos',
    description:
      'Los permisos vigentes, agrupados por módulo, para armar un rol. Es el mismo en todas las ' +
      'empresas.',
  })
  @ApiRespuestaOk([GrupoPermisosRespuestaDto], 'Catálogo de permisos')
  listar(): RespuestaApi<GrupoPermisosVista[]> {
    return ok(this.consultarCatalogo.execute(), 'Catálogo de permisos');
  }
}

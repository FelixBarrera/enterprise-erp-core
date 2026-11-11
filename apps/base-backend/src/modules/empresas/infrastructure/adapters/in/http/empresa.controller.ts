import { Body, Controller, Get, Inject, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Actor } from '../../../../../../shared/application/actor.js';
import {
  RequierePermiso,
  SoloSesion,
} from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { UsuarioActual } from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
} from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import type { EmpresaConsultada } from '../../../../application/ports/in/consultar-empresas.port.js';
import {
  EMPRESA_ACTIVA_PORT,
  type EmpresaActivaPort,
} from '../../../../application/ports/in/empresa-activa.port.js';
import { EditarEmpresaDto } from './dtos/editar-empresa.dto.js';
import { EmpresaRespuestaDto } from './dtos/empresa-respuesta.dto.js';

type EmpresaRespuesta = Pick<EmpresaConsultada, 'id' | 'nombre'>;

/** Lo que se muestra: la empresa activa siempre está activa, así que `activo` no se manda. */
const aRespuesta = ({ id, nombre }: EmpresaConsultada): EmpresaRespuesta => ({ id, nombre });

/**
 * Siempre la empresa activa de la sesión: la ruta no lleva id. Crear y desactivar van solo por
 * comando (EMP-D2).
 */
@ApiTags('Empresa')
@Controller('empresa')
export class EmpresaController {
  constructor(@Inject(EMPRESA_ACTIVA_PORT) private readonly empresaActiva: EmpresaActivaPort) {}

  // ─── GET /api/v1/empresa — Datos de la empresa activa ───
  // La ve todo usuario de la empresa.
  @Get()
  @SoloSesion()
  @ApiOperation({ summary: 'Datos de la empresa activa' })
  @ApiRespuestaOk(EmpresaRespuestaDto, 'Datos de la empresa')
  @ApiRespuestaError(404, 'La empresa no existe')
  async ver(@UsuarioActual() actor: Actor): Promise<RespuestaApi<EmpresaRespuesta>> {
    return ok(aRespuesta(await this.empresaActiva.ver(actor)), 'Datos de la empresa');
  }

  // ─── PATCH /api/v1/empresa — Editar la empresa activa ───
  @Patch()
  @RequierePermiso('empresas.empresa.editar')
  @ApiOperation({
    summary: 'Editar la empresa activa',
    description: 'Cambia el nombre. Sin el campo, queda igual. Queda en la bitácora.',
  })
  @ApiRespuestaOk(EmpresaRespuestaDto, 'Empresa actualizada')
  @ApiRespuestaError(
    400,
    'El nombre de la empresa es obligatorio',
    'El nombre de la empresa es obligatorio y debe ser texto',
    'El nombre de la empresa no puede pasar de 150 caracteres',
  )
  @ApiRespuestaError(404, 'La empresa no existe')
  @ApiRespuestaError(409, 'Ya existe una empresa con ese nombre')
  @ApiRespuestaError(422, 'La empresa está desactivada')
  async editar(
    @Body() dto: EditarEmpresaDto,
    @UsuarioActual() actor: Actor,
  ): Promise<RespuestaApi<EmpresaRespuesta>> {
    const empresa = await this.empresaActiva.editar({ nombre: dto.nombre }, actor);
    return ok(aRespuesta(empresa), 'Empresa actualizada');
  }
}

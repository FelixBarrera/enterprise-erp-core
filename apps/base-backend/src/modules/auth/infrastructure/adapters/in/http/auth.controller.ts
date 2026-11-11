import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  Publico,
  SoloSesion,
} from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import { LimiteLogin } from '../../../../../../shared/infrastructure/limite/limite.decorators.js';
import {
  SesionActual,
  type SesionDePeticion,
} from '../../../../../../shared/infrastructure/http/acceso/sesion-de-peticion.js';
import {
  ok,
  type RespuestaApi,
} from '../../../../../../shared/infrastructure/http/respuesta-api.js';
import {
  ApiRespuestaError,
  ApiRespuestaOk,
  ApiRespuestaOkSinDatos,
} from '../../../../../../shared/infrastructure/http/swagger.decorators.js';
import {
  CAMBIAR_CONTRASENA_PORT,
  type CambiarContrasenaPort,
} from '../../../../application/ports/in/cambiar-contrasena.port.js';
import {
  CAMBIAR_EMPRESA_PORT,
  type CambiarEmpresaPort,
} from '../../../../application/ports/in/cambiar-empresa.port.js';
import {
  CERRAR_SESION_PORT,
  type CerrarSesionPort,
} from '../../../../application/ports/in/cerrar-sesion.port.js';
import {
  CONSULTAR_SESION_PORT,
  type ConsultarSesionPort,
  type SesionVista,
} from '../../../../application/ports/in/consultar-sesion.port.js';
import {
  INICIAR_SESION_PORT,
  type IniciarSesionPort,
  type TokensSesion,
} from '../../../../application/ports/in/iniciar-sesion.port.js';
import {
  RENOVAR_SESION_PORT,
  type RenovarSesionPort,
} from '../../../../application/ports/in/renovar-sesion.port.js';
import { MENSAJE_SESION_TERMINO } from '../../../../../../shared/domain/errors/mensajes-acceso.js';
import { SesionInvalidaError } from '../../../../domain/errors/auth.errors.js';
import {
  borrarCookieRefresco,
  leerCookieRefresco,
  ponerCookieRefresco,
} from './cookie-refresco.js';
import { CambiarContrasenaDto } from './dtos/cambiar-contrasena.dto.js';
import { CambiarEmpresaDto } from './dtos/cambiar-empresa.dto.js';
import { IniciarSesionDto } from './dtos/iniciar-sesion.dto.js';
import { SesionIniciadaRespuestaDto } from './dtos/sesion-iniciada-respuesta.dto.js';
import { SesionRespuestaDto } from './dtos/sesion-respuesta.dto.js';
import { OrigenPermitidoGuard } from './origen-permitido.guard.js';

const MENSAJE_CREDENCIALES =
  'Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador.';
const MENSAJE_ORIGEN = 'La petición no viene de un sitio permitido';

@ApiTags('Sesión')
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(INICIAR_SESION_PORT) private readonly iniciarSesion: IniciarSesionPort,
    @Inject(RENOVAR_SESION_PORT) private readonly renovarSesion: RenovarSesionPort,
    @Inject(CONSULTAR_SESION_PORT) private readonly consultarSesion: ConsultarSesionPort,
    @Inject(CERRAR_SESION_PORT) private readonly cerrarSesion: CerrarSesionPort,
    @Inject(CAMBIAR_EMPRESA_PORT) private readonly cambiarEmpresa: CambiarEmpresaPort,
    @Inject(CAMBIAR_CONTRASENA_PORT) private readonly cambiarContrasena: CambiarContrasenaPort,
  ) {}

  // ─── POST /api/v1/auth/login — Iniciar sesión ───
  // Público. El access token va en el cuerpo; el refresh token, solo en la cookie.
  @Post('login')
  @HttpCode(200)
  @Publico()
  @LimiteLogin()
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Con el nombre de usuario y la contraseña. Responde el access token (15 minutos) y deja ' +
      'el refresh token en la cookie `token_refresco` (httpOnly). Entra a la última empresa ' +
      'usada. Un fallo responde siempre el mismo mensaje; al quinto seguido, la cuenta se ' +
      'bloquea 15 minutos. Además, cada IP tiene un límite de intentos por minuto ' +
      '(`LIMITE_LOGIN_POR_MINUTO`, 10 por defecto).',
  })
  @ApiRespuestaOk(SesionIniciadaRespuestaDto, 'Sesión iniciada')
  @ApiRespuestaError(
    400,
    'El nombre de usuario es obligatorio y debe ser texto',
    'La contraseña es obligatoria y debe ser texto',
    'El nombre de usuario es demasiado largo',
    'La contraseña es demasiado larga',
  )
  @ApiRespuestaError(401, MENSAJE_CREDENCIALES)
  @ApiRespuestaError(
    403,
    'Su usuario no tiene acceso a ninguna empresa. Pida ayuda al administrador.',
  )
  async login(
    @Body() dto: IniciarSesionDto,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaApi<SesionIniciadaRespuestaDto>> {
    const tokens = await this.iniciarSesion.execute(dto);
    return ok(entregar(respuesta, tokens), 'Sesión iniciada');
  }

  // ─── POST /api/v1/auth/refresh — Renovar la sesión ───
  // Público, pero con la cookie y el Origin de un sitio permitido (CSRF).
  @Post('refresh')
  @HttpCode(200)
  @Publico()
  @UseGuards(OrigenPermitidoGuard)
  @ApiOperation({
    summary: 'Renovar la sesión',
    description:
      'Con la cookie `token_refresco`: un access token nuevo y otra cookie (el refresh token ' +
      'cambia en cada uso). Un refresh token ya usado, fuera de los 60 s de gracia, cierra ' +
      'todas las sesiones del usuario. Si la sesión terminó, borra la cookie.',
  })
  @ApiRespuestaOk(SesionIniciadaRespuestaDto, 'Sesión renovada')
  @ApiRespuestaError(401, MENSAJE_SESION_TERMINO)
  @ApiRespuestaError(403, MENSAJE_ORIGEN)
  async refresh(
    @Req() peticion: Request,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaApi<SesionIniciadaRespuestaDto>> {
    try {
      const tokens = await this.renovarSesion.execute(leerCookieRefresco(peticion));
      return ok(entregar(respuesta, tokens), 'Sesión renovada');
    } catch (error) {
      if (error instanceof SesionInvalidaError) {
        // La cookie ya no sirve: que el navegador no la siga mandando.
        borrarCookieRefresco(respuesta);
      }
      throw error;
    }
  }

  // ─── POST /api/v1/auth/logout — Salir ───
  // Cierra esta sesión y borra la cookie. Con el access token y el Origin (usa la cookie).
  @Post('logout')
  @HttpCode(200)
  @SoloSesion({ conContrasenaTemporal: true })
  @UseGuards(OrigenPermitidoGuard)
  @ApiOperation({
    summary: 'Salir',
    description:
      'Cierra la sesión de este navegador (las de otros equipos siguen abiertas) y borra la ' +
      'cookie `token_refresco`. Se puede usar también con una contraseña temporal.',
  })
  @ApiRespuestaOkSinDatos('Sesión cerrada')
  @ApiRespuestaError(403, MENSAJE_ORIGEN)
  async logout(
    @SesionActual() sesion: SesionDePeticion,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<RespuestaApi<null>> {
    await this.cerrarSesion.execute(sesion.sesionId, sesion.actor);
    borrarCookieRefresco(respuesta);
    return ok(null, 'Sesión cerrada');
  }

  // ─── GET /api/v1/auth/sesion — Datos de la sesión ───
  // Lo primero que pide la pantalla al entrar (y al recargar, después del refresh).
  @Get('sesion')
  @SoloSesion({ conContrasenaTemporal: true })
  @ApiOperation({
    summary: 'Datos de la sesión',
    description:
      'El usuario, la empresa activa, todas sus empresas, si es administrador, sus permisos ' +
      'en la empresa activa (vacía hasta el paso 6.6), la zona horaria del negocio y cuándo ' +
      'vence la sesión. Se puede usar también con una contraseña temporal.',
  })
  @ApiRespuestaOk(SesionRespuestaDto, 'Sesión')
  async sesion(@SesionActual() sesion: SesionDePeticion): Promise<RespuestaApi<SesionVista>> {
    const vista = await this.consultarSesion.execute({
      sesionId: sesion.sesionId,
      usuarioId: sesion.actor.usuarioId,
      empresaId: sesion.actor.empresaId,
      esAdministrador: sesion.esAdministrador,
    });
    return ok(vista, 'Sesión');
  }

  // ─── POST /api/v1/auth/empresa — Cambiar de empresa ───
  // La sesión pasa a otra de sus empresas; el mismo access token sigue sirviendo (AUTH-D5).
  @Post('empresa')
  @HttpCode(200)
  @SoloSesion()
  @ApiOperation({
    summary: 'Cambiar de empresa',
    description:
      'Pasa la sesión a otra empresa en la que el usuario tiene un rol activo. Queda como la ' +
      'última usada (la próxima vez entra a ella) y responde los datos de la sesión ya con la ' +
      'empresa nueva (sus permisos son los de esa empresa). Si ya estaba en ella, no cambia nada.',
  })
  @ApiRespuestaOk(SesionRespuestaDto, 'Empresa cambiada')
  @ApiRespuestaError(
    400,
    'El id de la empresa es obligatorio y debe ser texto',
    'El id de la empresa no es válido',
  )
  @ApiRespuestaError(403, 'No tiene acceso a esa empresa')
  async empresa(
    @Body() dto: CambiarEmpresaDto,
    @SesionActual() sesion: SesionDePeticion,
  ): Promise<RespuestaApi<SesionVista>> {
    const vista = await this.cambiarEmpresa.execute(
      { sesionId: sesion.sesionId, usuarioId: sesion.actor.usuarioId, empresaId: dto.empresaId },
      sesion.actor,
    );
    return ok(vista, 'Empresa cambiada');
  }

  // ─── POST /api/v1/auth/cambiar-contrasena — Cambiar la contraseña ───
  // La propia, pidiendo la actual. También con una contraseña temporal (AUTH-D14).
  @Post('cambiar-contrasena')
  @HttpCode(200)
  @SoloSesion({ conContrasenaTemporal: true })
  @ApiOperation({
    summary: 'Cambiar la contraseña',
    description:
      'Pide la actual (o la temporal) y la nueva. Una actual incorrecta cuenta como intento ' +
      'fallido: al quinto, la cuenta se bloquea 15 minutos. Cierra las sesiones abiertas en ' +
      'otros equipos; esta sigue abierta. Con una contraseña temporal, es lo primero que hay ' +
      'que hacer.',
  })
  @ApiRespuestaOkSinDatos('Contraseña cambiada')
  @ApiRespuestaError(
    400,
    'La contraseña actual es obligatoria y debe ser texto',
    'La contraseña nueva es obligatoria y debe ser texto',
    'La contraseña actual no es correcta',
    'La contraseña debe tener al menos 8 caracteres',
    'La contraseña es demasiado común',
    'La contraseña nueva debe ser distinta de la actual',
  )
  @ApiRespuestaError(
    403,
    'Demasiados intentos fallidos. Espere 15 minutos o pida ayuda al administrador.',
  )
  async contrasena(
    @Body() dto: CambiarContrasenaDto,
    @SesionActual() sesion: SesionDePeticion,
  ): Promise<RespuestaApi<null>> {
    await this.cambiarContrasena.execute(
      {
        sesionId: sesion.sesionId,
        usuarioId: sesion.actor.usuarioId,
        contrasenaActual: dto.contrasenaActual,
        contrasenaNueva: dto.contrasenaNueva,
      },
      sesion.actor,
    );
    return ok(null, 'Contraseña cambiada');
  }
}

/** Pone la cookie y deja en el cuerpo solo lo que puede ver JavaScript. */
function entregar(respuesta: Response, tokens: TokensSesion): SesionIniciadaRespuestaDto {
  ponerCookieRefresco(respuesta, tokens.tokenRefresco, tokens.sesionVenceEn);
  return {
    tokenAcceso: tokens.tokenAcceso,
    expiraEnSegundos: tokens.expiraEnSegundos,
    debeCambiarContrasena: tokens.debeCambiarContrasena,
  };
}

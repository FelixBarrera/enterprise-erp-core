import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { EnvironmentVariables } from '../../shared/infrastructure/config/environment-variables.js';
import { LimitePeticionesGuard } from '../../shared/infrastructure/limite/limite-peticiones.guard.js';
import { CATALOGO_PERMISOS } from '../../catalogo-permisos.js';
import { EmpresasModule } from '../empresas/empresas.module.js';
import { ACCESOS_USUARIOS_PORT } from './application/ports/in/accesos-usuarios.port.js';
import { ACCIONES_USUARIOS_PORT } from './application/ports/in/acciones-usuarios.port.js';
import { ADMINISTRAR_ROLES_PORT } from './application/ports/in/administrar-roles.port.js';
import { ADMINISTRAR_USUARIOS_PORT } from './application/ports/in/administrar-usuarios.port.js';
import { AUTENTICAR_PETICION_PORT } from './application/ports/in/autenticar-peticion.port.js';
import { CAMBIAR_CONTRASENA_PORT } from './application/ports/in/cambiar-contrasena.port.js';
import { CAMBIAR_EMPRESA_PORT } from './application/ports/in/cambiar-empresa.port.js';
import { CERRAR_SESION_PORT } from './application/ports/in/cerrar-sesion.port.js';
import { CONSULTAR_CATALOGO_PERMISOS_PORT } from './application/ports/in/consultar-catalogo-permisos.port.js';
import { CONSULTAR_ROLES_PORT } from './application/ports/in/consultar-roles.port.js';
import { CONSULTAR_SESION_PORT } from './application/ports/in/consultar-sesion.port.js';
import { CONSULTAR_USUARIOS_PORT } from './application/ports/in/consultar-usuarios.port.js';
import { CREAR_EMPRESA_CON_ADMINISTRADOR_PORT } from './application/ports/in/crear-empresa-con-administrador.port.js';
import { CREAR_INSTALACION_INICIAL_PORT } from './application/ports/in/crear-instalacion-inicial.port.js';
import { DESACTIVAR_EMPRESA_CON_SESIONES_PORT } from './application/ports/in/desactivar-empresa-con-sesiones.port.js';
import { INICIAR_SESION_PORT } from './application/ports/in/iniciar-sesion.port.js';
import { RENOVAR_SESION_PORT } from './application/ports/in/renovar-sesion.port.js';
import { SINCRONIZAR_PERMISOS_PORT } from './application/ports/in/sincronizar-permisos.port.js';
import { ACCESOS_SESION_PORT } from './application/ports/out/accesos-sesion.repository.port.js';
import { CATALOGO_PERMISOS_PORT } from './application/ports/out/catalogo-permisos.port.js';
import { CONTRASENAS_COMUNES_PORT } from './application/ports/out/contrasenas-comunes.port.js';
import { GENERADOR_TOKENS_PORT } from './application/ports/out/generador-tokens.port.js';
import { GENERADOR_CONTRASENA_TEMPORAL_PORT } from './application/ports/out/generador-contrasena-temporal.port.js';
import { HASHER_CONTRASENA_PORT } from './application/ports/out/hasher-contrasena.port.js';
import {
  OPCIONES_SESION,
  type OpcionesSesion,
} from './application/ports/out/opciones-sesion.port.js';
import { PERMISOS_REPOSITORY_PORT } from './application/ports/out/permisos.repository.port.js';
import { ROLES_REPOSITORY_PORT } from './application/ports/out/roles.repository.port.js';
import { SESIONES_REPOSITORY_PORT } from './application/ports/out/sesiones.repository.port.js';
import { USUARIOS_REPOSITORY_PORT } from './application/ports/out/usuarios.repository.port.js';
import { AccesosUsuariosUseCase } from './application/use-cases/accesos-usuarios.use-case.js';
import { AccionesUsuariosUseCase } from './application/use-cases/acciones-usuarios.use-case.js';
import { AdministrarRolesUseCase } from './application/use-cases/administrar-roles.use-case.js';
import { AdministrarUsuariosUseCase } from './application/use-cases/administrar-usuarios.use-case.js';
import { AutenticarPeticionUseCase } from './application/use-cases/autenticar-peticion.use-case.js';
import { CambiarContrasenaUseCase } from './application/use-cases/cambiar-contrasena.use-case.js';
import { CambiarEmpresaUseCase } from './application/use-cases/cambiar-empresa.use-case.js';
import { CerrarSesionUseCase } from './application/use-cases/cerrar-sesion.use-case.js';
import { ConsultarCatalogoPermisosUseCase } from './application/use-cases/consultar-catalogo-permisos.use-case.js';
import { ConsultarRolesUseCase } from './application/use-cases/consultar-roles.use-case.js';
import { ConsultarSesionUseCase } from './application/use-cases/consultar-sesion.use-case.js';
import { ConsultarUsuariosUseCase } from './application/use-cases/consultar-usuarios.use-case.js';
import { CrearEmpresaConAdministradorUseCase } from './application/use-cases/crear-empresa-con-administrador.use-case.js';
import { CrearInstalacionInicialUseCase } from './application/use-cases/crear-instalacion-inicial.use-case.js';
import { DesactivarEmpresaConSesionesUseCase } from './application/use-cases/desactivar-empresa-con-sesiones.use-case.js';
import { IniciarSesionUseCase } from './application/use-cases/iniciar-sesion.use-case.js';
import { RenovarSesionUseCase } from './application/use-cases/renovar-sesion.use-case.js';
import { SincronizarPermisosUseCase } from './application/use-cases/sincronizar-permisos.use-case.js';
import { SincronizarPermisosAlArrancar } from './infrastructure/adapters/in/arranque/sincronizar-permisos.arranque.js';
import { AuthController } from './infrastructure/adapters/in/http/auth.controller.js';
import { PermisosController } from './infrastructure/adapters/in/http/permisos.controller.js';
import { OrigenPermitidoGuard } from './infrastructure/adapters/in/http/origen-permitido.guard.js';
import { RolesController } from './infrastructure/adapters/in/http/roles.controller.js';
import { RevisorReglasAcceso } from './infrastructure/adapters/in/http/revisor-reglas-acceso.js';
import { SesionGuard } from './infrastructure/adapters/in/http/sesion.guard.js';
import { UsuariosController } from './infrastructure/adapters/in/http/usuarios.controller.js';
import { HasherArgon2 } from './infrastructure/adapters/out/argon2/hasher-argon2.js';
import { ContrasenasComunesArchivo } from './infrastructure/adapters/out/contrasenas/contrasenas-comunes.archivo.js';
import { GeneradorContrasenaTemporalCrypto } from './infrastructure/adapters/out/contrasenas/generador-contrasena-temporal.crypto.js';
import {
  ALGORITMO_JWT,
  CLAVE_FIRMA_REFRESCO,
  derivarClaveRefresco,
  GeneradorTokensJwt,
} from './infrastructure/adapters/out/jwt/generador-tokens.jwt.js';
import { AccesosSesionPrismaRepository } from './infrastructure/adapters/out/prisma/accesos-sesion.prisma.repository.js';
import { PermisosPrismaRepository } from './infrastructure/adapters/out/prisma/permisos.prisma.repository.js';
import { RolesPrismaRepository } from './infrastructure/adapters/out/prisma/roles.prisma.repository.js';
import { SesionesPrismaRepository } from './infrastructure/adapters/out/prisma/sesiones.prisma.repository.js';
import { UsuariosPrismaRepository } from './infrastructure/adapters/out/prisma/usuarios.prisma.repository.js';

type Config = ConfigService<EnvironmentVariables, true>;

/**
 * Login, usuarios, roles y permisos (docs/modulos/auth-usuarios.md). Dueño del esquema
 * `seguridad` (AUTH-D1). Hoy: usuarios, roles, contraseñas (6.4b), los casos de uso de los
 * comandos `admin:*` (6.4c, `src/comandos/`), las sesiones con sus tokens (6.5a), login y refresh
 * (6.5b), el guard global con su revisión al arrancar, logout y `GET /auth/sesion` (6.5c),
 * cambiar de empresa, cambiar la contraseña y cerrar las sesiones al desactivar una empresa
 * (6.5d), registra el límite de peticiones después del guard de sesión (6.5e) y copia el catálogo
 * de permisos a la base al arrancar (6.6a); el guard revisa `@RequierePermiso()` y, al
 * arrancar, que cada permiso pedido esté en el catálogo (6.6b); `GET /permisos` (6.7a); los roles
 * de la empresa activa: lista, ficha, crear, editar, permisos, desactivar y reactivar (6.7b); los
 * usuarios de la empresa activa: lista, ficha y editar el nombre (6.7c); crear (con contraseña
 * temporal), dar acceso, fijar roles y quitar acceso (6.7d).
 */
@Module({
  imports: [
    EmpresasModule,
    // Para que RevisorReglasAcceso recorra todos los controllers al arrancar (AUTH-D9).
    DiscoveryModule,
    // El access token: HS256 con JWT_SECRETO, y solo HS256 al verificar.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: Config) => ({
        secret: config.get('JWT_SECRETO', { infer: true }),
        signOptions: { algorithm: ALGORITMO_JWT },
        verifyOptions: { algorithms: [ALGORITMO_JWT] },
      }),
    }),
  ],
  controllers: [AuthController, PermisosController, RolesController, UsuariosController],
  providers: [
    { provide: INICIAR_SESION_PORT, useClass: IniciarSesionUseCase },
    { provide: RENOVAR_SESION_PORT, useClass: RenovarSesionUseCase },
    { provide: AUTENTICAR_PETICION_PORT, useClass: AutenticarPeticionUseCase },
    { provide: CONSULTAR_SESION_PORT, useClass: ConsultarSesionUseCase },
    { provide: CERRAR_SESION_PORT, useClass: CerrarSesionUseCase },
    { provide: CAMBIAR_EMPRESA_PORT, useClass: CambiarEmpresaUseCase },
    { provide: CAMBIAR_CONTRASENA_PORT, useClass: CambiarContrasenaUseCase },
    // El catálogo de permisos del código, copiado a la base al arrancar (6.6a).
    { provide: CATALOGO_PERMISOS_PORT, useValue: CATALOGO_PERMISOS },
    { provide: SINCRONIZAR_PERMISOS_PORT, useClass: SincronizarPermisosUseCase },
    { provide: CONSULTAR_CATALOGO_PERMISOS_PORT, useClass: ConsultarCatalogoPermisosUseCase },
    SincronizarPermisosAlArrancar,
    // Roles de la empresa activa (6.7b).
    { provide: CONSULTAR_ROLES_PORT, useClass: ConsultarRolesUseCase },
    { provide: ADMINISTRAR_ROLES_PORT, useClass: AdministrarRolesUseCase },
    // Usuarios de la empresa activa (6.7c).
    { provide: CONSULTAR_USUARIOS_PORT, useClass: ConsultarUsuariosUseCase },
    { provide: ADMINISTRAR_USUARIOS_PORT, useClass: AdministrarUsuariosUseCase },
    // Crear, dar acceso, fijar roles y quitar acceso (6.7d).
    { provide: ACCESOS_USUARIOS_PORT, useClass: AccesosUsuariosUseCase },
    { provide: ACCIONES_USUARIOS_PORT, useClass: AccionesUsuariosUseCase },
    // Toda ruta exige sesión salvo @Publico() (AUTH-D9). Después, el límite de peticiones
    // (AUTH-D17), que necesita saber si hay sesión: NestJS corre los guards globales en el orden
    // en que se registran, así que estos dos van juntos y en este orden.
    { provide: APP_GUARD, useClass: SesionGuard },
    { provide: APP_GUARD, useClass: LimitePeticionesGuard },
    RevisorReglasAcceso,
    {
      provide: CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
      useClass: CrearEmpresaConAdministradorUseCase,
    },
    { provide: CREAR_INSTALACION_INICIAL_PORT, useClass: CrearInstalacionInicialUseCase },
    {
      provide: DESACTIVAR_EMPRESA_CON_SESIONES_PORT,
      useClass: DesactivarEmpresaConSesionesUseCase,
    },
    { provide: USUARIOS_REPOSITORY_PORT, useClass: UsuariosPrismaRepository },
    { provide: ROLES_REPOSITORY_PORT, useClass: RolesPrismaRepository },
    { provide: PERMISOS_REPOSITORY_PORT, useClass: PermisosPrismaRepository },
    { provide: HASHER_CONTRASENA_PORT, useClass: HasherArgon2 },
    { provide: CONTRASENAS_COMUNES_PORT, useClass: ContrasenasComunesArchivo },
    { provide: GENERADOR_CONTRASENA_TEMPORAL_PORT, useClass: GeneradorContrasenaTemporalCrypto },
    { provide: SESIONES_REPOSITORY_PORT, useClass: SesionesPrismaRepository },
    { provide: ACCESOS_SESION_PORT, useClass: AccesosSesionPrismaRepository },
    { provide: GENERADOR_TOKENS_PORT, useClass: GeneradorTokensJwt },
    // La firma del refresh token (SEG-05): una clave derivada de JWT_SECRETO.
    {
      provide: CLAVE_FIRMA_REFRESCO,
      inject: [ConfigService],
      useFactory: (config: Config): Buffer =>
        derivarClaveRefresco(config.get('JWT_SECRETO', { infer: true })),
    },
    {
      provide: OPCIONES_SESION,
      inject: [ConfigService],
      useFactory: (config: Config): OpcionesSesion => ({
        duracionMaximaHoras: config.get('SESION_DURACION_MAXIMA_HORAS', { infer: true }),
        inactividadMinutos: config.get('SESION_INACTIVIDAD_MINUTOS', { infer: true }),
      }),
    },
    OrigenPermitidoGuard,
  ],
  exports: [
    CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
    CREAR_INSTALACION_INICIAL_PORT,
    DESACTIVAR_EMPRESA_CON_SESIONES_PORT,
  ],
})
export class AuthModule {}

import type { Provider } from '@angular/core';
import { ADMINISTRAR_ROLES_PORT } from './application/ports/in/administrar-roles.port';
import { ADMINISTRAR_USUARIOS_PORT } from './application/ports/in/administrar-usuarios.port';
import { CONSULTAR_ROLES_PORT } from './application/ports/in/consultar-roles.port';
import { CONSULTAR_USUARIOS_PORT } from './application/ports/in/consultar-usuarios.port';
import { ROLES_REMOTOS_PORT } from './application/ports/out/roles-remotos.port';
import { USUARIOS_REMOTOS_PORT } from './application/ports/out/usuarios-remotos.port';
import { AdministrarRolesUseCase } from './application/use-cases/administrar-roles.use-case';
import { AdministrarUsuariosUseCase } from './application/use-cases/administrar-usuarios.use-case';
import { ConsultarRolesUseCase } from './application/use-cases/consultar-roles.use-case';
import { ConsultarUsuariosUseCase } from './application/use-cases/consultar-usuarios.use-case';
import { RolesApi } from './infrastructure/adapters/out/http/roles.api';
import { RolesRemotosHttpAdapter } from './infrastructure/adapters/out/http/roles-remotos.http.adapter';
import { UsuariosApi } from './infrastructure/adapters/out/http/usuarios.api';
import { UsuariosRemotosHttpAdapter } from './infrastructure/adapters/out/http/usuarios-remotos.http.adapter';

/**
 * Las pantallas de administración de `auth` (roles y usuarios). A diferencia de
 * `AUTH_PROVIDERS` (la sesión, desde el arranque), van en su ruta lazy: no pesan al entrar.
 */
export const ADMINISTRACION_PROVIDERS: Provider[] = [
  RolesApi,
  { provide: ROLES_REMOTOS_PORT, useClass: RolesRemotosHttpAdapter },
  { provide: CONSULTAR_ROLES_PORT, useClass: ConsultarRolesUseCase },
  { provide: ADMINISTRAR_ROLES_PORT, useClass: AdministrarRolesUseCase },
  UsuariosApi,
  { provide: USUARIOS_REMOTOS_PORT, useClass: UsuariosRemotosHttpAdapter },
  { provide: CONSULTAR_USUARIOS_PORT, useClass: ConsultarUsuariosUseCase },
  { provide: ADMINISTRAR_USUARIOS_PORT, useClass: AdministrarUsuariosUseCase },
];

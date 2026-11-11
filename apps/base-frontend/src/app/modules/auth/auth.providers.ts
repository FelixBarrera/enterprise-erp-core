import { computed, inject, type Provider } from '@angular/core';
import { ZONA_NEGOCIO_POR_DEFECTO } from '../../shared/domain/fechas';
import { ZONA_NEGOCIO } from '../../shared/infrastructure/fechas/zona-negocio';
import { USUARIO_CABECERA } from '../../shared/infrastructure/layout/usuario-cabecera';
import { PERMISOS_SESION } from '../../shared/infrastructure/permisos/permisos-sesion';
import { CAMBIAR_CONTRASENA_PORT } from './application/ports/in/cambiar-contrasena.port';
import { CAMBIAR_EMPRESA_PORT } from './application/ports/in/cambiar-empresa.port';
import { CERRAR_SESION_PORT } from './application/ports/in/cerrar-sesion.port';
import { INICIAR_SESION_PORT } from './application/ports/in/iniciar-sesion.port';
import { RENOVAR_SESION_PORT } from './application/ports/in/renovar-sesion.port';
import { DATOS_LOCALES_PORT } from './application/ports/out/datos-locales.port';
import { SESION_REMOTA_PORT } from './application/ports/out/sesion-remota.port';
import { CambiarContrasenaUseCase } from './application/use-cases/cambiar-contrasena.use-case';
import { CambiarEmpresaUseCase } from './application/use-cases/cambiar-empresa.use-case';
import { CerrarSesionUseCase } from './application/use-cases/cerrar-sesion.use-case';
import { IniciarSesionUseCase } from './application/use-cases/iniciar-sesion.use-case';
import { RenovarSesionUseCase } from './application/use-cases/renovar-sesion.use-case';
import { AuthApi } from './infrastructure/adapters/out/http/auth.api';
import { SesionRemotaHttpAdapter } from './infrastructure/adapters/out/http/sesion-remota.http.adapter';
import { DatosLocalesCacheAdapter } from './infrastructure/adapters/out/navegador/datos-locales.cache.adapter';
import { SesionFacade } from './infrastructure/presentation/facades/sesion.facade';
import { AuthStore } from './infrastructure/presentation/stores/auth.store';

/**
 * La sesión se usa desde el arranque (interceptor y guard): va en `app.config.ts`, a diferencia de
 * los demás módulos. Nada de Material aquí (presupuesto del paquete inicial).
 */
export const AUTH_PROVIDERS: Provider[] = [
  AuthApi,
  { provide: SESION_REMOTA_PORT, useClass: SesionRemotaHttpAdapter },
  { provide: DATOS_LOCALES_PORT, useClass: DatosLocalesCacheAdapter },
  { provide: INICIAR_SESION_PORT, useClass: IniciarSesionUseCase },
  { provide: RENOVAR_SESION_PORT, useClass: RenovarSesionUseCase },
  { provide: CERRAR_SESION_PORT, useClass: CerrarSesionUseCase },
  { provide: CAMBIAR_CONTRASENA_PORT, useClass: CambiarContrasenaUseCase },
  { provide: CAMBIAR_EMPRESA_PORT, useClass: CambiarEmpresaUseCase },
  { provide: USUARIO_CABECERA, useExisting: SesionFacade },
  { provide: PERMISOS_SESION, useExisting: SesionFacade },
  // Las fechas de las pantallas, en la zona que manda el backend con la sesión.
  {
    provide: ZONA_NEGOCIO,
    useFactory: () => {
      const store = inject(AuthStore);
      return computed(() => store.sesion()?.zonaNegocio ?? ZONA_NEGOCIO_POR_DEFECTO);
    },
  },
];

import {
  DESACTIVAR_EMPRESA_CON_SESIONES_PORT,
  type DesactivarEmpresaConSesionesPort,
} from '../modules/auth/application/ports/in/desactivar-empresa-con-sesiones.port.js';
import { ComandoDesactivarEmpresa } from '../modules/auth/infrastructure/adapters/in/cli/comando-desactivar-empresa.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../modules/empresas/application/ports/in/consultar-empresas.port.js';
import { ejecutarComando } from './ejecutar-comando.js';

/** `pnpm admin:desactivar-empresa` (ver `ComandoDesactivarEmpresa`). */
await ejecutarComando(
  (app, terminal) =>
    new ComandoDesactivarEmpresa(
      app.get<ConsultarEmpresasPort>(CONSULTAR_EMPRESAS_PORT),
      app.get<DesactivarEmpresaConSesionesPort>(DESACTIVAR_EMPRESA_CON_SESIONES_PORT),
      terminal,
    ),
);

import { ComandoRenombrarEmpresa } from '../modules/auth/infrastructure/adapters/in/cli/comando-renombrar-empresa.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../modules/empresas/application/ports/in/consultar-empresas.port.js';
import {
  RENOMBRAR_EMPRESA_PORT,
  type RenombrarEmpresaPort,
} from '../modules/empresas/application/ports/in/renombrar-empresa.port.js';
import { ejecutarComando } from './ejecutar-comando.js';

/** `pnpm admin:renombrar-empresa` (ver `ComandoRenombrarEmpresa`). */
await ejecutarComando(
  (app, terminal) =>
    new ComandoRenombrarEmpresa(
      app.get<ConsultarEmpresasPort>(CONSULTAR_EMPRESAS_PORT),
      app.get<RenombrarEmpresaPort>(RENOMBRAR_EMPRESA_PORT),
      terminal,
    ),
);

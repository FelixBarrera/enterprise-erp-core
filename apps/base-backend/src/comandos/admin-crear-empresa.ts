import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../modules/auth/application/ports/in/crear-empresa-con-administrador.port.js';
import { ComandoCrearEmpresa } from '../modules/auth/infrastructure/adapters/in/cli/comando-crear-empresa.js';
import { ejecutarComando } from './ejecutar-comando.js';

/** `pnpm admin:crear-empresa` (ver `ComandoCrearEmpresa`). */
await ejecutarComando(
  (app, terminal) =>
    new ComandoCrearEmpresa(
      app.get<CrearEmpresaConAdministradorPort>(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT),
      terminal,
    ),
);

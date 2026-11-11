import { Inject, Injectable } from '@nestjs/common';
import type { Actor } from '../../../../shared/application/actor.js';
import {
  CONSULTAR_EMPRESAS_PORT,
  type ConsultarEmpresasPort,
} from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import {
  CREAR_EMPRESA_CON_ADMINISTRADOR_PORT,
  type CrearEmpresaConAdministradorPort,
} from '../ports/in/crear-empresa-con-administrador.port.js';
import type {
  CrearInstalacionInicialComando,
  CrearInstalacionInicialPort,
  ResultadoInstalacionInicial,
} from '../ports/in/crear-instalacion-inicial.port.js';

@Injectable()
export class CrearInstalacionInicialUseCase implements CrearInstalacionInicialPort {
  constructor(
    @Inject(CONSULTAR_EMPRESAS_PORT) private readonly empresas: ConsultarEmpresasPort,
    @Inject(CREAR_EMPRESA_CON_ADMINISTRADOR_PORT)
    private readonly crearEmpresa: CrearEmpresaConAdministradorPort,
  ) {}

  async crear(
    comando: CrearInstalacionInicialComando,
    actor: Actor,
  ): Promise<ResultadoInstalacionInicial> {
    if (await this.empresas.hayAlguna()) {
      return { creada: false };
    }
    const resultado = await this.crearEmpresa.crear(
      {
        nombreEmpresa: comando.nombreEmpresa,
        administrador: {
          tipo: 'nuevo',
          nombreUsuario: comando.nombreUsuario,
          nombreCompleto: comando.nombreCompleto,
          contrasena: comando.contrasena,
        },
      },
      actor,
    );
    return { creada: true, ...resultado };
  }
}

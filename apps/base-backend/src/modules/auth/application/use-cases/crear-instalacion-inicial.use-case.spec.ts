import { actorDelSistema } from '../../../../shared/application/actor.js';
import type { ConsultarEmpresasPort } from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import { idDePrueba } from '../testing/auth-en-memoria.js';
import type {
  CrearEmpresaConAdministradorPort,
  ResultadoCrearEmpresaConAdministrador,
} from '../ports/in/crear-empresa-con-administrador.port.js';
import { CrearInstalacionInicialUseCase } from './crear-instalacion-inicial.use-case.js';

const COMANDO = {
  nombreEmpresa: 'Mi Empresa',
  nombreUsuario: 'admin',
  nombreCompleto: 'Administrador',
  contrasena: 'Margarita-Lunes-47',
};

const RESULTADO: ResultadoCrearEmpresaConAdministrador = {
  empresa: { id: idDePrueba(1), nombre: 'Mi Empresa', activo: true },
  administrador: {
    id: idDePrueba(101),
    nombreUsuario: 'admin',
    nombreCompleto: 'Administrador',
    activo: true,
  },
  usuarioNuevo: true,
};

describe('CrearInstalacionInicialUseCase', () => {
  const actor = actorDelSistema({ nombreUsuario: 'comando' });
  let hayEmpresas: boolean;
  let crear: ReturnType<typeof vi.fn<CrearEmpresaConAdministradorPort['crear']>>;
  let casoDeUso: CrearInstalacionInicialUseCase;

  beforeEach(() => {
    hayEmpresas = false;
    const empresas: ConsultarEmpresasPort = {
      buscarActiva: () => Promise.resolve(null),
      nombres: () => Promise.resolve([]),
      listarActivas: () => Promise.resolve([]),
      hayAlguna: () => Promise.resolve(hayEmpresas),
    };
    crear = vi.fn<CrearEmpresaConAdministradorPort['crear']>().mockResolvedValue(RESULTADO);
    casoDeUso = new CrearInstalacionInicialUseCase(empresas, {
      buscarUsuario: () => Promise.resolve(null),
      crear,
    });
  });

  it('sin empresas: crea la primera con un administrador nuevo', async () => {
    expect(await casoDeUso.crear(COMANDO, actor)).toEqual({ creada: true, ...RESULTADO });
    expect(crear).toHaveBeenCalledWith(
      {
        nombreEmpresa: 'Mi Empresa',
        administrador: {
          tipo: 'nuevo',
          nombreUsuario: 'admin',
          nombreCompleto: 'Administrador',
          contrasena: 'Margarita-Lunes-47',
        },
      },
      actor,
    );
  });

  it('si ya hay alguna empresa (activa o no): no hace nada', async () => {
    hayEmpresas = true;
    expect(await casoDeUso.crear(COMANDO, actor)).toEqual({ creada: false });
    expect(crear).not.toHaveBeenCalled();
  });
});

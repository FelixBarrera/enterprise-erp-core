import { DomainError } from '../../../../../../shared/domain/errors/domain-error.js';
import type {
  AdministradorDeEmpresa,
  CrearEmpresaConAdministradorPort,
  UsuarioResumen,
} from '../../../../application/ports/in/crear-empresa-con-administrador.port.js';
import { ContrasenaDebilError } from '../../../../domain/errors/auth.errors.js';
import {
  actorDelComando,
  type ComandoAdmin,
  correr,
  esSi,
  INTENTOS_POR_PREGUNTA,
  obligatorio,
  preguntarHasta,
  rechazo,
  type Revision,
  SALIDA_ERROR,
  SALIDA_OK,
  valido,
} from './comun.js';
import type { Terminal } from './terminal.js';

/**
 * `pnpm admin:crear-empresa`: otra empresa, con su rol Administrador dado a un usuario que ya
 * existe o a uno nuevo (EMP-D3). Pide todo por la terminal: la contraseña nunca va en la línea
 * de comandos, y no se ve al escribirla.
 */
export class ComandoCrearEmpresa implements ComandoAdmin {
  constructor(
    private readonly crearEmpresa: CrearEmpresaConAdministradorPort,
    private readonly terminal: Terminal,
  ) {}

  ejecutar(): Promise<number> {
    return correr(this.terminal, async () => {
      const t = this.terminal;
      t.escribir('Crear una empresa con su administrador (Ctrl+C cancela sin cambios).');
      const nombreEmpresa = await preguntarHasta(
        t,
        () => t.preguntar('Nombre de la empresa: '),
        obligatorio,
      );
      if (nombreEmpresa === null) return SALIDA_ERROR;

      const administrador = await this.pedirAdministrador();
      if (administrador === null) return SALIDA_ERROR;

      t.escribir('');
      t.escribir(`Empresa: ${nombreEmpresa.valor}`);
      t.escribir(
        administrador.tipo === 'nuevo'
          ? `Administrador nuevo: ${administrador.nombreUsuario} (${administrador.nombreCompleto})`
          : `Administrador: ${administrador.nombreUsuario} (ya existe)`,
      );
      if (!esSi(await t.preguntar('¿Crear la empresa? (s/n): '))) {
        t.escribir('No se hizo ningún cambio.');
        return SALIDA_ERROR;
      }
      return this.crear(nombreEmpresa.valor, administrador);
    });
  }

  /** Crea; si la contraseña no cumple las reglas, la pide otra vez (nada se guardó todavía). */
  private async crear(
    nombreEmpresa: string,
    administrador: AdministradorDeEmpresa,
  ): Promise<number> {
    let datos = administrador;
    for (let intento = 1; ; intento++) {
      try {
        const resultado = await this.crearEmpresa.crear(
          { nombreEmpresa, administrador: datos },
          actorDelComando('admin:crear-empresa'),
        );
        this.terminal.escribir(
          `Listo. Empresa «${resultado.empresa.nombre}» creada (id ${resultado.empresa.id}).`,
        );
        this.terminal.escribir(
          resultado.usuarioNuevo
            ? `${resultado.administrador.nombreUsuario} es su administrador. La primera vez que entre tendrá que cambiar la contraseña.`
            : `${resultado.administrador.nombreUsuario} es su administrador; entra con su contraseña de siempre.`,
        );
        return SALIDA_OK;
      } catch (error) {
        if (!(error instanceof ContrasenaDebilError) || datos.tipo !== 'nuevo') throw error;
        this.terminal.escribir(`  ${error.message}.`);
        if (intento >= INTENTOS_POR_PREGUNTA) {
          this.terminal.escribir('Demasiados intentos: no se hizo ningún cambio.');
          return SALIDA_ERROR;
        }
        const contrasena = await this.pedirContrasena();
        if (contrasena === null) return SALIDA_ERROR;
        datos = { ...datos, contrasena };
      }
    }
  }

  private async pedirAdministrador(): Promise<AdministradorDeEmpresa | null> {
    const t = this.terminal;
    const buscado = await preguntarHasta(
      t,
      () => t.preguntar('Usuario del administrador (uno que ya exista o uno nuevo): '),
      (respuesta) => this.buscarUsuario(respuesta),
    );
    if (buscado === null) return null;
    const { nombreUsuario, usuario } = buscado.valor;

    if (usuario !== null) {
      if (!usuario.activo) {
        t.escribir(
          `El usuario ${usuario.nombreUsuario} está desactivado: no puede ser administrador. No se hizo ningún cambio.`,
        );
        return null;
      }
      t.escribir(
        `Ya existe: ${usuario.nombreCompleto}. Recibirá el rol Administrador de la empresa nueva.`,
      );
      return { tipo: 'existente', nombreUsuario: usuario.nombreUsuario };
    }

    t.escribir('No existe: se creará un usuario nuevo.');
    const nombreCompleto = await preguntarHasta(
      t,
      () => t.preguntar('Nombre completo: '),
      obligatorio,
    );
    if (nombreCompleto === null) return null;
    const contrasena = await this.pedirContrasena();
    if (contrasena === null) return null;
    return { tipo: 'nuevo', nombreUsuario, nombreCompleto: nombreCompleto.valor, contrasena };
  }

  private async buscarUsuario(
    respuesta: string,
  ): Promise<Revision<{ nombreUsuario: string; usuario: UsuarioResumen | null }>> {
    try {
      const usuario = await this.crearEmpresa.buscarUsuario(respuesta);
      return valido({ nombreUsuario: respuesta.trim().toLowerCase(), usuario });
    } catch (error) {
      if (error instanceof DomainError) return rechazo(`${error.message}.`);
      throw error;
    }
  }

  /** Dos veces, sin que se vea. Es temporal: la persona la cambia al entrar. */
  private async pedirContrasena(): Promise<string | null> {
    const t = this.terminal;
    const contrasena = await preguntarHasta(
      t,
      () => t.preguntarOculto('Contraseña temporal (no se ve al escribir): '),
      async (primera) =>
        (await t.preguntarOculto('Repita la contraseña: ')) === primera
          ? valido(primera)
          : rechazo('Las contraseñas no coinciden.'),
    );
    return contrasena?.valor ?? null;
  }
}

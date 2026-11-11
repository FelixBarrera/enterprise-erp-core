import { NombreCompleto } from '../value-objects/nombre-completo.vo.js';
import { NombreUsuario } from '../value-objects/nombre-usuario.vo.js';

/** Fallos seguidos que bloquean la cuenta (docs/arquitectura-backend.md, sección 14). */
export const INTENTOS_PARA_BLOQUEO = 5;
export const MINUTOS_DE_BLOQUEO = 15;

/** Lo que se guarda de un usuario (`seguridad.usuarios`). */
export interface DatosUsuario {
  readonly id: string;
  readonly nombreUsuario: string;
  readonly nombreCompleto: string;
  /** Argon2id en formato PHC. Nunca sale de la API ni va a la bitácora. */
  readonly hashContrasena: string;
  readonly debeCambiarContrasena: boolean;
  readonly intentosFallidos: number;
  readonly bloqueadoHasta: Date | null;
  readonly ultimaEmpresaId: string | null;
  readonly ultimoIngresoEn: Date | null;
  readonly activo: boolean;
}

/**
 * Una persona que entra al sistema (AUTH-D2): una sola cuenta y una sola contraseña, con roles
 * por empresa. Maestro: se desactiva, nunca se borra. Inmutable: cada cambio devuelve otro
 * `Usuario`. La hora la pasa quien llama (`RELOJ_PORT`), nunca se lee aquí.
 */
export class Usuario {
  readonly id: string;
  readonly nombreUsuario: NombreUsuario;
  readonly nombreCompleto: NombreCompleto;
  readonly hashContrasena: string;
  readonly debeCambiarContrasena: boolean;
  readonly intentosFallidos: number;
  readonly bloqueadoHasta: Date | null;
  readonly ultimaEmpresaId: string | null;
  readonly ultimoIngresoEn: Date | null;
  readonly activo: boolean;

  private constructor(datos: DatosUsuario) {
    this.id = datos.id;
    this.nombreUsuario = NombreUsuario.crear(datos.nombreUsuario);
    this.nombreCompleto = NombreCompleto.crear(datos.nombreCompleto);
    this.hashContrasena = datos.hashContrasena;
    this.debeCambiarContrasena = datos.debeCambiarContrasena;
    this.intentosFallidos = datos.intentosFallidos;
    this.bloqueadoHasta = datos.bloqueadoHasta;
    this.ultimaEmpresaId = datos.ultimaEmpresaId;
    this.ultimoIngresoEn = datos.ultimoIngresoEn;
    this.activo = datos.activo;
  }

  /** Desde lo guardado (el repositorio). */
  static reconstruir(datos: DatosUsuario): Usuario {
    return new Usuario(datos);
  }

  /** Los datos tal como se guardan. */
  datos(): DatosUsuario {
    return {
      id: this.id,
      nombreUsuario: this.nombreUsuario.valor,
      nombreCompleto: this.nombreCompleto.valor,
      hashContrasena: this.hashContrasena,
      debeCambiarContrasena: this.debeCambiarContrasena,
      intentosFallidos: this.intentosFallidos,
      bloqueadoHasta: this.bloqueadoHasta,
      ultimaEmpresaId: this.ultimaEmpresaId,
      ultimoIngresoEn: this.ultimoIngresoEn,
      activo: this.activo,
    };
  }

  /** Bloqueado por intentos fallidos hasta un momento que todavía no llega. */
  estaBloqueado(ahora: Date): boolean {
    return this.bloqueadoHasta !== null && ahora.getTime() < this.bloqueadoHasta.getTime();
  }

  /**
   * Un intento fallido. Al quinto seguido, bloquea 15 minutos y la cuenta vuelve a 0 (al
   * terminar el bloqueo tiene otros cinco intentos). Mientras está bloqueado, otro fallo no
   * cambia nada: el bloqueo no se alarga. `seBloqueo` dice si este fallo bloqueó la cuenta
   * (para registrar `auth.usuario.bloquear`).
   */
  registrarFallo(ahora: Date): { usuario: Usuario; seBloqueo: boolean } {
    if (this.estaBloqueado(ahora)) {
      return { usuario: this, seBloqueo: false };
    }
    const intentos = this.intentosFallidos + 1;
    if (intentos >= INTENTOS_PARA_BLOQUEO) {
      const hasta = new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60_000);
      return {
        usuario: this.con({ intentosFallidos: 0, bloqueadoHasta: hasta }),
        seBloqueo: true,
      };
    }
    return { usuario: this.con({ intentosFallidos: intentos }), seBloqueo: false };
  }

  /** Entró bien: sin fallos ni bloqueo, con su último ingreso y la empresa en la que entró (AUTH-D4). */
  ingresoExitoso(ahora: Date, empresaId: string): Usuario {
    return this.con({
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoIngresoEn: ahora,
      ultimaEmpresaId: empresaId,
    });
  }

  /** Cambió de empresa: es la que se usa la próxima vez que entre (AUTH-D4). */
  usarEmpresa(empresaId: string): Usuario {
    return this.con({ ultimaEmpresaId: empresaId });
  }

  /** Nombre completo nuevo (`PATCH /usuarios/:id`, AUTH-D12). */
  cambiarNombre(nombreCompleto: NombreCompleto): Usuario {
    return this.con({ nombreCompleto: nombreCompleto.valor });
  }

  /** Quita el bloqueo por intentos (lo hace un administrador). */
  desbloquear(): Usuario {
    return this.con({ intentosFallidos: 0, bloqueadoHasta: null });
  }

  /**
   * Contraseña nueva (ya convertida en hash). `debeCambiar` es `true` si es temporal
   * (AUTH-D13): al entrar, lo primero es cambiarla.
   */
  cambiarContrasena(hash: string, debeCambiar: boolean): Usuario {
    return this.con({ hashContrasena: hash, debeCambiarContrasena: debeCambiar });
  }

  /** No entra en ninguna empresa. Sus datos y su historia quedan. */
  desactivar(): Usuario {
    return this.con({ activo: false });
  }

  reactivar(): Usuario {
    return this.con({ activo: true });
  }

  private con(cambios: Partial<DatosUsuario>): Usuario {
    return new Usuario({ ...this.datos(), ...cambios });
  }
}

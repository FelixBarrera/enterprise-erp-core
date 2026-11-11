import { Rol } from '../../domain/entities/rol.entity.js';
import {
  type DatosSesion,
  type MotivoCierreSesion,
  Sesion,
} from '../../domain/entities/sesion.entity.js';
import { type DatosUsuario, Usuario } from '../../domain/entities/usuario.entity.js';
import {
  NombreRolDuplicadoError,
  NombreUsuarioDuplicadoError,
} from '../../domain/errors/auth.errors.js';
import type { Contrasena } from '../../domain/value-objects/contrasena.vo.js';
import type { NombreUsuario } from '../../domain/value-objects/nombre-usuario.vo.js';
import {
  armarTokenRefresco,
  contenidoAFirmar,
  type PartesTokenRefresco,
  separarTokenRefresco,
} from '../../domain/value-objects/token-refresco.js';
import type { Actor } from '../../../../shared/application/actor.js';
import type { RegistrarAuditoriaPort } from '../../../auditoria/application/ports/in/registrar-auditoria.port.js';
import type { EmpresaConsultada } from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import type {
  CrearEmpresaComando,
  CrearEmpresaPort,
} from '../../../empresas/application/ports/in/crear-empresa.port.js';
import type { ContextoPeticionPort } from '../../../../shared/application/ports/contexto-peticion.port.js';
import type { ConsultarEmpresasPort } from '../../../empresas/application/ports/in/consultar-empresas.port.js';
import type {
  DatosTokenAcceso,
  GeneradorTokensPort,
  TokenAcceso,
} from '../ports/out/generador-tokens.port.js';
import type {
  AccesoSesion,
  AccesosSesionPort,
} from '../ports/out/accesos-sesion.repository.port.js';
import type { PermisosRepositoryPort } from '../ports/out/permisos.repository.port.js';
import type { PermisoDeclarado, PermisoGuardado } from '../../domain/services/catalogo-permisos.js';
import type { HasherContrasenaPort } from '../ports/out/hasher-contrasena.port.js';
import type { GeneradorContrasenaTemporalPort } from '../ports/out/generador-contrasena-temporal.port.js';
import type { NuevaSesion, SesionesRepositoryPort } from '../ports/out/sesiones.repository.port.js';
import type {
  FiltrosRoles,
  NuevoRol,
  RolesRepositoryPort,
  RolResumenGuardado,
} from '../ports/out/roles.repository.port.js';
import { desplazamiento, type PedidoPagina } from '../../../../shared/application/pagina.js';

/** Como `public.nombre_normalizado()` de la base: sin mayúsculas ni tildes. */
const normalizado = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
import type {
  FiltrosUsuarios,
  NuevoUsuario,
  UsuarioResumenGuardado,
  UsuariosRepositoryPort,
} from '../ports/out/usuarios.repository.port.js';

/** Ids con forma de UUID (la bitácora los exige): `idDePrueba(1)` = `…-000000000001`. */
export const idDePrueba = (numero: number): string =>
  `0190a4f2-1c2b-7000-8000-${String(numero).padStart(12, '0')}`;

/** Los ids de usuarios y roles empiezan en 101 y 201 para no chocar con los de empresas. */
const PRIMER_ID_USUARIO = 101;
const PRIMER_ID_ROL = 201;
/** Los de sesiones, en 301. */
const PRIMER_ID_SESION = 301;
/** Los de permisos, en 401. */
const PRIMER_ID_PERMISO = 401;

/** Repositorio de usuarios en memoria para los unitarios. Cumple el único del nombre de usuario. */
export class UsuariosEnMemoria implements UsuariosRepositoryPort {
  readonly filas = new Map<string, { usuario: Usuario; creadoPor: string | null }>();
  private siguiente = PRIMER_ID_USUARIO;

  /** `roles`: de donde salen los usuarios de cada empresa en `listarDeEmpresa()`. */
  constructor(private readonly roles: RolesEnMemoria = new RolesEnMemoria()) {
    // Como la real, `contarUsuarios()` cuenta solo los usuarios activos.
    roles.usuarioActivo = (id) => this.filas.get(id)?.usuario.activo ?? false;
  }

  /** Para preparar datos: un usuario activo con ese nombre (y lo que se cambie). */
  agregar(nombreUsuario: string, cambios: Partial<DatosUsuario> = {}): Usuario {
    const usuario = Usuario.reconstruir({
      id: idDePrueba(this.siguiente++),
      nombreUsuario,
      nombreCompleto: nombreUsuario,
      hashContrasena: 'hash',
      debeCambiarContrasena: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimaEmpresaId: null,
      ultimoIngresoEn: null,
      activo: true,
      ...cambios,
    });
    this.filas.set(usuario.id, { usuario, creadoPor: null });
    return usuario;
  }

  buscarPorId(id: string): Promise<Usuario | null> {
    return Promise.resolve(this.filas.get(id)?.usuario ?? null);
  }

  /** En memoria no hay nada que bloquear: es `buscarPorId()`. */
  buscarParaActualizar(id: string): Promise<Usuario | null> {
    return this.buscarPorId(id);
  }

  buscarPorNombreUsuario(nombre: NombreUsuario): Promise<Usuario | null> {
    const fila = [...this.filas.values()].find(
      ({ usuario }) => usuario.nombreUsuario.valor === nombre.valor,
    );
    return Promise.resolve(fila?.usuario ?? null);
  }

  async crear(nuevo: NuevoUsuario, creadoPor: string | null): Promise<Usuario> {
    if ((await this.buscarPorNombreUsuario(nuevo.nombreUsuario)) !== null) {
      throw new NombreUsuarioDuplicadoError();
    }
    const usuario = Usuario.reconstruir({
      id: idDePrueba(this.siguiente++),
      nombreUsuario: nuevo.nombreUsuario.valor,
      nombreCompleto: nuevo.nombreCompleto.valor,
      hashContrasena: nuevo.hashContrasena,
      debeCambiarContrasena: nuevo.debeCambiarContrasena,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimaEmpresaId: null,
      ultimoIngresoEn: null,
      activo: true,
    });
    this.filas.set(usuario.id, { usuario, creadoPor });
    return usuario;
  }

  /** Cuántas veces se guardó (para ver que no escribe de más). */
  guardados = 0;

  guardar(usuario: Usuario): Promise<void> {
    const fila = this.filas.get(usuario.id);
    if (fila !== undefined) {
      this.guardados++;
      this.filas.set(usuario.id, { ...fila, usuario });
    }
    return Promise.resolve();
  }

  /** Como la real: los que tienen algún rol en la empresa, por nombre completo sin tildes. */
  async listarDeEmpresa(
    empresaId: string,
    filtros: FiltrosUsuarios,
    pedido: PedidoPagina,
  ): Promise<{ elementos: UsuarioResumenGuardado[]; total: number }> {
    const texto = normalizado(filtros.texto?.trim() ?? '');
    const filas: UsuarioResumenGuardado[] = [];
    for (const { usuario } of this.filas.values()) {
      const roles = await this.roles.rolesDeUsuario(usuario.id, empresaId);
      const cumple =
        roles.length > 0 &&
        (filtros.activo === undefined || usuario.activo === filtros.activo) &&
        (filtros.rolId === undefined || roles.some((rol) => rol.id === filtros.rolId)) &&
        (normalizado(usuario.nombreCompleto.valor).includes(texto) ||
          usuario.nombreUsuario.valor.includes(texto));
      if (cumple) {
        filas.push({
          id: usuario.id,
          nombreUsuario: usuario.nombreUsuario.valor,
          nombreCompleto: usuario.nombreCompleto.valor,
          activo: usuario.activo,
          bloqueadoHasta: usuario.bloqueadoHasta,
          ultimoIngresoEn: usuario.ultimoIngresoEn,
          debeCambiarContrasena: usuario.debeCambiarContrasena,
          roles: roles
            .map((rol) => ({
              id: rol.id,
              nombre: rol.nombre.valor,
              esAdministrador: rol.esAdministrador,
              activo: rol.activo,
            }))
            .sort(
              (a, b) =>
                normalizado(a.nombre).localeCompare(normalizado(b.nombre)) ||
                a.id.localeCompare(b.id),
            ),
        });
      }
    }
    filas.sort(
      (a, b) =>
        normalizado(a.nombreCompleto).localeCompare(normalizado(b.nombreCompleto)) ||
        a.id.localeCompare(b.id),
    );
    const inicio = desplazamiento(pedido);
    return { elementos: filas.slice(inicio, inicio + pedido.tamano), total: filas.length };
  }
}

/** Repositorio de roles y asignaciones en memoria para los unitarios. */
export class RolesEnMemoria implements RolesRepositoryPort {
  readonly roles = new Map<string, Rol>();
  /** `usuarioId:rolId`. */
  readonly asignaciones = new Set<string>();
  private siguiente = PRIMER_ID_ROL;

  buscarAdministrador(empresaId: string): Promise<Rol | null> {
    const rol = [...this.roles.values()].find(
      (r) => r.empresaId === empresaId && r.esAdministrador,
    );
    return Promise.resolve(rol ?? null);
  }

  crear(nuevo: NuevoRol): Promise<Rol> {
    this.revisarNombre(nuevo.nombre.valor, null, nuevo.empresaId);
    const rol = Rol.reconstruir({
      id: idDePrueba(this.siguiente++),
      empresaId: nuevo.empresaId,
      nombre: nuevo.nombre.valor,
      descripcion: nuevo.descripcion,
      esAdministrador: nuevo.esAdministrador,
      activo: true,
    });
    this.roles.set(rol.id, rol);
    return Promise.resolve(rol);
  }

  asignar(usuarioId: string, rol: Rol): Promise<boolean> {
    const clave = `${usuarioId}:${rol.id}`;
    const nueva = !this.asignaciones.has(clave);
    this.asignaciones.add(clave);
    return Promise.resolve(nueva);
  }

  rolesDeUsuario(usuarioId: string, empresaId: string): Promise<Rol[]> {
    const roles = [...this.roles.values()]
      .filter(
        (rol) => rol.empresaId === empresaId && this.asignaciones.has(`${usuarioId}:${rol.id}`),
      )
      .sort((a, b) => a.nombre.valor.localeCompare(b.nombre.valor, 'es'));
    return Promise.resolve(roles);
  }

  empresasConAcceso(usuarioId: string): Promise<string[]> {
    const ids = [...this.roles.values()]
      .filter((rol) => rol.activo && this.asignaciones.has(`${usuarioId}:${rol.id}`))
      .map((rol) => rol.empresaId);
    return Promise.resolve([...new Set(ids)]);
  }

  empresasConRol(usuarioId: string): Promise<string[]> {
    const ids = [...this.roles.values()]
      .filter((rol) => this.asignaciones.has(`${usuarioId}:${rol.id}`))
      .map((rol) => rol.empresaId);
    return Promise.resolve([...new Set(ids)]);
  }

  buscarPorId(id: string, empresaId: string): Promise<Rol | null> {
    const rol = this.roles.get(id);
    return Promise.resolve(rol?.empresaId === empresaId ? rol : null);
  }

  /** En memoria no hay nada que bloquear: es `buscarPorId()`. */
  buscarParaActualizar(id: string, empresaId: string): Promise<Rol | null> {
    return this.buscarPorId(id, empresaId);
  }

  /** Cuántas veces se guardó (para ver que no escribe de más). */
  guardados = 0;

  guardar(rol: Rol): Promise<void> {
    if (rol.activo) {
      this.revisarNombre(rol.nombre.valor, rol.id, rol.empresaId);
    }
    this.guardados++;
    this.roles.set(rol.id, rol);
    return Promise.resolve();
  }

  /**
   * Como la real (Administrador primero, luego por nombre). `cantidadPermisos` sale de
   * `permisosDeRol`, que la prueba puede conectar a un `PermisosEnMemoria`.
   */
  listar(
    empresaId: string,
    filtros: FiltrosRoles,
    pedido: PedidoPagina,
  ): Promise<{ elementos: RolResumenGuardado[]; total: number }> {
    const texto = normalizado(filtros.texto?.trim() ?? '');
    const filtrados = [...this.roles.values()]
      .filter(
        (rol) =>
          rol.empresaId === empresaId &&
          (filtros.activo === undefined || rol.activo === filtros.activo) &&
          normalizado(rol.nombre.valor).includes(texto),
      )
      .sort(
        (a, b) =>
          Number(b.esAdministrador) - Number(a.esAdministrador) ||
          normalizado(a.nombre.valor).localeCompare(normalizado(b.nombre.valor)) ||
          a.id.localeCompare(b.id),
      );
    const inicio = desplazamiento(pedido);
    const elementos = filtrados.slice(inicio, inicio + pedido.tamano).map((rol) => ({
      ...rol.datos(),
      cantidadPermisos: this.permisosDeRol(rol.id),
      cantidadUsuarios: this.usuariosDeRol(rol.id),
    }));
    return Promise.resolve({ elementos, total: filtrados.length });
  }

  activosDeEmpresa(empresaId: string): Promise<Rol[]> {
    return Promise.resolve(
      [...this.roles.values()]
        .filter((rol) => rol.empresaId === empresaId && rol.activo)
        .sort(
          (a, b) =>
            Number(b.esAdministrador) - Number(a.esAdministrador) ||
            normalizado(a.nombre.valor).localeCompare(normalizado(b.nombre.valor)) ||
            a.id.localeCompare(b.id),
        ),
    );
  }

  contarUsuarios(rolId: string): Promise<number> {
    return Promise.resolve(this.usuariosDeRol(rolId));
  }

  /** Cuántos permisos tiene el rol (lo conecta `PermisosEnMemoria`; si no, 0). */
  permisosDeRol: (rolId: string) => number = () => 0;

  /** Si el usuario está activo (lo conecta `UsuariosEnMemoria`; si no, todos lo están). */
  usuarioActivo: (usuarioId: string) => boolean = () => true;

  buscarVarios(ids: readonly string[], empresaId: string): Promise<Rol[]> {
    return Promise.resolve(
      [...new Set(ids)]
        .map((id) => this.roles.get(id))
        .filter((rol): rol is Rol => rol?.empresaId === empresaId),
    );
  }

  /** Lo que recibió cada `fijarDeUsuario()`. */
  readonly fijadosDeUsuario: {
    usuarioId: string;
    empresaId: string;
    rolIds: string[];
    creadoPor: string | null;
  }[] = [];

  fijarDeUsuario(
    usuarioId: string,
    empresaId: string,
    rolIds: readonly string[],
    creadoPor: string | null,
  ): Promise<void> {
    this.fijadosDeUsuario.push({ usuarioId, empresaId, rolIds: [...rolIds], creadoPor });
    for (const rol of this.roles.values()) {
      if (rol.empresaId === empresaId) {
        this.asignaciones.delete(`${usuarioId}:${rol.id}`);
      }
    }
    for (const rolId of rolIds) {
      this.asignaciones.add(`${usuarioId}:${rolId}`);
    }
    return Promise.resolve();
  }

  private usuariosDeRol(rolId: string): number {
    return [...this.asignaciones].filter(
      (clave) => clave.endsWith(`:${rolId}`) && this.usuarioActivo(clave.split(':')[0] ?? ''),
    ).length;
  }

  /** El único de la base: nombre sin mayúsculas ni tildes entre los activos de la empresa. */
  private revisarNombre(nombre: string, exceptoId: string | null, empresaId: string): void {
    const repetido = [...this.roles.values()].some(
      (rol) =>
        rol.activo &&
        rol.id !== exceptoId &&
        rol.empresaId === empresaId &&
        normalizado(rol.nombre.valor) === normalizado(nombre),
    );
    if (repetido) {
      throw new NombreRolDuplicadoError();
    }
  }

  /** Para preparar datos: un rol (activo, salvo que se diga) asignado al usuario en esa empresa. */
  async darRol(
    usuarioId: string,
    empresaId: string,
    opciones: { nombre?: string; activo?: boolean; esAdministrador?: boolean } = {},
  ): Promise<Rol> {
    const rol = Rol.reconstruir({
      id: idDePrueba(this.siguiente++),
      empresaId,
      nombre: opciones.nombre ?? 'Operador',
      descripcion: null,
      esAdministrador: opciones.esAdministrador ?? false,
      activo: opciones.activo ?? true,
    });
    this.roles.set(rol.id, rol);
    await this.asignar(usuarioId, rol);
    return rol;
  }
}

/** Hasher de prueba: `hash(<contraseña>)`, sin Argon2 (rápido). */
export class HasherDePrueba implements HasherContrasenaPort {
  calcularHash(contrasena: Contrasena): Promise<string> {
    return Promise.resolve(`hash(${contrasena.valor})`);
  }

  /** Cuántas veces se verificó contra el hash de relleno (usuario que no existe). */
  rellenos = 0;

  verificar(hash: string, escrita: string): Promise<boolean> {
    return Promise.resolve(hash === `hash(${escrita.normalize('NFKC')})`);
  }

  verificarRelleno(): Promise<false> {
    this.rellenos++;
    return Promise.resolve(false);
  }
}

/**
 * `CREAR_EMPRESA_PORT` de prueba: crea la empresa (ids 1, 2…) y registra su evento en la
 * auditoría que se le pasa, como la real. Rechaza un nombre vacío como la real.
 */
export class CrearEmpresaDePrueba implements CrearEmpresaPort {
  readonly creadas: EmpresaConsultada[] = [];

  constructor(private readonly auditoria: RegistrarAuditoriaPort) {}

  async crear(comando: CrearEmpresaComando, actor: Actor): Promise<EmpresaConsultada> {
    const nombre = comando.nombre.trim();
    if (nombre === '') {
      throw new Error('Nombre de empresa vacío (en la real, NombreEmpresaInvalidoError)');
    }
    const empresa = { id: idDePrueba(this.creadas.length + 1), nombre, activo: true };
    this.creadas.push(empresa);
    await this.auditoria.registrar(
      {
        accion: 'empresas.empresa.crear',
        entidad: 'empresa',
        entidadId: empresa.id,
        entidadNombre: empresa.nombre,
        despues: { nombre },
      },
      { ...actor, empresaId: empresa.id },
    );
    return empresa;
  }
}

/** Repositorio de sesiones en memoria para los unitarios. */
export class SesionesEnMemoria implements SesionesRepositoryPort {
  readonly filas = new Map<string, Sesion>();
  private siguiente = PRIMER_ID_SESION;

  crear(nueva: NuevaSesion): Promise<Sesion> {
    const sesion = Sesion.reconstruir({
      id: idDePrueba(this.siguiente++),
      usuarioId: nueva.usuarioId,
      empresaId: nueva.empresaId,
      hashRefresh: nueva.hashRefresh,
      hashRefreshAnterior: null,
      rotadoEn: null,
      iniciadaEn: nueva.iniciadaEn,
      venceEn: nueva.venceEn,
      ultimoUsoEn: nueva.iniciadaEn,
      cerradaEn: null,
      motivoCierre: null,
      ip: nueva.ip,
      navegador: nueva.navegador,
    });
    this.filas.set(sesion.id, sesion);
    return Promise.resolve(sesion);
  }

  /** Para preparar datos: una sesión con lo que se cambie. */
  agregar(datos: Partial<DatosSesion> & Pick<DatosSesion, 'usuarioId' | 'empresaId'>): Sesion {
    const iniciadaEn = datos.iniciadaEn ?? new Date('2026-07-15T08:00:00-05:00');
    const sesion = Sesion.reconstruir({
      id: idDePrueba(this.siguiente++),
      hashRefresh: 'huella(secreto)',
      hashRefreshAnterior: null,
      rotadoEn: null,
      iniciadaEn,
      venceEn: Sesion.vencimiento(iniciadaEn, 13),
      ultimoUsoEn: iniciadaEn,
      cerradaEn: null,
      motivoCierre: null,
      ip: null,
      navegador: null,
      ...datos,
    });
    this.filas.set(sesion.id, sesion);
    return sesion;
  }

  buscarPorId(id: string): Promise<Sesion | null> {
    return Promise.resolve(this.filas.get(id) ?? null);
  }

  buscarParaActualizar(id: string): Promise<Sesion | null> {
    return Promise.resolve(this.filas.get(id) ?? null);
  }

  guardar(sesion: Sesion): Promise<void> {
    this.filas.set(sesion.id, sesion);
    return Promise.resolve();
  }

  abiertasDeUsuarioEnEmpresa(usuarioId: string, empresaId: string): Promise<Sesion[]> {
    return Promise.resolve(
      [...this.filas.values()]
        .filter((s) => s.usuarioId === usuarioId && s.empresaId === empresaId && s.estaAbierta())
        .sort((a, b) => b.datos().ultimoUsoEn.getTime() - a.datos().ultimoUsoEn.getTime()),
    );
  }

  cerrarTodasDelUsuario(
    usuarioId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    let cerradas = 0;
    for (const sesion of this.filas.values()) {
      if (sesion.usuarioId === usuarioId && sesion.estaAbierta()) {
        this.filas.set(sesion.id, sesion.cerrar(motivo, ahora));
        cerradas++;
      }
    }
    return Promise.resolve(cerradas);
  }

  cerrarOtrasDelUsuario(
    usuarioId: string,
    exceptoSesionId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    return this.cerrarDonde(
      (s) => s.usuarioId === usuarioId && s.id !== exceptoSesionId,
      motivo,
      ahora,
    );
  }

  cerrarTodasDelUsuarioEnEmpresa(
    usuarioId: string,
    empresaId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    return this.cerrarDonde(
      (s) => s.usuarioId === usuarioId && s.empresaId === empresaId,
      motivo,
      ahora,
    );
  }

  cerrarTodasDeEmpresa(
    empresaId: string,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    return this.cerrarDonde((s) => s.empresaId === empresaId, motivo, ahora);
  }

  private cerrarDonde(
    cumple: (sesion: Sesion) => boolean,
    motivo: MotivoCierreSesion,
    ahora: Date,
  ): Promise<number> {
    let cerradas = 0;
    for (const sesion of this.filas.values()) {
      if (cumple(sesion) && sesion.estaAbierta()) {
        this.filas.set(sesion.id, sesion.cerrar(motivo, ahora));
        cerradas++;
      }
    }
    return Promise.resolve(cerradas);
  }
}

/**
 * Tokens de prueba, legibles: el access token es `acceso(<usuario>,<sesión>)`, los secretos
 * `secreto-1`, `secreto-2`… (cada uno con 43 caracteres, como los reales), la huella
 * `huella(<secreto>)` y el refresh token `<sid>.<secreto>.<firma>`, con una firma de prueba que
 * depende del `sid` y del secreto (cambiar cualquiera de los dos la invalida, como la real).
 */
export class GeneradorTokensDePrueba implements GeneradorTokensPort {
  private contador = 0;

  firmarAcceso(datos: DatosTokenAcceso): Promise<TokenAcceso> {
    return Promise.resolve({
      token: `acceso(${datos.usuarioId},${datos.sesionId})`,
      expiraEnSegundos: 900,
    });
  }

  verificarAcceso(token: string): Promise<DatosTokenAcceso | null> {
    const partes = /^acceso\(([^,]+),([^)]+)\)$/.exec(token);
    return Promise.resolve(
      partes === null ? null : { usuarioId: partes[1] ?? '', sesionId: partes[2] ?? '' },
    );
  }

  nuevoSecreto(): string {
    this.contador++;
    return `secreto-${this.contador}`.padEnd(43, 'x');
  }

  huella(secreto: string): string {
    return `huella(${secreto})`;
  }

  armarRefresco(partes: PartesTokenRefresco): string {
    return armarTokenRefresco(partes, firmaDePrueba(partes));
  }

  abrirRefresco(token: string): PartesTokenRefresco | null {
    const separado = separarTokenRefresco(token);
    if (separado === null || separado.firma !== firmaDePrueba(separado)) {
      return null;
    }
    return { sesionId: separado.sesionId, secreto: separado.secreto };
  }
}

/** 43 caracteres de base64url que dependen de todo el contenido (FNV-1a, sin `node:crypto`). */
function firmaDePrueba(partes: PartesTokenRefresco): string {
  let hash = 0x811c9dc5;
  for (const caracter of contenidoAFirmar(partes)) {
    hash = Math.imul(hash ^ (caracter.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return `firma-${hash.toString(16).padStart(8, '0')}`.padEnd(43, 'f');
}

/** `CONSULTAR_EMPRESAS_PORT` de prueba, con una lista fija. */
export class ConsultarEmpresasDePrueba implements ConsultarEmpresasPort {
  constructor(readonly empresas: EmpresaConsultada[] = []) {}

  buscarActiva(id: string): Promise<EmpresaConsultada | null> {
    return Promise.resolve(this.empresas.find((e) => e.id === id && e.activo) ?? null);
  }

  nombres(ids: readonly string[]): Promise<EmpresaConsultada[]> {
    return Promise.resolve(
      this.empresas
        .filter((e) => ids.includes(e.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
  }

  listarActivas(): Promise<EmpresaConsultada[]> {
    return Promise.resolve(this.empresas.filter((e) => e.activo));
  }

  hayAlguna(): Promise<boolean> {
    return Promise.resolve(this.empresas.length > 0);
  }
}

/** Los datos de una petición de prueba (`CONTEXTO_PETICION_PORT`). */
export class ContextoDePrueba implements ContextoPeticionPort {
  constructor(
    private readonly datos: {
      ip?: string | null;
      navegador?: string | null;
      requestId?: string | null;
    } = { ip: '10.0.0.7', navegador: 'Navegador de prueba', requestId: 'peticion-1' },
  ) {}

  requestId(): string | null {
    return this.datos.requestId ?? null;
  }

  ip(): string | null {
    return this.datos.ip ?? null;
  }

  navegador(): string | null {
    return this.datos.navegador ?? null;
  }
}

/**
 * La lectura del guard en memoria, armada con los otros dobles: así una prueba prepara los datos
 * una sola vez (usuarios, roles, empresas, sesiones y permisos) y el guard ve lo mismo que los
 * casos de uso.
 */
export class AccesosSesionEnMemoria implements AccesosSesionPort {
  constructor(
    private readonly sesiones: SesionesEnMemoria,
    private readonly usuarios: UsuariosEnMemoria,
    private readonly roles: RolesEnMemoria,
    private readonly empresas: ConsultarEmpresasDePrueba,
    private readonly permisos: PermisosEnMemoria = new PermisosEnMemoria(roles),
  ) {}

  async buscar(sesionId: string, permiso: string | null): Promise<AccesoSesion | null> {
    const sesion = this.sesiones.filas.get(sesionId);
    const usuario = sesion === undefined ? null : await this.usuarios.buscarPorId(sesion.usuarioId);
    if (sesion === undefined || usuario === null) {
      return null;
    }
    const roles = (await this.roles.rolesDeUsuario(usuario.id, sesion.empresaId)).filter(
      (rol) => rol.activo,
    );
    return {
      sesion,
      usuario: {
        nombreUsuario: usuario.nombreUsuario.valor,
        activo: usuario.activo,
        debeCambiarContrasena: usuario.debeCambiarContrasena,
      },
      empresaActiva: this.empresas.empresas.some((e) => e.id === sesion.empresaId && e.activo),
      tieneRolActivo: roles.length > 0,
      esAdministrador: roles.some((rol) => rol.esAdministrador),
      tienePermiso:
        permiso !== null &&
        (await this.permisos.codigosDeUsuario(usuario.id, sesion.empresaId)).includes(permiso),
    };
  }
}

/**
 * Catálogo de permisos y `roles_permisos` en memoria. Lee los roles de `RolesEnMemoria` (activo,
 * empresa y asignaciones) para `codigosDeUsuario()`.
 */
export class PermisosEnMemoria implements PermisosRepositoryPort {
  readonly filas = new Map<string, PermisoGuardado>();
  /** `rolId:permisoId`. */
  readonly rolesPermisos = new Set<string>();
  /** Cuántas veces se pidió el bloqueo. */
  bloqueos = 0;
  /** Lo que escribió cada llamada (para ver que no escribe de más). */
  readonly escrituras: { tipo: 'crear' | 'actualizar'; cantidad: number; ahora: Date }[] = [];
  private siguiente = PRIMER_ID_PERMISO;

  constructor(private readonly roles: RolesEnMemoria = new RolesEnMemoria()) {
    // La lista de roles cuenta los permisos vigentes de cada uno, como la real.
    roles.permisosDeRol = (rolId) =>
      this.ordenados().filter((p) => !p.obsoleto && this.rolesPermisos.has(`${rolId}:${p.id}`))
        .length;
  }

  /** Para preparar datos: un permiso guardado (vigente, salvo que se diga). */
  agregar(codigo: string, descripcion = codigo, obsoleto = false): PermisoGuardado {
    const permiso = { id: idDePrueba(this.siguiente++), codigo, descripcion, obsoleto };
    this.filas.set(permiso.id, permiso);
    return permiso;
  }

  /** Para preparar datos: le da al rol el permiso con ese código (lo crea si no está). */
  darPermiso(rolId: string, codigo: string): void {
    const permiso =
      [...this.filas.values()].find((p) => p.codigo === codigo) ?? this.agregar(codigo);
    this.rolesPermisos.add(`${rolId}:${permiso.id}`);
  }

  codigosDeRol(rolId: string): Promise<string[]> {
    return Promise.resolve(
      this.ordenados()
        .filter((p) => !p.obsoleto && this.rolesPermisos.has(`${rolId}:${p.id}`))
        .map((p) => p.codigo),
    );
  }

  async codigosDeRoles(rolIds: readonly string[]): Promise<Map<string, string[]>> {
    const resultado = new Map<string, string[]>();
    for (const id of rolIds) {
      resultado.set(id, await this.codigosDeRol(id));
    }
    return resultado;
  }

  /** Lo que recibió cada `fijarDeRol()`. */
  readonly fijados: { rolId: string; codigos: string[]; creadoPor: string | null }[] = [];

  fijarDeRol(rolId: string, codigos: readonly string[], creadoPor: string | null): Promise<void> {
    this.fijados.push({ rolId, codigos: [...codigos], creadoPor });
    for (const clave of this.rolesPermisos) {
      if (clave.startsWith(`${rolId}:`)) {
        this.rolesPermisos.delete(clave);
      }
    }
    for (const permiso of this.filas.values()) {
      if (!permiso.obsoleto && codigos.includes(permiso.codigo)) {
        this.rolesPermisos.add(`${rolId}:${permiso.id}`);
      }
    }
    return Promise.resolve();
  }

  bloquearCatalogo(): Promise<void> {
    this.bloqueos++;
    return Promise.resolve();
  }

  listar(): Promise<PermisoGuardado[]> {
    return Promise.resolve(this.ordenados());
  }

  crear(nuevos: readonly PermisoDeclarado[], ahora: Date): Promise<void> {
    this.escrituras.push({ tipo: 'crear', cantidad: nuevos.length, ahora });
    for (const nuevo of nuevos) {
      this.agregar(nuevo.codigo, nuevo.descripcion);
    }
    return Promise.resolve();
  }

  actualizar(cambiados: readonly PermisoGuardado[], ahora: Date): Promise<void> {
    this.escrituras.push({ tipo: 'actualizar', cantidad: cambiados.length, ahora });
    for (const cambiado of cambiados) {
      this.filas.set(cambiado.id, cambiado);
    }
    return Promise.resolve();
  }

  codigosVigentes(): Promise<string[]> {
    return Promise.resolve(
      this.ordenados()
        .filter((p) => !p.obsoleto)
        .map((p) => p.codigo),
    );
  }

  async codigosDeUsuario(usuarioId: string, empresaId: string): Promise<string[]> {
    const roles = (await this.roles.rolesDeUsuario(usuarioId, empresaId)).filter((r) => r.activo);
    const codigos = this.ordenados()
      .filter((p) => !p.obsoleto && roles.some((r) => this.rolesPermisos.has(`${r.id}:${p.id}`)))
      .map((p) => p.codigo);
    return codigos;
  }

  async empresasConPermiso(usuarioId: string, codigo: string): Promise<string[]> {
    const empresas = new Set<string>();
    for (const rol of this.roles.roles.values()) {
      if (!rol.activo || !this.roles.asignaciones.has(`${usuarioId}:${rol.id}`)) {
        continue;
      }
      if (rol.esAdministrador || (await this.codigosDeRol(rol.id)).includes(codigo)) {
        empresas.add(rol.empresaId);
      }
    }
    return [...empresas];
  }

  private ordenados(): PermisoGuardado[] {
    return [...this.filas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  }
}

/**
 * Contraseñas temporales de prueba: da las de la lista, en orden, y después
 * `Temporal-Prueba-<n>` (cumplen las reglas de `Contrasena`).
 */
export class GeneradorContrasenaDePrueba implements GeneradorContrasenaTemporalPort {
  private generadas = 0;

  constructor(private readonly siguientes: string[] = []) {}

  generar(): string {
    this.generadas++;
    return this.siguientes.shift() ?? `Temporal-Prueba-${this.generadas}`;
  }

  /** Cuántas pidió el caso de uso. */
  get pedidas(): number {
    return this.generadas;
  }
}

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { ConfirmacionService } from '../../../../../../shared/infrastructure/avisos/confirmacion.service';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { ZONA_NEGOCIO } from '../../../../../../shared/infrastructure/fechas/zona-negocio';
import { MENU_APLICACION } from '../../../../../../shared/infrastructure/layout/menu';
import { USUARIO_CABECERA } from '../../../../../../shared/infrastructure/layout/usuario-cabecera';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { ADMINISTRAR_USUARIOS_PORT } from '../../../../application/ports/in/administrar-usuarios.port';
import { CONSULTAR_USUARIOS_PORT } from '../../../../application/ports/in/consultar-usuarios.port';
import { sesionDePrueba } from '../../../../application/testing/sesion-de-prueba';
import {
  rolesAsignablesDePrueba,
  usuarioDePrueba,
} from '../../../../application/testing/usuarios-de-prueba';
import { RolesSinGuardarError } from '../../../../domain/errors/roles-sin-guardar.error';
import type { Usuario } from '../../../../domain/usuario';
import { AuthStore } from '../../../presentation/stores/auth.store';
import { ContrasenaTemporalService } from '../contrasena-temporal/contrasena-temporal.service';
import { FichaUsuarioComponent } from './ficha-usuario.component';

function errorHttp(tipo: TipoErrorHttp, mensaje: string, estado: number, avisado = false) {
  return new ErrorHttp({ tipo, mensaje, estado, respondioLaApi: true, requestId: null, avisado });
}

const TODOS = [
  'auth.usuario.ver',
  'auth.usuario.editar',
  'auth.usuario.asignar_roles',
  'auth.usuario.restablecer',
  'auth.usuario.desactivar',
];

interface Opciones {
  usuario?: Usuario;
  ver?: () => Promise<Usuario>;
  permisos?: string[];
  confirmar?: boolean;
  /** Quien opera (por defecto, otro que no es administrador). */
  quienId?: string;
  esAdministrador?: boolean;
}

async function montar(opciones: Opciones = {}) {
  const usuario = opciones.usuario ?? usuarioDePrueba();
  const consultar = {
    listar: vi.fn(),
    ver: vi.fn(opciones.ver ?? (() => Promise.resolve(usuario))),
    rolesAsignables: vi.fn(() => Promise.resolve(rolesAsignablesDePrueba())),
  };
  const administrar = {
    guardar: vi.fn((u: Usuario, nombre: string, roles: readonly string[]) =>
      Promise.resolve<Usuario | null>({
        ...u,
        nombreCompleto: nombre.trim(),
        roles: roles.map((id) => ({ id, nombre: id, esAdministrador: false, activo: true })),
      }),
    ),
    quitarAcceso: vi.fn(() => Promise.resolve({ id: usuario.id, sesionesCerradas: 1 })),
    darContrasenaTemporal: vi.fn(() =>
      Promise.resolve({
        usuario: { ...usuario, bloqueadoHasta: null, debeCambiarContrasena: true, sesiones: [] },
        contrasenaTemporal: 'p4Hn8sLw2cXe',
      }),
    ),
    desbloquear: vi.fn(() => Promise.resolve<Usuario>({ ...usuario, bloqueadoHasta: null })),
    cerrarSesiones: vi.fn(() => Promise.resolve({ id: usuario.id, sesionesCerradas: 2 })),
    desactivar: vi.fn(() => Promise.resolve<Usuario>({ ...usuario, activo: false, sesiones: [] })),
    reactivar: vi.fn(() => Promise.resolve<Usuario>({ ...usuario, activo: true })),
  };
  const contrasenaTemporal = { mostrar: vi.fn(() => Promise.resolve()) };
  const avisos = { exito: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
  const confirmacion = { confirmar: vi.fn(() => Promise.resolve(opciones.confirmar ?? true)) };
  const sesion = sesionDePrueba({
    usuario: {
      id: opciones.quienId ?? 'u-quien',
      nombreUsuario: 'carlos.mora',
      nombreCompleto: 'Carlos Mora',
      debeCambiarContrasena: false,
    },
    esAdministrador: opciones.esAdministrador ?? false,
  });
  TestBed.configureTestingModule({
    imports: [FichaUsuarioComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([{ path: 'usuarios', children: [] }]),
      { provide: MENU_APLICACION, useValue: [] },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: usuario.id })) },
      },
      { provide: CONSULTAR_USUARIOS_PORT, useValue: consultar },
      { provide: ADMINISTRAR_USUARIOS_PORT, useValue: administrar },
      { provide: NotificacionesService, useValue: avisos },
      { provide: ConfirmacionService, useValue: confirmacion },
      { provide: ContrasenaTemporalService, useValue: contrasenaTemporal },
      { provide: PERMISOS_SESION, useValue: new PermisosDePrueba(opciones.permisos ?? TODOS) },
      { provide: AuthStore, useValue: { sesion: signal(sesion) } },
      { provide: USUARIO_CABECERA, useValue: { nombreEmpresa: signal('Comercial Ejemplo') } },
      { provide: ZONA_NEGOCIO, useValue: signal('America/Guayaquil') },
    ],
  });
  const fixture = TestBed.createComponent(FichaUsuarioComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const nombre = () => html.querySelector<HTMLInputElement>('#usuario-nombre');
  const escribir = async (valor: string) => {
    nombre()!.value = valor;
    nombre()!.dispatchEvent(new Event('input'));
    await listo();
  };
  const boton = (t: string) =>
    [...html.querySelectorAll('button')].find((b) => b.textContent?.trim().includes(t));
  const pestana = async (t: string) => {
    [...html.querySelectorAll<HTMLElement>('[role="tab"]')]
      .find((p) => p.textContent?.includes(t))!
      .click();
    await listo();
  };
  const casilla = (t: string) =>
    [...html.querySelectorAll<HTMLElement>('.editor-roles__rol')].find((c) =>
      c.querySelector('mat-checkbox')?.textContent?.includes(t),
    );
  const marcar = async (t: string) => {
    casilla(t)!.querySelector('input')!.click();
    await listo();
  };
  const botonAcciones = () =>
    html.querySelector<HTMLButtonElement>('.ficha-usuario__boton-acciones');
  /** Los textos del menú «Acciones» (se abre en el overlay, fuera de la ficha). */
  const abrirAcciones = async () => {
    botonAcciones()!.click();
    await listo();
    return [...document.querySelectorAll<HTMLButtonElement>('.menu-acciones .mat-mdc-menu-item')];
  };
  const opcionesAcciones = async () =>
    (await abrirAcciones()).map((b) => b.textContent?.trim() ?? '');
  const accion = async (t: string) => {
    (await abrirAcciones()).find((b) => b.textContent?.includes(t))!.click();
    await listo();
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await listo();
  };
  return {
    html,
    texto,
    nombre,
    escribir,
    boton,
    pestana,
    casilla,
    marcar,
    enviar,
    botonAcciones,
    opcionesAcciones,
    accion,
    listo,
    consultar,
    administrar,
    avisos,
    confirmacion,
    contrasenaTemporal,
    router: TestBed.inject(Router),
  };
}

describe('FichaUsuarioComponent', () => {
  it('«Ver historia» en el pie, solo con el permiso de la bitácora', async () => {
    const { html } = await montar({ permisos: [...TODOS, 'auditoria.evento.ver'] });
    const enlace = html.querySelector<HTMLAnchorElement>('.pie-ficha a.pie-ficha__enlace');
    expect(enlace?.textContent?.trim()).toBe('Ver historia');
    expect(enlace?.getAttribute('href')).toMatch(/^\/bitacora\?entidad=usuario&entidadId=/u);
    TestBed.resetTestingModule();
    const sinPermiso = await montar();
    expect(sinPermiso.html.querySelector('.pie-ficha__enlace')).toBeNull();
  });

  it('muestra el usuario: iniciales, estado, último ingreso, datos y pie', async () => {
    const { texto, nombre } = await montar();
    expect(texto()).toContain('JV');
    expect(texto()).toContain('Jorge Vera');
    expect(texto()).toContain('Activo');
    expect(texto()).toContain('jorge.vera · Último ingreso el 03/11/2026 11:28');
    expect(nombre()?.value).toBe('Jorge Vera');
    expect(texto()).toContain('Con este nombre entra. No se puede cambiar.');
    expect(texto()).toContain('Con acceso desde el 12/10/2026 09:00 por ana.perez');
  });

  it('con contraseña temporal, que nunca entró y en otra empresa: lo dice', async () => {
    const { texto } = await montar({
      usuario: usuarioDePrueba({
        debeCambiarContrasena: true,
        ultimoIngresoEn: null,
        trabajaEnOtrasEmpresas: true,
      }),
    });
    expect(texto()).toContain('Debe cambiar su contraseña');
    expect(texto()).toContain('Nunca entró');
    expect(texto()).toContain('También trabaja en otra empresa.');
  });

  it('cambiar el nombre: la barra aparece y «Guardar cambios» lo manda', async () => {
    const { texto, escribir, enviar, administrar, avisos } = await montar();
    expect(texto()).not.toContain('sin guardar');
    await escribir('Jorge Vera Ruiz');
    expect(texto()).toContain('1 cambio sin guardar');
    await enviar();
    expect(administrar.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u-1' }),
      'Jorge Vera Ruiz',
      ['r-soporte'],
    );
    expect(avisos.exito).toHaveBeenCalledWith('Usuario actualizado');
    expect(texto()).not.toContain('sin guardar');
  });

  it('el nombre vacío no se manda: lo dice en el campo', async () => {
    const { texto, escribir, enviar, administrar } = await montar();
    await escribir('  ');
    await enviar();
    expect(administrar.guardar).not.toHaveBeenCalled();
    expect(texto()).toContain('Escriba el nombre completo');
  });

  it('roles: marca lo que puede dar, bloquea lo demás con el motivo y guarda en orden', async () => {
    const { texto, pestana, casilla, marcar, enviar, administrar } = await montar();
    await pestana('Roles');
    expect(texto()).toContain('Roles en Comercial Ejemplo');
    expect(texto()).toContain('1 de 4 marcados');
    expect(casilla('Administrador')?.textContent).toContain('Solo un administrador da este rol');
    expect(casilla('Cumplimiento')?.querySelector('input')?.disabled).toBe(true);
    await marcar('Consulta');
    expect(casilla('Consulta')?.textContent).toContain('Se agrega');
    expect(texto()).toContain('1 cambio sin guardar');
    await enviar();
    expect(administrar.guardar).toHaveBeenCalledWith(expect.anything(), 'Jorge Vera', [
      'r-consulta',
      'r-soporte',
    ]);
  });

  it('sin ningún rol no se guarda: pide usar «Quitar acceso»', async () => {
    const { texto, pestana, marcar, enviar, administrar, boton } = await montar();
    await pestana('Roles');
    await marcar('Soporte');
    expect(texto()).toContain(
      'Debe tener al menos un rol. Para quitarle todos use «Quitar acceso».',
    );
    expect(boton('Guardar cambios')?.getAttribute('aria-disabled')).toBe('true');
    await enviar();
    expect(administrar.guardar).not.toHaveBeenCalled();
  });

  it('«Descartar» vuelve a lo guardado', async () => {
    const { texto, escribir, boton, nombre, listo } = await montar();
    await escribir('Otro');
    boton('Descartar')!.click();
    await listo();
    expect(nombre()?.value).toBe('Jorge Vera');
    expect(texto()).not.toContain('sin guardar');
  });

  it('el error del backend va en la barra', async () => {
    const { texto, pestana, marcar, enviar, administrar } = await montar();
    administrar.guardar.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.REGLA_NEGOCIO, 'La empresa no puede quedarse sin administrador', 422),
    );
    await pestana('Roles');
    await marcar('Consulta');
    await enviar();
    expect(texto()).toContain('La empresa no puede quedarse sin administrador');
    expect(texto()).toContain('1 cambio sin guardar');
  });

  it('si se guarda el nombre y no los roles: el nombre queda y los roles, pendientes', async () => {
    const { texto, escribir, pestana, marcar, enviar, administrar } = await montar();
    administrar.guardar.mockRejectedValueOnce(
      new RolesSinGuardarError(
        usuarioDePrueba({ nombreCompleto: 'Jorge Vera Ruiz' }),
        errorHttp(TipoErrorHttp.REGLA_NEGOCIO, 'No se puede dar un rol desactivado', 422),
      ),
    );
    await escribir('Jorge Vera Ruiz');
    await pestana('Roles');
    await marcar('Consulta');
    await enviar();
    expect(texto()).toContain(
      'Se guardó el nombre, pero no los roles. No se puede dar un rol desactivado',
    );
    expect(texto()).toContain('1 cambio sin guardar');
  });

  it('su propia ficha: roles en solo lectura y en «Acciones» solo cerrar las otras sesiones', async () => {
    const { texto, pestana, casilla, opcionesAcciones } = await montar({ quienId: 'u-1' });
    expect(texto()).toContain('no puede cambiar sus propios roles');
    expect(await opcionesAcciones()).toEqual(['Cerrar sus otras sesiones']);
    await pestana('Roles');
    expect(casilla('Consulta')?.querySelector('input')?.disabled).toBe(true);
  });

  it('sin «Editar usuarios»: el nombre como texto', async () => {
    const { nombre, texto } = await montar({ permisos: ['auth.usuario.ver'] });
    expect(nombre()).toBeNull();
    expect(texto()).toContain('Nombre completoJorge Vera');
  });

  it('«Quitar acceso» se confirma, avisa y vuelve a la lista', async () => {
    const { accion, confirmacion, administrar, avisos, router } = await montar();
    await accion('Quitar acceso');
    expect(confirmacion.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: 'Quitar el acceso', peligro: true }),
    );
    expect(administrar.quitarAcceso).toHaveBeenCalledWith('u-1');
    expect(avisos.exito).toHaveBeenCalledWith('Acceso quitado');
    expect(router.url).toBe('/usuarios');
  });

  it('«Quitar acceso» cancelado: no hace nada', async () => {
    const { accion, administrar } = await montar({ confirmar: false });
    await accion('Quitar acceso');
    expect(administrar.quitarAcceso).not.toHaveBeenCalled();
  });

  it('«Quitar acceso» rechazado: el mensaje del backend en un aviso', async () => {
    const { accion, administrar, avisos } = await montar();
    administrar.quitarAcceso.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.REGLA_NEGOCIO, 'La empresa no puede quedarse sin administrador', 422),
    );
    await accion('Quitar acceso');
    expect(avisos.error).toHaveBeenCalledWith('La empresa no puede quedarse sin administrador');
  });

  it('sesiones: el equipo, la IP y las fechas; sin ninguna, lo dice', async () => {
    const { texto, pestana } = await montar({
      usuario: usuarioDePrueba({
        sesiones: [
          {
            id: 's-1',
            iniciadaEn: '2026-11-06T13:10:00.000Z',
            ultimoUsoEn: '2026-11-06T15:45:00.000Z',
            ip: '10.0.0.7',
            navegador:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36',
          },
        ],
      }),
    });
    await pestana('Sesiones');
    expect(texto()).toContain('Chrome en Windows');
    expect(texto()).toContain('10.0.0.7');
    expect(texto()).toContain('06/11/2026 08:10');
    TestBed.resetTestingModule();
    const sinSesiones = await montar();
    await sinSesiones.pestana('Sesiones');
    expect(sinSesiones.texto()).toContain('No tiene sesiones abiertas en esta empresa.');
  });

  it('un usuario que no es de esta empresa: el mensaje y «Volver a Usuarios»', async () => {
    const { texto } = await montar({
      ver: () =>
        Promise.reject(errorHttp(TipoErrorHttp.NO_ENCONTRADO, 'El usuario no existe', 404)),
    });
    expect(texto()).toContain('El usuario no existe');
    expect(texto()).toContain('Volver a Usuarios');
  });

  it('sin red: «Reintentar» vuelve a pedirlo', async () => {
    const { texto, boton, listo, consultar } = await montar({
      ver: () => Promise.reject(errorHttp(TipoErrorHttp.SIN_CONEXION, 'Sin conexión', 0, true)),
    });
    expect(texto()).toContain('No se pudieron cargar los datos del usuario.');
    consultar.ver.mockResolvedValueOnce(usuarioDePrueba());
    boton('Reintentar')!.click();
    await listo();
    expect(texto()).toContain('jorge.vera');
  });

  describe('«Acciones»', () => {
    const bloqueado = () =>
      usuarioDePrueba({ bloqueadoHasta: '2026-11-06T15:00:00.000Z', trabajaEnOtrasEmpresas: true });

    it('las que aplican, en su orden; las de peligro al final', async () => {
      const { opcionesAcciones } = await montar({ usuario: bloqueado() });
      expect(await opcionesAcciones()).toEqual([
        'Desbloquear',
        'Dar contraseña temporal',
        'Cerrar sus sesiones',
        'Quitar acceso',
        'Desactivar',
      ]);
      expect(document.querySelectorAll('.menu-acciones__peligro')).toHaveLength(2);
    });

    it('sin ningún permiso de acciones: no hay botón', async () => {
      const { botonAcciones } = await montar({ permisos: ['auth.usuario.ver'] });
      expect(botonAcciones()).toBeNull();
    });

    it('desbloquear: sin confirmar, avisa y quita la insignia', async () => {
      const { accion, administrar, confirmacion, avisos, texto } = await montar({
        usuario: bloqueado(),
      });
      expect(texto()).toContain('Bloqueado');
      await accion('Desbloquear');
      expect(confirmacion.confirmar).not.toHaveBeenCalled();
      expect(administrar.desbloquear).toHaveBeenCalledWith('u-1');
      expect(avisos.exito).toHaveBeenCalledWith('Usuario desbloqueado');
      expect(texto()).not.toContain('Bloqueado');
    });

    it('contraseña temporal: confirma, la muestra en su ventana y queda «Debe cambiar…»', async () => {
      const { accion, administrar, confirmacion, contrasenaTemporal, texto } = await montar({
        usuario: bloqueado(),
      });
      await accion('Dar contraseña temporal');
      expect(confirmacion.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({
          titulo: 'Dar una contraseña temporal',
          mensaje: expect.stringContaining('También se quita el bloqueo.'),
        }),
      );
      expect(administrar.darContrasenaTemporal).toHaveBeenCalledWith('u-1');
      expect(contrasenaTemporal.mostrar).toHaveBeenCalledWith({
        titulo: 'Contraseña temporal nueva',
        nombreUsuario: 'jorge.vera',
        contrasena: 'p4Hn8sLw2cXe',
        textoListo: 'Listo',
      });
      expect(texto()).toContain('Debe cambiar su contraseña');
    });

    it('contraseña temporal cancelada: no pide nada', async () => {
      const { accion, administrar, contrasenaTemporal } = await montar({ confirmar: false });
      await accion('Dar contraseña temporal');
      expect(administrar.darContrasenaTemporal).not.toHaveBeenCalled();
      expect(contrasenaTemporal.mostrar).not.toHaveBeenCalled();
    });

    it('cerrar sesiones: avisa que son las de todas sus empresas, cuántas cerró y las vuelve a pedir', async () => {
      const { accion, administrar, confirmacion, avisos, consultar } = await montar({
        usuario: bloqueado(),
      });
      await accion('Cerrar sus sesiones');
      expect(confirmacion.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({
          mensaje: expect.stringContaining('en todas sus empresas, no solo en esta'),
        }),
      );
      expect(administrar.cerrarSesiones).toHaveBeenCalledWith('u-1');
      expect(avisos.exito).toHaveBeenCalledWith('Se cerraron 2 sesiones');
      expect(consultar.ver).toHaveBeenCalledTimes(2);
    });

    it('sus otras sesiones: lo dice así', async () => {
      const { accion, avisos, confirmacion } = await montar({ quienId: 'u-1' });
      await accion('Cerrar sus otras sesiones');
      expect(confirmacion.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ mensaje: expect.stringContaining('Esta sigue abierta.') }),
      );
      expect(avisos.exito).toHaveBeenCalledWith('Se cerraron sus otras 2 sesiones');
    });

    it('desactivar: en rojo, confirma y queda «Desactivado» con solo «Reactivar» y «Quitar acceso»', async () => {
      const { accion, administrar, confirmacion, avisos, texto, opcionesAcciones } = await montar();
      await accion('Desactivar');
      expect(confirmacion.confirmar).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: 'Desactivar el usuario', peligro: true }),
      );
      expect(administrar.desactivar).toHaveBeenCalledWith('u-1');
      expect(avisos.exito).toHaveBeenCalledWith('Usuario desactivado');
      expect(texto()).toContain('Está desactivado');
      expect(await opcionesAcciones()).toEqual(['Reactivar', 'Quitar acceso']);
    });

    it('reactivar: sin confirmar, avisa y vuelve a «Activo»', async () => {
      const { accion, administrar, confirmacion, avisos, texto } = await montar({
        usuario: usuarioDePrueba({ activo: false }),
      });
      await accion('Reactivar');
      expect(confirmacion.confirmar).not.toHaveBeenCalled();
      expect(administrar.reactivar).toHaveBeenCalledWith('u-1');
      expect(avisos.exito).toHaveBeenCalledWith('Usuario reactivado');
      expect(texto()).toContain('Activo');
    });

    it('rechazada: el mensaje del backend en un aviso; si ya se avisó, no se repite', async () => {
      const { accion, administrar, avisos } = await montar();
      administrar.desactivar.mockRejectedValueOnce(
        errorHttp(
          TipoErrorHttp.REGLA_NEGOCIO,
          'La empresa no puede quedarse sin administrador',
          422,
        ),
      );
      await accion('Desactivar');
      expect(avisos.error).toHaveBeenCalledWith('La empresa no puede quedarse sin administrador');
      avisos.error.mockClear();
      administrar.desactivar.mockRejectedValueOnce(
        errorHttp(TipoErrorHttp.NO_AUTORIZADO, 'No tiene permiso para esta acción', 403, true),
      );
      await accion('Desactivar');
      expect(avisos.error).not.toHaveBeenCalled();
    });

    it('mientras corre: el botón dice qué hace y no deja empezar otra', async () => {
      let terminar: (u: Usuario) => void = () => undefined;
      const { accion, administrar, botonAcciones, listo } = await montar({ usuario: bloqueado() });
      administrar.desbloquear.mockImplementationOnce(
        () => new Promise<Usuario>((resolver) => (terminar = resolver)),
      );
      await accion('Desbloquear');
      expect(botonAcciones()!.textContent).toContain('Desbloqueando…');
      expect(botonAcciones()!.getAttribute('aria-disabled')).toBe('true');
      expect(administrar.desbloquear).toHaveBeenCalledTimes(1);
      terminar(usuarioDePrueba());
      await new Promise((resolver) => setTimeout(resolver));
      await listo();
      expect(botonAcciones()!.textContent).toContain('Acciones');
    });
  });
});

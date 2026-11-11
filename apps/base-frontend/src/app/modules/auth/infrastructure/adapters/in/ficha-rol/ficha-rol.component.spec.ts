import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ErrorHttp, TipoErrorHttp } from '../../../../../../shared/domain/errors/error-http';
import { ConfirmacionService } from '../../../../../../shared/infrastructure/avisos/confirmacion.service';
import { NotificacionesService } from '../../../../../../shared/infrastructure/avisos/notificaciones.service';
import { MENU_APLICACION } from '../../../../../../shared/infrastructure/layout/menu';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { PERMISOS_SESION } from '../../../../../../shared/infrastructure/permisos/permisos-sesion';
import { PermisosDePrueba } from '../../../../../../shared/infrastructure/permisos/permisos-de-prueba';
import { ADMINISTRAR_ROLES_PORT } from '../../../../application/ports/in/administrar-roles.port';
import { CONSULTAR_ROLES_PORT } from '../../../../application/ports/in/consultar-roles.port';
import { catalogoDePrueba, rolDePrueba } from '../../../../application/testing/roles-de-prueba';
import { PermisosSinGuardarError } from '../../../../domain/errors/permisos-sin-guardar.error';
import type { GrupoPermisos } from '../../../../domain/permisos-rol';
import type { DatosRolEscritos, Rol } from '../../../../domain/rol';
import { FichaRolComponent } from './ficha-rol.component';

function errorHttp(tipo: TipoErrorHttp, mensaje: string, estado: number, avisado = false) {
  return new ErrorHttp({ tipo, mensaje, estado, respondioLaApi: true, requestId: null, avisado });
}

const TODOS = [
  'auth.rol.ver',
  'auth.rol.editar',
  'auth.rol.desactivar',
  'auth.usuario.ver',
  'auth.usuario.restablecer',
  'empresas.empresa.editar',
];

interface Opciones {
  rol?: Rol;
  ver?: () => Promise<Rol>;
  permisos?: string[];
  confirmar?: boolean;
  catalogo?: () => Promise<GrupoPermisos[]>;
}

async function montar(opciones: Opciones = {}) {
  const rol = opciones.rol ?? rolDePrueba();
  const consultar = {
    listar: vi.fn(),
    ver: vi.fn(opciones.ver ?? (() => Promise.resolve(rol))),
    catalogo: vi.fn(opciones.catalogo ?? (() => Promise.resolve(catalogoDePrueba()))),
  };
  const administrar = {
    guardar: vi.fn((r: Rol, e: DatosRolEscritos, permisos: readonly string[]) =>
      Promise.resolve<Rol | null>({ ...r, nombre: e.nombre.trim(), permisos: [...permisos] }),
    ),
    crear: vi.fn(),
    desactivar: vi.fn(() => Promise.resolve({ ...rol, activo: false })),
    reactivar: vi.fn(() => Promise.resolve({ ...rol, activo: true })),
  };
  const avisos = { exito: vi.fn(() => Promise.resolve()), error: vi.fn(() => Promise.resolve()) };
  const confirmacion = { confirmar: vi.fn(() => Promise.resolve(opciones.confirmar ?? true)) };
  TestBed.configureTestingModule({
    imports: [FichaRolComponent],
    providers: [
      ...PROVIDERS_MATERIAL,
      provideRouter([]),
      { provide: MENU_APLICACION, useValue: [] },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: rol.id })) } },
      { provide: CONSULTAR_ROLES_PORT, useValue: consultar },
      { provide: ADMINISTRAR_ROLES_PORT, useValue: administrar },
      { provide: NotificacionesService, useValue: avisos },
      { provide: ConfirmacionService, useValue: confirmacion },
      { provide: PERMISOS_SESION, useValue: new PermisosDePrueba(opciones.permisos ?? TODOS) },
    ],
  });
  const fixture = TestBed.createComponent(FichaRolComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const campo = (id: string) =>
    html.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#rol-${id}`);
  const escribir = async (id: string, valor: string) => {
    const c = campo(id)!;
    c.value = valor;
    c.dispatchEvent(new Event('input'));
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
    [...html.querySelectorAll<HTMLElement>('mat-checkbox')].find((c) => c.textContent?.includes(t));
  const marcar = async (t: string) => {
    casilla(t)!.querySelector('input')!.click();
    await listo();
  };
  const enviar = async () => {
    html.querySelector('form')!.dispatchEvent(new Event('submit'));
    await listo();
  };
  return {
    html,
    texto,
    campo,
    escribir,
    boton,
    enviar,
    pestana,
    casilla,
    marcar,
    listo,
    consultar,
    administrar,
    avisos,
    confirmacion,
  };
}

describe('FichaRolComponent', () => {
  it('«Ver historia» en el pie, solo con el permiso de la bitácora', async () => {
    const { html } = await montar({ permisos: [...TODOS, 'auditoria.evento.ver'] });
    const enlace = html.querySelector<HTMLAnchorElement>('.pie-ficha a.pie-ficha__enlace');
    expect(enlace?.textContent?.trim()).toBe('Ver historia');
    expect(enlace?.getAttribute('href')).toMatch(/^\/bitacora\?entidad=rol&entidadId=/u);
    TestBed.resetTestingModule();
    const sinPermiso = await montar();
    expect(sinPermiso.html.querySelector('.pie-ficha__enlace')).toBeNull();
  });

  it('muestra el rol: nombre, estado, usuarios, datos y pie', async () => {
    const { texto, campo } = await montar();
    expect(texto()).toContain('Jefe de oficina');
    expect(texto()).toContain('Activo');
    expect(texto()).toContain('2 usuarios activos tienen este rol');
    expect(campo('nombre')?.value).toBe('Jefe de oficina');
    expect(campo('descripcion')?.value).toBe('Crea usuarios y les da roles');
    expect(texto()).toContain('por ana.perez');
  });

  it('sin cambios no hay barra; al escribir aparece con «1 cambio sin guardar»', async () => {
    const { texto, escribir } = await montar();
    expect(texto()).not.toContain('sin guardar');
    await escribir('nombre', 'Tesorería');
    expect(texto()).toContain('1 cambio sin guardar');
    await escribir('descripcion', 'Paga');
    expect(texto()).toContain('2 cambios sin guardar');
  });

  it('«Guardar cambios» manda lo escrito, avisa y la barra se va', async () => {
    const { escribir, enviar, administrar, avisos, texto } = await montar();
    await escribir('nombre', 'Tesorería');
    await enviar();
    expect(administrar.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r-1' }),
      { nombre: 'Tesorería', descripcion: 'Crea usuarios y les da roles' },
      ['auth.usuario.ver'],
    );
    expect(avisos.exito).toHaveBeenCalledWith('Rol actualizado');
    expect(texto()).not.toContain('sin guardar');
    expect(texto()).toContain('Tesorería');
  });

  it('«Descartar» vuelve a lo guardado', async () => {
    const { escribir, boton, listo, campo, texto } = await montar();
    await escribir('nombre', 'Otro');
    boton('Descartar')!.click();
    await listo();
    expect(campo('nombre')?.value).toBe('Jefe de oficina');
    expect(texto()).not.toContain('sin guardar');
  });

  it('nombre vacío: no envía y muestra el error', async () => {
    const { escribir, enviar, administrar, texto } = await montar();
    await escribir('nombre', '  ');
    await enviar();
    expect(administrar.guardar).not.toHaveBeenCalled();
    expect(texto()).toContain('Escriba el nombre del rol');
  });

  it('nombre repetido: el mensaje del backend en la barra', async () => {
    const { escribir, enviar, administrar, html } = await montar();
    administrar.guardar.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.CONFLICTO, 'Ya existe un rol con ese nombre', 409),
    );
    await escribir('nombre', 'Consulta');
    await enviar();
    expect(html.querySelector('[role="alert"]')?.textContent).toContain(
      'Ya existe un rol con ese nombre',
    );
  });

  it('el Administrador: solo lectura, con su nota y sin «Desactivar»', async () => {
    const { texto, campo, boton } = await montar({
      rol: rolDePrueba({ nombre: 'Administrador', esAdministrador: true }),
    });
    expect(texto()).toContain('Tiene todos los permisos y no se puede cambiar.');
    expect(campo('nombre')).toBeNull();
    expect(boton('Desactivar')).toBeUndefined();
  });

  it('sin permiso de editar: solo lectura; sin el de desactivar, sin botón', async () => {
    const { campo, boton, texto } = await montar({ permisos: ['auth.rol.ver'] });
    expect(campo('nombre')).toBeNull();
    expect(texto()).toContain('Crea usuarios y les da roles');
    expect(boton('Desactivar')).toBeUndefined();
  });

  it('«Desactivar» confirma, desactiva y avisa', async () => {
    const { boton, listo, confirmacion, administrar, avisos, texto } = await montar();
    boton('Desactivar')!.click();
    await listo();
    expect(confirmacion.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({ textoConfirmar: 'Desactivar', peligro: true }),
    );
    expect(administrar.desactivar).toHaveBeenCalledWith('r-1');
    expect(avisos.exito).toHaveBeenCalledWith('Rol desactivado');
    expect(texto()).toContain('Desactivado');
    expect(boton('Reactivar')).toBeDefined();
  });

  it('«Desactivar» cancelado: no hace nada', async () => {
    const { boton, listo, administrar } = await montar({ confirmar: false });
    boton('Desactivar')!.click();
    await listo();
    expect(administrar.desactivar).not.toHaveBeenCalled();
  });

  it('desactivar conserva lo escrito sin guardar', async () => {
    const { boton, listo, escribir, campo, texto } = await montar();
    await escribir('nombre', 'Otro nombre');
    boton('Desactivar')!.click();
    await listo();
    expect(campo('nombre')?.value).toBe('Otro nombre');
    expect(texto()).toContain('1 cambio sin guardar');
  });

  it('«Reactivar» un rol desactivado; si el backend lo rechaza, avisa su mensaje', async () => {
    const { boton, listo, administrar, avisos } = await montar({
      rol: rolDePrueba({ activo: false }),
    });
    administrar.reactivar.mockRejectedValueOnce(
      errorHttp(TipoErrorHttp.CONFLICTO, 'Ya existe un rol con ese nombre', 409),
    );
    boton('Reactivar')!.click();
    await listo();
    expect(avisos.error).toHaveBeenCalledWith('Ya existe un rol con ese nombre');
  });

  it('un rol que no existe: su mensaje y el enlace a la lista', async () => {
    const { texto, html } = await montar({
      ver: () => Promise.reject(errorHttp(TipoErrorHttp.NO_ENCONTRADO, 'El rol no existe', 404)),
    });
    expect(texto()).toContain('El rol no existe');
    expect(html.querySelector('a[href="/roles"]')?.textContent).toContain('Volver a Roles');
  });

  it('sin conexión: mensaje general y «Reintentar»', async () => {
    const ver = vi
      .fn<() => Promise<Rol>>()
      .mockRejectedValueOnce(errorHttp(TipoErrorHttp.SIN_CONEXION, 'Sin conexión', 0, true))
      .mockResolvedValueOnce(rolDePrueba());
    const { texto, boton, listo } = await montar({ ver });
    expect(texto()).toContain('No se pudieron cargar los datos del rol.');
    boton('Reintentar')!.click();
    await listo();
    expect(texto()).toContain('2 usuarios activos tienen este rol');
  });

  describe('pestaña «Permisos»', () => {
    it('muestra «N de M» en la pestaña y los grupos con sus permisos', async () => {
      const { texto, pestana, casilla } = await montar();
      expect(texto()).toContain('Permisos 1 de 4');
      await pestana('Permisos');
      expect(texto()).toContain('Usuarios y roles');
      expect(texto()).toContain('1 de 3');
      expect(texto()).toContain('0 de 1');
      expect(casilla('Ver usuarios')!.querySelector('input')!.checked).toBe(true);
      expect(casilla('Ver roles')!.querySelector('input')!.checked).toBe(false);
    });

    it('marcar suma un cambio con «Se agrega»; guardar manda los permisos en orden', async () => {
      const { texto, pestana, marcar, enviar, administrar, avisos } = await montar();
      await pestana('Permisos');
      await marcar('Editar la empresa');
      await marcar('Ver usuarios');
      expect(texto()).toContain('Se agrega');
      expect(texto()).toContain('Se quita');
      expect(texto()).toContain('2 cambios sin guardar');
      await marcar('Ver roles');
      await enviar();
      expect(administrar.guardar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'r-1' }),
        { nombre: 'Jefe de oficina', descripcion: 'Crea usuarios y les da roles' },
        ['auth.rol.ver', 'empresas.empresa.editar'],
      );
      expect(avisos.exito).toHaveBeenCalledWith('Rol actualizado');
      expect(texto()).not.toContain('sin guardar');
    });

    it('datos y permisos cuentan juntos en la barra; «Descartar» vuelve todo', async () => {
      const { texto, pestana, marcar, escribir, boton, listo, casilla } = await montar();
      await escribir('nombre', 'Otro');
      await pestana('Permisos');
      await marcar('Ver roles');
      expect(texto()).toContain('2 cambios sin guardar');
      boton('Descartar')!.click();
      await listo();
      expect(texto()).not.toContain('sin guardar');
      expect(casilla('Ver roles')!.querySelector('input')!.checked).toBe(false);
    });

    it('nombre vacío desde «Permisos»: vuelve a «Datos» y no envía', async () => {
      const { escribir, pestana, enviar, administrar, texto, html } = await montar();
      await escribir('nombre', '');
      await pestana('Permisos');
      await enviar();
      expect(administrar.guardar).not.toHaveBeenCalled();
      expect(texto()).toContain('Escriba el nombre del rol');
      expect(html.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain(
        'Datos',
      );
    });

    it('sin el permiso que quiere dar: casilla bloqueada con «Usted no tiene este permiso»', async () => {
      const { pestana, casilla, texto } = await montar({
        permisos: ['auth.rol.ver', 'auth.rol.editar', 'auth.usuario.ver'],
      });
      await pestana('Permisos');
      expect(casilla('Editar la empresa')!.querySelector('input')!.disabled).toBe(true);
      expect(casilla('Ver roles')!.querySelector('input')!.disabled).toBe(false);
      expect(texto()).toContain('Usted no tiene este permiso');
      // Lo que el rol ya tiene se puede quitar.
      expect(casilla('Ver usuarios')!.querySelector('input')!.disabled).toBe(false);
    });

    it('datos guardados pero permisos rechazados: los datos quedan y los permisos pendientes', async () => {
      const { escribir, pestana, marcar, enviar, administrar, html, texto } = await montar();
      administrar.guardar.mockRejectedValueOnce(
        new PermisosSinGuardarError(
          rolDePrueba({ nombre: 'Tesorería' }),
          errorHttp(TipoErrorHttp.VALIDACION, 'El permiso «x» no existe', 400),
        ),
      );
      await escribir('nombre', 'Tesorería');
      await pestana('Permisos');
      await marcar('Ver roles');
      await enviar();
      expect(html.querySelector('[role="alert"]')?.textContent).toContain(
        'Se guardaron los datos del rol, pero no los permisos. El permiso «x» no existe',
      );
      expect(texto()).toContain('1 cambio sin guardar');
      expect(html.querySelector('h1')?.textContent).toContain('Tesorería');
    });

    it('el Administrador: todo marcado y nada se puede cambiar', async () => {
      const { pestana, html } = await montar({
        rol: rolDePrueba({
          nombre: 'Administrador',
          esAdministrador: true,
          permisos: catalogoDePrueba().flatMap((g) => g.permisos.map((p) => p.codigo)),
        }),
      });
      await pestana('Permisos');
      const casillas = [...html.querySelectorAll<HTMLInputElement>('mat-checkbox input')];
      expect(casillas).toHaveLength(4);
      expect(casillas.every((c) => c.checked && c.disabled)).toBe(true);
      expect(html.querySelector('[aria-label^="Marcar todo el grupo"]')).toBeNull();
    });
  });

  it('si no carga el catálogo: mensaje general y «Reintentar» (lo vuelve a pedir)', async () => {
    const { texto, consultar, boton, listo } = await montar({
      catalogo: vi
        .fn<() => Promise<GrupoPermisos[]>>()
        .mockRejectedValueOnce(errorHttp(TipoErrorHttp.SIN_CONEXION, 'Sin conexión', 0, true))
        .mockResolvedValueOnce(catalogoDePrueba()),
    });
    expect(texto()).toContain('No se pudieron cargar los datos del rol.');
    boton('Reintentar')!.click();
    await listo();
    expect(consultar.catalogo).toHaveBeenCalledTimes(2);
    expect(texto()).toContain('Permisos 1 de 4');
  });
});

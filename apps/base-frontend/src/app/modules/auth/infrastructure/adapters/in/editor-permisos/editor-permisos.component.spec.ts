import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PROVIDERS_MATERIAL } from '../../../../../../shared/infrastructure/material/material.providers';
import { catalogoDePrueba } from '../../../../application/testing/roles-de-prueba';
import { EditorPermisosComponent } from './editor-permisos.component';

@Component({
  imports: [EditorPermisosComponent],
  template: `<app-editor-permisos
    [catalogo]="catalogo"
    [(marcados)]="marcados"
    [originales]="originales"
    [editable]="editable()"
    [puedeDar]="puedeDar"
  />`,
})
class AnfitrionComponent {
  readonly catalogo = catalogoDePrueba();
  readonly marcados = signal<ReadonlySet<string>>(new Set(['auth.usuario.ver']));
  readonly originales: ReadonlySet<string> = new Set(['auth.usuario.ver']);
  readonly editable = signal(true);
  puedeDar = (codigo: string) => codigo !== 'empresas.empresa.editar';
}

async function montar() {
  TestBed.configureTestingModule({ imports: [AnfitrionComponent], providers: PROVIDERS_MATERIAL });
  const fixture = TestBed.createComponent(AnfitrionComponent);
  await fixture.whenStable();
  const html = fixture.nativeElement as HTMLElement;
  const listo = () => fixture.whenStable();
  const texto = () => (html.textContent ?? '').replace(/\s+/gu, ' ');
  const buscar = async (valor: string) => {
    const campo = html.querySelector<HTMLInputElement>('input[type="search"]')!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await listo();
  };
  const grupo = (nombre: string) =>
    html.querySelector<HTMLInputElement>(`[aria-label="Marcar todo el grupo ${nombre}"] input`) ??
    html.querySelector<HTMLInputElement>(`input[aria-label="Marcar todo el grupo ${nombre}"]`);
  const descripciones = () =>
    [...html.querySelectorAll('.editor-permisos__permiso mat-checkbox')].map((c) =>
      c.textContent?.trim(),
    );
  return { anfitrion: fixture.componentInstance, html, listo, texto, buscar, grupo, descripciones };
}

describe('EditorPermisosComponent', () => {
  it('total y «N de M» por grupo', async () => {
    const { texto } = await montar();
    expect(texto()).toContain('1 de 4 marcados');
    expect(texto()).toContain('Usuarios y roles 1 de 3');
    expect(texto()).toContain('Empresa 0 de 1');
  });

  it('buscar sin tildes; sin coincidencias, el mensaje', async () => {
    const { buscar, descripciones, texto } = await montar();
    await buscar('contrasena');
    expect(descripciones()).toEqual(['Dar contraseña temporal']);
    expect(texto()).not.toContain('Empresa 0 de 1');
    await buscar('zzz');
    expect(texto()).toContain('Ningún permiso coincide con la búsqueda.');
  });

  it('«Solo los marcados»', async () => {
    const { html, listo, descripciones } = await montar();
    html.querySelector<HTMLButtonElement>('mat-slide-toggle button')!.click();
    await listo();
    expect(descripciones()).toEqual(['Ver usuarios']);
  });

  it('marcar todo el grupo marca lo que puede dar; la segunda vez lo desmarca', async () => {
    const { anfitrion, grupo, listo, texto } = await montar();
    grupo('Usuarios y roles')!.click();
    await listo();
    expect([...anfitrion.marcados()].sort()).toEqual([
      'auth.rol.ver',
      'auth.usuario.restablecer',
      'auth.usuario.ver',
    ]);
    expect(texto()).toContain('Se agrega');
    grupo('Usuarios y roles')!.click();
    await listo();
    expect(anfitrion.marcados().size).toBe(0);
    expect(texto()).toContain('Se quita');
  });

  it('un grupo donde no puede dar nada: su casilla bloqueada', async () => {
    const { grupo, texto } = await montar();
    expect(grupo('Empresa')!.disabled).toBe(true);
    expect(texto()).toContain('Usted no tiene este permiso');
  });

  it('solo lectura: sin casilla de grupo ni notas, todo bloqueado', async () => {
    const { anfitrion, html, listo, grupo, texto } = await montar();
    anfitrion.editable.set(false);
    await listo();
    expect(grupo('Usuarios y roles')).toBeNull();
    expect(texto()).not.toContain('Usted no tiene este permiso');
    const casillas = [...html.querySelectorAll<HTMLInputElement>('mat-checkbox input')];
    expect(casillas.every((c) => c.disabled)).toBe(true);
  });
});

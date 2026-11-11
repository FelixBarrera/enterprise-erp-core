import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConPermisoDirective } from './con-permiso.directive';
import { PermisosDePrueba } from './permisos-de-prueba';
import { PERMISOS_SESION } from './permisos-sesion';

@Component({
  imports: [ConPermisoDirective],
  template: `<button *appConPermiso="codigo()" type="button">Nuevo usuario</button>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Pantalla {
  readonly codigo = signal('auth.usuario.crear');
}

async function montar(permisos: PermisosDePrueba) {
  TestBed.configureTestingModule({
    imports: [Pantalla],
    providers: [{ provide: PERMISOS_SESION, useValue: permisos }],
  });
  const fixture = TestBed.createComponent(Pantalla);
  await fixture.whenStable();
  const botones = () => (fixture.nativeElement as HTMLElement).querySelectorAll('button');
  return { fixture, botones };
}

describe('ConPermisoDirective', () => {
  it('con el permiso, dibuja el botón', async () => {
    const { botones } = await montar(new PermisosDePrueba(['auth.usuario.crear']));
    expect(botones()).toHaveLength(1);
    expect(botones()[0]?.textContent).toBe('Nuevo usuario');
  });

  it('sin el permiso, no lo dibuja', async () => {
    const { botones } = await montar(new PermisosDePrueba(['auth.usuario.ver']));
    expect(botones()).toHaveLength(0);
  });

  it('aparece y desaparece cuando cambian los permisos (sin repetirse)', async () => {
    const permisos = new PermisosDePrueba();
    const { fixture, botones } = await montar(permisos);
    permisos.fijar(['auth.usuario.crear']);
    await fixture.whenStable();
    expect(botones()).toHaveLength(1);
    permisos.fijar(['auth.usuario.crear', 'auth.usuario.ver']);
    await fixture.whenStable();
    expect(botones()).toHaveLength(1);
    permisos.fijar([]);
    await fixture.whenStable();
    expect(botones()).toHaveLength(0);
  });

  it('sigue al código si la pantalla lo cambia', async () => {
    const { fixture, botones } = await montar(new PermisosDePrueba(['auth.rol.crear']));
    fixture.componentInstance.codigo.set('auth.rol.crear');
    await fixture.whenStable();
    expect(botones()).toHaveLength(1);
  });
});

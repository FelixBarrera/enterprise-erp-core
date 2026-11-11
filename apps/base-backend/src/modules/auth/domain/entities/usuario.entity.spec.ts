import { NombreCompleto } from '../value-objects/nombre-completo.vo.js';
import { type DatosUsuario, MINUTOS_DE_BLOQUEO, Usuario } from './usuario.entity.js';

const EMPRESA = '0190a4f2-1c2b-7000-8000-000000000009';
const datos: DatosUsuario = {
  id: '0190a4f2-1c2b-7000-8000-000000000001',
  nombreUsuario: 'ana',
  nombreCompleto: 'Ana Pérez',
  hashContrasena: '$argon2id$v=19$…',
  debeCambiarContrasena: false,
  intentosFallidos: 0,
  bloqueadoHasta: null,
  ultimaEmpresaId: null,
  ultimoIngresoEn: null,
  activo: true,
};

function fallar(usuario: Usuario, veces: number, ahora: Date): Usuario {
  let actual = usuario;
  for (let i = 0; i < veces; i++) {
    actual = actual.registrarFallo(ahora).usuario;
  }
  return actual;
}

describe('Usuario', () => {
  // El dominio recibe la hora; aquí basta una fija (RelojFijo es de application/).
  const reloj = { ahora: () => new Date('2026-07-15T11:00:00-05:00') };

  it('reconstruye y devuelve los mismos datos', () => {
    const usuario = Usuario.reconstruir(datos);
    expect(usuario.nombreUsuario.valor).toBe('ana');
    expect(usuario.datos()).toEqual(datos);
  });

  it('cuatro fallos suman; el quinto bloquea 15 minutos y vuelve a 0', () => {
    const ahora = reloj.ahora();
    const cuatro = fallar(Usuario.reconstruir(datos), 4, ahora);
    expect(cuatro.intentosFallidos).toBe(4);
    expect(cuatro.estaBloqueado(ahora)).toBe(false);
    const { usuario, seBloqueo } = cuatro.registrarFallo(ahora);
    expect(seBloqueo).toBe(true);
    expect(usuario.intentosFallidos).toBe(0);
    expect(usuario.bloqueadoHasta).toEqual(new Date('2026-07-15T11:15:00-05:00'));
    expect(usuario.estaBloqueado(ahora)).toBe(true);
  });

  it('bloqueado, otro fallo no alarga el bloqueo; al pasar los 15 minutos ya no lo está', () => {
    const ahora = reloj.ahora();
    const bloqueado = fallar(Usuario.reconstruir(datos), 5, ahora);
    const otro = bloqueado.registrarFallo(new Date(ahora.getTime() + 60_000));
    expect(otro.seBloqueo).toBe(false);
    expect(otro.usuario).toBe(bloqueado);
    const despues = new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60_000);
    expect(bloqueado.estaBloqueado(despues)).toBe(false);
    expect(bloqueado.registrarFallo(despues).usuario.intentosFallidos).toBe(1);
  });

  it('entrar bien borra fallos y bloqueo, y anota el ingreso y la empresa', () => {
    const ahora = reloj.ahora();
    const usuario = fallar(Usuario.reconstruir(datos), 3, ahora).ingresoExitoso(ahora, EMPRESA);
    expect(usuario).toMatchObject({
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoIngresoEn: ahora,
      ultimaEmpresaId: EMPRESA,
    });
  });

  it('usarEmpresa cambia solo la última empresa usada', () => {
    const usuario = Usuario.reconstruir(datos);
    const otra = '0190a4f2-1c2b-7000-8000-000000000002';
    expect(usuario.usarEmpresa(otra).datos()).toEqual({
      ...usuario.datos(),
      ultimaEmpresaId: otra,
    });
  });

  it('cambiarNombre cambia solo el nombre completo', () => {
    const usuario = Usuario.reconstruir(datos);
    expect(usuario.cambiarNombre(NombreCompleto.crear('  Ana  María ')).datos()).toEqual({
      ...datos,
      nombreCompleto: 'Ana María',
    });
  });

  it('desbloquear, cambiar contraseña, desactivar y reactivar', () => {
    const bloqueado = fallar(Usuario.reconstruir(datos), 5, reloj.ahora());
    expect(bloqueado.desbloquear()).toMatchObject({ intentosFallidos: 0, bloqueadoHasta: null });
    const temporal = bloqueado.cambiarContrasena('$argon2id$nuevo', true);
    expect(temporal).toMatchObject({
      hashContrasena: '$argon2id$nuevo',
      debeCambiarContrasena: true,
    });
    expect(temporal.desactivar().activo).toBe(false);
    expect(temporal.desactivar().reactivar().activo).toBe(true);
  });

  it('es inmutable: los cambios no tocan el original', () => {
    const usuario = Usuario.reconstruir(datos);
    usuario.desactivar();
    usuario.registrarFallo(reloj.ahora());
    expect(usuario.datos()).toEqual(datos);
  });
});

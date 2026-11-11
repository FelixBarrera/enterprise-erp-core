import { Dinero } from '../../../shared/domain/value-objects/dinero.vo.js';
import { FechaFiscal } from '../../../shared/domain/value-objects/fecha-fiscal.vo.js';
import { EventoAuditoriaInvalidoError } from './errors/auditoria.errors.js';
import { armarEventoAuditoria, type Autor, VALOR_OCULTO } from './evento-auditoria.js';

const ID = '0190a4f2-1c2b-7000-8000-00000000000a';
const AHORA = new Date('2026-07-15T16:00:00Z');
const autor: Autor = {
  usuarioId: '0190a4f2-1c2b-7000-8000-000000000001',
  nombreUsuario: 'ana',
  empresaId: '0190a4f2-1c2b-7000-8000-000000000002',
  ip: '10.0.0.5',
  navegador: 'Firefox',
  requestId: 'req-1',
};

const armar = (datos: Parameters<typeof armarEventoAuditoria>[0], quien: Autor = autor) =>
  armarEventoAuditoria(datos, quien, AHORA);

describe('armarEventoAuditoria', () => {
  it('copia quién, desde dónde y cuándo', () => {
    expect(armar({ accion: 'auth.sesion.iniciar' })).toEqual({
      ocurridoEn: AHORA,
      empresaId: autor.empresaId,
      usuarioId: autor.usuarioId,
      nombreUsuario: 'ana',
      accion: 'auth.sesion.iniciar',
      entidad: null,
      entidadId: null,
      entidadNombre: null,
      antes: null,
      despues: null,
      ip: '10.0.0.5',
      navegador: 'Firefox',
      requestId: 'req-1',
    });
  });

  describe('lo que cambió (AUD-D3)', () => {
    it('con antes y despues, solo los campos que cambiaron', () => {
      const evento = armar({
        accion: 'auth.usuario.editar',
        entidad: 'usuario',
        entidadId: ID,
        antes: { nombre: 'Ana', correo: 'a@x.ec', activo: true },
        despues: { nombre: 'Ana María', correo: 'a@x.ec', activo: true },
      });
      expect(evento?.antes).toEqual({ nombre: 'Ana' });
      expect(evento?.despues).toEqual({ nombre: 'Ana María' });
      expect(evento?.entidad).toBe('usuario');
      expect(evento?.entidadId).toBe(ID);
    });

    it('si nada cambió, no hay evento', () => {
      expect(
        armar({
          accion: 'auth.usuario.editar',
          antes: { a: 1, b: { x: 1, y: 2 } },
          despues: { a: 1, b: { y: 2, x: 1 } },
        }),
      ).toBeNull();
    });

    it('un campo que aparece o desaparece cuenta como cambio (con null del otro lado)', () => {
      const evento = armar({ accion: 'm.r.a', antes: { viejo: 'x' }, despues: { nuevo: 'y' } });
      expect(evento?.antes).toEqual({ viejo: 'x', nuevo: null });
      expect(evento?.despues).toEqual({ viejo: null, nuevo: 'y' });
    });

    it('undefined y null son lo mismo', () => {
      expect(armar({ accion: 'm.r.a', antes: { a: null }, despues: { a: undefined } })).toBeNull();
    });

    it('solo despues (alta): todos los campos', () => {
      const evento = armar({
        accion: 'auth.usuario.crear',
        despues: { nombre: 'Ana', activo: true },
      });
      expect(evento?.antes).toBeNull();
      expect(evento?.despues).toEqual({ nombre: 'Ana', activo: true });
    });

    it('solo antes: todos los campos de antes', () => {
      const evento = armar({ accion: 'auth.rol.quitar', antes: { rol: 'Caja' } });
      expect(evento?.antes).toEqual({ rol: 'Caja' });
      expect(evento?.despues).toBeNull();
    });

    it('listas: cambia si cambia el orden o un elemento', () => {
      const evento = armar({ accion: 'm.r.a', antes: { l: [1, 2] }, despues: { l: [2, 1] } });
      expect(evento?.despues).toEqual({ l: [2, 1] });
    });

    it('fechas, Dinero, FechaFiscal y bigint quedan como texto, como en el JSON de la API', () => {
      const evento = armar({
        accion: 'm.r.a',
        despues: {
          instante: new Date('2026-07-15T16:00:00Z'),
          monto: Dinero.desdeTexto('10.5'),
          fecha: FechaFiscal.desdeTexto('2026-07-15'),
          grande: 12n,
        },
      });
      expect(evento?.despues).toEqual({
        instante: '2026-07-15T16:00:00.000Z',
        monto: '10.50',
        fecha: '2026-07-15',
        grande: '12',
      });
    });

    it('el mismo monto escrito distinto no es un cambio', () => {
      expect(
        armar({
          accion: 'm.r.a',
          antes: { monto: Dinero.desdeTexto('10.5') },
          despues: { monto: Dinero.desdeTexto('10.50') },
        }),
      ).toBeNull();
    });
  });

  describe('lo sensible nunca entra (AUD-D4)', () => {
    it('en un alta, el valor queda oculto', () => {
      const evento = armar({
        accion: 'auth.usuario.crear',
        despues: { nombre: 'Ana', contrasena: 'Secreta123', hashContrasena: '$argon2id$...' },
      });
      expect(evento?.despues).toEqual({
        nombre: 'Ana',
        contrasena: VALOR_OCULTO,
        hashContrasena: VALOR_OCULTO,
      });
      expect(JSON.stringify(evento)).not.toContain('Secreta123');
      expect(JSON.stringify(evento)).not.toContain('argon2');
    });

    it('si solo cambió la contraseña hay evento, sin los valores', () => {
      const evento = armar({
        accion: 'auth.usuario.editar',
        antes: { nombre: 'Ana', hashContrasena: 'h1' },
        despues: { nombre: 'Ana', hashContrasena: 'h2' },
      });
      expect(evento?.antes).toEqual({ hashContrasena: VALOR_OCULTO });
      expect(evento?.despues).toEqual({ hashContrasena: VALOR_OCULTO });
    });

    it('un sensible que no cambió no aparece', () => {
      const evento = armar({
        accion: 'm.r.a',
        antes: { nombre: 'a', token: 't' },
        despues: { nombre: 'b', token: 't' },
      });
      expect(evento?.despues).toEqual({ nombre: 'b' });
    });

    it.each(['password', 'refreshToken', 'secreto', 'clientSecret', 'TOKEN', 'hash'])(
      '%s se oculta',
      (campo) => {
        expect(armar({ accion: 'm.r.a', despues: { [campo]: 'x' } })?.despues).toEqual({
          [campo]: VALOR_OCULTO,
        });
      },
    );

    it('también dentro de objetos y listas', () => {
      const evento = armar({
        accion: 'm.r.a',
        antes: { integracion: { url: 'u', token: 'viejo' }, cuentas: [{ secreto: 's1' }] },
        despues: { integracion: { url: 'u2', token: 'nuevo' }, cuentas: [{ secreto: 's2' }] },
      });
      expect(evento?.despues).toEqual({
        integracion: { url: 'u2', token: VALOR_OCULTO },
        cuentas: [{ secreto: VALOR_OCULTO }],
      });
      expect(JSON.stringify(evento)).not.toMatch(/viejo|nuevo|s1|s2/);
    });

    it('la clave de acceso del SRI no es secreta: se guarda', () => {
      expect(armar({ accion: 'm.r.a', despues: { claveAcceso: '123' } })?.despues).toEqual({
        claveAcceso: '123',
      });
    });
  });

  describe('nombre del registro (6.12c0b)', () => {
    it('se guarda recortado, hasta 150 caracteres; vacío o sin él, null', () => {
      const con = (entidadNombre?: string | null) =>
        armar({ accion: 'auth.usuario.editar', entidad: 'usuario', entidadId: ID, entidadNombre })
          ?.entidadNombre;
      expect(con(' jorge.vera ')).toBe('jorge.vera');
      expect(con('r'.repeat(200))).toBe('r'.repeat(150));
      expect(con('  ')).toBeNull();
      expect(con(null)).toBeNull();
      expect(con()).toBeNull();
    });
  });

  describe('datos de quien opera', () => {
    it('recorta lo que pasa del largo de la columna y deja null lo vacío', () => {
      const evento = armar(
        { accion: 'm.r.a' },
        { ...autor, navegador: 'x'.repeat(500), nombreUsuario: '  ', ip: null, requestId: ' r ' },
      );
      expect(evento?.navegador).toHaveLength(300);
      expect(evento?.nombreUsuario).toBeNull();
      expect(evento?.ip).toBeNull();
      expect(evento?.requestId).toBe('r');
    });

    it('un proceso del sistema: sin usuario ni empresa', () => {
      const evento = armar(
        { accion: 'm.r.a' },
        {
          usuarioId: null,
          nombreUsuario: null,
          empresaId: null,
          ip: null,
          navegador: null,
          requestId: null,
        },
      );
      expect(evento).toMatchObject({ usuarioId: null, empresaId: null });
    });
  });

  describe('eventos mal armados (error de programación)', () => {
    it.each([
      'auth.usuario',
      'Auth.usuario.crear',
      'auth.usuario.crear.x',
      'auth usuario crear',
      '',
      `a.b.${'c'.repeat(100)}`,
    ])('acción "%s"', (accion) => {
      expect(() => armar({ accion })).toThrow(EventoAuditoriaInvalidoError);
    });

    it('acepta números y guion bajo', () => {
      expect(armar({ accion: 'modulo2.recurso_x.cambiar_contrasena' })).not.toBeNull();
    });

    it('entidad sin id o id sin entidad', () => {
      expect(() => armar({ accion: 'm.r.a', entidad: 'usuario' })).toThrow('van juntos');
      expect(() => armar({ accion: 'm.r.a', entidadId: ID })).toThrow('van juntos');
    });

    it('entidad vacía o demasiado larga', () => {
      expect(() => armar({ accion: 'm.r.a', entidad: ' ', entidadId: ID })).toThrow('entidad');
      expect(() => armar({ accion: 'm.r.a', entidad: 'e'.repeat(61), entidadId: ID })).toThrow(
        'entidad',
      );
    });

    it('nombre del registro sin su entidad (6.12c0b)', () => {
      expect(() => armar({ accion: 'm.r.a', entidadNombre: 'ana' })).toThrow('solo con su entidad');
      expect(armar({ accion: 'm.r.a', entidadNombre: null })?.entidadNombre).toBeNull();
    });

    it('id que no es UUID', () => {
      expect(() => armar({ accion: 'm.r.a', entidad: 'usuario', entidadId: '12' })).toThrow('UUID');
    });
  });
});

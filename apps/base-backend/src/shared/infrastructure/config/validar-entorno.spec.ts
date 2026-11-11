import { validarEntorno } from './validar-entorno.js';

const VALIDO = {
  NODE_ENV: 'test',
  PORT: '3100',
  DATABASE_URL: 'postgresql://usuario:clave@localhost:5432/base',
  REDIS_URL: 'redis://localhost:6379',
  CORS_ORIGINS: 'http://localhost:4200',
  JWT_SECRETO: 'x'.repeat(64),
};

describe('validarEntorno', () => {
  it('acepta un .env completo y convierte PORT a número', () => {
    const variables = validarEntorno(VALIDO);
    expect(variables.PORT).toBe(3100);
    expect(variables.NODE_ENV).toBe('test');
  });

  it('usa los valores por defecto de NODE_ENV y PORT', () => {
    const { NODE_ENV: _n, PORT: _p, ...sinOpcionales } = VALIDO;
    const variables = validarEntorno(sinOpcionales);
    expect(variables.NODE_ENV).toBe('development');
    expect(variables.PORT).toBe(3000);
  });

  it('no arranca si falta DATABASE_URL', () => {
    const { DATABASE_URL: _d, ...sinBase } = VALIDO;
    expect(() => validarEntorno(sinBase)).toThrow('DATABASE_URL es obligatoria');
  });

  it('no arranca si falta REDIS_URL', () => {
    const { REDIS_URL: _r, ...sinRedis } = VALIDO;
    expect(() => validarEntorno(sinRedis)).toThrow('REDIS_URL es obligatoria');
  });

  it('rechaza una DATABASE_URL vacía', () => {
    expect(() => validarEntorno({ ...VALIDO, DATABASE_URL: '' })).toThrow(
      'DATABASE_URL es obligatoria',
    );
  });

  it('rechaza una DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => validarEntorno({ ...VALIDO, DATABASE_URL: 'mysql://x' })).toThrow(
      'DATABASE_URL debe empezar con postgresql://',
    );
  });

  it('rechaza un PORT que no es número', () => {
    expect(() => validarEntorno({ ...VALIDO, PORT: 'abc' })).toThrow(
      'PORT debe ser un número entero',
    );
  });

  it('rechaza un PORT fuera de rango', () => {
    expect(() => validarEntorno({ ...VALIDO, PORT: '70000' })).toThrow(
      'PORT debe ser un número de puerto válido',
    );
  });

  it('rechaza un NODE_ENV desconocido', () => {
    expect(() => validarEntorno({ ...VALIDO, NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV debe ser development, test o production',
    );
  });

  it('junta todos los errores en un solo mensaje y no muestra los valores', () => {
    const intento = () => validarEntorno({ PORT: 'abc', DATABASE_URL: 'secreto-raro' });
    expect(intento).toThrow(/DATABASE_URL[\s\S]*REDIS_URL|REDIS_URL[\s\S]*DATABASE_URL/);
    expect(intento).not.toThrow(/secreto-raro/);
  });

  it('separa CORS_ORIGINS por coma y quita espacios', () => {
    const variables = validarEntorno({
      ...VALIDO,
      CORS_ORIGINS: 'http://localhost:4200, https://base_erp.example.com',
    });
    expect(variables.CORS_ORIGINS).toEqual(['http://localhost:4200', 'https://base_erp.example.com']);
  });

  it('no arranca si falta CORS_ORIGINS o está vacía', () => {
    const { CORS_ORIGINS: _c, ...sinCors } = VALIDO;
    expect(() => validarEntorno(sinCors)).toThrow('CORS_ORIGINS es obligatoria');
    expect(() => validarEntorno({ ...VALIDO, CORS_ORIGINS: ' , ' })).toThrow(
      'CORS_ORIGINS es obligatoria',
    );
  });

  it('rechaza un origen de CORS mal escrito o con / al final', () => {
    for (const origen of ['localhost:4200', 'http://localhost:4200/', '*']) {
      expect(() => validarEntorno({ ...VALIDO, CORS_ORIGINS: origen })).toThrow(
        'CORS_ORIGINS debe tener direcciones',
      );
    }
  });

  it('TRUST_PROXY es false por defecto y acepta true o false', () => {
    expect(validarEntorno(VALIDO).TRUST_PROXY).toBe(false);
    expect(validarEntorno({ ...VALIDO, TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(true);
    expect(validarEntorno({ ...VALIDO, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe(false);
  });

  it('rechaza un TRUST_PROXY que no es true ni false', () => {
    expect(() => validarEntorno({ ...VALIDO, TRUST_PROXY: 'si' })).toThrow(
      'TRUST_PROXY debe ser true o false',
    );
  });

  it('LOG_LEVEL es info por defecto y acepta los niveles de pino', () => {
    expect(validarEntorno(VALIDO).LOG_LEVEL).toBe('info');
    expect(validarEntorno({ ...VALIDO, LOG_LEVEL: 'silent' }).LOG_LEVEL).toBe('silent');
  });

  it('rechaza un LOG_LEVEL desconocido', () => {
    expect(() => validarEntorno({ ...VALIDO, LOG_LEVEL: 'todo' })).toThrow(
      'LOG_LEVEL debe ser fatal, error, warn, info, debug, trace o silent',
    );
  });

  it('ZONA_NEGOCIO es America/Guayaquil por defecto y acepta otra zona exacta', () => {
    expect(validarEntorno(VALIDO).ZONA_NEGOCIO).toBe('America/Guayaquil');
    expect(validarEntorno({ ...VALIDO, ZONA_NEGOCIO: 'Europe/Madrid' }).ZONA_NEGOCIO).toBe(
      'Europe/Madrid',
    );
  });

  it('no arranca con una ZONA_NEGOCIO mal escrita, vacía, como desfase o abreviatura', () => {
    for (const zona of ['America/Guayakil', '', '-05:00', 'EST']) {
      expect(() => validarEntorno({ ...VALIDO, ZONA_NEGOCIO: zona })).toThrow(
        'ZONA_NEGOCIO debe ser el nombre exacto de una zona horaria',
      );
    }
  });

  it('no arranca sin JWT_SECRETO o con uno corto', () => {
    const { JWT_SECRETO: _j, ...sinSecreto } = VALIDO;
    expect(() => validarEntorno(sinSecreto)).toThrow('JWT_SECRETO es obligatoria');
    expect(() => validarEntorno({ ...VALIDO, JWT_SECRETO: 'x'.repeat(63) })).toThrow(
      'JWT_SECRETO debe tener al menos 64 caracteres',
    );
  });

  it('la sesión dura 13 horas y se corta a los 120 minutos sin uso, salvo que se diga otra cosa', () => {
    const porDefecto = validarEntorno(VALIDO);
    expect(porDefecto.SESION_DURACION_MAXIMA_HORAS).toBe(13);
    expect(porDefecto.SESION_INACTIVIDAD_MINUTOS).toBe(120);
    const otra = validarEntorno({
      ...VALIDO,
      SESION_DURACION_MAXIMA_HORAS: '9',
      SESION_INACTIVIDAD_MINUTOS: '30',
    });
    expect(otra.SESION_DURACION_MAXIMA_HORAS).toBe(9);
    expect(otra.SESION_INACTIVIDAD_MINUTOS).toBe(30);
  });

  it('rechaza duraciones de sesión fuera de rango o que no son enteras', () => {
    for (const horas of ['0', '25', '1.5', 'trece']) {
      expect(() => validarEntorno({ ...VALIDO, SESION_DURACION_MAXIMA_HORAS: horas })).toThrow(
        'SESION_DURACION_MAXIMA_HORAS debe ser',
      );
    }
    for (const minutos of ['14', '721', 'mucho']) {
      expect(() => validarEntorno({ ...VALIDO, SESION_INACTIVIDAD_MINUTOS: minutos })).toThrow(
        'SESION_INACTIVIDAD_MINUTOS debe ser',
      );
    }
  });

  it('límites por minuto: 10 en el login, 300 por usuario y 60 por IP, salvo que se diga otra cosa', () => {
    const porDefecto = validarEntorno(VALIDO);
    expect(porDefecto.LIMITE_LOGIN_POR_MINUTO).toBe(10);
    expect(porDefecto.LIMITE_USUARIO_POR_MINUTO).toBe(300);
    expect(porDefecto.LIMITE_IP_POR_MINUTO).toBe(60);
    const otros = validarEntorno({
      ...VALIDO,
      LIMITE_LOGIN_POR_MINUTO: '20',
      LIMITE_USUARIO_POR_MINUTO: '600',
      LIMITE_IP_POR_MINUTO: '120',
    });
    expect(otros.LIMITE_LOGIN_POR_MINUTO).toBe(20);
    expect(otros.LIMITE_USUARIO_POR_MINUTO).toBe(600);
    expect(otros.LIMITE_IP_POR_MINUTO).toBe(120);
  });

  it('rechaza límites que no son enteros de 1 a 100000', () => {
    for (const variable of [
      'LIMITE_LOGIN_POR_MINUTO',
      'LIMITE_USUARIO_POR_MINUTO',
      'LIMITE_IP_POR_MINUTO',
    ]) {
      for (const valor of ['0', '100001', '2.5', 'muchos']) {
        expect(() => validarEntorno({ ...VALIDO, [variable]: valor })).toThrow(
          `${variable} debe ser`,
        );
      }
    }
  });
});

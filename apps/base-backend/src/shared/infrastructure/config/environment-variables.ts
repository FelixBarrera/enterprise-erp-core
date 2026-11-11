import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  Max,
  Min,
  Validate,
  type ValidatorConstraintInterface,
  ValidatorConstraint,
} from 'class-validator';
import { esZonaHorariaValida, ZONA_NEGOCIO_POR_DEFECTO } from '../../domain/zona-negocio.js';

export const ENTORNOS = ['development', 'test', 'production'] as const;
export type Entorno = (typeof ENTORNOS)[number];

export const NIVELES_LOG = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type NivelLog = (typeof NIVELES_LOG)[number];

@ValidatorConstraint({ name: 'zonaHoraria' })
class ZonaHorariaValida implements ValidatorConstraintInterface {
  validate(valor: unknown): boolean {
    return typeof valor === 'string' && esZonaHorariaValida(valor);
  }
}

/**
 * Variables del `.env` que el backend necesita para arrancar.
 * Variable nueva → esta clase, `.env.example` y el `env:` del CI.
 * Se leen con `ConfigService<EnvironmentVariables, true>`, nunca con `process.env`.
 */
export class EnvironmentVariables {
  @IsIn(ENTORNOS, {
    message: 'NODE_ENV debe ser development, test o production',
  })
  NODE_ENV: Entorno = 'development';

  @Max(65535, {
    message: 'PORT debe ser un número de puerto válido (1 a 65535)',
  })
  @Min(1, { message: 'PORT debe ser un número de puerto válido (1 a 65535)' })
  @IsInt({ message: 'PORT debe ser un número entero' })
  @Type(() => Number)
  PORT = 3000;

  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL debe empezar con postgresql://',
  })
  @IsNotEmpty({ message: 'DATABASE_URL es obligatoria' })
  @IsString({ message: 'DATABASE_URL es obligatoria' })
  DATABASE_URL: string;

  @Matches(/^rediss?:\/\/.+/, {
    message: 'REDIS_URL debe empezar con redis://',
  })
  @IsNotEmpty({ message: 'REDIS_URL es obligatoria' })
  @IsString({ message: 'REDIS_URL es obligatoria' })
  REDIS_URL: string;

  /** Orígenes (sitios web) que pueden llamar a la API desde el navegador, separados por coma. */
  @Matches(/^https?:\/\/[^/\s,]+$/, {
    each: true,
    message:
      'CORS_ORIGINS debe tener direcciones como http://localhost:4200 (sin / al final), separadas por coma',
  })
  @ArrayNotEmpty({ message: 'CORS_ORIGINS es obligatoria' })
  @IsArray({ message: 'CORS_ORIGINS es obligatoria' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((origen) => origen.trim())
          .filter((origen) => origen !== '')
      : value,
  )
  CORS_ORIGINS: string[];

  /** `true` solo detrás de Nginx: así se toma la IP real del usuario y no la de Nginx. */
  @IsBoolean({ message: 'TRUST_PROXY debe ser true o false' })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  TRUST_PROXY = false;

  /** Cuánto se escribe en el log: `info` normalmente; `debug` para investigar; `silent` en los e2e. */
  @IsIn(NIVELES_LOG, {
    message: 'LOG_LEVEL debe ser fatal, error, warn, info, debug, trace o silent',
  })
  LOG_LEVEL: NivelLog = 'info';

  /**
   * La zona del negocio (regla 11): de ella salen la hora y "qué día es", esté donde esté el
   * servidor. Se elige al instalar y no se cambia con datos guardados (EMP-D7).
   */
  @Validate(ZonaHorariaValida, {
    message:
      'ZONA_NEGOCIO debe ser el nombre exacto de una zona horaria, como America/Guayaquil (ni -05:00 ni EST)',
  })
  ZONA_NEGOCIO = ZONA_NEGOCIO_POR_DEFECTO;

  // ─── Sesión (docs/modulos/auth-usuarios.md, sección 6) ───

  /**
   * Firma de los access token (HS256). Al azar y largo: `openssl rand -base64 64`. Uno distinto
   * por instalación; cambiarlo corta todos los access token (en 15 minutos como mucho, el refresh
   * los vuelve a dar).
   */
  @MinLength(64, {
    message:
      'JWT_SECRETO debe tener al menos 64 caracteres (generarlo con: openssl rand -base64 64)',
  })
  @IsString({ message: 'JWT_SECRETO es obligatoria (generarla con: openssl rand -base64 64)' })
  JWT_SECRETO: string;

  /** Lo más que dura una sesión, aunque se use sin parar: una jornada. */
  @Max(24, { message: 'SESION_DURACION_MAXIMA_HORAS debe ser de 1 a 24 horas' })
  @Min(1, { message: 'SESION_DURACION_MAXIMA_HORAS debe ser de 1 a 24 horas' })
  @IsInt({ message: 'SESION_DURACION_MAXIMA_HORAS debe ser un número entero de horas' })
  @Type(() => Number)
  SESION_DURACION_MAXIMA_HORAS = 13;

  /** Sin usar la sesión este tiempo, se corta (se mide en cada refresh: hasta 15 minutos de margen). */
  @Max(720, { message: 'SESION_INACTIVIDAD_MINUTOS debe ser de 15 a 720 minutos' })
  @Min(15, { message: 'SESION_INACTIVIDAD_MINUTOS debe ser de 15 a 720 minutos' })
  @IsInt({ message: 'SESION_INACTIVIDAD_MINUTOS debe ser un número entero de minutos' })
  @Type(() => Number)
  SESION_INACTIVIDAD_MINUTOS = 120;

  // ─── Límite de peticiones por minuto (AUTH-D17; revisar con la prueba de carga) ───

  /** Intentos de login por IP. */
  @Max(100_000, { message: 'LIMITE_LOGIN_POR_MINUTO debe ser de 1 a 100000' })
  @Min(1, { message: 'LIMITE_LOGIN_POR_MINUTO debe ser de 1 a 100000' })
  @IsInt({ message: 'LIMITE_LOGIN_POR_MINUTO debe ser un número entero' })
  @Type(() => Number)
  LIMITE_LOGIN_POR_MINUTO = 10;

  /** Peticiones de un usuario con sesión (sumando todos sus equipos). */
  @Max(100_000, { message: 'LIMITE_USUARIO_POR_MINUTO debe ser de 1 a 100000' })
  @Min(1, { message: 'LIMITE_USUARIO_POR_MINUTO debe ser de 1 a 100000' })
  @IsInt({ message: 'LIMITE_USUARIO_POR_MINUTO debe ser un número entero' })
  @Type(() => Number)
  LIMITE_USUARIO_POR_MINUTO = 300;

  /**
   * Peticiones sin sesión (login, refresh) por IP. Toda una oficina detrás de una sola IP
   * comparte este cupo y el del login: subirlos si es el caso.
   */
  @Max(100_000, { message: 'LIMITE_IP_POR_MINUTO debe ser de 1 a 100000' })
  @Min(1, { message: 'LIMITE_IP_POR_MINUTO debe ser de 1 a 100000' })
  @IsInt({ message: 'LIMITE_IP_POR_MINUTO debe ser un número entero' })
  @Type(() => Number)
  LIMITE_IP_POR_MINUTO = 60;

  // ─── Solo para `pnpm admin:crear-inicial` (la API no las usa; pueden faltar) ───
  // Las revisa el propio comando, que dice cuál falta. La contraseña es temporal: se cambia al
  // entrar. Después de correrlo, borrar ADMIN_INICIAL_CONTRASENA del .env.

  @IsString({ message: 'EMPRESA_INICIAL_NOMBRE debe ser texto' })
  @IsOptional()
  EMPRESA_INICIAL_NOMBRE?: string;

  @IsString({ message: 'ADMIN_INICIAL_USUARIO debe ser texto' })
  @IsOptional()
  ADMIN_INICIAL_USUARIO?: string;

  @IsString({ message: 'ADMIN_INICIAL_NOMBRE debe ser texto' })
  @IsOptional()
  ADMIN_INICIAL_NOMBRE?: string;

  @IsString({ message: 'ADMIN_INICIAL_CONTRASENA debe ser texto' })
  @IsOptional()
  ADMIN_INICIAL_CONTRASENA?: string;
}

import type { DeclaracionAuditoria } from '../auditoria/domain/catalogo-auditoria.js';
import { MotivoLoginFallido } from './application/use-cases/iniciar-sesion.use-case.js';
import { MotivoCierreSesion } from './domain/entities/sesion.entity.js';

/**
 * Lo que registra el módulo `auth` en la bitácora. Se junta en `src/catalogo-auditoria.ts`; una
 * acción, un campo o un valor nuevo se agrega aquí y en los textos del frontend (AUD-D9).
 */
export const AUDITORIA_AUTH: DeclaracionAuditoria = {
  modulo: 'auth',
  acciones: [
    'auth.usuario.crear',
    'auth.usuario.dar_acceso',
    'auth.usuario.editar',
    'auth.usuario.asignar_roles',
    'auth.usuario.contrasena_temporal',
    'auth.usuario.desbloquear',
    'auth.usuario.cerrar_sesiones',
    'auth.usuario.quitar_acceso',
    'auth.usuario.desactivar',
    'auth.usuario.reactivar',
    'auth.usuario.cambiar_contrasena',
    'auth.usuario.cambiar_contrasena_fallido',
    'auth.usuario.bloquear',
    'auth.rol.crear',
    'auth.rol.editar',
    'auth.rol.permisos',
    'auth.rol.desactivar',
    'auth.rol.reactivar',
    'auth.sesion.iniciar',
    'auth.sesion.fallido',
    'auth.sesion.cambiar_empresa',
    'auth.sesion.cerrar',
    'auth.sesion.reuso',
  ],
  campos: [
    'nombreUsuario',
    'nombreCompleto',
    'nombre',
    'descripcion',
    'esAdministrador',
    'activo',
    'roles',
    'permisos',
    'claveTemporal',
    'debeCambiarContrasena',
    'bloqueadoHasta',
    'intentosFallidos',
    'motivo',
    'empresa',
    'empresaId',
    'venceEn',
    'motivoCierre',
    'sesionesCerradas',
  ],
  valores: {
    motivo: Object.values(MotivoLoginFallido),
    motivoCierre: Object.values(MotivoCierreSesion),
  },
};

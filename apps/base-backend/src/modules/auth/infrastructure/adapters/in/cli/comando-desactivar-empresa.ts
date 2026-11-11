import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../../../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { DesactivarEmpresaConSesionesPort } from '../../../../application/ports/in/desactivar-empresa-con-sesiones.port.js';
import {
  actorDelComando,
  type ComandoAdmin,
  correr,
  preguntarHasta,
  rechazo,
  SALIDA_ERROR,
  SALIDA_OK,
  valido,
} from './comun.js';
import type { Terminal } from './terminal.js';

/** Para comparar el nombre escrito al confirmar: sin mayúsculas, tildes ni espacios de más. */
const comparable = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();

/**
 * `pnpm admin:desactivar-empresa`: muestra las empresas activas, se elige una por su número y
 * se confirma escribiendo su nombre. Nadie puede entrar a ella después; sus datos quedan (EMP-D9).
 * Las sesiones abiertas en ella se cierran en la misma transacción (6.5d).
 */
export class ComandoDesactivarEmpresa implements ComandoAdmin {
  constructor(
    private readonly consultar: ConsultarEmpresasPort,
    private readonly desactivar: DesactivarEmpresaConSesionesPort,
    private readonly terminal: Terminal,
  ) {}

  ejecutar(): Promise<number> {
    return correr(this.terminal, async () => {
      const t = this.terminal;
      const activas = await this.consultar.listarActivas();
      if (activas.length === 0) {
        t.escribir('No hay empresas activas: no hay nada que desactivar.');
        return SALIDA_OK;
      }
      t.escribir('Empresas activas (Ctrl+C cancela sin cambios):');
      activas.forEach((empresa, indice) => {
        t.escribir(`  ${indice + 1}. ${empresa.nombre}  (id ${empresa.id})`);
      });

      const elegida = await preguntarHasta(
        t,
        () => t.preguntar('Número de la empresa a desactivar: '),
        (respuesta) => {
          const empresa = /^\d+$/u.test(respuesta.trim())
            ? activas[Number(respuesta) - 1]
            : undefined;
          return empresa === undefined
            ? rechazo(`Escriba un número del 1 al ${activas.length}.`)
            : valido(empresa);
        },
      );
      if (elegida === null) return SALIDA_ERROR;
      const empresa: EmpresaConsultada = elegida.valor;

      t.escribir(
        `Nadie podrá entrar a «${empresa.nombre}». Sus datos quedan guardados: no se borra nada.`,
      );
      if (activas.length === 1) {
        t.escribir('OJO: es la única empresa activa. Después, nadie podrá entrar al sistema.');
      }
      const confirmacion = await t.preguntar('Para confirmar, escriba el nombre de la empresa: ');
      if (comparable(confirmacion) !== comparable(empresa.nombre)) {
        t.escribir('El nombre no coincide: no se hizo ningún cambio.');
        return SALIDA_ERROR;
      }

      const resultado = await this.desactivar.desactivar(
        empresa.id,
        actorDelComando('admin:desactivar-empresa'),
      );
      t.escribir(
        resultado.yaEstabaDesactivada
          ? `«${empresa.nombre}» ya estaba desactivada.`
          : `Listo. «${empresa.nombre}» quedó desactivada.`,
      );
      t.escribir(
        resultado.sesionesCerradas === 0
          ? 'No había sesiones abiertas en ella.'
          : `Se cerraron ${resultado.sesionesCerradas} sesiones abiertas en ella.`,
      );
      return SALIDA_OK;
    });
  }
}

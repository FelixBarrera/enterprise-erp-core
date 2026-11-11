import type {
  ConsultarEmpresasPort,
  EmpresaConsultada,
} from '../../../../../empresas/application/ports/in/consultar-empresas.port.js';
import type { RenombrarEmpresaPort } from '../../../../../empresas/application/ports/in/renombrar-empresa.port.js';
import {
  actorDelComando,
  type ComandoAdmin,
  correr,
  esSi,
  obligatorio,
  preguntarHasta,
  rechazo,
  SALIDA_ERROR,
  SALIDA_OK,
  valido,
} from './comun.js';
import type { Terminal } from './terminal.js';

/**
 * `pnpm admin:renombrar-empresa` (6.15a): muestra las empresas activas, se elige una por su número,
 * se escribe el nombre nuevo y se confirma. Queda en la bitácora de esa empresa como
 * `empresas.empresa.editar`. Quienes estén dentro ven el nombre nuevo al recargar la página.
 */
export class ComandoRenombrarEmpresa implements ComandoAdmin {
  constructor(
    private readonly consultar: ConsultarEmpresasPort,
    private readonly renombrar: RenombrarEmpresaPort,
    private readonly terminal: Terminal,
  ) {}

  ejecutar(): Promise<number> {
    return correr(this.terminal, async () => {
      const t = this.terminal;
      const activas = await this.consultar.listarActivas();
      if (activas.length === 0) {
        t.escribir('No hay empresas activas: no hay nada que renombrar.');
        return SALIDA_OK;
      }
      t.escribir('Empresas activas (Ctrl+C cancela sin cambios):');
      activas.forEach((empresa, indice) => {
        t.escribir(`  ${indice + 1}. ${empresa.nombre}  (id ${empresa.id})`);
      });

      const elegida = await preguntarHasta(
        t,
        () => t.preguntar('Número de la empresa a renombrar: '),
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

      const nuevo = await preguntarHasta(
        t,
        () => t.preguntar(`Nombre nuevo de «${empresa.nombre}»: `),
        obligatorio,
      );
      if (nuevo === null) return SALIDA_ERROR;

      t.escribir('');
      t.escribir(`Nombre actual: ${empresa.nombre}`);
      t.escribir(`Nombre nuevo:  ${nuevo.valor}`);
      if (!esSi(await t.preguntar('¿Cambiar el nombre? (s/n): '))) {
        t.escribir('No se hizo ningún cambio.');
        return SALIDA_ERROR;
      }

      const resultado = await this.renombrar.renombrar(
        empresa.id,
        nuevo.valor,
        actorDelComando('admin:renombrar-empresa'),
      );
      t.escribir(
        resultado.cambio
          ? `Listo. «${empresa.nombre}» ahora se llama «${resultado.empresa.nombre}». Quienes estén dentro lo verán al recargar la página.`
          : `«${empresa.nombre}» ya tenía ese nombre: no se hizo ningún cambio.`,
      );
      return SALIDA_OK;
    });
  }
}

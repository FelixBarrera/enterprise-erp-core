import type { Empresa } from '../../domain/entities/empresa.entity.js';
import type { EmpresaConsultada } from '../ports/in/consultar-empresas.port.js';

export function aEmpresaConsultada(empresa: Empresa): EmpresaConsultada {
  return { id: empresa.id, nombre: empresa.nombre.valor, activo: empresa.activo };
}

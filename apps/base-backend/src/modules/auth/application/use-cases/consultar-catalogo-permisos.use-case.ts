import { Inject, Injectable } from '@nestjs/common';
import { CatalogoPermisos } from '../../domain/services/catalogo-permisos.js';
import type {
  ConsultarCatalogoPermisosPort,
  GrupoPermisosVista,
} from '../ports/in/consultar-catalogo-permisos.port.js';
import {
  CATALOGO_PERMISOS_PORT,
  type CatalogoPermisosDeclarado,
} from '../ports/out/catalogo-permisos.port.js';

/**
 * Lee el catálogo del código, no la base: al arrancar se copia a `seguridad.permisos`, así que
 * los vigentes de la base son exactamente estos (los obsoletos ya no están en el código). Sin
 * consultas, y con los nombres de los módulos, que la base no guarda.
 */
@Injectable()
export class ConsultarCatalogoPermisosUseCase implements ConsultarCatalogoPermisosPort {
  private readonly grupos: GrupoPermisosVista[];

  constructor(@Inject(CATALOGO_PERMISOS_PORT) declarado: CatalogoPermisosDeclarado) {
    // Si estuviera mal escrito, la sincronización del arranque ya habría detenido la API.
    this.grupos = CatalogoPermisos.desde(declarado).grupos.map((g) => ({
      modulo: g.modulo,
      nombre: g.nombre,
      permisos: g.permisos.map((p) => ({ codigo: p.codigo, descripcion: p.descripcion })),
    }));
  }

  execute(): GrupoPermisosVista[] {
    return this.grupos;
  }
}

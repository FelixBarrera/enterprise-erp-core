import { Inject, Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants.js';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { reglasDeAcceso } from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import {
  CATALOGO_PERMISOS_PORT,
  type CatalogoPermisosDeclarado,
} from '../../../../application/ports/out/catalogo-permisos.port.js';

/**
 * AUTH-D9: al arrancar, revisa que **cada** ruta de **cada** controller tenga exactamente una
 * regla de acceso (`@Publico()`, `@SoloSesion()` o `@RequierePermiso()`) y que el permiso de
 * `@RequierePermiso()` esté en el catálogo (`src/catalogo-permisos.ts`). Si no, la API no
 * arranca y el error dice cuáles: nadie puede olvidarse de proteger un endpoint, ni pedir un
 * permiso que nadie puede tener. Una ruta `@Publico()` con permiso tiene dos reglas: tampoco.
 */
@Injectable()
export class RevisorReglasAcceso implements OnApplicationBootstrap {
  constructor(
    private readonly descubrimiento: DiscoveryService,
    private readonly escaner: MetadataScanner,
    @Inject(CATALOGO_PERMISOS_PORT) private readonly catalogo: CatalogoPermisosDeclarado,
  ) {}

  onApplicationBootstrap(): void {
    const malas = this.rutasMal();
    if (malas.length > 0) {
      throw new Error(
        'Rutas sin exactamente una regla de acceso (@Publico, @SoloSesion, @RequierePermiso) ' +
          `o con un permiso fuera del catálogo, AUTH-D9: ${malas.join(', ')}`,
      );
    }
  }

  /** `Controller.metodo (motivo)` de cada ruta con 0 reglas, con más de 1 o con un permiso que no existe. */
  rutasMal(): string[] {
    const declarados = new Set(this.catalogo.flatMap((d) => Object.keys(d.permisos)));
    const malas: string[] = [];
    for (const { metatype } of this.descubrimiento.getControllers()) {
      if (typeof metatype !== 'function') {
        continue;
      }
      const prototipo = metatype.prototype as Record<string, unknown>;
      for (const nombre of this.escaner.getAllMethodNames(prototipo)) {
        const metodo = prototipo[nombre];
        if (typeof metodo !== 'function') {
          continue;
        }
        const esRuta: unknown = Reflect.getMetadata(METHOD_METADATA, metodo);
        if (esRuta === undefined) {
          continue;
        }
        const reglas = reglasDeAcceso(metodo);
        const [regla] = reglas;
        if (regla === undefined || reglas.length > 1) {
          malas.push(`${metatype.name}.${nombre} (${reglas.length} reglas)`);
        } else if (regla.tipo === 'permiso' && !declarados.has(regla.codigo)) {
          malas.push(`${metatype.name}.${nombre} (permiso «${regla.codigo}» fuera del catálogo)`);
        }
      }
    }
    return malas;
  }
}

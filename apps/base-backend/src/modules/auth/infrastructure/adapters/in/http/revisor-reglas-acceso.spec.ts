import { Controller, Get, Post } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  Publico,
  RequierePermiso,
  SoloSesion,
} from '../../../../../../shared/infrastructure/http/acceso/acceso.decorators.js';
import {
  CATALOGO_PERMISOS_PORT,
  type CatalogoPermisosDeclarado,
} from '../../../../application/ports/out/catalogo-permisos.port.js';
import { RevisorReglasAcceso } from './revisor-reglas-acceso.js';

const CATALOGO: CatalogoPermisosDeclarado = [
  { modulo: 'ventas', nombre: 'Ventas', permisos: { 'ventas.factura.ver': 'Ver facturas' } },
];

@Controller('bien')
class ControllerBien {
  @Get()
  @Publico()
  ver(): void {}

  @Post()
  @SoloSesion()
  crear(): void {}

  @Get('facturas')
  @RequierePermiso('ventas.factura.ver')
  facturas(): void {}

  /** No es una ruta: no necesita regla. */
  ayudante(): void {}
}

@Controller('mal')
class ControllerMal {
  @Get('sin')
  sinRegla(): void {}

  @Get('dos')
  @Publico()
  @SoloSesion()
  conDos(): void {}

  @Get('publica-con-permiso')
  @Publico()
  @RequierePermiso('ventas.factura.ver')
  publicaConPermiso(): void {}

  @Get('inventado')
  @RequierePermiso('ventas.factura.anular')
  inventado(): void {}
}

async function revisor(...controllers: (typeof ControllerBien | typeof ControllerMal)[]) {
  const modulo = await Test.createTestingModule({
    imports: [DiscoveryModule],
    controllers,
    providers: [RevisorReglasAcceso, { provide: CATALOGO_PERMISOS_PORT, useValue: CATALOGO }],
  }).compile();
  return modulo.get(RevisorReglasAcceso);
}

describe('RevisorReglasAcceso (AUTH-D9)', () => {
  it('con todas las rutas bien, arranca', async () => {
    const r = await revisor(ControllerBien);
    expect(r.rutasMal()).toEqual([]);
    expect(() => r.onApplicationBootstrap()).not.toThrow();
  });

  it('sin regla, con dos (también @Publico con permiso) o con un permiso que no existe, no arranca y dice cuáles', async () => {
    const r = await revisor(ControllerBien, ControllerMal);
    const esperadas = [
      'ControllerMal.sinRegla (0 reglas)',
      'ControllerMal.conDos (2 reglas)',
      'ControllerMal.publicaConPermiso (2 reglas)',
      'ControllerMal.inventado (permiso «ventas.factura.anular» fuera del catálogo)',
    ];
    expect(r.rutasMal()).toEqual(esperadas);
    expect(() => r.onApplicationBootstrap()).toThrow(
      'Rutas sin exactamente una regla de acceso (@Publico, @SoloSesion, @RequierePermiso) ' +
        `o con un permiso fuera del catálogo, AUTH-D9: ${esperadas.join(', ')}`,
    );
  });
});

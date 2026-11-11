import { Injectable } from '@nestjs/common';
import { ClsService, type ClsStore } from 'nestjs-cls';
import type { ContextoPeticionPort } from '../../application/ports/contexto-peticion.port.js';

/** Lo que se guarda de cada petición (nestjs-cls lo mantiene aparte para cada una). */
export interface DatosPeticion extends ClsStore {
  ip: string | null;
  navegador: string | null;
}

/** Lee los datos de la petición en curso con nestjs-cls (fuera de una petición, `null`). */
@Injectable()
export class ContextoPeticionCls implements ContextoPeticionPort {
  constructor(private readonly cls: ClsService<DatosPeticion>) {}

  requestId(): string | null {
    return this.cls.isActive() ? (this.cls.getId() ?? null) : null;
  }

  ip(): string | null {
    return this.cls.isActive() ? (this.cls.get('ip') ?? null) : null;
  }

  navegador(): string | null {
    return this.cls.isActive() ? (this.cls.get('navegador') ?? null) : null;
  }
}

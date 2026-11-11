import { Injectable } from '@nestjs/common';
import type { RelojPort } from '../../application/ports/reloj.port.js';

/** El reloj real: el único lugar del backend que lee la hora del servidor. */
@Injectable()
export class RelojSistema implements RelojPort {
  ahora(): Date {
    return new Date();
  }
}

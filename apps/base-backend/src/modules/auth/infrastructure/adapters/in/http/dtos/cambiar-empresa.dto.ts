import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString } from 'class-validator';

/** `POST /auth/empresa`. */
export class CambiarEmpresaDto {
  @ApiProperty({
    description: 'Id de la empresa a la que quiere pasar (una de `empresas` de `GET /auth/sesion`)',
    example: '0190a4f2-1c2b-7000-8000-000000000002',
  })
  @IsUUID('all', { message: 'El id de la empresa no es válido' })
  @IsString({ message: 'El id de la empresa es obligatorio y debe ser texto' })
  empresaId: string;
}

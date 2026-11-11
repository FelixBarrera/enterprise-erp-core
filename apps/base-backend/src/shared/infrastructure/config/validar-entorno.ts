import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment-variables.js';

/**
 * Valida el `.env` al arrancar. Si falta algo o está mal, el backend no arranca
 * y el mensaje dice qué variable corregir (sin mostrar su valor).
 */
export function validarEntorno(config: Record<string, unknown>): EnvironmentVariables {
  const variables = plainToInstance(EnvironmentVariables, config);
  const errores = validateSync(variables, { stopAtFirstError: true });

  if (errores.length > 0) {
    const detalle = errores
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((mensaje) => `  - ${mensaje}`)
      .join('\n');
    throw new Error(`Configuración inválida en el .env:\n${detalle}`);
  }

  return variables;
}

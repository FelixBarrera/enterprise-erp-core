import { readFileSync } from 'node:fs';
import { Contrasena } from '../../../../domain/value-objects/contrasena.vo.js';
import {
  ARCHIVO_CONTRASENAS_COMUNES,
  ContrasenasComunesArchivo,
} from './contrasenas-comunes.archivo.js';

describe('ContrasenasComunesArchivo', () => {
  const comunes = new ContrasenasComunesArchivo();

  it('carga la lista entera: 2.087 de 8 a 128 caracteres, en minúsculas y sin repetidas', () => {
    const lineas = readFileSync(ARCHIVO_CONTRASENAS_COMUNES, 'utf8').trimEnd().split('\n');
    expect(comunes.cantidad).toBe(2087);
    expect(new Set(lineas).size).toBe(lineas.length);
    expect(lineas.every((linea) => linea === linea.toLowerCase())).toBe(true);
    expect(lineas.every((linea) => linea.length >= 8 && linea.length <= 128)).toBe(true);
  });

  it.each(['password', 'PASSWORD', 'iloveyou', 'sunshine', 'football'])('%j es común', (texto) => {
    expect(comunes.esComun(texto)).toBe(true);
  });

  it('una frase propia no lo es', () => {
    expect(comunes.esComun('caballo bateria grapa')).toBe(false);
  });

  it('con Contrasena: la rechaza por común', () => {
    const contexto = {
      nombreUsuario: 'ana',
      nombresEmpresas: [],
      esComun: (texto: string) => comunes.esComun(texto),
    };
    expect(() => Contrasena.crear('Sunshine', contexto)).toThrow(
      'La contraseña es demasiado común',
    );
  });

  it('ignora líneas vacías y fines de línea de Windows', () => {
    const lista = ContrasenasComunesArchivo.desdeTexto('uno12345\r\n\r\n  dos12345 \n');
    expect([...lista]).toEqual(['uno12345', 'dos12345']);
  });
});

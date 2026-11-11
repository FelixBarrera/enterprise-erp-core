/**
 * Un texto como se guarda: NFC (una "é" escrita de dos formas queda igual), espacios repetidos
 * juntados y recortado. Lo usan los nombres del módulo.
 */
export function textoLimpio(texto: string): string {
  return texto.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

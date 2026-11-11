/**
 * Termina una frase con punto, salvo que ya termine en uno (o en «?», «!» o «…»).
 * Para frases que acaban en un dato escrito por alguien: «… en Comercial S.A.» no debe salir
 * «… en Comercial S.A..».
 */
export function cerrarFrase(texto: string): string {
  const sinEspacios = texto.trimEnd();
  return /[.!?…]$/u.test(sinEspacios) ? sinEspacios : `${sinEspacios}.`;
}

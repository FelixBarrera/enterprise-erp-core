// Si la persona dejó el menú lateral estrecho en la PC (la franja con los íconos), recordado en el
// navegador: solo una preferencia de aspecto, nada sensible. Si el navegador no deja guardar (modo
// privado, almacenamiento bloqueado), el menú empieza ancho.

const CLAVE = 'menu.estrecho';

export function leerMenuEstrecho(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'si';
  } catch {
    return false;
  }
}

export function guardarMenuEstrecho(estrecho: boolean): void {
  try {
    if (estrecho) localStorage.setItem(CLAVE, 'si');
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento: la preferencia dura hasta recargar.
  }
}

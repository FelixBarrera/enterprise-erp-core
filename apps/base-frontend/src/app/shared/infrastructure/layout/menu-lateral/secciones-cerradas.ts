// Qué secciones del menú dejó cerradas la persona, recordado en el navegador (solo una
// preferencia de aspecto: nada sensible). Si el navegador no deja guardar (modo privado,
// almacenamiento bloqueado), el menú funciona igual con todo abierto.

const CLAVE = 'menu.secciones-cerradas';

export function leerSeccionesCerradas(): ReadonlySet<string> {
  try {
    const texto = localStorage.getItem(CLAVE);
    const valor: unknown = texto ? JSON.parse(texto) : [];
    if (!Array.isArray(valor)) return new Set();
    return new Set(
      (valor as readonly unknown[]).filter((id): id is string => typeof id === 'string'),
    );
  } catch {
    return new Set();
  }
}

export function guardarSeccionesCerradas(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify([...ids]));
  } catch {
    // Sin almacenamiento: la preferencia dura hasta recargar.
  }
}

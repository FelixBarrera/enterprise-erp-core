/**
 * Dirección de la API, siempre **relativa** (regla 11 de docs/arquitectura-frontend.md):
 * en desarrollo la resuelve el proxy (`proxy.conf.json`) y en producción Nginx, en el mismo
 * dominio (sin CORS y con la cookie `SameSite=Strict`). Nunca escribir `http://…` en el código.
 *
 * Uso en un `<modulo>.api.ts`: `this.http.get(`${URL_API}/clientes`)`.
 */
export const URL_API = '/api/v1';

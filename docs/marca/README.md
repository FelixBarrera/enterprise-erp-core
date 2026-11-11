# Marca: originales

La marca es **provisional** hasta que el negocio entregue color y logo (`docs/arquitectura-frontend.md`, sección 8.6). La de hoy (tres barras que suben, la última dorada, y «Base ERP») sale de la maqueta que el usuario aprobó el 2026-11-06 (paso 6.10b0); es un dibujo propio.

| Archivo | Para qué |
|---|---|
| `apps/base-frontend/src/app/shared/infrastructure/layout/marca/marca.component.ts` | El logo **dentro de la aplicación** (`<app-marca>`: menú, cabecera, login), con la fuente Inter |
| `apps/base-frontend/public/marca/logo.svg`, `logo-claro.svg` | El mismo logo como imagen, para fondo claro y oscuro (fuera de la aplicación: documentos, correos) |
| `apps/base-frontend/public/marca/simbolo.svg` | Favicon e íconos "normales" de la PWA (esquinas redondeadas, fondo transparente) |
| `docs/marca/icono-pwa-maskable.svg` | Íconos "maskable" de la PWA y del iPhone: fondo a sangre, símbolo dentro del 80 % central (el teléfono recorta la forma) |

## Regenerar los PNG de `public/iconos-app/`

Con Chrome (no hace falta instalar nada más). Desde la raíz del proyecto:

```bash
png() {  # png <svg> <tamaño> <salida>
  local t; t=$(mktemp -d)
  printf '<html><body style="margin:0"><img src="file://%s" width="%s" height="%s" style="display:block"></body></html>' \
    "$(realpath "$1")" "$2" "$2" > "$t/p.html"
  google-chrome --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size="$2,$2" --screenshot="$(realpath -m "$3")" "file://$t/p.html"
  rm -rf "$t"
}
P=apps/base-frontend/public
png $P/marca/simbolo.svg 192 $P/iconos-app/icono-192.png
png $P/marca/simbolo.svg 512 $P/iconos-app/icono-512.png
png docs/marca/icono-pwa-maskable.svg 192 $P/iconos-app/icono-maskable-192.png
png docs/marca/icono-pwa-maskable.svg 512 $P/iconos-app/icono-maskable-512.png
png docs/marca/icono-pwa-maskable.svg 180 $P/iconos-app/icono-iphone-180.png
```

Al cambiar el color: también `theme_color` en `public/manifest.webmanifest` y `<meta name="theme-color">` en `src/index.html`.

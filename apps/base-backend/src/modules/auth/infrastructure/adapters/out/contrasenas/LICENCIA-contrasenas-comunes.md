# Lista de contraseñas comunes: origen y licencia

`contrasenas-comunes.txt` es la lista que rechaza `Contrasena` (AUTH-D20, `docs/modulos/auth-usuarios.md`).

- **Origen**: SecLists, `Passwords/Common-Credentials/10k-most-common.txt` (las 10.000 más comunes), en el commit `913b327317496d062bcc7cace524aaad8a693be2` (2026-09-08) de https://github.com/danielmiessler/SecLists.
- **Qué se cambió**: se pasó a minúsculas, se quitaron las repetidas y se dejaron solo las de **8 a 128 caracteres** (2.087 de las 10.000). Las más cortas ya las rechaza el largo mínimo: el resultado es el mismo con un archivo cinco veces más chico.
- **Para actualizarla**: descargar el archivo de nuevo y repetir el filtro:
  `tr 'A-Z' 'a-z' < 10k-most-common.txt | awk 'length>=8 && length<=128 && !seen[$0]++' > contrasenas-comunes.txt`
  y anotar aquí el commit nuevo.

## Licencia de SecLists (MIT)

```
MIT License

Copyright (c) 2018 Daniel Miessler

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

# Pruebas manuales: empresas

La empresa **no tiene pantalla** (6.15b): el usuario solo ve su nombre (en el menú lateral y en el menú del usuario) y, si trabaja en más de una, «Cambiar de empresa». Crear, desactivar y renombrar empresas se hace en el servidor con los comandos `admin:*` (EMP-D2, 6.15a). La API (`GET`/`PATCH /empresa`) se queda.

Tiempo aproximado: 10 minutos.

## Necesita antes

- Haber hecho `auth-usuarios.md`: el administrador de dos empresas y el usuario de prueba (`prueba2.MMDD`).
- Ventana normal: el administrador. Ventana de incógnito: el usuario de prueba.
- Acceso a la terminal del servidor, con `pnpm build` hecho (los comandos se corren desde `dist/`).
- Anotar el nombre actual de la empresa activa del administrador (se vuelve a poner al terminar).

## Casos

| # | Pasos | Debe pasar |
|---|---|---|
| E1 | Administrador: abrir el menú «Administración» | Se ven «Usuarios», «Roles» y «Bitácora»; **no** hay «Empresa» (el Administrador tiene todos los permisos, y aun así no aparece) |
| E2 | Escribir a mano `/empresa` en la barra de direcciones | No se abre ninguna pantalla de la empresa: vuelve al inicio |
| E3 | Mirar el menú lateral y el menú del usuario | El nombre de la empresa activa se ve en los dos |
| E4 | En la terminal: `pnpm admin:renombrar-empresa`, elegir la empresa activa del administrador, escribir el nombre anotado con « MMDD» al final y confirmar con `s` | «Listo. «X» ahora se llama «X MMDD». Quienes estén dentro lo verán al recargar la página.» |
| E5 | En el navegador del administrador, recargar la página | El nombre nuevo se ve en el menú lateral y en el menú del usuario |
| E6 | Menú del usuario → «Cambiar de empresa» | La lista muestra el nombre nuevo |
| E7 | En la terminal, otra vez `pnpm admin:renombrar-empresa` con la misma empresa, escribir el nombre de **la otra** empresa del administrador (con otras mayúsculas o sin tildes) y confirmar | «No se pudo: Ya existe una empresa con ese nombre. No se guardó ningún cambio.» |
| E8 | Bitácora → abrir el evento «Cambió el nombre de la empresa» de E4 | El detalle muestra el nombre de antes y el de después; **no** hay «Ver su ficha» |
| E9 | Usuario de prueba: abrir el menú y escribir a mano `/empresa` | No hay «Empresa» en el menú y la dirección vuelve al inicio |

## Celular (390 × 844)

| # | Pasos | Debe pasar |
|---|---|---|
| EC1 | Abrir el menú | Tampoco aparece «Empresa»; el nombre de la empresa se ve en el menú |

## Al terminar

- Volver a poner el nombre anotado al empezar con `pnpm admin:renombrar-empresa`.
- No se crea nada más en este archivo.

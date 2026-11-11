# Pruebas manuales: auth (sesión, roles y usuarios)

Entrar y salir, la contraseña, cambiar de empresa, los permisos en el menú y las pantallas «Usuarios» y «Roles» (menú «Administración»). Diseño: `docs/modulos/auth-usuarios.md`.

Tiempo aproximado: 75 minutos. Las secciones van en orden: cada una usa lo que dejó la anterior.

## Necesita antes

- Lo de «Antes de empezar» del `README.md`: todo levantado y un **administrador que trabaja en dos empresas**.
- Ventana normal: el administrador. Ventana de **incógnito**: para el usuario de prueba (se crea en U6).
- `MMDD` es el mes y el día de hoy (por ejemplo, `1107`).

## 1. Entrar y salir

| # | Pasos | Debe pasar |
|---|---|---|
| S1 | Abrir http://localhost:4200 sin sesión | Lleva al login: «Ingrese a su cuenta», marca a la izquierda (en la PC) |
| S2 | Pulsar «Ingresar» con los dos campos vacíos | «Escriba su usuario» y «Escriba su contraseña» bajo cada campo. No se envía nada |
| S3 | Usuario que no existe (`no.existe.MMDD`) y cualquier contraseña | «Credenciales inválidas. Si falló varias veces, espere 15 minutos o pida ayuda al administrador.» |
| S4 | El administrador con una contraseña equivocada | **El mismo** mensaje de S3, y tarda más o menos lo mismo |
| S5 | Pulsar el ojo del campo «Contraseña» | Se ve lo escrito; otra vez, se oculta |
| S6 | Entrar con el administrador | Pantalla de inicio con el menú lateral, la empresa activa y su nombre en el menú del usuario (arriba a la derecha) |
| S7 | Recargar la página (F5) | Sigue dentro, sin volver a pedir la contraseña |
| S8 | Abrir otra pestaña en http://localhost:4200 | También entra sin pedir la contraseña |
| S9 | Menú del usuario → «Salir» | Vuelve al login. En la otra pestaña, al hacer algo (o al recargar), también pide entrar |
| S10 | Entrar de nuevo, copiar la URL de una pantalla (por ejemplo, `/roles`), salir y pegar esa URL | Pide entrar y, al entrar, lleva a esa pantalla |

## 2. Contraseña

| # | Pasos | Debe pasar |
|---|---|---|
| C1 | Administrador: menú del usuario → «Cambiar contraseña» | «Cambiar contraseña» con «Contraseña actual», «Contraseña nueva», «Repita la contraseña nueva» y la lista de reglas a la derecha |
| C2 | Escribir una nueva de 5 caracteres | «Debe tener entre 8 y 128 caracteres»; la regla del largo queda sin marcar |
| C3 | Escribir dos nuevas distintas | «Las dos contraseñas no coinciden» |
| C4 | Nueva `12345678` dos veces y guardar | El backend la rechaza por común (mensaje arriba del botón). No se cambia |
| C5 | Una nueva que contiene el nombre de usuario | La rechaza (contiene el usuario) |
| C6 | Contraseña actual equivocada y una nueva válida | «La contraseña actual no es correcta» |
| C7 | «Cancelar» | Vuelve a la pantalla de antes sin cambiar nada |
| C8 | Con una segunda sesión del administrador abierta en la ventana de incógnito: cambiar la contraseña con datos válidos | Aviso «Contraseña cambiada». Esta sesión sigue; la de incógnito, al hacer algo, vuelve al login |
| C9 | Entrar en incógnito con la contraseña vieja y después con la nueva | La vieja no entra (mensaje de S3); la nueva sí. Salir de incógnito |

## 3. Cambiar de empresa

| # | Pasos | Debe pasar |
|---|---|---|
| M1 | Menú del usuario → «Cambiar de empresa» | Diálogo con sus dos empresas, la activa marcada como «Empresa activa», y «La página se vuelve a cargar con los datos de la empresa que elija.» |
| M2 | «Cancelar» | No cambia nada |
| M3 | Elegir la otra empresa | Dice «Cambiando…», la página se recarga y el menú lateral y la cabecera muestran la otra empresa. «Usuarios» y «Roles» muestran los de esa empresa |
| M4 | Con dos pestañas abiertas, cambiar de empresa en una | La otra se recarga sola en el inicio, ya con la empresa nueva |
| M5 | En la PC, pulsar el botón para encoger el menú lateral | Queda una franja de íconos; al pasar el mouse o con Tab se ve el nombre de cada opción. Al recargar sigue encogido |
| M6 | Volver a la primera empresa | Para seguir con las pruebas en ella |

## 4. Roles

| # | Pasos | Debe pasar |
|---|---|---|
| R1 | Menú «Administración» → «Roles» | Lista con «Rol», «Permisos», «Usuarios» y «Estado». Está el rol «Administrador» |
| R2 | Buscar parte de un nombre, sin tildes y en mayúsculas | Encuentra el rol igual. La búsqueda queda en la URL: al recargar sigue filtrada |
| R3 | «Estado» → «Desactivados» y después «Limpiar filtros» | «Ningún rol coincide con los filtros.» (todavía no hay roles desactivados); «Limpiar filtros» vuelve a la lista completa |
| R4 | Buscar `zzz` | «Ningún rol coincide con los filtros.» |
| R5 | Abrir «Administrador» | «Tiene todos los permisos y no se puede cambiar.» Sin acción de desactivar ni campos para editar |
| R6 | «Nuevo rol» → pulsar «Registrar rol» con todo vacío | Pide el nombre. No se crea |
| R7 | Nombre «Administrador» (o «administrador») | «Ya existe un rol con ese nombre» |
| R8 | Nombre «Rol de prueba MMDD», una descripción y, en «Permisos», buscar «usuarios» y marcar solo «Ver usuarios»; registrar | Aviso «Rol creado» y se abre su ficha |
| R9 | En la ficha, pestaña «Permisos»: «Solo los marcados» | Se ve solo «Ver usuarios»; dice «1 de N marcados» |
| R10 | Marcar «Ver roles» y cambiar la descripción, sin guardar | Una barra «2 cambios sin guardar» (o el número que corresponda) con «Descartar» y guardar |
| R11 | Guardar | Aviso «Rol actualizado». El pie de la ficha dice «Modificado» con la hora y su usuario |
| R12 | Acción «Desactivar» → confirmar | Diálogo «Desactivar el rol». Al confirmar, la ficha dice «Está desactivado: no da sus permisos a quienes lo tienen.» |
| R13 | «Reactivar» | Vuelve a estar activo |
| R14 | «Ver historia» (en el pie de la ficha) | Abre la bitácora con todo lo que se hizo con este rol |

## 5. Usuarios

| # | Pasos | Debe pasar |
|---|---|---|
| U1 | Menú «Administración» → «Usuarios» | Lista con «Usuario», «Roles», «Último ingreso» y «Estado». Filtros «Buscar», «Rol» y «Estado» |
| U2 | Buscar parte del nombre del administrador, sin tildes | Lo encuentra. Al recargar, el filtro sigue |
| U3 | Abrir su propia ficha | «Es su usuario: no puede cambiar sus propios roles, quitarse el acceso ni desactivarse…». Sin esas acciones |
| U4 | «Nuevo usuario» → «Registrar usuario» con todo vacío | «Escriba el nombre de usuario», «Escriba el nombre completo» y «Elija al menos un rol.» |
| U5 | Nombre de usuario `Ñandú` o `a` | «Debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo» |
| U6 | Usuario `prueba.MMDD`, nombre «Persona de Prueba MMDD», rol «Rol de prueba MMDD»; registrar | Diálogo «Usuario creado» con la contraseña temporal y «Copiar». Solo se cierra con «Listo, ir a su ficha». **Anótela en un papel, no en este documento** |
| U7 | Crear otro con el mismo usuario `prueba.MMDD` | «Ese nombre de usuario ya existe (aunque esté desactivado, no se vuelve a usar). Elija otro» |
| U8 | En la lista: el usuario nuevo | Estado «Debe cambiar su contraseña» |
| U9 | Incógnito: entrar con `prueba.MMDD` y la temporal | Va directo a «Elija su contraseña», sin menú (solo la marca y «Salir»). Escribir otra URL a mano lleva de vuelta ahí |
| U10 | Elegir una contraseña nueva válida y «Guardar y continuar» | Entra. En «Administración», el menú muestra solo «Usuarios» y «Roles» (los permisos del rol desde R10) |
| U11 | Incógnito: abrir la ficha de un usuario | Se ve, pero sin «Acciones» ni campos para editar; no hay «Nuevo usuario» |
| U12 | Incógnito: escribir `/bitacora` en la barra | «No tiene permiso para ver esta pantalla» y vuelve al inicio |
| U13 | Administrador: ficha de `prueba.MMDD` → cambiar el nombre completo y guardar | Aviso «Usuario actualizado» |
| U14 | Pestaña «Roles»: sumarle «Administrador» | Se puede (el administrador puede dar ese rol). Guardar. Después quitárselo y guardar |
| U15 | Pestaña «Sesiones» | Se ve la sesión de incógnito: equipo, dirección IP, «Entró» y «Último uso» |
| U16 | «Acciones» → «Cerrar sus sesiones» → confirmar | Aviso con el número de sesiones cerradas. En incógnito, al hacer algo, vuelve al login |
| U17 | Incógnito: entrar 5 veces con una contraseña equivocada y una vez con la buena | Las 6 veces el mensaje de S3 (no dice si está bloqueado) |
| U18 | Administrador: recargar la ficha de `prueba.MMDD` | Estado «Bloqueado» y la acción «Desbloquear». Pulsarla: «Usuario desbloqueado». En incógnito, ya entra con la buena |
| U19 | «Acciones» → «Dar contraseña temporal» → confirmar | Diálogo «Contraseña temporal nueva» con «Copiar». Al cerrar con «Listo», el estado dice «Debe cambiar su contraseña» y la sesión de incógnito se cerró |
| U20 | Incógnito: entrar con la temporal nueva y elegir otra contraseña | Como U9 y U10 |
| U21 | «Acciones» → «Quitar acceso» → confirmar | Diálogo «Quitar el acceso» que dice que deja de entrar a esta empresa. Aviso «Acceso quitado». Ya no aparece en la lista |
| U22 | Incógnito: entrar | «Su usuario no tiene acceso a ninguna empresa. Pida ayuda al administrador.» |

Para seguir con `empresas.md` y `auditoria.md` hace falta el usuario de prueba con acceso: crear `prueba2.MMDD` como en U6, con el «Rol de prueba MMDD», y elegir su contraseña en incógnito como en U9 y U10. Desde aquí, «el usuario de prueba» es `prueba2.MMDD`.

| # | Pasos | Debe pasar |
|---|---|---|
| U24 | Ficha de `prueba2.MMDD` → «Acciones» → «Desactivar» → confirmar | Diálogo «Desactivar el usuario». Aviso «Usuario desactivado». La ficha dice «Está desactivado: no entra en ninguna empresa.» |
| U25 | Incógnito: entrar con `prueba2.MMDD` | El mensaje de S3 |
| U26 | «Reactivar» | «Usuario reactivado». En incógnito, entra con sus mismos roles |
| U27 | Ir a la ficha del rol «Rol de prueba MMDD» → «Desactivar». En incógnito, recargar y volver a entrar | Al recargar vuelve al login: era su único rol, y sin un rol activo no tiene acceso a la empresa. Al entrar: «Su usuario no tiene acceso a ninguna empresa…». Reactivar el rol: vuelve a entrar con «Usuarios» y «Roles» |

## 6. Permisos en el menú y en los botones

| # | Pasos | Debe pasar |
|---|---|---|
| P1 | Usuario de prueba: mirar el menú | Solo las opciones de sus permisos; una sección sin ninguna opción no aparece |
| P2 | Darle «Crear usuarios» al rol y recargar en incógnito | Aparece «Nuevo usuario» en la lista. Quitárselo: desaparece |
| P3 | Darle «Asignar y quitar roles» y, en incógnito, abrir la ficha del administrador → «Roles» | Los roles que no puede dar se ven bloqueados con el motivo al lado: «Administrador» dice «Solo un administrador quita este rol» (y un rol con permisos que él no tiene, «Usted no tiene todos los permisos de este rol») |
| P4 | Quitar ese permiso | Para dejar el rol como estaba: «Ver usuarios» y «Ver roles» |

## Celular (390 × 844)

| # | Pasos | Debe pasar |
|---|---|---|
| AC1 | Login | Sin la marca de la izquierda; el logo arriba del formulario. Tocar un campo no agranda la página |
| AC2 | El menú lateral | Se abre con el botón de la cabecera y se cierra al elegir una opción |
| AC3 | Lista de usuarios y de roles | Tarjetas en vez de tabla; los filtros en un botón «Filtros» con el número de filtros activos |
| AC4 | Ficha de usuario | Las acciones en «⋮»; las pestañas se pueden recorrer; sin barra para mover de lado |
| AC5 | «Nuevo usuario» y el diálogo de la contraseña temporal | Se ven completos y «Copiar» funciona |

## Teclado

| # | Pasos | Debe pasar |
|---|---|---|
| AT1 | Login solo con el teclado: Tab, escribir, Enter | Entra. El foco se ve siempre |
| AT2 | Login con error | El foco va al primer campo con error |
| AT3 | Lista de usuarios: Tab hasta una fila y Enter | Abre la ficha |
| AT4 | Un diálogo de confirmación: Escape | Se cierra sin hacer nada; el foco vuelve al botón que lo abrió |
| AT5 | Diálogo de la contraseña temporal: Escape | **No** se cierra (solo con su botón) |

## Accesibilidad

| # | Pasos | Debe pasar |
|---|---|---|
| AA1 | F12 → Lighthouse → Accesibilidad en el login, «Usuarios», una ficha de usuario, «Roles» y una ficha de rol | 100, salvo `autocomplete-valid` en los campos con `autocomplete="sin-autollenado"` (excepción aceptada en el 6.13e: `docs/arquitectura-frontend.md`, sección 3); lo demás que falte, anotado |
| AA2 | Lector de pantalla en el login con error | Lee el mensaje de error |
| AA3 | Lector de pantalla en «Cambiar contraseña» | Lee qué reglas están cumplidas y cuáles pendientes |
| AA4 | Zoom del navegador al 200 % en una ficha | Todo se lee y se puede usar, sin cortar textos |

## Al terminar

No se borra nada (regla 12). Dejarlo así:

- `prueba.MMDD`: ya sin acceso a la empresa (U21).
- `prueba2.MMDD` y «Rol de prueba MMDD»: **siguen activos** si después se hacen `empresas.md` y `auditoria.md`; al terminar esas, desactivar el usuario (U24) y el rol (R12).
- La contraseña del administrador: la nueva de C8.

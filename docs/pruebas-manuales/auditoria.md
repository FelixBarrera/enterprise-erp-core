# Pruebas manuales: auditoría (bitácora)

Pantalla «Bitácora» (menú «Administración»): qué se hizo en la empresa, quién y cuándo; el detalle «antes y después» de cada evento y la historia de un registro («Ver historia» en las fichas). Diseño: `docs/modulos/auditoria.md`.

Tiempo aproximado: 30 minutos.

## Necesita antes

- Haber hecho `auth-usuarios.md` y `empresas.md` **hoy**: así la bitácora tiene ingresos, intentos fallidos, un bloqueo, cambios de rol, de usuario y de la empresa.
- Ventana normal: el administrador (tiene «Ver la bitácora de cambios»). Ventana de incógnito: el usuario de prueba (`prueba2.MMDD`, sin ese permiso).

## Casos

| # | Pasos | Debe pasar |
|---|---|---|
| B1 | Menú «Administración» → «Bitácora» | «Lo que se hizo en <empresa>, quién lo hizo y cuándo. No se puede cambiar ni borrar.» Por defecto, los últimos 7 días; lo más nuevo arriba. Columnas «Fecha y hora», «Quién», «Qué hizo» y «Sobre qué» |
| B2 | Mirar la ayuda bajo las fechas | «Hasta 92 días por búsqueda. Fechas y horas de Guayaquil.» (o la ciudad de `ZONA_NEGOCIO`) |
| B3 | Buscar en la lista lo hecho en `auth-usuarios.md` | Están, con texto en español (nunca un código como `auth.usuario.crear`): «Creó un usuario», «Cambió los permisos de un rol», «Entró al sistema», «Cambió de empresa», «Cambió el nombre de la empresa»… |
| B4 | Los intentos fallidos y el bloqueo (U17) | «Intento de ingreso fallido» y «El usuario quedó bloqueado», marcados como «Seguridad» |
| B5 | Buscar el intento con un usuario que no existe (S3) | **No aparece**: no tiene empresa, y los eventos sin empresa no se ven en la aplicación (AUD-D5; se consultan en la base). Los del usuario de prueba (U17) sí |
| B6 | «Qué hizo» → «Cambió el nombre de la empresa» (E4 y «Al terminar» de `empresas.md`) | En «Sobre qué», cada evento con el nombre que tenía la empresa **en ese momento** (el de prueba y el original), no el de hoy en todos |
| B7 | Filtro «Qué hizo» → «Todo sobre roles» | Solo eventos de roles. Después, una acción sola («Creó un rol»): solo esa |
| B8 | Filtro «Usuario» → el administrador | Solo lo que hizo él. La lista del filtro tiene solo quienes aparecen en la bitácora de esta empresa |
| B9 | Con los filtros puestos, recargar (F5) y copiar la URL en otra pestaña | Los filtros siguen; junto a «Filtros», el contador dice cuántos hay («2 activos») |
| B10 | «Desde» de hace 100 días y «Hasta» hoy | «El rango no puede pasar de 92 días». No se busca |
| B11 | «Desde» posterior a «Hasta» | «La fecha desde no puede ser mayor que la fecha hasta». No se busca |
| B12 | Un rango sin eventos (por ejemplo, una semana de hace un año) | «Ningún evento coincide con los filtros.» (cambiar las fechas cuenta como filtro), sin error |
| B13 | «Limpiar filtros» | Vuelve a los últimos 7 días, sin otros filtros |
| B14 | «Ver detalle» de «Cambió los permisos de un rol» (R10) | «Qué cambió»: solo los datos que cambiaron, con «Antes» y «Después»; los permisos con «Se agregó» y «Se quitó». «Datos del evento»: «Sobre qué», «Quién», «Cuándo», «Desde dónde», «Con qué» y «N.º de petición» |
| B15 | Detalle de «Dio una contraseña temporal» (U19) | **No** muestra la contraseña: solo que se dio una temporal |
| B16 | Detalle de un «Intento de ingreso fallido» | El motivo en español («Contraseña incorrecta», «Estaba bloqueado», «Estaba desactivado», «Sin acceso a ninguna empresa» si la contraseña era correcta pero no tenía empresa), nunca un código como `CONTRASENA_INCORRECTA` |
| B17 | En el detalle, «Ver su ficha» y volver; después «Ver su historia» | La ficha del registro; la historia: todo lo que se hizo con él en esta empresa, «Toda su historia, sin límite de días.», y «Volver a su ficha» |
| B18 | Ficha del «Rol de prueba MMDD» → «Ver historia» (en el pie) | La misma historia: creado, editado, permisos, desactivado, reactivado (lo más viejo, «Creó un rol», en la última página). «Ver toda la bitácora» quita el filtro del registro |
| B19 | La hora de un evento hecho hoy | La hora real en la zona del negocio (comparar con el reloj: con la zona por defecto, la hora de Guayaquil aunque el equipo esté en otra) |
| B20 | Cambiar de empresa y abrir la bitácora | Solo los eventos de esa empresa: nada de lo hecho en la primera |
| B21 | Incógnito (sin el permiso): buscar «Bitácora» en el menú y escribir `/bitacora` a mano | No está en el menú; a mano: «No tiene permiso para ver esta pantalla» y vuelve al inicio |
| B22 | Darle «Ver la bitácora de cambios» al «Rol de prueba MMDD» y recargar en incógnito | Ve la bitácora. Quitárselo al terminar |
| B23 | Buscar una forma de cambiar o borrar un evento | No hay: ni botones ni acciones |

## Celular (390 × 844)

| # | Pasos | Debe pasar |
|---|---|---|
| BC1 | Abrir la bitácora | Tarjetas en vez de tabla; los filtros en un botón «Filtros» (abierto si ya hay uno puesto) |
| BC2 | Abrir un detalle | «Antes» y «Después» se leen sin barra para mover de lado |

## Teclado

| # | Pasos | Debe pasar |
|---|---|---|
| BT1 | Recorrer los filtros y la lista con Tab | El foco se ve siempre; Enter en «Ver detalle» lo abre |
| BT2 | Elegir las fechas solo con el teclado | Se pueden escribir o elegir sin el mouse |

## Accesibilidad

| # | Pasos | Debe pasar |
|---|---|---|
| BA1 | F12 → Lighthouse → Accesibilidad en la lista y en un detalle | 100, o lo que falte anotado |
| BA2 | Lector de pantalla en «Seguridad» | Se lee que el evento es de seguridad (no solo por el color) |

## Al terminar

- Quitarle al «Rol de prueba MMDD» el permiso de la bitácora (B22).
- Desactivar `prueba2.MMDD` y el «Rol de prueba MMDD» (`auth-usuarios.md`, U24 y R12). No se borra nada: los eventos de la prueba quedan en la bitácora para siempre, como debe ser.

# Despliegue: un servidor nuevo, paso a paso

Cómo dejar funcionando el sistema en un servidor con Ubuntu, con un subdominio por cliente (`cliente1.midominio.com`), y cómo cuidarlo después. Qué es cada pieza y qué hace cada script: `despliegue/README.md`. Aquí va el orden en que se hace todo.

Sirve para cualquier proveedor (o un servidor propio): solo hace falta un Ubuntu con acceso por `ssh` y una dirección IP fija.

> **Estado (2026-11-10):** todo lo de esta guía se probó en una PC con Ubuntu 24.04, con dos clientes, la copia externa en una carpeta y en otro servidor por `ssh`, y la recuperación completa desde la copia. **Falta probarlo en un servidor de verdad**: la lista del final («Primer servidor real»).

## Índice

1. [Qué hace falta](#1-qué-hace-falta)
2. [Preparar el servidor](#2-preparar-el-servidor)
3. [Instalar Docker](#3-instalar-docker)
4. [El dominio: un subdominio por cliente](#4-el-dominio-un-subdominio-por-cliente)
5. [Traer el código](#5-traer-el-código)
6. [Levantar los servicios comunes](#6-levantar-los-servicios-comunes)
7. [Dar de alta los clientes](#7-dar-de-alta-los-clientes)
8. [Copia fuera del servidor](#8-copia-fuera-del-servidor)
9. [Tareas programadas](#9-tareas-programadas)
10. [El día a día](#10-el-día-a-día)
11. [Si se pierde el servidor](#11-si-se-pierde-el-servidor)
12. [Primer servidor real](#12-primer-servidor-real)

---

## 1. Qué hace falta

| Qué | Para qué | Nota |
|---|---|---|
| Un servidor con **Ubuntu 24.04 LTS** | Donde corre todo | Para empezar, con pocos clientes: 2 procesadores, **4 GB de memoria** y 60 GB de disco. Las pantallas se compilan en el servidor y eso pide memoria: con 2 GB, agregar memoria de intercambio (`swap`, sección 2). Medir y agrandar cuando haya más clientes |
| Una **IP fija** del servidor | Para que el dominio apunte a él | La da el proveedor |
| Un **dominio** (`midominio.com`) | Cada cliente entra por `<cliente>.midominio.com` | En cualquier registrador. Hay que poder crear registros DNS |
| Un **correo** | Let's Encrypt avisa ahí si un certificado no se pudo renovar | |
| Un **destino para la copia externa** | Los respaldos fuera del servidor (sección 8) | Almacenamiento tipo S3 u otro servidor |
| Un **gestor de contraseñas** | Guardar lo que no puede quedar solo en el servidor (sección 8) | Bitwarden, 1Password, KeePassXC… |

En la nube, **medir la latencia** desde las oficinas antes de contratar (`docs/arquitectura-backend.md`, sección 17).

## 2. Preparar el servidor

Todo con un usuario propio (aquí, `erp`), nunca con `root`. Desde la PC, entrar con lo que dé el proveedor (`ssh root@IP` o `ssh ubuntu@IP`):

```bash
# Usuario propio con permiso de administrador
adduser erp
usermod -aG sudo erp

# Entrar con llave en vez de contraseña: copiar la llave pública de la PC al usuario nuevo.
# (En la PC, si no tiene una: ssh-keygen -t ed25519.) Desde la PC:
#   ssh-copy-id erp@IP
```

Probar en **otra terminal** que `ssh erp@IP` entra sin pedir contraseña. Solo entonces, cerrar la entrada con contraseña y la de `root`:

```bash
sudo tee /etc/ssh/sshd_config.d/10-solo-llave.conf >/dev/null <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
CONF
sudo systemctl restart ssh
```

**Cortafuegos** (`ufw`): solo `ssh` y la web.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

> Docker abre por su cuenta los puertos que publica, sin pasar por `ufw`. Aquí solo Nginx publica puertos (80 y 443); PostgreSQL y Redis no se ven desde afuera (`despliegue/compose.yml`). **Nunca agregar `ports:` a la base o a Redis.**

**Actualizaciones de seguridad automáticas** (Ubuntu ya trae `unattended-upgrades`; esto lo deja activo):

```bash
sudo apt update && sudo apt upgrade -y
sudo dpkg-reconfigure -plow unattended-upgrades     # responder «Sí»
```

**Hora del servidor**: dejarla en UTC (lo normal); las horas de la sección 9 ya están en UTC. **La del negocio es una por servidor**: `--zona` de `iniciar-servidor.sh` (sección 6; por defecto `America/Guayaquil`) la deja en `ZONA_NEGOCIO` de `despliegue/.env`, cada cliente la copia en su `api.env` al darse de alta, y su base la toma de ahí después de cada migración y de cada recuperación (la que muestran psql, DBeaver o Power BI; la prueba mensual revisa que coincida). No se cambia con datos guardados.

**Memoria de intercambio**, solo si el servidor tiene menos de 4 GB:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Instalar Docker

Desde el repositorio de Docker (el de Ubuntu viene atrasado):

```bash
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
  sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Que el usuario erp use Docker sin sudo (salir y volver a entrar para que valga)
sudo usermod -aG docker erp
```

Comprobar (después de volver a entrar): `docker compose version` (2.24 o más nuevo).

> Estar en el grupo `docker` equivale a ser administrador del servidor: solo el usuario `erp`.

## 4. El dominio: un subdominio por cliente

En el panel del registrador del dominio, un registro **comodín** que mande todos los subdominios al servidor:

| Tipo | Nombre | Valor |
|---|---|---|
| `A` | `*` | la IP del servidor |
| `AAAA` | `*` | la IPv6 del servidor (solo si tiene) |

Así, un cliente nuevo no necesita tocar el DNS. Si el registrador no acepta comodines, un registro `A` por cliente (`cliente1` → IP).

Comprobar desde la PC (puede tardar unos minutos u horas en verse):

```bash
dig +short cliente1.midominio.com     # tiene que dar la IP del servidor
```

Let's Encrypt saca **un certificado por subdominio** cuando se da de alta el cliente (sección 7): el subdominio tiene que apuntar ya al servidor.

## 5. Traer el código

El repositorio es privado: el servidor entra con una **llave de solo lectura** (en GitHub, *deploy key*), que sirve solo para este repositorio.

```bash
ssh-keygen -t ed25519 -N '' -C "servidor-erp" -f ~/.ssh/github-erp
cat ~/.ssh/github-erp.pub
```

En GitHub: el repositorio → *Settings* → *Deploy keys* → *Add deploy key*, pegar esa llave **sin** marcar *Allow write access*. Después:

```bash
cat >>~/.ssh/config <<'CONF'
Host github.com
  IdentityFile ~/.ssh/github-erp
  IdentitiesOnly yes
CONF
git clone git@github.com:<cuenta>/<repositorio>.git ~/erp
cd ~/erp
```

En el servidor no hace falta Node ni pnpm: todo se compila dentro de Docker.

## 6. Levantar los servicios comunes

Una vez por servidor, con el dominio y el correo reales (y la zona del negocio, si no es `America/Guayaquil`: `--zona America/Mexico_City`; la lista, `timedatectl list-timezones`):

```bash
~/erp/despliegue/scripts/iniciar-servidor.sh --dominio midominio.com --correo yo@midominio.com
```

Arma `despliegue/.env` con contraseñas nuevas, construye las imágenes (la primera vez tarda) y levanta PostgreSQL, Redis y Nginx. Comprobar:

```bash
cd ~/erp/despliegue && docker compose ps      # postgres, redis y web: «healthy» o «running»
```

## 7. Dar de alta los clientes

Uno por vez; el script pregunta el nombre de la empresa y los datos del administrador:

```bash
~/erp/despliegue/scripts/alta-cliente.sh cliente1
~/erp/despliegue/scripts/alta-cliente.sh cliente2
```

El nombre corto (`cliente1`) es el del subdominio, el de su base y el de su copia de la API: solo minúsculas y números. Al final muestra **una sola vez** la contraseña temporal del administrador: dársela al cliente por un medio seguro (al entrar, el sistema le pide cambiarla).

Comprobar cada uno:

```bash
curl -s https://cliente1.midominio.com/api/v1/health    # {"success":true,…}
```

Y en el navegador, `https://cliente1.midominio.com`: el candado sin avisos (certificado de Let's Encrypt), el login y entrar con el administrador. Que el usuario de un cliente **no** entre en el otro (cada uno tiene su base).

## 8. Copia fuera del servidor

Los respaldos diarios (`respaldar.sh`) quedan en el mismo servidor: si se pierde el disco, se pierden con él. Por eso, todos los días, `copia-externa.sh` manda a otro lugar, **cifrado** con [restic](https://restic.net/):

- el último respaldo de cada cliente,
- `despliegue/.env` y `despliegue/clientes/` (las contraseñas de cada base y de cada cliente: sin ellas, los respaldos no sirven para levantar el sistema en otro servidor),
- `despliegue/sitios/`.

Se guarda **la última copia de cada día por 30 días y la última de cada mes por 7 años** (`docs/arquitectura-backend.md`, sección 17). restic corre en su propio contenedor (no hay que instalarlo) y solo ve, sin poder cambiarlo, lo que copia.

### 8.1 Elegir el destino

Uno de estos (en el mismo `despliegue/copia-externa/destino.env`; ejemplo en `despliegue/copia-externa.env.example`):

**A. Almacenamiento compatible con S3** (Backblaze B2, Wasabi, Cloudflare R2, AWS S3…). Lo más simple; unos pocos dólares al mes para estos tamaños.

1. Crear una cuenta y un *bucket* (una carpeta del servicio) **privado**, en otra región o proveedor que el servidor.
2. Crear una **llave de acceso solo para ese bucket** (leer y escribir; si el servicio lo permite, sin poder borrar el bucket).
3. Poner en `destino.env` la dirección (`s3:https://<servidor del servicio>/<bucket>/erp`), `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY` (se llaman así aunque el servicio no sea de Amazon).

**B. Otro servidor o una PC por `ssh`** (otro proveedor, o una PC de la oficina siempre encendida):

1. En el otro equipo, un usuario solo para esto (`copias`) y su carpeta (`/srv/copias/erp`).
2. En este servidor, una llave solo para las copias y la «huella» del otro equipo:
   ```bash
   cd ~/erp/despliegue && mkdir -p copia-externa/ssh && chmod 700 copia-externa copia-externa/ssh
   ssh-keygen -t ed25519 -N '' -C copias-erp -f copia-externa/ssh/id_ed25519
   ssh-keyscan otro-servidor.midominio.com > copia-externa/ssh/known_hosts
   ```
   (Con otro puerto: `ssh-keyscan -p 2222 …`.) Agregar `copia-externa/ssh/id_ed25519.pub` al `~/.ssh/authorized_keys` del usuario `copias` del otro equipo.
3. En `destino.env`: `RESTIC_REPOSITORY=sftp:copias@otro-servidor.midominio.com:/srv/copias/erp` (con otro puerto: `sftp://copias@otro-servidor.midominio.com:2222//srv/copias/erp`).

**C. Un disco externo montado en este servidor**: `RESTIC_REPOSITORY=/destino` y `COPIA_EXTERNA_CARPETA=/mnt/disco/erp`. Protege si falla el disco del servidor, pero no si se pierde el servidor entero: mejor A o B.

### 8.2 Preparar y probar

```bash
cd ~/erp/despliegue
mkdir -p copia-externa && chmod 700 copia-externa
cp copia-externa.env.example copia-externa/destino.env && chmod 600 copia-externa/destino.env
nano copia-externa/destino.env              # dejar solo el destino elegido
scripts/copia-externa.sh iniciar            # crea la clave y prepara el destino
```

`iniciar` muestra **una sola vez** la clave con que se cifra todo (queda en `copia-externa/clave`). **Guardar ya en el gestor de contraseñas, fuera del servidor:**

1. la clave (`copia-externa/clave`),
2. el contenido de `copia-externa/destino.env`,
3. si el destino es B, la llave `copia-externa/ssh/id_ed25519`.

**Sin la clave nadie puede leer las copias, tampoco nosotros.** Si se pierden el servidor y la clave, no hay forma de recuperar los datos.

Después, la primera copia y la primera prueba de que se puede restaurar:

```bash
scripts/respaldar.sh
scripts/copia-externa.sh copiar
scripts/copia-externa.sh listar
scripts/probar-restauracion.sh --copia-externa
```

## 9. Tareas programadas

`crontab -e` con el usuario `erp`. Las horas, en UTC (07:00 UTC = 02:00 en Guayaquil):

```cron
# Respaldo diario, copia externa y certificados (de madrugada en Guayaquil)
0 7 * * *   /home/erp/erp/despliegue/scripts/respaldar.sh              >> /home/erp/erp-respaldo.log 2>&1
30 7 * * *  /home/erp/erp/despliegue/scripts/copia-externa.sh copiar   >> /home/erp/erp-copia-externa.log 2>&1
30 8 * * *  /home/erp/erp/despliegue/scripts/renovar-certificados.sh   >> /home/erp/erp-certificados.log 2>&1
# El día 1 de cada mes: restaurar la copia externa en bases aparte y revisarla
0 9 1 * *   /home/erp/erp/despliegue/scripts/probar-restauracion.sh --copia-externa >> /home/erp/erp-restauracion.log 2>&1
```

Que esos archivos no crezcan sin fin (`/etc/logrotate.d/erp`):

```bash
sudo tee /etc/logrotate.d/erp >/dev/null <<'CONF'
/home/erp/erp-*.log {
  monthly
  rotate 12
  compress
  missingok
  notifempty
}
CONF
```

**Avisos**: hoy nadie avisa solo si algo falla (está en la lista de la sección 17: monitoreo con aviso). Mientras tanto, **una vez por semana**:

```bash
grep -h '✖\|⚠' ~/erp-*.log | tail -20     # nada = todo bien
```

## 10. El día a día

| Qué | Cómo |
|---|---|
| **Actualizar** a una versión nueva (fuera de horario) | `cd ~/erp && git pull && despliegue/scripts/actualizar.sh`. Respalda, migra y reinicia cliente por cliente; si uno falla, se detiene. Para probar primero con uno: `actualizar.sh cliente1` |
| **Cliente nuevo** | Sección 7 (con el comodín del DNS, no hace falta tocar el dominio) |
| **Cliente que se va** | `despliegue/scripts/baja-cliente.sh cliente1` (último respaldo y borra todo lo suyo; los respaldos se quedan) |
| Comandos `admin:*` de un cliente | `docker exec -it cliente1-api node dist/comandos/admin-<nombre>.js` |
| Ver qué pasa en una API | `docker logs --tail 100 cliente1-api` (o `-f` para seguirla) |
| Estado de todo | `docker ps` (cada API `healthy`) |
| Volver a la versión anterior | `despliegue/README.md`, «Restaurar un respaldo» y el párrafo que sigue |
| **Espacio en disco** (una vez al mes) | `df -h /` y `docker system df`. Cada actualización deja la imagen anterior (para volver atrás): borrar las de hace más de tres versiones con `docker image ls base-api` y `docker image rm base-api:<versión>` (igual con `base-migrador` y `base-web`), y `docker builder prune -f` |
| Copias externas que hay | `despliegue/scripts/copia-externa.sh listar` |

## 11. Si se pierde el servidor

Con un servidor nuevo y lo guardado en el gestor de contraseñas (sección 8.2). Los datos vuelven como estaban en la última copia externa (la de esa madrugada); lo que se hizo después se pierde.

1. **Servidor nuevo**: secciones 2, 3 y 5 (preparar, Docker y el código). En el DNS, cambiar la IP del comodín por la nueva (sección 4).
2. **La configuración de la copia**, desde el gestor de contraseñas:
   ```bash
   cd ~/erp/despliegue
   mkdir -p copia-externa && chmod 700 copia-externa
   nano copia-externa/destino.env && chmod 600 copia-externa/destino.env   # pegar
   nano copia-externa/clave && chmod 600 copia-externa/clave               # pegar
   # Destino B: también copia-externa/ssh/id_ed25519 (600) y su known_hosts (ssh-keyscan)
   ```
3. **Traer la última copia** y poner en su lugar el `.env` del servidor, las carpetas de los clientes y sus respaldos (los sitios no: se vuelven a armar con los certificados nuevos):
   ```bash
   scripts/copia-externa.sh listar
   scripts/copia-externa.sh traer latest       # o el número de una copia anterior
   cp copia-externa/traido/latest/despliegue/.env .env && chmod 600 .env
   mkdir -p clientes respaldos && chmod 700 clientes respaldos
   cp -a copia-externa/traido/latest/despliegue/clientes/. clientes/
   cp -a copia-externa/traido/latest/despliegue/respaldos/. respaldos/
   ```
4. **Servicios comunes** con ese `.env` (las mismas contraseñas de antes):
   ```bash
   scripts/iniciar-servidor.sh
   ```
5. **Cada cliente**, con su base, sus usuarios y contraseñas de siempre, su API, su certificado y su sitio:
   ```bash
   scripts/recuperar-cliente.sh cliente1
   scripts/recuperar-cliente.sh cliente2
   ```
6. Comprobar como en la sección 7 (los usuarios entran con sus contraseñas de siempre), borrar lo traído (`rm -rf copia-externa/traido/latest`) y volver a poner las tareas de la sección 9. La copia externa sigue en el mismo destino y con la misma clave.

## 12. Primer servidor real

Lo que no se pudo probar en una PC. La primera vez, ir marcando y anotar aquí lo que haya que corregir:

- [ ] Secciones 2 y 3 en el Ubuntu del proveedor: `ssh` solo con llave (`ssh -o PubkeyAuthentication=no erp@IP` tiene que fallar), `ufw status` con 22, 80 y 443, Docker sin `sudo`.
- [ ] Desde afuera, solo 22, 80 y 443 abiertos (desde la PC: `nc -zv IP 5432` y `nc -zv IP 6379` tienen que fallar).
- [ ] Comodín del DNS y **certificado de Let's Encrypt de verdad** para dos clientes; candado sin avisos en el navegador; `http://` lleva a `https://`.
- [ ] La renovación con certificados reales, sin cambiar nada: dentro de `despliegue/`, `docker compose --profile certificados run --rm certbot renew --dry-run --webroot -w /var/www/acme`.
- [ ] Copia externa al destino elegido (A o B): `iniciar`, `copiar` y `probar-restauracion.sh --copia-externa`.
- [ ] Las tareas de la sección 9 corren solas (mirar los logs al día siguiente).
- [ ] Latencia y velocidad desde las oficinas (abrir la bitácora y un listado largo).
- [ ] Un simulacro de la sección 11 en un segundo servidor (se puede borrar después).

# Publicar LifeOS en un servidor (VPS) con HTTPS

Para instalar LifeOS en el móvil y recibir notificaciones, la app tiene que estar en un servidor al que el móvil
llegue por **HTTPS**. Esta guía usa un servidor virtual pequeño (VPS) y Caddy, que obtiene y renueva el
certificado HTTPS automáticamente. Tus datos (incluidas las fotos) se guardan solo en ese servidor.

## Qué necesitas

- Un VPS con Ubuntu 24.04, 2 GB de RAM y unos 20 GB de disco (cualquier proveedor sirve, por unos 4–6 €/mes).
- Un nombre de dominio o subdominio que apunte al servidor. Si no tienes dominio, uno gratuito como
  `tunombre.duckdns.org` vale.

## 1. Apunta el dominio al servidor

En el panel de tu dominio crea un registro **A** con el nombre que quieras (por ejemplo `lifeos.tudominio.es`) y
la IP pública del VPS. Comprueba que ya resuelve antes de seguir:

```bash
ping lifeos.tudominio.es
```

## 2. Prepara el servidor

Conéctate por SSH e instala Docker y el cortafuegos:

```bash
curl -fsSL https://get.docker.com | sh
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

Solo quedan abiertos SSH, 80 (necesario para obtener el certificado) y 443. La base de datos y la API no se
publican fuera del servidor.

## 3. Descarga y configura LifeOS

```bash
git clone https://github.com/jorgeric00/Personal-AI-assistant.git lifeos
cd lifeos
cp .env.example .env
nano .env
```

En `.env` cambia como mínimo:

| Variable | Valor |
| --- | --- |
| `LIFEOS_DB_PASSWORD` | Una contraseña larga inventada. |
| `LIFEOS_ADMIN_EMAIL`, `LIFEOS_ADMIN_PASSWORD`, `LIFEOS_ADMIN_NAME` | Tu cuenta (contraseña de al menos 12 caracteres). |
| `LIFEOS_COOKIE_SECURE` | `true` |
| `LIFEOS_DOMAIN` | Tu dominio, sin `https://` (por ejemplo `lifeos.tudominio.es`). |
| `LIFEOS_PUSH_SUBJECT` | `mailto:` y tu correo. |

## 4. Arranca

```bash
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

La primera vez tarda unos minutos en compilar. Cuando acabe, abre `https://lifeos.tudominio.es` en el
navegador e inicia sesión. Si el certificado no se obtiene, revisa que el dominio apunta al servidor y los
puertos 80 y 443 están abiertos: `docker compose -f docker-compose.yml -f docker-compose.https.yml logs caddy`.

## 5. Instálala en el móvil

- **Android (Chrome):** abre la dirección, inicia sesión y elige **Instalar aplicación** (o menú ⋮ →
  *Añadir a pantalla de inicio*). Después, en **Ajustes → Notificaciones** de LifeOS, actívalas.
- **iPhone (Safari, iOS 16.4 o posterior):** abre la dirección, pulsa *Compartir → Añadir a pantalla de inicio* y
  abre LifeOS desde ese icono. Las notificaciones solo funcionan así.

## Actualizar

```bash
cd lifeos
git pull
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Las copias de seguridad diarias se guardan en `lifeos/backups/` del servidor
(ver [copias-de-seguridad.md](copias-de-seguridad.md)). Conviene descargarlas de vez en cuando a otro equipo.

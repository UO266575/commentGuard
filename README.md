# CommentGuard

Extensión de Chrome que clasifica los comentarios de YouTube con Jev (TypeSafe AI) para proteger la salud mental de quien crea contenido. Ver [docs/ESPECIFICACION.md](docs/ESPECIFICACION.md) para la especificación completa.

## Desplegar el servidor (Render + Neon)

El servidor (`packages/server`) se despliega como un *web service* gratuito en [Render](https://render.com), con la base de datos en [Neon](https://neon.tech) (Postgres gratuito).

### 1. Crear la base de datos en Neon

1. Crea un proyecto en [Neon](https://neon.tech) y copia la cadena de conexión que te da. Ya incluye `?sslmode=require`; la librería `postgres` que usa el servidor lo soporta de forma nativa (cifra la conexión sin verificar el certificado del servidor, que es justo lo que pide Neon), así que no hace falta tocar nada de código.
2. Guarda esa cadena de conexión para el paso 3.

### 2. Crear el servicio en Render

1. En Render, "New" → "Blueprint", y apunta al repositorio: detecta [`render.yaml`](render.yaml) en la raíz y crea el servicio `comment-classificator-server` solo (plan gratuito, Node 20, arranca con `node packages/server/dist/index.js`, y usa `GET /health` como comprobación de salud — ese endpoint no toca la base de datos, así que Render puede confirmar que el proceso está vivo aunque Neon esté fallando en ese momento).
2. Render pide rellenar las variables marcadas como `sync: false` en `render.yaml`:
   - `DATABASE_URL`: la cadena de conexión de Neon del paso 1.
   - `GOOGLE_CLIENT_ID`: el `client_id` de OAuth de Google Cloud (el mismo que usa la extensión).
   - `JEV_API_KEY`: la clave real de Jev. Si todavía no la tienes, dale el valor que quieras y pon `JEV_MOCK_MODE=true` (ver abajo) — la extensión funciona igual, clasificando con categorías aleatorias en vez de llamar a Jev de verdad.
   - `SESSION_SECRET` la genera Render sola (`generateValue: true` en `render.yaml`), no hace falta rellenarla.
3. El plan gratuito de Render duerme el servicio a los 15 minutos sin tráfico y tarda hasta un minuto en despertar con la siguiente petición. La extensión ya lo tiene en cuenta: muestra "Conectando con el servidor…" en vez de un error mientras espera, con un margen de 90 segundos antes de darlo por caído de verdad.

### 3. Aplicar las migraciones contra Neon

Desde tu máquina, apuntando `DATABASE_URL` a Neon (no a tu Postgres local):

```bash
cd packages/server
DATABASE_URL="postgres://usuario:contraseña@host.neon.tech/basededatos?sslmode=require" pnpm run db:migrate
```

Esto crea las tablas (`users`, `quota_usage`, `comment_classification_cache`, `comment_corrections`) en Neon. Hay que repetirlo cada vez que se añada una migración nueva en `packages/server/drizzle/`.

### 4. Compilar la extensión apuntando al servidor de Render

Por defecto la extensión apunta a `http://localhost:3000`. Para que apunte al servidor real, añade a `packages/extension/.env`:

```
WXT_SERVER_BASE_URL=https://comment-classificator-server.onrender.com
```

(con la URL real que te dé Render para tu servicio) y recompila:

```bash
cd packages/extension
pnpm run build
```

El build añade ese origen a `host_permissions` del manifest automáticamente a partir de esa variable — si cambias la URL más adelante, hace falta recompilar para que el permiso se actualice.

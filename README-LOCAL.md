# Configuración Local - PostgreSQL

Esta guía te ayudará a configurar el proyecto para trabajar completamente en local con PostgreSQL.

## Prerrequisitos

1. **PostgreSQL instalado** y corriendo
2. **DBeaver** (o cualquier cliente PostgreSQL)
3. **Node.js** y **npm**

## Paso 1: Crear la Base de Datos

Conéctate a PostgreSQL usando DBeaver o `psql` y crea la base de datos:

```sql
CREATE DATABASE tiktok_dashboard;
```

## Paso 2: Configurar Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
DB_USER=postgres
DB_PASSWORD=123123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tiktok_dashboard
```

O usa `DATABASE_URL` completo:

```env
DATABASE_URL=postgresql://postgres:123123@localhost:5432/tiktok_dashboard
```

## Paso 3: Ejecutar Migraciones

Ejecuta el script de setup para crear todas las tablas:

```bash
npm run setup-db
```

Este script ejecutará automáticamente las migraciones SQL desde `supabase/migrations/001_initial_schema.sql`.

## Paso 4: Verificar en DBeaver

Abre DBeaver y conéctate a tu base de datos `tiktok_dashboard`. Deberías ver las siguientes tablas:

- `streamers`
- `streams`
- `users`
- `events`
- `donations`
- `user_changes_log`

## Paso 5: Iniciar el Proyecto

```bash
# Instalar dependencias (si no lo has hecho)
npm install

# Iniciar servidor de desarrollo
npm run dev
```

El dashboard estará disponible en `http://localhost:3000`

## Paso 6: Configurar el Bot

En la carpeta `bot/`, crea un archivo `.env`:

```env
STREAMER_USERNAME=tu_username_aqui
API_URL=http://localhost:3000/api
```

Luego inicia el bot:

```bash
cd bot
pip install -r requirements.txt
python main.py
```

## Diferencias con Supabase

### Realtime

En desarrollo local, el sistema usa **polling** (actualizaciones cada 2-3 segundos) en lugar de WebSockets. Esto es suficiente para desarrollo y testing.

Cuando migres a producción con Supabase, el Realtime funcionará automáticamente.

### Ventajas del Desarrollo Local

- ✅ Más rápido (sin latencia de red)
- ✅ Sin límites de uso
- ✅ Control total con DBeaver
- ✅ Puedes hacer backups fácilmente
- ✅ No consume recursos de Supabase

## Troubleshooting

### Error: "database does not exist"

Asegúrate de haber creado la base de datos:

```sql
CREATE DATABASE tiktok_dashboard;
```

### Error de conexión

Verifica que PostgreSQL esté corriendo y que las credenciales en `.env.local` sean correctas.

### Error en migraciones

Si hay errores al ejecutar `npm run setup-db`, puedes ejecutar el SQL manualmente en DBeaver:

1. Abre `supabase/migrations/001_initial_schema.sql`
2. Copia todo el contenido
3. Ejecútalo en DBeaver

## Migración a Producción

Cuando estés listo para producción:

1. Crea un proyecto en Supabase
2. Ejecuta las migraciones en Supabase
3. Cambia las variables de entorno a las de Supabase
4. El código funcionará sin cambios (el wrapper detecta automáticamente)


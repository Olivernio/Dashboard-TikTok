# 🚀 Setup Local - Guía Rápida

## Configuración Inicial

### 1. Crear Base de Datos en PostgreSQL

Abre DBeaver y ejecuta:

```sql
CREATE DATABASE tiktok_dashboard;
```

### 2. Configurar `.env.local`

Crea/actualiza `.env.local` en la raíz del proyecto:

```env
DB_USER=postgres
DB_PASSWORD=123123
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tiktok_dashboard
```

### 3. Ejecutar Migraciones

```bash
npm run setup-db
```

Esto creará todas las tablas automáticamente.

### 4. Iniciar el Proyecto

```bash
npm run dev
```

Abre `http://localhost:3000`

### 5. Configurar el Bot

En `bot/.env`:

```env
STREAMER_USERNAME=tu_username
API_URL=http://localhost:3000/api
```

Luego:

```bash
cd bot
pip install -r requirements.txt
python main.py
```

## ✅ Listo!

Ahora puedes trabajar completamente en local con PostgreSQL y DBeaver.

## 📝 Notas

- **Realtime**: Usa polling (cada 2-3 segundos) en lugar de WebSockets
- **DBeaver**: Puedes ver y editar datos directamente
- **Sin límites**: Trabaja sin restricciones de Supabase


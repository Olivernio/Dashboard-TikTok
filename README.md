# TikTok Stream Dashboard

Dashboard interactivo para capturar, almacenar y analizar eventos de streams de TikTok en tiempo real.

## Características

- 📊 **Dashboard Interactivo**: Cards con métricas, gráficos con zoom, listas filtrables
- 💬 **Chat en Vivo**: Visualización de chat en tiempo real o histórico
- 📹 **Gestión de Streams**: Lista de todos los directos registrados con capacidad de selección
- 👤 **Vista de Usuario**: Información detallada de usuarios con historial completo
- ⚙️ **Configuración**: Tema oscuro/claro y zona horaria personalizable
- 📈 **Analytics**: Estadísticas descriptivas y análisis de datos
- 🔄 **Tiempo Real**: Actualizaciones automáticas usando Supabase Realtime
- 📝 **Sistema de Auditoría**: Log completo de cambios en usuarios

## Stack Tecnológico

- **Frontend/Backend**: Next.js 14 (App Router) + TypeScript
- **Base de Datos**: Supabase (PostgreSQL)
- **Bot**: Python + TikTokLive
- **UI**: Tailwind CSS + shadcn/ui
- **Gráficos**: Recharts
- **Estado**: Zustand + React Query
- **Tiempo Real**: Supabase Realtime

## Instalación

### 1. Clonar el repositorio

```bash
git clone <tu-repositorio>
cd Dashboard-TikTok
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com)
2. Ejecuta las migraciones SQL desde `supabase/migrations/001_initial_schema.sql` en el SQL Editor de Supabase
3. Obtén tu URL y anon key desde Settings > API

### 4. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 5. Configurar el bot

```bash
cd bot
pip install -r requirements.txt
cp .env.example .env
# Edita .env con tus valores
```

```env
STREAMER_USERNAME=username_del_streamer
API_URL=http://localhost:3000/api
```

## Uso

### Desarrollo

1. Inicia el servidor de desarrollo:

```bash
npm run dev
```

2. Inicia el bot (en otra terminal):

```bash
cd bot
python main.py
```

### Producción

1. Despliega en Vercel:

```bash
vercel
```

2. Configura las variables de entorno en Vercel

3. Actualiza la URL de la API en el bot:

```env
API_URL=https://tu-proyecto.vercel.app/api
```

4. Ejecuta el bot en un servidor (Railway, Render, VPS, etc.)

## Estructura del Proyecto

```
Dashboard-TikTok/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Rutas del dashboard
│   ├── api/              # API Routes
│   └── components/       # Componentes React
├── bot/                  # Bot de captura de eventos
├── lib/                  # Utilidades y tipos
├── components/           # Componentes compartidos
├── store/                # Estado global (Zustand)
└── supabase/            # Migraciones SQL
```

## Base de Datos

El esquema incluye:

- `streamers`: Streamers registrados
- `streams`: Sesiones de directos
- `users`: Usuarios que interactúan
- `events`: Todos los eventos capturados
- `donations`: Donaciones/regalos detallados
- `user_changes_log`: Log de auditoría

## Funcionalidades Principales

### Dashboard
- Cards con métricas en tiempo real
- Gráficos interactivos con zoom
- Listas filtrables de donaciones
- Estadísticas descriptivas

### Chat
- Vista en tiempo real para streams activos
- Vista histórica para streams antiguos
- Búsqueda y filtros

### Streams
- Lista completa de streams
- Filtros por streamer
- Selección para ver detalles

### Usuarios
- Información completa del usuario
- Historial de eventos y donaciones
- Log de cambios (auditoría)

### Analytics
- Eventos por tipo (gráfico de pastel)
- Eventos por día (gráfico de barras)
- Top donadores

## Despliegue

### Vercel (Recomendado)

1. Conecta tu repositorio a Vercel
2. Configura las variables de entorno
3. Deploy automático en cada push

### Base de Datos

- **Supabase**: Plan gratuito (500MB) suficiente para uso inicial
- Si crece, considerar particionamiento por fecha

### Bot

El bot puede ejecutarse en:
- Railway (tier gratis limitado)
- Render (tier gratis)
- VPS propio
- Servidor local

## Licencia

MIT

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o PR.


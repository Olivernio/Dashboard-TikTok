# Migraciones de Supabase

Este directorio contiene las migraciones SQL para configurar la base de datos.

## Instrucciones

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Navega a SQL Editor
3. Copia y pega el contenido de `001_initial_schema.sql`
4. Ejecuta la migración

## Esquema

La migración crea:

- **Tablas principales**: streamers, streams, users, events, donations
- **Tabla de auditoría**: user_changes_log
- **Índices**: Para optimizar consultas frecuentes
- **Triggers**: Para actualizar timestamps y logs automáticamente
- **Funciones**: Para actualizar estadísticas de streams

## Habilitar Realtime

Para que funcione el tiempo real, necesitas habilitar Realtime en Supabase:

1. Ve a Database > Replication
2. Habilita Realtime para las tablas:
   - `events`
   - `donations`
   - `streams`


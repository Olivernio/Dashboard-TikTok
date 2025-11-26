# Sistema de Cola de Eventos

## Descripción

El bot ahora incluye un sistema de cola de eventos con persistencia que permite guardar eventos cuando la API de Node.js está caída y reenviarlos automáticamente cuando esté disponible.

## Características

- ✅ **Persistencia en archivo JSON**: Los eventos se guardan en `bot_event_queue.json`
- ✅ **Reintentos automáticos**: Intenta enviar eventos pendientes cada 10 segundos
- ✅ **Prioridades**: Los eventos críticos (viewers, streams) tienen mayor prioridad
- ✅ **Manejo de errores**: Detecta cuando la API está caída y agrega eventos a la cola
- ✅ **Procesamiento en segundo plano**: No bloquea la captura de eventos

## Tipos de Eventos en Cola

1. **event**: Eventos normales (comentarios, regalos, follows, etc.)
2. **viewer_count**: Actualizaciones de viewer count (prioridad alta)
3. **viewer_history**: Historial de viewers
4. **stream_update**: Actualizaciones de stream (ended_at, etc.)
5. **streamer**: Registro de streamer
6. **stream_create**: Creación de stream

## Funcionamiento

### Cuando la API está disponible:
- Los eventos se envían directamente a la API
- Si hay eventos en la cola, se procesan automáticamente

### Cuando la API está caída:
- Los eventos se agregan automáticamente a la cola
- Se guardan en `bot_event_queue.json`
- El bot continúa capturando eventos normalmente

### Cuando la API vuelve a estar disponible:
- El procesador de cola detecta automáticamente la disponibilidad
- Los eventos se envían en orden de prioridad
- Los eventos enviados se marcan como "sent" y se eliminan de la cola

## Archivo de Cola

El archivo `bot_event_queue.json` contiene:
- Lista de eventos pendientes
- Estado de cada evento (pending, sent, failed)
- Número de reintentos
- Timestamps de creación y envío

## Estadísticas

Puedes verificar el estado de la cola usando:
```python
stats = event_queue.get_stats()
print(f"Pendientes: {stats['pending']}, Enviados: {stats['sent']}, Fallidos: {stats['failed']}")
```

## Limpieza

Los eventos enviados se eliminan automáticamente de la cola. Los eventos fallidos se mantienen para revisión manual.


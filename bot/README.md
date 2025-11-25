# TikTok Stream Bot

Bot para capturar eventos de streams de TikTok en tiempo real.

## Instalación

1. Instala las dependencias:
```bash
pip install -r requirements.txt
```

2. Configura las variables de entorno:
```bash
cp .env.example .env
# Edita .env con tus valores
```

## Uso

```bash
python main.py
```

O con variables de entorno:
```bash
STREAMER_USERNAME=username API_URL=http://localhost:3000/api python main.py
```

## Variables de Entorno

- `STREAMER_USERNAME`: Username del streamer de TikTok (sin @)
- `API_URL`: URL de la API del dashboard (default: http://localhost:3000/api)

## Eventos Capturados

- **Comentarios**: Todos los comentarios del chat
- **Regalos/Donaciones**: Regalos enviados durante el stream
- **Follows**: Nuevos seguidores
- **Viewer Updates**: Actualizaciones del número de viewers


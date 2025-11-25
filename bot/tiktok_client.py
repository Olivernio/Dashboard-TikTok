"""
TikTok Live Client
Captura eventos de streams de TikTok y los envía a la API
"""
import asyncio
import os
import requests
from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    CommentEvent,
    GiftEvent,
    FollowEvent,
    ViewerUpdateEvent,
    ConnectEvent,
    DisconnectEvent,
)
from dotenv import load_dotenv

load_dotenv()

API_URL = os.getenv("API_URL", "http://localhost:3000/api")
STREAMER_USERNAME = os.getenv("STREAMER_USERNAME", "")


class TikTokStreamClient:
    def __init__(self, username: str, api_url: str = API_URL):
        self.username = username
        self.api_url = api_url
        self.client = TikTokLiveClient(unique_id=username)
        self.stream_id = None
        self.streamer_id = None
        self._setup_handlers()

    def _setup_handlers(self):
        """Configura los handlers de eventos"""
        self.client.add_listener("connect", self.on_connect)
        self.client.add_listener("disconnect", self.on_disconnect)
        self.client.add_listener("comment", self.on_comment)
        self.client.add_listener("gift", self.on_gift)
        self.client.add_listener("follow", self.on_follow)
        self.client.add_listener("viewer_update", self.on_viewer_update)

    async def on_connect(self, event: ConnectEvent):
        """Se ejecuta cuando se conecta al stream"""
        print(f"✅ Conectado al stream de @{self.username}")
        
        # Registrar streamer si no existe
        await self._register_streamer()
        
        # Crear nuevo stream
        await self._create_stream()

    async def on_disconnect(self, event: DisconnectEvent):
        """Se ejecuta cuando se desconecta del stream"""
        print(f"❌ Desconectado del stream de @{self.username}")
        
        # Finalizar stream
        if self.stream_id:
            await self._end_stream()

    async def on_comment(self, event: CommentEvent):
        """Maneja comentarios del chat"""
        try:
            user_data = {
                "username": event.user.unique_id or event.user.nickname or "unknown",
                "display_name": event.user.nickname,
                "profile_image_url": event.user.avatar_url.url if event.user.avatar_url else None,
                "follower_count": None,
                "following_count": None,
                "is_following_streamer": None,
            }

            event_data = {
                "content": event.comment,
                "metadata": {
                    "comment_id": str(event.comment_id),
                },
            }

            await self._send_event("comment", user_data, event_data)
        except Exception as e:
            print(f"Error procesando comentario: {e}")

    async def on_gift(self, event: GiftEvent):
        """Maneja regalos/donaciones"""
        try:
            user_data = {
                "username": event.user.unique_id or event.user.nickname or "unknown",
                "display_name": event.user.nickname,
                "profile_image_url": event.user.avatar_url.url if event.user.avatar_url else None,
                "follower_count": None,
                "following_count": None,
                "is_following_streamer": None,
            }

            donation_data = {
                "gift_type": event.gift.gift_type if hasattr(event.gift, "gift_type") else "unknown",
                "gift_name": event.gift.name,
                "gift_count": event.gift.count,
                "gift_value": None,  # TikTok no siempre proporciona el valor
                "message": None,
            }

            event_data = {
                "content": f"Regalo: {event.gift.name} x{event.gift.count}",
                "metadata": {
                    "gift_id": str(event.gift.id) if hasattr(event.gift, "id") else None,
                },
                "donation": donation_data,
            }

            await self._send_event("donation", user_data, event_data)
        except Exception as e:
            print(f"Error procesando regalo: {e}")

    async def on_follow(self, event: FollowEvent):
        """Maneja nuevos seguidores"""
        try:
            user_data = {
                "username": event.user.unique_id or event.user.nickname or "unknown",
                "display_name": event.user.nickname,
                "profile_image_url": event.user.avatar_url.url if event.user.avatar_url else None,
                "follower_count": None,
                "following_count": None,
                "is_following_streamer": True,
            }

            event_data = {
                "content": f"{event.user.nickname} comenzó a seguir",
                "metadata": {},
            }

            await self._send_event("follow", user_data, event_data)
        except Exception as e:
            print(f"Error procesando follow: {e}")

    async def on_viewer_update(self, event: ViewerUpdateEvent):
        """Maneja actualizaciones de viewers (puede usarse como evento 'join')"""
        try:
            # Actualizar viewer count del stream
            if self.stream_id:
                requests.patch(
                    f"{self.api_url}/streams",
                    json={
                        "id": self.stream_id,
                        "viewer_count": event.viewer_count,
                    },
                    timeout=5,
                )
        except Exception as e:
            print(f"Error actualizando viewers: {e}")

    async def _register_streamer(self):
        """Registra o actualiza el streamer en la base de datos"""
        try:
            response = requests.post(
                f"{self.api_url}/streamers",
                json={
                    "username": self.username,
                    "display_name": self.username,
                },
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                self.streamer_id = data.get("id")
                print(f"✅ Streamer registrado: {self.streamer_id}")
        except Exception as e:
            print(f"Error registrando streamer: {e}")

    async def _create_stream(self):
        """Crea un nuevo stream en la base de datos"""
        try:
            if not self.streamer_id:
                await self._register_streamer()

            response = requests.post(
                f"{self.api_url}/streams",
                json={
                    "streamer_id": self.streamer_id,
                    "title": None,
                    "viewer_count": None,
                },
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                self.stream_id = data.get("id")
                print(f"✅ Stream creado: {self.stream_id}")
        except Exception as e:
            print(f"Error creando stream: {e}")

    async def _end_stream(self):
        """Finaliza el stream actual"""
        try:
            if self.stream_id:
                # Get current time in ISO format
                from datetime import datetime
                requests.patch(
                    f"{self.api_url}/streams",
                    json={
                        "id": self.stream_id,
                        "ended_at": datetime.utcnow().isoformat() + "Z",
                    },
                    timeout=10,
                )
                print(f"✅ Stream finalizado: {self.stream_id}")
        except Exception as e:
            print(f"Error finalizando stream: {e}")

    async def _send_event(
        self, event_type: str, user_data: dict, event_data: dict
    ):
        """Envía un evento a la API"""
        try:
            if not self.stream_id:
                await self._create_stream()

            payload = {
                "event_type": event_type,
                "stream_id": self.stream_id,
                "user_data": user_data,
                "event_data": event_data,
            }

            response = requests.post(
                f"{self.api_url}/events",
                json=payload,
                timeout=5,
            )

            if response.status_code != 200:
                print(f"⚠️ Error enviando evento: {response.text}")
        except Exception as e:
            print(f"Error enviando evento: {e}")

    async def start(self):
        """Inicia la conexión al stream"""
        try:
            await self.client.start()
        except Exception as e:
            print(f"Error iniciando cliente: {e}")
            raise

    async def stop(self):
        """Detiene la conexión"""
        if self.stream_id:
            await self._end_stream()
        await self.client.stop()


async def main():
    """Función principal"""
    username = STREAMER_USERNAME or input("Ingresa el username del streamer: ").strip()
    
    if not username:
        print("❌ Debes proporcionar un username")
        return

    client = TikTokStreamClient(username)
    
    try:
        await client.start()
        # Mantener el bot corriendo
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo bot...")
        await client.stop()
    except Exception as e:
        print(f"❌ Error: {e}")
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())


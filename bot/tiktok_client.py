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
    ConnectEvent,
    DisconnectEvent,
    JoinEvent,
    ShareEvent,
    LikeEvent,
)
from dotenv import load_dotenv
from event_queue import EventQueue

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
        self.event_queue = EventQueue(queue_file="bot_event_queue.json", api_url=api_url)
        self._queue_processor_task = None
        self._setup_handlers()

    def _get_stream_day(self, dt) -> str:
        """
        Determina el "día de directo" basado en la hora chilena.
        Un día de directo va desde las 5 PM (17:00) de un día hasta las 5 PM del día siguiente.
        
        Args:
            dt: datetime en hora chilena
            
        Returns:
            str: Fecha del día de directo en formato YYYY-MM-DD
        """
        from datetime import datetime, timedelta, timezone
        
        # Zona horaria de Chile (UTC-3)
        chile_offset = timezone(timedelta(hours=-3))
        
        # Asegurar que dt está en hora chilena
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=chile_offset)
        else:
            dt = dt.astimezone(chile_offset)
        
        # Si la hora es >= 17:00 (5 PM), el día de directo es ese día
        # Si la hora es < 17:00 (5 PM), el día de directo es el día anterior
        if dt.hour >= 17:
            stream_day = dt.date()
        else:
            # Es antes de las 5 PM, el día de directo es el día anterior
            stream_day = (dt - timedelta(days=1)).date()
        
        return stream_day.strftime("%Y-%m-%d")

    def _setup_handlers(self):
        """Configura los handlers de eventos usando decoradores"""
        print(f"🔧 Configurando handlers de eventos...")
        
        # Usar decoradores como en el bot antiguo
        @self.client.on(ConnectEvent)
        async def on_connect_handler(event: ConnectEvent):
            print(f"🔔 [DEBUG] ConnectEvent recibido!")
            await self.on_connect(event)
        
        @self.client.on(DisconnectEvent)
        async def on_disconnect_handler(event: DisconnectEvent):
            print(f"🔔 [DEBUG] DisconnectEvent recibido!")
            await self.on_disconnect(event)
        
        @self.client.on(CommentEvent)
        async def on_comment_handler(event: CommentEvent):
            await self.on_comment(event)
        
        @self.client.on(GiftEvent)
        async def on_gift_handler(event: GiftEvent):
            await self.on_gift(event)
        
        @self.client.on(FollowEvent)
        async def on_follow_handler(event: FollowEvent):
            await self.on_follow(event)
        
        @self.client.on(JoinEvent)
        async def on_join_handler(event: JoinEvent):
            await self.on_join(event)
        
        @self.client.on(ShareEvent)
        async def on_share_handler(event: ShareEvent):
            await self.on_share(event)
        
        @self.client.on(LikeEvent)
        async def on_like_handler(event: LikeEvent):
            await self.on_like(event)
        
        print(f"✅ Handlers configurados (ConnectEvent, DisconnectEvent, CommentEvent, GiftEvent, FollowEvent, JoinEvent, ShareEvent, LikeEvent)")
        # Viewers se capturan desde JoinEvent

    async def on_connect(self, event: ConnectEvent):
        """Se ejecuta cuando se conecta al stream"""
        print(f"✅ [EVENTO] Conectado al stream de @{self.username}")
        
        # Registrar streamer si no existe
        await self._register_streamer()
        
        # Crear nuevo stream
        await self._create_stream()

    async def on_disconnect(self, event: DisconnectEvent):
        """Se ejecuta cuando se desconecta del stream"""
        print(f"❌ Desconectado del stream de @{self.username}")
        
        # NO finalizar el stream automáticamente
        # El stream permanece activo hasta que se confirme que realmente terminó
        # (por ejemplo, cuando se detecta "not live" al intentar reconectar)
        print(f"💡 Stream {self.stream_id} permanece activo. Se finalizará cuando se confirme que terminó.")

    def _extract_user_info(self, event):
        """Extrae información completa del usuario desde cualquier evento"""
        user_info = {}
        try:
            # Intentar obtener de user_info (estructura completa)
            if hasattr(event, 'user_info') and event.user_info:
                ui = event.user_info
                
                # Información básica
                if hasattr(ui, 'id'):
                    user_info['user_id'] = ui.id
                if hasattr(ui, 'nick_name'):
                    user_info['nickname'] = ui.nick_name
                if hasattr(ui, 'username'):
                    user_info['username'] = ui.username
                if hasattr(ui, 'sec_uid'):
                    user_info['sec_uid'] = ui.sec_uid
                
                # Avatar (foto de perfil)
                if hasattr(ui, 'avatar_thumb') and ui.avatar_thumb:
                    if hasattr(ui.avatar_thumb, 'm_urls') and ui.avatar_thumb.m_urls:
                        user_info['profile_image_url'] = ui.avatar_thumb.m_urls[0]
                    elif hasattr(ui.avatar_thumb, 'uri'):
                        user_info['profile_image_url'] = ui.avatar_thumb.uri
                
                # Información de seguimiento
                if hasattr(ui, 'follow_info') and ui.follow_info:
                    if hasattr(ui.follow_info, 'follower_count'):
                        user_info['follower_count'] = ui.follow_info.follower_count
                    if hasattr(ui.follow_info, 'following_count'):
                        user_info['following_count'] = ui.follow_info.following_count
                
                # Identidad del usuario (si sigue al streamer)
                if hasattr(event, 'user_identity') and event.user_identity:
                    ui_identity = event.user_identity
                    if hasattr(ui_identity, 'is_follower_of_anchor'):
                        user_info['is_following_streamer'] = ui_identity.is_follower_of_anchor
            
            # Fallback: intentar obtener de user (estructura simple)
            elif hasattr(event, 'user') and event.user:
                user = event.user
                
                # Información básica
                if hasattr(user, 'unique_id'):
                    user_info['username'] = user.unique_id
                if hasattr(user, 'nickname') or hasattr(user, 'nick_name'):
                    user_info['nickname'] = getattr(user, 'nickname', None) or getattr(user, 'nick_name', None)
                if hasattr(user, 'username'):
                    user_info['username'] = user.username
                
                # Avatar (foto de perfil) - intentar múltiples formas
                if hasattr(user, 'avatar_thumb') and user.avatar_thumb:
                    if hasattr(user.avatar_thumb, 'm_urls') and user.avatar_thumb.m_urls:
                        user_info['profile_image_url'] = user.avatar_thumb.m_urls[0]
                    elif hasattr(user.avatar_thumb, 'uri'):
                        user_info['profile_image_url'] = user.avatar_thumb.uri
                elif hasattr(user, 'avatar_large') and user.avatar_large:
                    if hasattr(user.avatar_large, 'm_urls') and user.avatar_large.m_urls:
                        user_info['profile_image_url'] = user.avatar_large.m_urls[0]
                elif hasattr(user, 'avatar_url') and user.avatar_url:
                    if hasattr(user.avatar_url, 'url'):
                        user_info['profile_image_url'] = user.avatar_url.url
                    elif isinstance(user.avatar_url, str):
                        user_info['profile_image_url'] = user.avatar_url
                elif hasattr(user, 'profile_picture_url'):
                    user_info['profile_image_url'] = user.profile_picture_url
                
                # Información de seguimiento
                if hasattr(user, 'follow_info') and user.follow_info:
                    if hasattr(user.follow_info, 'follower_count'):
                        user_info['follower_count'] = user.follow_info.follower_count
                    if hasattr(user.follow_info, 'following_count'):
                        user_info['following_count'] = user.follow_info.following_count
                
                # Intentar obtener directamente del user
                if 'follower_count' not in user_info and hasattr(user, 'follower_count'):
                    user_info['follower_count'] = user.follower_count
                if 'following_count' not in user_info and hasattr(user, 'following_count'):
                    user_info['following_count'] = user.following_count
                
                # Relación con el streamer
                if hasattr(user, 'is_following'):
                    user_info['is_following_streamer'] = user.is_following
                if hasattr(user, 'is_follower'):
                    user_info['is_following_streamer'] = user.is_follower
                    
        except Exception as e:
            print(f"⚠️ Error extrayendo info del usuario: {e}")
        
        return user_info

    async def on_comment(self, event: CommentEvent):
        """Maneja comentarios del chat"""
        try:
            # Extraer información completa del usuario
            extracted_info = self._extract_user_info(event)
            
            user_data = {
                "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                "profile_image_url": extracted_info.get('profile_image_url'),
                "follower_count": extracted_info.get('follower_count'),
                "following_count": extracted_info.get('following_count'),
                "is_following_streamer": extracted_info.get('is_following_streamer'),
            }

            event_data = {
                "content": event.comment,
                "metadata": {
                    # comment_id no está disponible en CommentEvent de TikTokLive 6.x
                },
            }

            print(f"💬 [COMENTARIO] {user_data['display_name'] or user_data['username']}: {event.comment[:50]}")
            await self._send_event("comment", user_data, event_data)
        except Exception as e:
            print(f"❌ Error procesando comentario: {e}")
            import traceback
            traceback.print_exc()

    async def on_gift(self, event: GiftEvent):
        """Maneja regalos/donaciones"""
        try:
            # Extraer información completa del usuario
            extracted_info = self._extract_user_info(event)
            
            user_data = {
                "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                "profile_image_url": extracted_info.get('profile_image_url'),
                "follower_count": extracted_info.get('follower_count'),
                "following_count": extracted_info.get('following_count'),
                "is_following_streamer": extracted_info.get('is_following_streamer'),
            }

            # Extraer imagen del regalo (mejorado para capturar más casos)
            gift_image_url = None
            try:
                gift = event.gift
                
                # Intentar múltiples ubicaciones donde TikTok puede almacenar la imagen
                if hasattr(gift, 'image') and gift.image:
                    if hasattr(gift.image, 'm_urls') and gift.image.m_urls:
                        gift_image_url = gift.image.m_urls[0]
                    elif hasattr(gift.image, 'uri'):
                        gift_image_url = gift.image.uri
                    elif hasattr(gift.image, 'url'):
                        gift_image_url = gift.image.url
                    elif isinstance(gift.image, str):
                        gift_image_url = gift.image
                
                # Intentar otras propiedades directas
                if not gift_image_url:
                    if hasattr(gift, 'image_url'):
                        gift_image_url = gift.image_url
                    elif hasattr(gift, 'gift_picture_url'):
                        gift_image_url = gift.gift_picture_url
                    elif hasattr(gift, 'picture_url'):
                        gift_image_url = gift.picture_url
                    elif hasattr(gift, 'icon_url'):
                        gift_image_url = gift.icon_url
                
                # Intentar desde gift_info si existe
                if not gift_image_url and hasattr(gift, 'gift_info'):
                    gift_info = gift.gift_info
                    if hasattr(gift_info, 'image') and gift_info.image:
                        if hasattr(gift_info.image, 'm_urls') and gift_info.image.m_urls:
                            gift_image_url = gift_info.image.m_urls[0]
                        elif hasattr(gift_info.image, 'uri'):
                            gift_image_url = gift_info.image.uri
                    elif hasattr(gift_info, 'image_url'):
                        gift_image_url = gift_info.image_url
                
                if gift_image_url:
                    print(f"🖼️ [DEBUG] Imagen del regalo capturada: {gift_image_url}")
                else:
                    print(f"⚠️ [DEBUG] No se pudo encontrar imagen para el regalo: {getattr(gift, 'name', 'Unknown')}")
                    
            except Exception as e:
                print(f"⚠️ Error extrayendo imagen del regalo: {e}")
                import traceback
                traceback.print_exc()

            # Intentar extraer TikTok coins/diamonds del regalo
            tiktok_coins = None
            try:
                gift = event.gift
                # Intentar múltiples ubicaciones donde TikTok puede almacenar los coins
                if hasattr(gift, 'diamond_count') and gift.diamond_count is not None:
                    tiktok_coins = int(gift.diamond_count) * getattr(gift, "count", 1)
                elif hasattr(gift, 'coins') and gift.coins is not None:
                    tiktok_coins = int(gift.coins) * getattr(gift, "count", 1)
                elif hasattr(gift, 'diamonds') and gift.diamonds is not None:
                    tiktok_coins = int(gift.diamonds) * getattr(gift, "count", 1)
                elif hasattr(gift, 'amount') and gift.amount is not None:
                    tiktok_coins = int(gift.amount) * getattr(gift, "count", 1)
                elif hasattr(gift, 'gift_info'):
                    gift_info = gift.gift_info
                    if hasattr(gift_info, 'diamond_count') and gift_info.diamond_count is not None:
                        tiktok_coins = int(gift_info.diamond_count) * getattr(gift, "count", 1)
                    elif hasattr(gift_info, 'coins') and gift_info.coins is not None:
                        tiktok_coins = int(gift_info.coins) * getattr(gift, "count", 1)
                    elif hasattr(gift_info, 'diamonds') and gift_info.diamonds is not None:
                        tiktok_coins = int(gift_info.diamonds) * getattr(gift, "count", 1)
                    elif hasattr(gift_info, 'amount') and gift_info.amount is not None:
                        tiktok_coins = int(gift_info.amount) * getattr(gift, "count", 1)
                
                if tiktok_coins:
                    print(f"💰 [DEBUG] TikTok Coins capturados: {tiktok_coins}")
                else:
                    print(f"⚠️ [DEBUG] No se pudo encontrar TikTok Coins para el regalo: {getattr(gift, 'name', 'Unknown')}")
                    # Debug: mostrar atributos disponibles del gift
                    if hasattr(gift, '__dict__'):
                        print(f"🔍 [DEBUG] Atributos disponibles en gift: {list(gift.__dict__.keys())}")
            except Exception as e:
                print(f"⚠️ Error extrayendo TikTok Coins: {e}")
                import traceback
                traceback.print_exc()

            donation_data = {
                "gift_type": getattr(event.gift, "gift_type", "unknown"),
                "gift_name": getattr(event.gift, "name", "Unknown Gift"),
                "gift_count": getattr(event.gift, "count", 1),
                "gift_value": None,  # TikTok no siempre proporciona el valor en USD
                "tiktok_coins": tiktok_coins,  # Coins de TikTok
                "gift_image_url": gift_image_url,  # URL de la imagen del regalo
                "message": None,
            }

            event_data = {
                "content": f"Regalo: {donation_data['gift_name']} x{donation_data['gift_count']}",
                "metadata": {
                    "gift_id": str(getattr(event.gift, "id", None)) if hasattr(event.gift, "id") else None,
                },
                "donation": donation_data,
            }

            print(f"🎁 [REGALO] {user_data['display_name'] or user_data['username']}: {donation_data['gift_name']} x{donation_data['gift_count']}")
            await self._send_event("donation", user_data, event_data)
        except Exception as e:
            print(f"❌ Error procesando regalo: {e}")
            import traceback
            traceback.print_exc()

    async def on_follow(self, event: FollowEvent):
        """Maneja nuevos seguidores"""
        try:
            # Extraer información completa del usuario
            extracted_info = self._extract_user_info(event)
            
            user_data = {
                "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                "profile_image_url": extracted_info.get('profile_image_url'),
                "follower_count": extracted_info.get('follower_count'),
                "following_count": extracted_info.get('following_count'),
                "is_following_streamer": extracted_info.get('is_following_streamer', True),  # Default True para follows
            }

            event_data = {
                "content": f"{user_data['display_name'] or user_data['username']} comenzó a seguir",
                "metadata": {},
            }

            print(f"👥 [FOLLOW] {user_data['display_name'] or user_data['username']} comenzó a seguir")
            await self._send_event("follow", user_data, event_data)
        except Exception as e:
            print(f"❌ Error procesando follow: {e}")
            import traceback
            traceback.print_exc()

    async def on_join(self, event: JoinEvent):
        """Captura viewers y información del usuario que se une"""
        try:
            viewer_count = None
            
            # El evento JoinEvent tiene un atributo 'count' con el número de viewers
            if hasattr(event, 'count') and event.count is not None:
                viewer_count = event.count
                
                # Solo actualizar si hay un stream activo
                if self.stream_id:
                    # Actualizar viewer_count en el stream
                    await self._update_viewer_count(viewer_count)
                    
                    # Guardar en historial (solo si cambió significativamente para no saturar la BD)
                    # Guardamos cada cambio o al menos cada 10 segundos
                    await self._save_viewer_history(viewer_count)
                    
                    print(f"👥 [VIEWERS] {viewer_count} espectadores")
            
            # Capturar información del usuario que se une
            if self.stream_id:
                # Extraer información completa del usuario
                extracted_info = self._extract_user_info(event)
                
                user_data = {
                    "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                    "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                    "profile_image_url": extracted_info.get('profile_image_url'),
                    "follower_count": extracted_info.get('follower_count'),
                    "following_count": extracted_info.get('following_count'),
                    "is_following_streamer": extracted_info.get('is_following_streamer'),
                }

                event_data = {
                    "content": f"{user_data['display_name'] or user_data['username']} se unió al stream",
                    "metadata": {
                        "viewer_count": viewer_count,
                    },
                }

                print(f"👋 [JOIN] {user_data['display_name'] or user_data['username']} se unió")
                await self._send_event("join", user_data, event_data)
        except Exception as e:
            print(f"⚠️ Error procesando join: {e}")
            import traceback
            traceback.print_exc()

    async def _update_viewer_count(self, viewer_count: int):
        """Actualiza el viewer_count en el stream"""
        try:
            response = requests.patch(
                f"{self.api_url}/streams/{self.stream_id}",
                json={"viewer_count": viewer_count},
                timeout=5
            )
            if response.status_code == 200:
                return
            else:
                print(f"⚠️ Error actualizando viewer_count: {response.status_code}")
                # Agregar a cola para reintentar
                self.event_queue.add_event(
                    "viewer_count",
                    {"stream_id": self.stream_id, "viewer_count": viewer_count},
                    priority=2  # Alta prioridad para viewers
                )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            # API no disponible, agregar a cola
            self.event_queue.add_event(
                "viewer_count",
                {"stream_id": self.stream_id, "viewer_count": viewer_count},
                priority=2
            )
        except Exception as e:
            # Otros errores, agregar a cola
            self.event_queue.add_event(
                "viewer_count",
                {"stream_id": self.stream_id, "viewer_count": viewer_count},
                priority=2
            )

    async def _save_viewer_history(self, viewer_count: int):
        """Guarda el viewer_count en el historial"""
        try:
            response = requests.post(
                f"{self.api_url}/viewer-history",
                json={
                    "stream_id": self.stream_id,
                    "viewer_count": viewer_count
                },
                timeout=5
            )
            if response.status_code == 200:
                return
            else:
                print(f"⚠️ Error guardando historial de viewers: {response.status_code}")
                # Agregar a cola para reintentar
                self.event_queue.add_event(
                    "viewer_history",
                    {"stream_id": self.stream_id, "viewer_count": viewer_count},
                    priority=1
                )
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            # API no disponible, agregar a cola
            self.event_queue.add_event(
                "viewer_history",
                {"stream_id": self.stream_id, "viewer_count": viewer_count},
                priority=1
            )
        except Exception as e:
            # Otros errores, agregar a cola
            self.event_queue.add_event(
                "viewer_history",
                {"stream_id": self.stream_id, "viewer_count": viewer_count},
                priority=1
            )

    async def on_share(self, event: ShareEvent):
        """Maneja compartidos del stream"""
        try:
            # Extraer información completa del usuario
            extracted_info = self._extract_user_info(event)
            
            user_data = {
                "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                "profile_image_url": extracted_info.get('profile_image_url'),
                "follower_count": extracted_info.get('follower_count'),
                "following_count": extracted_info.get('following_count'),
                "is_following_streamer": extracted_info.get('is_following_streamer'),
            }

            # Obtener tipo de compartido
            share_type = None
            share_text = "Compartido"
            try:
                if hasattr(event, 'display_text') and event.display_text:
                    share_text = event.display_text
                    share_type = getattr(event, 'share_type', None)
                elif hasattr(event, 'share_type'):
                    share_type = event.share_type
                    share_text = f"Compartido ({share_type})"
            except Exception as e:
                print(f"⚠️ Error obteniendo tipo de share: {e}")

            event_data = {
                "content": share_text,
                "metadata": {
                    "share_type": str(share_type) if share_type else None,
                },
            }

            print(f"📤 [SHARE] {user_data['display_name'] or user_data['username']}: {share_text}")
            await self._send_event("share", user_data, event_data)
        except Exception as e:
            print(f"❌ Error procesando share: {e}")
            import traceback
            traceback.print_exc()

    async def on_like(self, event: LikeEvent):
        """Maneja likes/me gustas del stream"""
        try:
            # Extraer información completa del usuario
            extracted_info = self._extract_user_info(event)
            
            user_data = {
                "username": extracted_info.get('username') or getattr(event.user, 'unique_id', None) or getattr(event.user, 'nickname', None) or "unknown",
                "display_name": extracted_info.get('nickname') or getattr(event.user, 'nickname', None),
                "profile_image_url": extracted_info.get('profile_image_url'),
                "follower_count": extracted_info.get('follower_count'),
                "following_count": extracted_info.get('following_count'),
                "is_following_streamer": extracted_info.get('is_following_streamer'),
            }

            # Intentar obtener el contador de likes si está disponible
            likes_count = None
            try:
                if hasattr(event, 'like_count'):
                    likes_count = event.like_count
                elif hasattr(event, 'count'):
                    likes_count = event.count
            except Exception as e:
                print(f"⚠️ Error extrayendo contador de likes: {e}")

            event_data = {
                "content": "Me gusta",
                "metadata": {
                    "like_count": likes_count,
                },
            }

            print(f"❤️ [LIKE] {user_data['display_name'] or user_data['username']}" + (f" ({likes_count} likes)" if likes_count else ""))
            await self._send_event("like", user_data, event_data)
        except Exception as e:
            print(f"❌ Error procesando like: {e}")
            import traceback
            traceback.print_exc()

    # Nota: viewer_update no está disponible en TikTokLive 6.x
    # Si necesitas actualizar viewer count, puedes hacerlo periódicamente
    # o usar otro evento disponible

    async def _register_streamer(self):
        """Registra o actualiza el streamer en la base de datos"""
        try:
            print(f"📝 Registrando streamer @{self.username}...")
            # Asegurarse de que no haya valores None/undefined
            payload = {
                "username": self.username or "",
                "display_name": self.username or "",
            }
            # Remover None values
            payload = {k: v for k, v in payload.items() if v is not None}
            
            response = requests.post(
                f"{self.api_url}/streamers",
                json=payload,
                timeout=10,
            )
            if response.status_code == 200:
                data = response.json()
                self.streamer_id = data.get("id")
                print(f"✅ Streamer registrado: {self.streamer_id}")
                return
            else:
                print(f"⚠️ Error registrando streamer ({response.status_code}): {response.text}")
                # Agregar a cola para reintentar
                self.event_queue.add_event("streamer", payload, priority=2)
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
            print(f"⚠️ API no disponible, agregando registro de streamer a la cola")
            self.event_queue.add_event("streamer", payload, priority=2)
            # Intentar obtener streamer_id de la cola si ya existe
            # Por ahora, continuar sin streamer_id
        except Exception as e:
            print(f"❌ Error registrando streamer: {e}")
            import traceback
            traceback.print_exc()
            # Agregar a cola como último recurso
            try:
                payload = {
                    "username": self.username or "",
                    "display_name": self.username or "",
                }
                self.event_queue.add_event("streamer", payload, priority=2)
            except:
                pass

    async def _create_stream(self):
        """Crea un nuevo stream o continúa con uno del mismo día de directo"""
        try:
            if not self.streamer_id:
                await self._register_streamer()

            if not self.streamer_id:
                print(f"❌ No se pudo obtener streamer_id, no se puede crear el stream")
                return

            print(f"📹 Buscando stream del mismo día de directo para streamer_id: {self.streamer_id}...")
            
            # Obtener el día de directo actual
            from datetime import datetime, timedelta, timezone
            chile_offset = timezone(timedelta(hours=-3))
            now_chile = datetime.now(chile_offset)
            current_stream_day = self._get_stream_day(now_chile)
            
            print(f"📅 Día de directo actual: {current_stream_day}")
            
            try:
                # Buscar streams del mismo streamer
                response = requests.get(
                    f"{self.api_url}/streams?streamer_id={self.streamer_id}",
                    timeout=10,
                )
                
                if response.status_code == 200:
                    streams = response.json()
                    
                    # Buscar streams del mismo día de directo
                    same_day_streams = []
                    for stream in streams:
                        try:
                            # Obtener started_at del stream
                            started_at = stream.get("started_at")
                            if not started_at:
                                continue
                            
                            # Parsear started_at
                            started_dt = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                            if started_dt.tzinfo is None:
                                started_dt = started_dt.replace(tzinfo=timezone.utc)
                            
                            # Convertir a hora de Chile y obtener día de directo
                            started_chile = started_dt.astimezone(chile_offset)
                            stream_day = self._get_stream_day(started_chile)
                            
                            # Si es del mismo día de directo, agregarlo a la lista
                            if stream_day == current_stream_day:
                                same_day_streams.append(stream)
                        except Exception as e:
                            print(f"⚠️ Error procesando stream {stream.get('id')}: {e}")
                            continue
                    
                    if same_day_streams:
                        # Buscar stream activo del mismo día de directo
                        active_stream = None
                        for stream in same_day_streams:
                            if not stream.get("ended_at"):
                                active_stream = stream
                                break
                        
                        if active_stream:
                            # Hay un stream activo del mismo día de directo, continuar con ese
                            stream_id = active_stream.get("id")
                            parent_stream_id = active_stream.get("parent_stream_id")
                            
                            # Si tiene parent_stream_id, usar el parent como stream principal
                            if parent_stream_id:
                                print(f"🔄 Stream activo es una parte, usando stream principal: {parent_stream_id}")
                                stream_id = parent_stream_id
                            
                            # Si el stream tiene ended_at (no debería, pero por si acaso), reabrirlo
                            if active_stream.get("ended_at"):
                                print(f"🔄 Reabriendo stream activo: {stream_id}")
                                try:
                                    patch_response = requests.patch(
                                        f"{self.api_url}/streams/{stream_id}",
                                        json={"ended_at": None},
                                        timeout=10,
                                    )
                                    if patch_response.status_code == 200:
                                        self.stream_id = stream_id
                                        print(f"✅ Stream reabierto: {self.stream_id}")
                                        return
                                except Exception as e:
                                    print(f"⚠️ Error reabriendo stream: {e}")
                            else:
                                # Stream ya está activo, usar ese
                                self.stream_id = stream_id
                                print(f"✅ Continuando con stream activo del mismo día: {self.stream_id}")
                                return
                        else:
                            # No hay stream activo, pero hay streams terminados del mismo día
                            # Crear una nueva parte
                            print(f"📝 Hay streams terminados del mismo día de directo, creando nueva parte...")
                            
                            # Encontrar el stream principal (el más antiguo sin parent_stream_id)
                            principal_stream = None
                            for stream in same_day_streams:
                                if not stream.get("parent_stream_id"):
                                    if principal_stream is None:
                                        principal_stream = stream
                                    else:
                                        # Comparar started_at para encontrar el más antiguo
                                        principal_started = datetime.fromisoformat(
                                            principal_stream.get("started_at", "").replace('Z', '+00:00')
                                        )
                                        stream_started = datetime.fromisoformat(
                                            stream.get("started_at", "").replace('Z', '+00:00')
                                        )
                                        if stream_started < principal_started:
                                            principal_stream = stream
                            
                            if principal_stream:
                                # Crear nueva parte del stream principal
                                principal_id = principal_stream.get("id")
                                
                                # Obtener el número de parte más alto
                                max_part_number = 1
                                for stream in same_day_streams:
                                    if stream.get("parent_stream_id") == principal_id:
                                        part_num = stream.get("part_number", 1)
                                        if part_num > max_part_number:
                                            max_part_number = part_num
                                
                                # Crear nuevo stream como parte
                                payload = {
                                    "streamer_id": self.streamer_id,
                                    "parent_stream_id": principal_id,
                                    "part_number": max_part_number + 1,
                                }
                                
                                try:
                                    response = requests.post(
                                        f"{self.api_url}/streams",
                                        json=payload,
                                        timeout=10,
                                    )
                                    if response.status_code == 200:
                                        data = response.json()
                                        self.stream_id = data.get("id")
                                        print(f"✅ Nueva parte creada: {self.stream_id} (parte {max_part_number + 1} del stream {principal_id})")
                                        return
                                except Exception as e:
                                    print(f"⚠️ Error creando nueva parte: {e}")
                
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                print(f"⚠️ API no disponible para buscar streams, creando nuevo stream")
            except Exception as e:
                print(f"⚠️ Error buscando streams: {e}")
                import traceback
                traceback.print_exc()

            # Si no se encontró stream reciente o hubo error, crear uno nuevo
            print(f"📹 Creando nuevo stream para streamer_id: {self.streamer_id}...")
            payload = {
                "streamer_id": self.streamer_id,
            }
            
            try:
                response = requests.post(
                    f"{self.api_url}/streams",
                    json=payload,
                    timeout=10,
                )
                if response.status_code == 200:
                    data = response.json()
                    self.stream_id = data.get("id")
                    print(f"✅ Stream creado: {self.stream_id}")
                    return
                else:
                    print(f"⚠️ Error creando stream ({response.status_code}): {response.text}")
                    # Agregar a cola para reintentar
                    self.event_queue.add_event("stream_create", payload, priority=2)
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                print(f"⚠️ API no disponible, agregando creación de stream a la cola")
                self.event_queue.add_event("stream_create", payload, priority=2)
                # Nota: stream_id será None hasta que se procese la cola
            except Exception as e:
                print(f"❌ Error creando stream: {e}")
                # Agregar a cola para reintentar
                self.event_queue.add_event("stream_create", payload, priority=2)
        except Exception as e:
            print(f"❌ Error en _create_stream: {e}")
            import traceback
            traceback.print_exc()

    async def _end_stream(self):
        """Finaliza el stream actual"""
        try:
            if self.stream_id:
                # Get current time in ISO format
                from datetime import datetime
                payload = {
                    "id": self.stream_id,
                    "ended_at": datetime.utcnow().isoformat() + "Z",
                }
                
                try:
                    response = requests.patch(
                        f"{self.api_url}/streams/{self.stream_id}",
                        json={"ended_at": payload["ended_at"]},
                        timeout=10,
                    )
                    if response.status_code == 200:
                        print(f"✅ Stream finalizado: {self.stream_id}")
                        return
                    else:
                        print(f"⚠️ Error finalizando stream ({response.status_code})")
                        # Agregar a cola para reintentar
                        self.event_queue.add_event("stream_update", payload, priority=2)
                except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                    print(f"⚠️ API no disponible, agregando finalización de stream a la cola")
                    self.event_queue.add_event("stream_update", payload, priority=2)
                except Exception as e:
                    print(f"⚠️ Error finalizando stream: {e}")
                    # Agregar a cola para reintentar
                    self.event_queue.add_event("stream_update", payload, priority=2)
        except Exception as e:
            print(f"Error en _end_stream: {e}")

    async def _send_event(
        self, event_type: str, user_data: dict, event_data: dict
    ):
        """Envía un evento a la API o lo agrega a la cola si falla"""
        try:
            if not self.stream_id:
                print(f"⚠️ No hay stream_id, creando stream...")
                await self._create_stream()
                if not self.stream_id:
                    print(f"❌ No se pudo crear el stream, no se puede enviar el evento")
                    return

            payload = {
                "event_type": event_type,
                "stream_id": self.stream_id,
                "user_data": user_data,
                "event_data": event_data,
            }

            # Intentar enviar directamente primero
            try:
                response = requests.post(
                    f"{self.api_url}/events",
                    json=payload,
                    timeout=5,
                )

                if response.status_code == 200:
                    print(f"✅ Evento {event_type} enviado correctamente")
                    return
                else:
                    print(f"⚠️ Error enviando evento ({response.status_code}): {response.text}")
                    # Agregar a cola para reintentar
                    self.event_queue.add_event("event", payload, priority=1)
            except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as e:
                # API no disponible, agregar a cola
                print(f"⚠️ API no disponible, agregando evento a la cola: {event_type}")
                self.event_queue.add_event("event", payload, priority=1)
            except Exception as e:
                print(f"❌ Error enviando evento: {e}")
                # Agregar a cola para reintentar
                self.event_queue.add_event("event", payload, priority=1)
        except Exception as e:
            print(f"❌ Error en _send_event: {e}")
            import traceback
            traceback.print_exc()
            # Intentar agregar a cola como último recurso
            try:
                payload = {
                    "event_type": event_type,
                    "stream_id": self.stream_id,
                    "user_data": user_data,
                    "event_data": event_data,
                }
                self.event_queue.add_event("event", payload, priority=0)
            except:
                pass

    async def start(self):
        """Inicia la conexión al stream"""
        try:
            # Iniciar procesador de cola si no está corriendo
            if self._queue_processor_task is None:
                async def process_queue_loop():
                    while True:
                        try:
                            await self.event_queue.process_queue()
                            await asyncio.sleep(10)  # Procesar cola cada 10 segundos
                        except Exception as e:
                            print(f"⚠️ Error en procesador de cola: {e}")
                            await asyncio.sleep(10)
                
                self._queue_processor_task = asyncio.create_task(process_queue_loop())
                print(f"🔄 Procesador de cola iniciado")
            
            # Procesar cola pendiente al iniciar
            queue_size = self.event_queue.get_queue_size()
            if queue_size > 0:
                print(f"📦 Procesando {queue_size} eventos pendientes en la cola...")
                await self.event_queue.process_queue()
            
            print(f"🔄 Intentando conectar al stream de @{self.username}...")
            await self.client.start()
            print(f"✅ Cliente iniciado, esperando eventos...")
            print(f"💡 Si el streamer está en vivo, deberías ver '✅ [EVENTO] Conectado al stream' en breve...")
            # Dar tiempo para que se dispare el evento ConnectEvent
            await asyncio.sleep(5)
            
            # Verificar si se recibió el ConnectEvent
            if not self.stream_id:
                print(f"⚠️ No se recibió ConnectEvent después de 5 segundos.")
                print(f"💡 Posibles razones:")
                print(f"   - El streamer @{self.username} no está en vivo actualmente")
                print(f"   - Hay un problema de conexión con TikTok")
                print(f"   - El username puede ser incorrecto")
                print(f"💡 El bot seguirá esperando. Si el streamer inicia un directo, se conectará automáticamente.")
        except Exception as e:
            error_msg = str(e).lower()
            print(f"❌ Error iniciando cliente: {e}")
            
            # Detectar si el streamer no está en vivo
            if any(keyword in error_msg for keyword in ['not live', 'not streaming', 'no live', 'offline', 'unavailable', '504', 'sign_not_200']):
                print(f"💡 El streamer @{self.username} no está en vivo actualmente")
                print(f"💡 Espera a que comience a transmitir y vuelve a intentar")
            else:
                print(f"💡 Asegúrate de que el stream esté en vivo y el username sea correcto")
            raise

    async def stop(self):
        """Detiene la conexión"""
        try:
            if self.stream_id:
                await self._end_stream()
        except Exception as e:
            print(f"Error finalizando stream: {e}")
        
        # Intentar detener el cliente si tiene el método
        try:
            if hasattr(self.client, 'stop'):
                if asyncio.iscoroutinefunction(self.client.stop):
                    await self.client.stop()
                else:
                    self.client.stop()
            elif hasattr(self.client, 'disconnect'):
                if asyncio.iscoroutinefunction(self.client.disconnect):
                    await self.client.disconnect()
                else:
                    self.client.disconnect()
        except Exception as e:
            print(f"Error deteniendo cliente: {e}")


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


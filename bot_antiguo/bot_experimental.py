"""
Bot experimental para analizar streams de TikTok.
Lee el streamer activo desde la configuración del dashboard.
NO sube datos a Google Sheets, solo guarda localmente.
"""
import asyncio
import time
import threading
from TikTokLive import TikTokLiveClient
from TikTokLive.events import (
    ConnectEvent, CommentEvent, GiftEvent, LikeEvent, JoinEvent, FollowEvent, DisconnectEvent, ShareEvent
)

import db_manager_experimental
import tiktok_page_scraper

# Variable global para el username actual
current_streamer_username = None

def get_active_streamer():
    """Obtiene el streamer activo desde la configuración."""
    global current_streamer_username
    
    try:
        streamer_username = db_manager_experimental.get_active_streamer_username()
        if streamer_username:
            current_streamer_username = streamer_username
            return streamer_username
    except Exception as e:
        print(f"[Bot-Experimental] Error obteniendo streamer activo: {e}")
    
    return current_streamer_username

# Inicializar cliente (se actualizará cuando haya streamer activo)
client = None

# --- Funciones de Ayuda ---
def extract_user_info(event):
    """
    Extrae información completa del usuario desde cualquier evento de TikTokLive.
    Retorna un diccionario con toda la información disponible del usuario.
    """
    user_info = {}
    try:
        # Debug: Ver qué atributos tiene el evento
        event_attrs = [attr for attr in dir(event) if not attr.startswith('_')]
        
        # Intentar obtener de user_info (estructura completa)
        if hasattr(event, 'user_info'):
            ui = event.user_info
            print(f"[Bot-Experimental] ✅ user_info encontrado. Tipo: {type(ui)}")
            print(f"[Bot-Experimental] 📋 Atributos de user_info: {[attr for attr in dir(ui) if not attr.startswith('_')]}")
            
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
                    # Tomar la primera URL disponible
                    user_info['profile_picture_url'] = ui.avatar_thumb.m_urls[0]
            
            # Información de seguimiento
            if hasattr(ui, 'follow_info') and ui.follow_info:
                print(f"[Bot-Experimental] 📊 follow_info encontrado: {type(ui.follow_info)}")
                print(f"[Bot-Experimental] 📋 Atributos de follow_info: {[attr for attr in dir(ui.follow_info) if not attr.startswith('_')]}")
                if hasattr(ui.follow_info, 'follower_count'):
                    user_info['follower_count'] = ui.follow_info.follower_count
                    print(f"[Bot-Experimental] ✅ follower_count = {ui.follow_info.follower_count}")
                if hasattr(ui.follow_info, 'following_count'):
                    user_info['following_count'] = ui.follow_info.following_count
                    print(f"[Bot-Experimental] ✅ following_count = {ui.follow_info.following_count}")
                if hasattr(ui.follow_info, 'follow_status'):
                    user_info['follow_status'] = ui.follow_info.follow_status
            else:
                print(f"[Bot-Experimental] ⚠️ follow_info NO encontrado o está vacío")
            
            # Badges (moderador, etc.)
            if hasattr(ui, 'badge_list') and ui.badge_list:
                badges = []
                for badge in ui.badge_list:
                    badge_info = {}
                    if hasattr(badge, 'text_badge') and badge.text_badge:
                        if hasattr(badge.text_badge, 'default_pattern'):
                            badge_info['text'] = badge.text_badge.default_pattern
                    if hasattr(badge, 'combine_badge_struct') and badge.combine_badge_struct:
                        if hasattr(badge.combine_badge_struct, 'text') and badge.combine_badge_struct.text:
                            if hasattr(badge.combine_badge_struct.text, 'default_pattern'):
                                badge_info['text'] = badge.combine_badge_struct.text.default_pattern
                    if badge_info:
                        badges.append(badge_info)
                if badges:
                    user_info['badges'] = badges
            
            # Identidad del usuario (si sigue al streamer, es moderador, etc.)
            if hasattr(event, 'user_identity') and event.user_identity:
                ui_identity = event.user_identity
                if hasattr(ui_identity, 'is_follower_of_anchor'):
                    user_info['is_following_streamer'] = ui_identity.is_follower_of_anchor
                if hasattr(ui_identity, 'is_mutual_following_with_anchor'):
                    user_info['is_mutual_following'] = ui_identity.is_mutual_following_with_anchor
                if hasattr(ui_identity, 'is_moderator_of_anchor'):
                    user_info['is_moderator'] = ui_identity.is_moderator_of_anchor
            
            # Atributos del usuario
            if hasattr(ui, 'user_attr') and ui.user_attr:
                if hasattr(ui.user_attr, 'is_admin'):
                    user_info['is_admin'] = ui.user_attr.is_admin
        
        # Fallback: intentar obtener de user (estructura simple)
        elif hasattr(event, 'user') and event.user:
            user = event.user
            print(f"[Bot-Experimental] ⚠️ Usando fallback 'user' (estructura simple)")
            print(f"[Bot-Experimental] 📋 Atributos de user: {[attr for attr in dir(user) if not attr.startswith('_')]}")
            
            # Información básica
            if hasattr(user, 'id'):
                user_info['user_id'] = user.id
            if hasattr(user, 'unique_id'):
                user_info['username'] = user.unique_id
            if hasattr(user, 'nickname') or hasattr(user, 'nick_name'):
                user_info['nickname'] = getattr(user, 'nickname', None) or getattr(user, 'nick_name', None)
            if hasattr(user, 'username'):
                user_info['username'] = user.username
            if hasattr(user, 'sec_uid'):
                user_info['sec_uid'] = user.sec_uid
            
            # Avatar (foto de perfil) - intentar múltiples formas
            if hasattr(user, 'avatar_thumb') and user.avatar_thumb:
                if hasattr(user.avatar_thumb, 'm_urls') and user.avatar_thumb.m_urls:
                    user_info['profile_picture_url'] = user.avatar_thumb.m_urls[0]
                elif hasattr(user.avatar_thumb, 'uri'):
                    user_info['profile_picture_url'] = user.avatar_thumb.uri
            elif hasattr(user, 'avatar_large') and user.avatar_large:
                if hasattr(user.avatar_large, 'm_urls') and user.avatar_large.m_urls:
                    user_info['profile_picture_url'] = user.avatar_large.m_urls[0]
            elif hasattr(user, 'profile_picture_url'):
                user_info['profile_picture_url'] = user.profile_picture_url
            
            # Información de seguimiento desde follow_info
            if hasattr(user, 'follow_info') and user.follow_info:
                print(f"[Bot-Experimental] 📊 follow_info encontrado en user: {type(user.follow_info)}")
                print(f"[Bot-Experimental] 📋 Atributos de follow_info: {[attr for attr in dir(user.follow_info) if not attr.startswith('_')]}")
                if hasattr(user.follow_info, 'follower_count'):
                    user_info['follower_count'] = user.follow_info.follower_count
                    print(f"[Bot-Experimental] ✅ follower_count = {user.follow_info.follower_count}")
                if hasattr(user.follow_info, 'following_count'):
                    user_info['following_count'] = user.follow_info.following_count
                    print(f"[Bot-Experimental] ✅ following_count = {user.follow_info.following_count}")
                if hasattr(user.follow_info, 'follow_status'):
                    user_info['follow_status'] = user.follow_info.follow_status
            
            # Intentar obtener directamente del user si no está en follow_info
            if 'follower_count' not in user_info and hasattr(user, 'follower_count'):
                user_info['follower_count'] = user.follower_count
            if 'following_count' not in user_info and hasattr(user, 'following_count'):
                user_info['following_count'] = user.following_count
            
            # Relación con el streamer
            if hasattr(user, 'is_following'):
                user_info['is_following_streamer'] = user.is_following
            if hasattr(user, 'is_follower'):
                user_info['is_following_streamer'] = user.is_follower
            
            # Badges
            if hasattr(user, 'badge_list') and user.badge_list:
                badges = []
                for badge in user.badge_list:
                    badge_info = {}
                    if hasattr(badge, 'text_badge') and badge.text_badge:
                        if hasattr(badge.text_badge, 'default_pattern'):
                            badge_info['text'] = badge.text_badge.default_pattern
                    if hasattr(badge, 'combine_badge_struct') and badge.combine_badge_struct:
                        if hasattr(badge.combine_badge_struct, 'text') and badge.combine_badge_struct.text:
                            if hasattr(badge.combine_badge_struct.text, 'default_pattern'):
                                badge_info['text'] = badge.combine_badge_struct.text.default_pattern
                    if badge_info:
                        badges.append(badge_info)
                if badges:
                    user_info['badges'] = badges
            
            # Moderador/Admin
            if hasattr(user, 'is_moderator'):
                user_info['is_moderator'] = user.is_moderator
            if hasattr(user, 'user_attr') and user.user_attr:
                if hasattr(user.user_attr, 'is_admin'):
                    user_info['is_admin'] = user.user_attr.is_admin
        else:
            print(f"[Bot-Experimental] ⚠️ No se encontró ni 'user_info' ni 'user' en el evento")
            print(f"[Bot-Experimental] 📋 Atributos disponibles del evento: {event_attrs}")
                
    except Exception as e:
        print(f"[Bot-Experimental] ❌ Error extrayendo info del usuario: {e}")
        import traceback
        traceback.print_exc()
    
    if user_info:
        print(f"[Bot-Experimental] 📦 user_info final extraído: {user_info}")
    else:
        print(f"[Bot-Experimental] ⚠️ user_info vacío - no se pudo extraer información")
    
    return user_info

def get_safe_nickname(event):
    try:
        return event.user.nickname
    except TypeError as e:
        if "'nickName'" in str(e): 
            try:
                return event.user_info.nick_name 
            except Exception:
                return "Usuario(Bug)"
        else:
            return "Usuario(Error)"
    except Exception:
        return "Usuario(Excepción)"

# --- Manejadores de Eventos ---

def setup_client(username):
    """Configura el cliente para un streamer específico."""
    global client
    
    if client:
        try:
            client.stop()
        except:
            pass
    
    client = TikTokLiveClient(unique_id=username)
    
    # Variable para trackear la sesión actual
    current_session_id = None
    current_part_number = None
    is_new_session = True
    was_disconnected = False  # Flag para detectar si hubo desconexión
    likes_capture_task = None  # Tarea asíncrona para capturar likes
    last_likes_count = -1  # Último contador de likes capturado
    
    # Registrar todos los handlers
    async def capture_likes_periodically():
        """
        Tarea asíncrona que captura el contador de likes de la página de TikTok Live periódicamente.
        """
        nonlocal current_session_id, current_part_number, last_likes_count
        
        print(f"[Bot-Experimental-Likes] 🎯 Iniciando captura periódica de likes desde la página web...")
        
        while True:
            try:
                # Esperar 30 segundos antes de la primera captura
                await asyncio.sleep(30)
                
                # Verificar que aún estamos conectados
                if not current_session_id:
                    break
                
                # Capturar el contador de likes desde la página
                likes_count = await asyncio.to_thread(tiktok_page_scraper.fetch_likes_count, username)
                
                if likes_count is not None and likes_count != last_likes_count:
                    last_likes_count = likes_count
                    print(f"[Bot-Experimental-Likes] ❤️ Likes desde página web: {likes_count}")
                    
                    # Guardar en la base de datos como evento room_info
                    simple_data_likes = {
                        "likes_count": likes_count,
                        "source": "web_page"  # Indicar que viene de la página web
                    }
                    
                    # Crear un objeto dummy para raw_data (no tenemos el evento real)
                    class DummyEvent:
                        pass
                    dummy_event = DummyEvent()
                    
                    await asyncio.to_thread(
                        db_manager_experimental.log_event,
                        "room_info", "SYSTEM", simple_data_likes, dummy_event,
                        current_session_id, current_part_number
                    )
                elif likes_count is None:
                    print(f"[Bot-Experimental-Likes] ⚠️ No se pudo obtener el contador de likes")
                    
            except asyncio.CancelledError:
                print(f"[Bot-Experimental-Likes] 🛑 Captura de likes cancelada")
                break
            except Exception as e:
                print(f"[Bot-Experimental-Likes] ❌ Error capturando likes: {e}")
                # Continuar intentando
                await asyncio.sleep(30)
    
    @client.on(ConnectEvent)
    async def on_connect(_: ConnectEvent):
        nonlocal current_session_id, current_part_number, is_new_session, was_disconnected, likes_capture_task, last_likes_count
        
        print(f"[Bot-Experimental] ✅ ¡Conectado exitosamente al LIVE de {username}!")
        print(f"[Bot-Experimental] 🎥 Stream en vivo detectado. Iniciando captura de eventos...")
        
        # Si hubo desconexión previa, forzar nueva parte (continuación)
        force_new_part = was_disconnected
        was_disconnected = False  # Resetear flag
        
        # Obtener o crear sesión de stream
        # Si hubo desconexión, force_new=False pero la lógica detectará si es continuación
        session_id, part_num, is_new = db_manager_experimental.get_or_create_stream_session(
            username, 
            force_new=False
        )
        
        current_session_id = session_id
        current_part_number = part_num
        is_new_session = is_new
        last_likes_count = -1  # Resetear contador de likes
        
        if is_new:
            print(f"[Bot-Experimental] 🆕 Nueva sesión iniciada - Parte {part_num} (ID: {session_id})")
        else:
            print(f"[Bot-Experimental] 📺 Continuación del stream - Parte {part_num} (ID: {session_id})")
        
        # Iniciar tarea de captura de likes desde la página web
        if likes_capture_task is None or likes_capture_task.done():
            likes_capture_task = asyncio.create_task(capture_likes_periodically())
            print(f"[Bot-Experimental] 🎯 Tarea de captura de likes iniciada")
    
    @client.on(DisconnectEvent)
    async def on_disconnect(_: DisconnectEvent):
        nonlocal current_session_id, was_disconnected, likes_capture_task
        
        print(f"[Bot-Experimental] ⚠️ Desconectado del LIVE de {username}.")
        print(f"[Bot-Experimental] 🔄 El bot intentará reconectarse automáticamente...")
        
        # Cancelar tarea de captura de likes
        if likes_capture_task and not likes_capture_task.done():
            likes_capture_task.cancel()
            try:
                await likes_capture_task
            except asyncio.CancelledError:
                pass
            likes_capture_task = None
            print(f"[Bot-Experimental] 🛑 Tarea de captura de likes detenida")
        
        # Marcar que hubo desconexión para crear nueva parte al reconectar
        was_disconnected = True
        
        # NO finalizamos la sesión aquí porque puede ser un corte temporal
        # La sesión se finalizará solo si pasan más de 2 horas sin reconexión
        # o cuando se inicie una nueva sesión
    
    @client.on(CommentEvent)
    async def on_comment(event: CommentEvent):
        nonlocal current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        comment_text = event.comment
        
        print(f"[Bot-Experimental-Chat] {user_name}: {comment_text}")
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        simple_data = {
            "user": user_name,
            "comment": comment_text,
            "user_info": user_info
        }
        await asyncio.to_thread(
            db_manager_experimental.log_event, 
            "comment", user_name, simple_data, event,
            current_session_id, current_part_number
        )
    
    @client.on(GiftEvent)
    async def on_gift(event: GiftEvent):
        nonlocal current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        gift_name = "Regalo Desconocido"
        gift_count = 0
        diamonds = 0
        gift_image_url = None
        gift_id = None
        
        try:
            gift = event.gift
            gift_name = gift.name
            diamonds = gift.diamond_count
            is_streakable = gift.streakable
            
            # Extraer información adicional del regalo
            if hasattr(gift, 'id'):
                gift_id = gift.id
            if hasattr(gift, 'gift_id'):
                gift_id = gift.gift_id
            
            # Intentar obtener la imagen del regalo
            if hasattr(gift, 'image') and gift.image:
                if hasattr(gift.image, 'm_urls') and gift.image.m_urls:
                    gift_image_url = gift.image.m_urls[0]
                elif hasattr(gift.image, 'uri'):
                    gift_image_url = gift.image.uri
            elif hasattr(gift, 'image_url'):
                gift_image_url = gift.image_url
            elif hasattr(gift, 'gift_picture_url'):
                gift_image_url = gift.gift_picture_url
            
            # Debug: Ver qué atributos tiene el regalo
            print(f"[Bot-Experimental-Gift] 📦 Atributos del regalo: {[attr for attr in dir(gift) if not attr.startswith('_')]}")
            if gift_image_url:
                print(f"[Bot-Experimental-Gift] 🖼️ Imagen del regalo encontrada: {gift_image_url}")
            else:
                print(f"[Bot-Experimental-Gift] ⚠️ No se encontró imagen del regalo")
            
            if is_streakable:
                if event.repeat_end:
                    gift_count = event.repeat_count
                    print(f"  [Bot-Experimental-Gift] {user_name} envió racha de {gift_count}x {gift_name}!")
            else:
                gift_count = 1
                print(f"  [Bot-Experimental-Gift] {user_name} envió 1x {gift_name}!")
                
        except Exception as e:
            print(f"[Bot-Experimental-Gift] Error procesando regalo: {e}")
            import traceback
            traceback.print_exc()
            gift_count = 1
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        if gift_count > 0:
            simple_data = {
                "user": user_name,
                "gift_name": gift_name,
                "gift_id": gift_id,
                "gift_count": gift_count,
                "diamond_count": diamonds,
                "gift_image_url": gift_image_url,
                "total_diamonds": diamonds * gift_count,  # Diamantes totales (cantidad * valor unitario)
                "user_info": user_info
            }
            await asyncio.to_thread(
                db_manager_experimental.log_event, 
                "gift", user_name, simple_data, event,
                current_session_id, current_part_number
            )
    
    @client.on(LikeEvent)
    async def on_like(event: LikeEvent):
        nonlocal current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        print(f"[Bot-Experimental-Like] {user_name}")
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        simple_data = {
            "user": user_name,
            "user_info": user_info
        }
        await asyncio.to_thread(
            db_manager_experimental.log_event, 
            "like", user_name, simple_data, event,
            current_session_id, current_part_number
        )
    
    last_viewer_count = -1
    
    @client.on(JoinEvent)
    async def on_join(event: JoinEvent):
        nonlocal last_viewer_count, current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        print(f"[Bot-Experimental-Join] {user_name} se unió.")
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        simple_data_join = {
            "user": user_name,
            "user_info": user_info
        }
        await asyncio.to_thread(
            db_manager_experimental.log_event, 
            "join", user_name, simple_data_join, event,
            current_session_id, current_part_number
        )
        
        try:
            current_viewers = event.count
            
            if current_viewers >= 0 and current_viewers != last_viewer_count:
                last_viewer_count = current_viewers
                print(f"[Bot-Experimental-Stats] Espectadores: {current_viewers}")
                
                simple_data_viewers = {"viewer_count": current_viewers}
                await asyncio.to_thread(
                    db_manager_experimental.log_event, 
                    "room_info", "SYSTEM", simple_data_viewers, event,
                    current_session_id, current_part_number
                )
        except AttributeError:
            pass
        except Exception as e:
            print(f"[Bot-Experimental-Stats] Error: {e}")
    
    @client.on(FollowEvent)
    async def on_follow(event: FollowEvent):
        nonlocal current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        print(f"[Bot-Experimental-Follow] ¡Nuevo seguidor: {user_name}!")
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        simple_data = {
            "user": user_name,
            "user_info": user_info
        }
        await asyncio.to_thread(
            db_manager_experimental.log_event, 
            "follow", user_name, simple_data, event,
            current_session_id, current_part_number
        )
    
    @client.on(ShareEvent)
    async def on_share(event: ShareEvent):
        nonlocal current_session_id, current_part_number
        user_name = get_safe_nickname(event)
        
        # Obtener información del share
        share_type_desc = "Compartido"
        try:
            if hasattr(event, 'display_text') and event.display_text:
                share_type_desc = event.display_text
            elif hasattr(event, 'share_type'):
                share_type_desc = str(event.share_type)
        except Exception as e:
            print(f"[Bot-Experimental-Share] Error obteniendo tipo de share: {e}")
        
        print(f"[Bot-Experimental-Share] {user_name} compartió el stream ({share_type_desc})")
        
        # Extraer información completa del usuario
        user_info = extract_user_info(event)
        
        simple_data = {
            "user": user_name,
            "share_type": share_type_desc,
            "user_info": user_info
        }
        await asyncio.to_thread(
            db_manager_experimental.log_event, 
            "share", user_name, simple_data, event,
            current_session_id, current_part_number
        )
    
    return client

def start_bot_client(username):
    """
    Inicia el cliente del bot para un streamer con reconexión infinita.
    El bot intentará conectarse infinitamente hasta que el streamer esté en vivo.
    """
    reconnect_delay_short = 10  # Segundos entre intentos cuando hay error de conexión
    reconnect_delay_long = 15   # Segundos entre intentos cuando el streamer no está en vivo
    attempt = 0
    last_error_type = None
    
    print(f"[Bot-Experimental] 🚀 Iniciando bot para el LIVE de {username}...")
    print(f"[Bot-Experimental] ⏳ Esperando a que el streamer comience a transmitir...")
    print(f"[Bot-Experimental] 🔄 El bot intentará conectarse infinitamente hasta que esté en vivo.")
    
    while True:  # Bucle infinito
        try:
            attempt += 1
            if attempt > 1:
                # Determinar delay según el tipo de error
                if last_error_type == "not_live":
                    delay = reconnect_delay_long
                    print(f"[Bot-Experimental] 🔄 Intento {attempt}: Streamer no está en vivo. Reintentando en {delay}s...")
                else:
                    delay = reconnect_delay_short
                    print(f"[Bot-Experimental] 🔄 Intento {attempt}: Reintentando conexión en {delay}s...")
                time.sleep(delay)
            else:
                print(f"[Bot-Experimental] 🔌 Intentando conectar al LIVE de {username}...")
            
            # Configurar y ejecutar el cliente
            client = setup_client(username)
            last_error_type = None  # Resetear tipo de error
            
            # Intentar conectar
            client.run()
            
            # Si llegamos aquí, el cliente se detuvo (desconexión)
            print(f"[Bot-Experimental] ⚠️ Cliente desconectado. Reintentando en {reconnect_delay_short}s...")
            last_error_type = "disconnect"
            time.sleep(reconnect_delay_short)
            
        except KeyboardInterrupt:
            print("\n[Bot-Experimental] 🛑 Detenido por el usuario.")
            # Finalizar sesión actual si existe
            try:
                db_manager_experimental.end_stream_session()
            except:
                pass
            break
        except Exception as e:
            error_msg = str(e).lower()
            
            # Detectar si el streamer no está en vivo
            if any(keyword in error_msg for keyword in ['not live', 'not streaming', 'no live', 'offline', 'unavailable']):
                last_error_type = "not_live"
                delay = reconnect_delay_long
                print(f"[Bot-Experimental] ⏸️ Streamer no está en vivo actualmente.")
                print(f"[Bot-Experimental] ⏳ Esperando {delay}s antes de verificar nuevamente...")
            else:
                last_error_type = "error"
                delay = reconnect_delay_short
                print(f"[Bot-Experimental] ❌ Error en client.run(): {e}")
                print(f"[Bot-Experimental] 🔄 Reintentando en {delay}s...")
            
            time.sleep(delay)

def check_streamer_changes():
    """Verifica si el streamer activo ha cambiado."""
    global current_streamer_username
    
    while True:
        try:
            new_streamer = get_active_streamer()
            
            if new_streamer and new_streamer != current_streamer_username:
                print(f"[Bot-Experimental] Streamer cambiado: {current_streamer_username} -> {new_streamer}")
                current_streamer_username = new_streamer
                # Reiniciar el bot con el nuevo streamer
                start_bot_client(new_streamer)
            elif not new_streamer and current_streamer_username:
                print(f"[Bot-Experimental] No hay streamer activo. Esperando...")
                current_streamer_username = None
                if client:
                    try:
                        client.stop()
                    except:
                        pass
            
            time.sleep(5)  # Verificar cada 5 segundos
            
        except Exception as e:
            print(f"[Bot-Experimental] Error verificando streamer: {e}")
            time.sleep(10)

# --- Ejecución Principal ---

if __name__ == "__main__":
    print("=" * 60)
    print("Bot Experimental de TikTok Live")
    print("=" * 60)
    print("Iniciando el Gestor de Base de Datos Experimental...")
    db_manager_experimental.create_database()
    
    print("\n[Bot-Experimental] Este bot:")
    print("  - Lee el streamer activo desde el dashboard")
    print("  - Guarda eventos en BDs separadas por día (experimental_events_YYYY-MM-DD.db)")
    print("  - Detecta cortes del stream y los maneja como 'partes' del mismo directo")
    print("  - Ventana de continuación: 2 horas (si se reconecta antes, es la misma sesión)")
    print("  - NO sube datos a Google Sheets")
    print("  - Se reinicia automáticamente si cambia el streamer")
    print("  - 🔄 RECONEXIÓN INFINITA: Intenta conectarse hasta que el streamer esté en vivo")
    print("  - ⏳ Espera automáticamente si el streamer no está transmitiendo")
    print("\nEsperando streamer activo...")
    
    # Hilo para verificar cambios de streamer
    checker_thread = threading.Thread(target=check_streamer_changes, daemon=True)
    checker_thread.start()
    
    # Bucle principal
    while True:
        streamer = get_active_streamer()
        if streamer:
            start_bot_client(streamer)
        else:
            print("[Bot-Experimental] No hay streamer activo configurado. Esperando...")
            time.sleep(10)

"""
Bot experimental para capturar eventos de compartir (shares) de TikTok.
Lee el streamer activo desde la configuración del dashboard.
Solo guarda localmente, NO sube a Sheets.
"""
import asyncio
import sqlite3
import json
import time
from TikTokLive import TikTokLiveClient
from TikTokLive.events import ConnectEvent, DisconnectEvent, ShareEvent
import os
import sys
from pathlib import Path
from datetime import datetime

# Agregar el path del dashboard para importar Django
dashboard_path = Path(__file__).resolve().parent.parent / 'dashboard'
if dashboard_path.exists():
    sys.path.insert(0, str(dashboard_path))
    
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
        django.setup()
        
        from core.models import StreamerConfig
        DJANGO_AVAILABLE = True
    except Exception as e:
        print(f"[ShareBot-Experimental] Django no disponible: {e}")
        DJANGO_AVAILABLE = False
else:
    DJANGO_AVAILABLE = False

# --- CONFIGURATION ---
DB_DIR = Path(__file__).resolve().parent / 'bd'
# Crear la carpeta si no existe
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_TIMEOUT = 10.0
# ---------------------

def get_db_path_for_date(date_str=None):
    """
    Obtiene la ruta de la BD de shares para una fecha específica.
    Si no se especifica fecha, usa la fecha actual.
    Formato: experimental_shares_YYYY-MM-DD.db
    """
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    db_name = f"experimental_shares_{date_str}.db"
    return DB_DIR / db_name

def get_active_streamer_username():
    """Obtiene el username del streamer activo desde Django."""
    if not DJANGO_AVAILABLE:
        return None
    
    try:
        streamer = StreamerConfig.get_active_streamer()
        if streamer:
            return streamer.username
    except Exception as e:
        print(f"[ShareBot-Experimental] Error obteniendo streamer activo: {e}")
    
    return None

# --- Database Setup ---
def create_share_database(db_path=None):
    """Creates the SQLite table for share events if it doesn't exist."""
    if db_path is None:
        db_path = get_db_path_for_date()
    
    conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
    cursor = conn.cursor()
    
    # Activar modo WAL para mejor concurrencia
    try:
        cursor.execute("PRAGMA journal_mode = WAL;")
    except Exception as e:
        print(f"[ShareBot-Experimental] No se pudo activar el modo WAL: {e}")
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS share_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_nickname TEXT,
        streamer_username TEXT,
        share_type_desc TEXT,
        raw_data_json_str TEXT
    )
    """)
    conn.commit()
    conn.close()
    print(f"[ShareBot-Experimental] Base de datos creada: {db_path}")

def log_share_event(user_nickname: str, share_type_desc: str, raw_data_obj):
    """Saves a share event to the local SQLite database (BD del día actual)."""
    try:
        # Obtener BD del día actual
        db_path = get_db_path_for_date()
        create_share_database(db_path)
        
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        streamer_username = get_active_streamer_username()
        raw_json_str = json.dumps(raw_data_obj, default=str)
        
        cursor.execute(
            """
            INSERT INTO share_events
            (user_nickname, streamer_username, share_type_desc, raw_data_json_str)
            VALUES (?, ?, ?, ?)
            """,
            (user_nickname, streamer_username, share_type_desc, raw_json_str)
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Error DB-Shares-Experimental] Error saving share event: {e}")

# Variable global para el cliente
client = None
current_streamer_username = None

def setup_client(username):
    """Configura el cliente para un streamer específico."""
    global client, current_streamer_username
    
    if client:
        try:
            client.stop()
        except:
            pass
    
    current_streamer_username = username
    client = TikTokLiveClient(unique_id=username)
    
    @client.on(ConnectEvent)
    async def on_connect_shares(_: ConnectEvent):
        print(f"[ShareBot-Experimental] Connected successfully to @{username}'s LIVE!")
        print("[ShareBot-Experimental] Listening ONLY for share events...")
    
    @client.on(DisconnectEvent)
    async def on_disconnect_shares(_: DisconnectEvent):
        print(f"[ShareBot-Experimental] Disconnected from @{username}'s LIVE.")
    
    @client.on(ShareEvent)
    async def on_share(event: ShareEvent):
        """Handles share events."""
        user_name = "Usuario(Excepción)"
        share_desc = "Tipo Desconocido"
        
        try:
            user_name = event.user.nickname
        except Exception:
            pass
        
        try:
            share_desc = event.display_text if event.display_text else "Compartido"
        except Exception:
            pass
        
        print(f"[ShareBot-Experimental] Share detected from: {user_name} ({share_desc})")
        await asyncio.to_thread(log_share_event, user_name, share_desc, event)
    
    return client

def check_streamer_changes():
    """Verifica si el streamer activo ha cambiado."""
    global current_streamer_username, client
    
    while True:
        try:
            new_streamer = get_active_streamer_username()
            
            if new_streamer and new_streamer != current_streamer_username:
                print(f"[ShareBot-Experimental] Streamer cambiado: {current_streamer_username} -> {new_streamer}")
                current_streamer_username = new_streamer
                setup_client(new_streamer)
                try:
                    client.run()
                except Exception as e:
                    print(f"[ShareBot-Experimental] Error: {e}")
            elif not new_streamer and current_streamer_username:
                print(f"[ShareBot-Experimental] No hay streamer activo. Esperando...")
                current_streamer_username = None
                if client:
                    try:
                        client.stop()
                    except:
                        pass
            
            time.sleep(5)
            
        except Exception as e:
            print(f"[ShareBot-Experimental] Error verificando streamer: {e}")
            time.sleep(10)

# --- Main Execution ---
if __name__ == "__main__":
    print("=" * 60)
    print("Share Bot Experimental de TikTok Live")
    print("=" * 60)
    print("Initializing share database...")
    create_share_database()
    
    print("\n[ShareBot-Experimental] Este bot:")
    print("  - Lee el streamer activo desde el dashboard")
    print("  - Guarda shares en BDs separadas por día (experimental_shares_YYYY-MM-DD.db)")
    print("  - NO sube datos a Google Sheets")
    print("  - 🔄 RECONEXIÓN INFINITA: Intenta conectarse hasta que el streamer esté en vivo")
    print("  - ⏳ Espera automáticamente si el streamer no está transmitiendo")
    print("\nEsperando streamer activo...")
    
    # Hilo para verificar cambios
    import threading
    checker_thread = threading.Thread(target=check_streamer_changes, daemon=True)
    checker_thread.start()
    
    # Bucle principal con reconexión infinita
    try:
        while True:
            streamer = get_active_streamer_username()
            if streamer:
                print(f"[ShareBot-Experimental] 🚀 Iniciando bot para shares de {streamer}...")
                print(f"[ShareBot-Experimental] 🔄 Reconexión infinita activada.")
                
                reconnect_delay_short = 10
                reconnect_delay_long = 15
                attempt = 0
                
                while True:  # Bucle infinito de reconexión
                    try:
                        attempt += 1
                        if attempt > 1:
                            print(f"[ShareBot-Experimental] 🔄 Intento {attempt}: Reintentando en {reconnect_delay_short}s...")
                            time.sleep(reconnect_delay_short)
                        else:
                            print(f"[ShareBot-Experimental] 🔌 Intentando conectar al LIVE de {streamer}...")
                        
                        client = setup_client(streamer)
                        client.run()
                        
                        # Si llegamos aquí, el cliente se detuvo
                        print(f"[ShareBot-Experimental] ⚠️ Cliente desconectado. Reintentando en {reconnect_delay_short}s...")
                        time.sleep(reconnect_delay_short)
                        
                    except KeyboardInterrupt:
                        raise  # Re-lanzar para que el try externo lo capture
                    except Exception as e:
                        error_msg = str(e).lower()
                        if any(keyword in error_msg for keyword in ['not live', 'not streaming', 'no live', 'offline']):
                            delay = reconnect_delay_long
                            print(f"[ShareBot-Experimental] ⏸️ Streamer no está en vivo. Esperando {delay}s...")
                        else:
                            delay = reconnect_delay_short
                            print(f"[ShareBot-Experimental] ❌ Error: {e}. Reintentando en {delay}s...")
                        time.sleep(delay)
            else:
                print("[ShareBot-Experimental] No hay streamer activo configurado. Esperando...")
                time.sleep(10)
    except KeyboardInterrupt:
        print("\n[ShareBot-Experimental] 🛑 Detenido por el usuario.")

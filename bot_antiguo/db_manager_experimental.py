"""
Gestor de base de datos para los bots experimentales.
Guarda eventos en BDs separadas por día, sin subir a Sheets.
Maneja sesiones de stream con partes (para detectar cortes del directo).
"""
import sqlite3
import json
import time
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

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
        print(f"[DB-Experimental] Django no disponible: {e}")
        DJANGO_AVAILABLE = False
else:
    DJANGO_AVAILABLE = False

# Ruta a las bases de datos experimentales
DB_DIR = Path(__file__).resolve().parent / 'bd'
# Crear la carpeta si no existe
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_TIMEOUT = 10.0
MAX_RETRIES = 5  # Número máximo de reintentos para operaciones de BD
RETRY_DELAY_BASE = 0.1  # Delay base en segundos para reintentos (exponencial)

# Configuración de sesiones de stream
STREAM_CONTINUATION_WINDOW_HOURS = 2  # Ventana de tiempo para considerar continuación (2 horas)

# Variable global para la sesión actual
_current_stream_session = None

def retry_db_operation(func):
    """
    Decorador para reintentar operaciones de base de datos que fallan por 'database is locked'.
    Usa backoff exponencial.
    También puede usarse como función para envolver llamadas.
    """
    def wrapper(*args, **kwargs):
        last_exception = None
        for attempt in range(MAX_RETRIES):
            try:
                return func(*args, **kwargs)
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e).lower():
                    last_exception = e
                    if attempt < MAX_RETRIES - 1:
                        delay = RETRY_DELAY_BASE * (2 ** attempt)  # Backoff exponencial
                        time.sleep(delay)
                        continue
                    else:
                        # Último intento falló
                        print(f"[DB-Experimental] Error después de {MAX_RETRIES} intentos: {e}")
                        raise
                else:
                    # Otro tipo de error operacional, no reintentar
                    raise
            except Exception as e:
                # Otros errores no se reintentan
                raise
        if last_exception:
            raise last_exception
    return wrapper

def call_with_retry(func, *args, **kwargs):
    """
    Llama a una función con retry para errores de 'database is locked'.
    """
    return retry_db_operation(func)(*args, **kwargs)

def ensure_wal_mode(db_path):
    """
    Asegura que la base de datos esté en modo WAL para mejor concurrencia.
    """
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode = WAL;")
        result = cursor.fetchone()
        conn.close()
        if result and result[0].upper() != 'WAL':
            print(f"[DB-Experimental] Advertencia: BD {db_path} no está en modo WAL (modo actual: {result[0]})")
    except Exception as e:
        print(f"[DB-Experimental] Error verificando modo WAL en {db_path}: {e}")

def get_db_path_for_date(date_str=None):
    """
    Obtiene la ruta de la BD para una fecha específica.
    Si no se especifica fecha, usa la fecha actual.
    Formato: experimental_events_YYYY-MM-DD.db
    """
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    db_name = f"experimental_events_{date_str}.db"
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
        print(f"[DB-Experimental] Error obteniendo streamer activo: {e}")
    
    return None

@retry_db_operation
def create_database(db_path=None):
    """
    Crea las tablas si no existen en la BD especificada.
    Si no se especifica db_path, usa la BD del día actual.
    """
    if db_path is None:
        db_path = get_db_path_for_date()
    
    conn = None
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        # Activar modo WAL para mejor concurrencia
        try:
            cursor.execute("PRAGMA journal_mode = WAL;")
            cursor.execute("PRAGMA synchronous = NORMAL;")  # Mejor rendimiento con WAL
            cursor.execute("PRAGMA busy_timeout = 10000;")  # 10 segundos de timeout
        except Exception as e:
            print(f"[DB-Experimental] No se pudo configurar modo WAL: {e}")
        
        # Tabla de eventos
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS raw_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            event_type TEXT NOT NULL,
            user_nickname TEXT,
            streamer_username TEXT,
            
            -- Información de sesión de stream --
            stream_session_id INTEGER,
            stream_part_number INTEGER,
            
            -- Datos del evento --
            simple_data_json TEXT,
            raw_data_json_str TEXT,
            
            FOREIGN KEY (stream_session_id) REFERENCES stream_sessions(id)
        )
        """)
        
        # Tabla de sesiones de stream
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS stream_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            streamer_username TEXT NOT NULL,
            session_date DATE NOT NULL,
            part_number INTEGER NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            is_active INTEGER DEFAULT 1,
            total_events INTEGER DEFAULT 0,
            notes TEXT,
            
            UNIQUE(streamer_username, session_date, part_number)
        )
        """)
        
        # Índices para mejorar rendimiento
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_stream_sessions_streamer_date 
        ON stream_sessions(streamer_username, session_date, part_number)
        """)
        
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_stream_sessions_active 
        ON stream_sessions(is_active, streamer_username, session_date)
        """)
        
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_events_session 
        ON raw_events(stream_session_id)
        """)
        
        # Índice compuesto para consultas por timestamp (más eficiente)
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp_desc 
        ON raw_events(timestamp DESC, id DESC)
        """)
        
        # Índice compuesto para consultas por tipo de evento y timestamp
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_events_type_timestamp 
        ON raw_events(event_type, timestamp DESC, id DESC)
        """)
        
        # Índice para streamer_username (si se filtra por streamer)
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_events_streamer 
        ON raw_events(streamer_username, timestamp DESC)
        """)
        
        # Índice específico para room_info (usado para viewer_count)
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_raw_events_room_info 
        ON raw_events(event_type, timestamp DESC) 
        WHERE event_type = 'room_info'
        """)
        
        conn.commit()
        print(f"[DB-Experimental] Base de datos creada/inicializada: {db_path}")
    finally:
        if conn:
            conn.close()

@retry_db_operation
def find_active_session_in_recent_dbs(streamer_username, max_days_back=2):
    """
    Busca una sesión activa reciente en las BDs de los últimos días.
    Retorna: (session_id, part_number, session_date, start_time) o None
    """
    now = datetime.now()
    cutoff_time = now - timedelta(hours=STREAM_CONTINUATION_WINDOW_HOURS)
    
    # Buscar en el día actual y días anteriores (hasta max_days_back días atrás)
    for days_back in range(max_days_back + 1):
        check_date = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
        db_path = get_db_path_for_date(check_date)
        
        if not db_path.exists():
            continue
        
        conn = None
        try:
            conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, part_number, session_date, start_time
                FROM stream_sessions
                WHERE streamer_username = ? 
                  AND session_date = ?
                  AND is_active = 1
                  AND start_time >= ?
                ORDER BY part_number DESC
                LIMIT 1
            """, (streamer_username, check_date, cutoff_time.isoformat()))
            
            row = cursor.fetchone()
            
            if row:
                session_id, part_num, session_date, start_time_str = row
                start_time = datetime.fromisoformat(start_time_str)
                # Verificar que está dentro de la ventana de continuación
                if now - start_time < timedelta(hours=STREAM_CONTINUATION_WINDOW_HOURS):
                    return session_id, part_num, session_date, start_time
        except sqlite3.OperationalError as e:
            if "database is locked" in str(e).lower():
                # Re-lanzar para que el decorador lo maneje
                raise
            print(f"[DB-Experimental] Error buscando en BD {check_date}: {e}")
            continue
        except Exception as e:
            print(f"[DB-Experimental] Error buscando en BD {check_date}: {e}")
            continue
        finally:
            if conn:
                conn.close()
    
    return None

@retry_db_operation
def _create_new_stream_part(db_path, streamer_username, session_date, old_session_id, new_part_num):
    """Helper para crear una nueva parte de sesión (con retry)."""
    conn = None
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        # Cerrar la sesión anterior (parte N)
        if old_session_id:
            cursor.execute("""
                UPDATE stream_sessions 
                SET end_time = ?, is_active = 0
                WHERE id = ?
            """, (datetime.now().isoformat(), old_session_id))
        
        # Crear nueva parte (parte N+1) en la MISMA BD
        cursor.execute("""
            INSERT INTO stream_sessions 
            (streamer_username, session_date, part_number, start_time, is_active)
            VALUES (?, ?, ?, ?, 1)
        """, (streamer_username, session_date, new_part_num, datetime.now().isoformat()))
        
        new_session_id = cursor.lastrowid
        conn.commit()
        return new_session_id
    finally:
        if conn:
            conn.close()

@retry_db_operation
def _get_or_create_session_part1(db_path, streamer_username, session_date):
    """
    Obtiene o crea una sesión parte 1.
    Si ya existe una sesión parte 1:
    - Si está activa, la reutiliza
    - Si está inactiva, crea una nueva parte (parte 2, 3, etc.)
    
    Retorna: (session_id, part_number)
    """
    conn = None
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        # Verificar si ya existe una sesión parte 1 activa
        cursor.execute("""
            SELECT id, is_active, part_number
            FROM stream_sessions
            WHERE streamer_username = ? 
              AND session_date = ?
              AND part_number = 1
              AND is_active = 1
            ORDER BY id DESC
            LIMIT 1
        """, (streamer_username, session_date))
        
        existing_active = cursor.fetchone()
        
        if existing_active:
            # Sesión activa existe, reutilizarla
            existing_id, _, part_num = existing_active
            return existing_id, part_num
        
        # Verificar si existe una sesión parte 1 inactiva
        cursor.execute("""
            SELECT id, is_active, part_number
            FROM stream_sessions
            WHERE streamer_username = ? 
              AND session_date = ?
              AND part_number = 1
            ORDER BY id DESC
            LIMIT 1
        """, (streamer_username, session_date))
        
        existing = cursor.fetchone()
        
        if existing:
            # Sesión inactiva existe, crear nueva parte
            # Encontrar el número de parte más alto para este streamer y fecha
            cursor.execute("""
                SELECT MAX(part_number) FROM stream_sessions
                WHERE streamer_username = ? AND session_date = ?
            """, (streamer_username, session_date))
            max_part = cursor.fetchone()[0] or 0
            new_part = max_part + 1
            
            cursor.execute("""
                INSERT INTO stream_sessions 
                (streamer_username, session_date, part_number, start_time, is_active)
                VALUES (?, ?, ?, ?, 1)
            """, (streamer_username, session_date, new_part, datetime.now().isoformat()))
            
            new_session_id = cursor.lastrowid
            conn.commit()
            return new_session_id, new_part
        
        # No existe sesión parte 1, crear una nueva
        cursor.execute("""
            INSERT INTO stream_sessions 
            (streamer_username, session_date, part_number, start_time, is_active)
            VALUES (?, ?, 1, ?, 1)
        """, (streamer_username, session_date, datetime.now().isoformat()))
        
        new_session_id = cursor.lastrowid
        conn.commit()
        return new_session_id, 1
    finally:
        if conn:
            conn.close()

def get_or_create_stream_session(streamer_username, force_new=False):
    """
    Obtiene o crea una sesión de stream.
    
    Lógica:
    - Busca sesiones activas en las BDs de los últimos días (hasta 2 días atrás)
    - Si hay una sesión activa reciente (últimas 2 horas), es continuación (parte N+1)
      y se guarda en la MISMA BD donde comenzó el directo
    - Si no hay sesión activa o pasaron más de 2 horas, es nueva sesión (parte 1)
      y se guarda en la BD del día actual
    - Si force_new=True, siempre crea una nueva sesión en la BD del día actual
    
    Retorna: (session_id, part_number, is_new_session)
    """
    global _current_stream_session
    
    if not streamer_username:
        return None, 1, True
    
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    
    try:
        # Si hay una sesión actual en memoria y no se fuerza nueva, verificar que sigue activa
        if _current_stream_session and not force_new:
            session_id, part_num = _current_stream_session
            # Buscar en qué BD está la sesión
            found_session = find_active_session_in_recent_dbs(streamer_username)
            if found_session and found_session[0] == session_id:
                session_date = found_session[2]
                return session_id, part_num, False
        
        # Si se fuerza nueva o no hay sesión en memoria, buscar sesiones activas
        if not force_new:
            found_session = find_active_session_in_recent_dbs(streamer_username)
            
            if found_session:
                # Hay una sesión activa reciente - continuar en la MISMA BD donde comenzó
                session_id, part_num, session_date, start_time = found_session
                db_path = get_db_path_for_date(session_date)
                create_database(db_path)
                ensure_wal_mode(db_path)
                
                # Usar retry para crear nueva parte (ya decorado)
                new_part = part_num + 1
                new_session_id = _create_new_stream_part(
                    db_path, streamer_username, session_date, session_id, new_part
                )
                
                _current_stream_session = (new_session_id, new_part)
                print(f"[DB-Experimental] 📺 Continuación del stream - Parte {new_part} (sesión anterior: parte {part_num}) en BD del {session_date}")
                return new_session_id, new_part, False
        
        # Nueva sesión (parte 1) - siempre en la BD del día actual
        db_path = get_db_path_for_date(today)
        create_database(db_path)
        ensure_wal_mode(db_path)
        
        # Obtener o crear sesión (maneja automáticamente si ya existe)
        new_session_id, part_num = _get_or_create_session_part1(
            db_path, streamer_username, today
        )
        
        _current_stream_session = (new_session_id, part_num)
        
        # Verificar si es nueva o reutilizada
        conn_check = None
        is_new = True
        try:
            conn_check = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
            cursor_check = conn_check.cursor()
            cursor_check.execute("""
                SELECT COUNT(*) FROM stream_sessions
                WHERE streamer_username = ? 
                  AND session_date = ?
                  AND id < ?
            """, (streamer_username, today, new_session_id))
            count_before = cursor_check.fetchone()[0]
            is_new = (count_before == 0 or part_num == 1)
        except:
            pass
        finally:
            if conn_check:
                conn_check.close()
        
        if is_new:
            print(f"[DB-Experimental] 🆕 Nueva sesión de stream iniciada - Parte {part_num} (ID: {new_session_id}) en BD del {today}")
        else:
            print(f"[DB-Experimental] ♻️ Reutilizando sesión activa existente - Parte {part_num} (ID: {new_session_id}) en BD del {today}")
        
        return new_session_id, part_num, is_new
        
    except Exception as e:
        print(f"[DB-Experimental] Error obteniendo/creando sesión: {e}")
        import traceback
        traceback.print_exc()
        return None, 1, True

@retry_db_operation
def _end_stream_session_internal(db_path, session_id):
    """Helper para finalizar una sesión (con retry)."""
    conn = None
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        # Contar eventos de la sesión
        cursor.execute("""
            SELECT COUNT(*) FROM raw_events WHERE stream_session_id = ?
        """, (session_id,))
        event_count = cursor.fetchone()[0]
        
        # Actualizar sesión
        cursor.execute("""
            UPDATE stream_sessions 
            SET end_time = ?, is_active = 0, total_events = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), event_count, session_id))
        
        conn.commit()
        return event_count
    finally:
        if conn:
            conn.close()

def end_stream_session(session_id=None):
    """
    Marca una sesión de stream como finalizada.
    Busca la sesión en las BDs recientes para encontrarla.
    """
    global _current_stream_session
    
    if session_id is None and _current_stream_session:
        session_id, _ = _current_stream_session
    
    if not session_id:
        return
    
    # Buscar la sesión en las BDs recientes
    now = datetime.now()
    session_date = None
    for days_back in range(3):
        check_date = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
        db_path = get_db_path_for_date(check_date)
        if db_path.exists():
            conn = None
            try:
                conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT session_date FROM stream_sessions WHERE id = ?
                """, (session_id,))
                row = cursor.fetchone()
                if row:
                    session_date = row[0]
                    break
            except:
                continue
            finally:
                if conn:
                    conn.close()
    
    if not session_date:
        return
    
    db_path = get_db_path_for_date(session_date)
    if not db_path.exists():
        return
    
    try:
        event_count = _end_stream_session_internal(db_path, session_id)
        print(f"[DB-Experimental] 🛑 Sesión de stream finalizada (ID: {session_id}, Eventos: {event_count}) en BD del {session_date}")
        
        # Limpiar sesión actual
        if _current_stream_session and _current_stream_session[0] == session_id:
            _current_stream_session = None
    except Exception as e:
        print(f"[DB-Experimental] Error finalizando sesión: {e}")

@retry_db_operation
def _insert_event_to_db(db_path, event_type, user_nickname, streamer_username, session_id, part_num, simple_json, raw_json_str):
    """Helper para insertar un evento en la BD (con retry)."""
    conn = None
    try:
        conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
        cursor = conn.cursor()
        
        cursor.execute(
            """
            INSERT INTO raw_events 
            (event_type, user_nickname, streamer_username, stream_session_id, stream_part_number, simple_data_json, raw_data_json_str) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (event_type, user_nickname, streamer_username, session_id, part_num, simple_json, raw_json_str)
        )
        
        event_id = cursor.lastrowid
        
        # Actualizar contador de eventos de la sesión
        if session_id:
            cursor.execute("""
                UPDATE stream_sessions 
                SET total_events = total_events + 1
                WHERE id = ?
            """, (session_id,))
        
        conn.commit()
        return event_id
    finally:
        if conn:
            conn.close()

def log_event(event_type: str, user_nickname: str, simple_data: dict, raw_data_obj, stream_session_id=None, stream_part_number=None):
    """
    Guarda un evento en la base de datos correspondiente a la sesión.
    Si la sesión está en otra BD (día anterior), guarda allí.
    NO sube a Sheets (solo local).
    """
    try:
        # Obtener el streamer activo
        streamer_username = get_active_streamer_username()
        
        # Obtener o crear sesión de stream
        if stream_session_id is None:
            session_id, part_num, is_new = get_or_create_stream_session(streamer_username)
        else:
            session_id = stream_session_id
            part_num = stream_part_number or 1
        
        # Determinar en qué BD está la sesión
        # Buscar la sesión en las BDs recientes para obtener su fecha
        session_date = None
        if session_id:
            found_session = find_active_session_in_recent_dbs(streamer_username)
            if found_session and found_session[0] == session_id:
                session_date = found_session[2]
            else:
                # Si no se encuentra activa, buscar en todas las BDs recientes
                now = datetime.now()
                for days_back in range(3):
                    check_date = (now - timedelta(days=days_back)).strftime("%Y-%m-%d")
                    db_path_check = get_db_path_for_date(check_date)
                    if db_path_check.exists():
                        conn_check = None
                        try:
                            conn_check = sqlite3.connect(str(db_path_check), timeout=DB_TIMEOUT)
                            cursor_check = conn_check.cursor()
                            cursor_check.execute("""
                                SELECT session_date FROM stream_sessions WHERE id = ?
                            """, (session_id,))
                            row = cursor_check.fetchone()
                            if row:
                                session_date = row[0]
                                break
                        except:
                            continue
                        finally:
                            if conn_check:
                                conn_check.close()
        
        # Si no se encontró la fecha de la sesión, usar el día actual
        if not session_date:
            session_date = datetime.now().strftime("%Y-%m-%d")
        
        db_path = get_db_path_for_date(session_date)
        create_database(db_path)
        ensure_wal_mode(db_path)
        
        # Prepara los JSONs
        simple_json = json.dumps(simple_data, default=str)
        raw_json_str = json.dumps(raw_data_obj, default=str)
        
        # Agregar información de sesión a simple_data
        if 'stream_session_id' not in simple_data:
            simple_data['stream_session_id'] = session_id
        if 'stream_part_number' not in simple_data:
            simple_data['stream_part_number'] = part_num
        simple_json = json.dumps(simple_data, default=str)
        
        # Usar retry para insertar el evento (ya decorado)
        event_id = _insert_event_to_db(
            db_path, event_type, user_nickname, streamer_username, session_id, part_num, simple_json, raw_json_str
        )
        
        # Intentar publicar al dashboard (opcional)
        try:
            # Importar desde dashboard/core
            dashboard_path = Path(__file__).resolve().parent.parent / 'dashboard'
            if dashboard_path.exists() and str(dashboard_path) not in sys.path:
                sys.path.insert(0, str(dashboard_path))
            
            # Configurar Django si no está configurado
            if not os.environ.get('DJANGO_SETTINGS_MODULE'):
                os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dashboard.settings')
                import django
                django.setup()
            
            from core.event_publisher import publish_event
            publish_event(event_type, user_nickname, simple_data, event_id)
        except Exception as e:
            # Silenciar si no está disponible (dashboard no está corriendo, etc.)
            # Solo mostrar error en modo debug
            # print(f"[DB-Experimental] No se pudo publicar evento al dashboard: {e}")
            pass
        
        return event_id
        
    except Exception as e:
        print(f"[Error DB-Experimental] Error al guardar en SQLite: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_stream_sessions_summary(streamer_username=None, date_str=None):
    """
    Obtiene un resumen de las sesiones de stream.
    """
    if date_str is None:
        date_str = datetime.now().strftime("%Y-%m-%d")
    
    db_path = get_db_path_for_date(date_str)
    if not db_path.exists():
        return []
    
    conn = sqlite3.connect(str(db_path), timeout=DB_TIMEOUT)
    cursor = conn.cursor()
    
    try:
        if streamer_username:
            cursor.execute("""
                SELECT id, streamer_username, part_number, start_time, end_time, is_active, total_events
                FROM stream_sessions
                WHERE streamer_username = ? AND session_date = ?
                ORDER BY part_number
            """, (streamer_username, date_str))
        else:
            cursor.execute("""
                SELECT id, streamer_username, part_number, start_time, end_time, is_active, total_events
                FROM stream_sessions
                WHERE session_date = ?
                ORDER BY part_number
            """, (date_str,))
        
        rows = cursor.fetchall()
        sessions = []
        for row in rows:
            sessions.append({
                'id': row[0],
                'streamer_username': row[1],
                'part_number': row[2],
                'start_time': row[3],
                'end_time': row[4],
                'is_active': bool(row[5]),
                'total_events': row[6]
            })
        
        return sessions
    finally:
        conn.close()

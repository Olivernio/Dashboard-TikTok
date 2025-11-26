"""
Script para optimizar las bases de datos existentes agregando índices.
Ejecutar este script una vez para mejorar el rendimiento de las consultas.
"""
import sqlite3
import os
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent / 'bd'

def optimize_database(db_path):
    """Agrega índices a una base de datos existente."""
    try:
        conn = sqlite3.connect(str(db_path), timeout=10.0)
        cursor = conn.cursor()
        
        print(f"Optimizando {os.path.basename(db_path)}...")
        
        # Índices para mejorar rendimiento
        indexes = [
            # Índice compuesto para consultas por timestamp (más eficiente)
            """
            CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp_desc 
            ON raw_events(timestamp DESC, id DESC)
            """,
            
            # Índice compuesto para consultas por tipo de evento y timestamp
            """
            CREATE INDEX IF NOT EXISTS idx_raw_events_type_timestamp 
            ON raw_events(event_type, timestamp DESC, id DESC)
            """,
            
            # Índice para streamer_username (si se filtra por streamer)
            """
            CREATE INDEX IF NOT EXISTS idx_raw_events_streamer 
            ON raw_events(streamer_username, timestamp DESC)
            """,
            
            # Índice específico para room_info (usado para viewer_count)
            """
            CREATE INDEX IF NOT EXISTS idx_raw_events_room_info 
            ON raw_events(event_type, timestamp DESC) 
            WHERE event_type = 'room_info'
            """,
            
            # Índice para sesiones activas
            """
            CREATE INDEX IF NOT EXISTS idx_stream_sessions_active 
            ON stream_sessions(is_active, streamer_username, session_date)
            """
        ]
        
        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
            except Exception as e:
                print(f"  Advertencia: No se pudo crear índice: {e}")
        
        conn.commit()
        conn.close()
        print(f"  ✓ Optimizado")
        
    except Exception as e:
        print(f"  ✗ Error optimizando {os.path.basename(db_path)}: {e}")

def main():
    """Optimiza todas las bases de datos en el directorio."""
    if not DB_DIR.exists():
        print(f"Directorio de BD no existe: {DB_DIR}")
        return
    
    db_files = list(DB_DIR.glob('experimental_events_*.db'))
    
    if not db_files:
        print("No se encontraron bases de datos para optimizar.")
        return
    
    print(f"Encontradas {len(db_files)} bases de datos para optimizar...\n")
    
    for db_path in sorted(db_files):
        optimize_database(db_path)
    
    print(f"\n✓ Optimización completada para {len(db_files)} base(s) de datos.")

if __name__ == '__main__':
    main()


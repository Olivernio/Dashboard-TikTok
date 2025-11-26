"""
Sistema de cola de eventos con persistencia
Guarda eventos cuando la API está caída y los reenvía cuando está disponible
"""
import json
import os
import asyncio
import requests
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path

class EventQueue:
    def __init__(self, queue_file: str = "event_queue.json", api_url: str = "http://localhost:3000/api"):
        self.queue_file = Path(queue_file)
        self.api_url = api_url
        self.max_retries = 3
        self.retry_delay = 5  # Segundos entre reintentos
        self.processing = False
        
        # Asegurar que el archivo existe
        if not self.queue_file.exists():
            self._save_queue([])
    
    def _load_queue(self) -> List[Dict]:
        """Carga la cola desde el archivo"""
        try:
            if not self.queue_file.exists():
                return []
            with open(self.queue_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception as e:
            print(f"⚠️ Error cargando cola: {e}")
            return []
    
    def _save_queue(self, queue: List[Dict]):
        """Guarda la cola en el archivo"""
        try:
            with open(self.queue_file, 'w', encoding='utf-8') as f:
                json.dump(queue, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ Error guardando cola: {e}")
    
    def add_event(self, event_type: str, payload: Dict, priority: int = 0):
        """
        Agrega un evento a la cola
        
        Args:
            event_type: Tipo de evento ('event', 'viewer_count', 'viewer_history', 'stream_update')
            payload: Datos del evento
            priority: Prioridad (0 = normal, 1 = alta, 2 = crítica)
        """
        queue_item = {
            "id": f"{datetime.utcnow().isoformat()}_{event_type}_{len(self._load_queue())}",
            "event_type": event_type,
            "payload": payload,
            "priority": priority,
            "created_at": datetime.utcnow().isoformat(),
            "retry_count": 0,
            "status": "pending"
        }
        
        queue = self._load_queue()
        # Insertar según prioridad (mayor prioridad primero)
        inserted = False
        for i, item in enumerate(queue):
            if item.get("priority", 0) < priority:
                queue.insert(i, queue_item)
                inserted = True
                break
        
        if not inserted:
            queue.append(queue_item)
        
        self._save_queue(queue)
        print(f"📦 Evento agregado a la cola: {event_type} (Total en cola: {len(queue)})")
    
    async def process_queue(self):
        """Procesa la cola intentando enviar eventos pendientes"""
        if self.processing:
            return
        
        self.processing = True
        try:
            queue = self._load_queue()
            if not queue:
                return
            
            pending_events = [e for e in queue if e.get("status") == "pending"]
            if not pending_events:
                return
            
            print(f"🔄 Procesando cola: {len(pending_events)} eventos pendientes")
            
            processed = []
            for item in pending_events:
                if item.get("retry_count", 0) >= self.max_retries:
                    item["status"] = "failed"
                    item["error"] = "Max retries exceeded"
                    print(f"❌ Evento {item['id']} excedió máximo de reintentos")
                    continue
                
                success = await self._send_event(item)
                if success:
                    item["status"] = "sent"
                    item["sent_at"] = datetime.utcnow().isoformat()
                    processed.append(item["id"])
                    print(f"✅ Evento {item['id']} enviado correctamente")
                else:
                    item["retry_count"] = item.get("retry_count", 0) + 1
                    item["last_retry"] = datetime.utcnow().isoformat()
                    print(f"⚠️ Evento {item['id']} falló, reintento {item['retry_count']}/{self.max_retries}")
            
            # Actualizar cola removiendo eventos enviados
            queue = [e for e in queue if e["id"] not in processed]
            self._save_queue(queue)
            
            if processed:
                print(f"✅ {len(processed)} eventos procesados exitosamente")
        
        except Exception as e:
            print(f"❌ Error procesando cola: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.processing = False
    
    async def _send_event(self, item: Dict) -> bool:
        """Intenta enviar un evento a la API"""
        event_type = item["event_type"]
        payload = item["payload"]
        
        try:
            if event_type == "event":
                response = requests.post(
                    f"{self.api_url}/events",
                    json=payload,
                    timeout=5,
                )
            elif event_type == "viewer_count":
                response = requests.patch(
                    f"{self.api_url}/streams/{payload.get('stream_id')}",
                    json={"viewer_count": payload.get("viewer_count")},
                    timeout=5,
                )
            elif event_type == "viewer_history":
                response = requests.post(
                    f"{self.api_url}/viewer-history",
                    json=payload,
                    timeout=5,
                )
            elif event_type == "stream_update":
                # Para updates de stream (ended_at, title, etc)
                response = requests.patch(
                    f"{self.api_url}/streams/{payload.get('id')}",
                    json={k: v for k, v in payload.items() if k != 'id'},
                    timeout=5,
                )
            elif event_type == "streamer":
                response = requests.post(
                    f"{self.api_url}/streamers",
                    json=payload,
                    timeout=10,
                )
            elif event_type == "stream_create":
                response = requests.post(
                    f"{self.api_url}/streams",
                    json=payload,
                    timeout=10,
                )
            else:
                print(f"⚠️ Tipo de evento desconocido: {event_type}")
                return False
            
            return response.status_code in [200, 201]
        
        except requests.exceptions.ConnectionError:
            # API no disponible
            return False
        except requests.exceptions.Timeout:
            # Timeout
            return False
        except Exception as e:
            print(f"⚠️ Error enviando evento {item['id']}: {e}")
            return False
    
    def get_queue_size(self) -> int:
        """Retorna el número de eventos pendientes en la cola"""
        queue = self._load_queue()
        return len([e for e in queue if e.get("status") == "pending"])
    
    def clear_sent_events(self):
        """Limpia eventos que ya fueron enviados (mantiene solo pendientes y fallidos)"""
        queue = self._load_queue()
        queue = [e for e in queue if e.get("status") != "sent"]
        self._save_queue(queue)
    
    def get_stats(self) -> Dict:
        """Retorna estadísticas de la cola"""
        queue = self._load_queue()
        return {
            "total": len(queue),
            "pending": len([e for e in queue if e.get("status") == "pending"]),
            "sent": len([e for e in queue if e.get("status") == "sent"]),
            "failed": len([e for e in queue if e.get("status") == "failed"]),
        }


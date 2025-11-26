"""
Main entry point para el bot de TikTok
"""
import asyncio
from tiktok_client import TikTokStreamClient
import os
from dotenv import load_dotenv

load_dotenv()


async def main():
    """Función principal con reconexión automática"""
    username = os.getenv("STREAMER_USERNAME", "").strip()
    api_url = os.getenv("API_URL", "http://localhost:3000/api")
    
    if not username:
        print("❌ Debes configurar STREAMER_USERNAME en el archivo .env")
        print("O proporcionar el username como argumento")
        return

    print(f"🚀 Iniciando bot para @{username}")
    print(f"📡 API URL: {api_url}")
    print(f"🔄 El bot intentará reconectarse automáticamente si hay errores")
    
    reconnect_delay_short = 10  # Segundos entre intentos cuando hay error de conexión
    reconnect_delay_long = 15     # Segundos entre intentos cuando el streamer no está en vivo
    attempt = 0
    last_error_type = None
    
    while True:  # Bucle de reconexión infinita
        try:
            attempt += 1
            if attempt > 1:
                if last_error_type == "not_live":
                    delay = reconnect_delay_long
                    print(f"\n⏸️ Streamer no está en vivo. Reintentando en {delay}s... (Intento {attempt})")
                else:
                    delay = reconnect_delay_short
                    print(f"\n🔄 Reintentando conexión en {delay}s... (Intento {attempt})")
                await asyncio.sleep(delay)
            
            client = TikTokStreamClient(username, api_url)
            last_error_type = None  # Resetear tipo de error
            
            try:
                await client.start()
                # Mantener el bot corriendo indefinidamente
                await asyncio.Event().wait()
            except KeyboardInterrupt:
                print("\n🛑 Deteniendo bot...")
                try:
                    # Al detener manualmente, NO finalizar el stream
                    # El stream permanece activo para continuar cuando se reactive
                    await client.stop(end_stream=False)
                except:
                    pass
                break
            except Exception as e:
                error_msg = str(e).lower()
                # Detectar tipo de error
                if any(keyword in error_msg for keyword in ['not live', 'not streaming', 'no live', 'offline', 'unavailable', '504', 'sign_not_200']):
                    last_error_type = "not_live"
                    # Si el error es "not live", el stream realmente terminó
                    # Finalizar el stream actual (confirmado)
                    try:
                        if client.stream_id:
                            print(f"🛑 Streamer no está en vivo, finalizando stream {client.stream_id}")
                            await client._end_stream(confirmed=True)
                    except Exception as end_error:
                        print(f"⚠️ Error finalizando stream: {end_error}")
                else:
                    last_error_type = "error"
                    # Si el error es de conexión/red, NO finalizar el stream
                    # El stream permanece activo para que pueda continuar cuando se reconecte
                    print(f"💡 Error de conexión. Stream permanece activo para continuar cuando se reconecte.")
                
                # Si el cliente se desconectó, intentar detenerlo limpiamente
                try:
                    # NO llamar a stop() porque eso finalizaría el stream
                    # Solo desconectar el cliente sin finalizar el stream
                    if hasattr(client.client, 'disconnect'):
                        if asyncio.iscoroutinefunction(client.client.disconnect):
                            await client.client.disconnect()
                        else:
                            client.client.disconnect()
                except:
                    pass
                # Continuar el bucle para reconectar
                continue
                
        except KeyboardInterrupt:
            print("\n🛑 Deteniendo bot...")
            break
        except Exception as e:
            last_error_type = "error"
            print(f"❌ Error inesperado: {e}")
            await asyncio.sleep(reconnect_delay_short)


if __name__ == "__main__":
    asyncio.run(main())


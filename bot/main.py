"""
Main entry point para el bot de TikTok
"""
import asyncio
from tiktok_client import TikTokStreamClient
import os
from dotenv import load_dotenv

load_dotenv()


async def main():
    """Función principal"""
    username = os.getenv("STREAMER_USERNAME", "").strip()
    api_url = os.getenv("API_URL", "http://localhost:3000/api")
    
    if not username:
        print("❌ Debes configurar STREAMER_USERNAME en el archivo .env")
        print("O proporcionar el username como argumento")
        return

    print(f"🚀 Iniciando bot para @{username}")
    print(f"📡 API URL: {api_url}")
    
    client = TikTokStreamClient(username, api_url)
    
    try:
        await client.start()
        # Mantener el bot corriendo indefinidamente
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo bot...")
        await client.stop()
    except Exception as e:
        print(f"❌ Error: {e}")
        await client.stop()


if __name__ == "__main__":
    asyncio.run(main())


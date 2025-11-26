"""
Módulo para hacer scraping de la página de TikTok Live y extraer datos como el contador de likes.
"""
import requests
from bs4 import BeautifulSoup
import re
import time
from typing import Optional

# Headers para simular un navegador real
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}

def get_tiktok_live_url(username: str) -> str:
    """
    Construye la URL de la página de TikTok Live para un usuario.
    
    Args:
        username: Nombre de usuario de TikTok (con o sin @)
    
    Returns:
        URL completa de la página de TikTok Live
    """
    # Remover @ si está presente
    clean_username = username.lstrip('@')
    return f"https://www.tiktok.com/@{clean_username}/live"

def extract_likes_count_from_html(html_content: str) -> Optional[int]:
    """
    Extrae el contador de likes del HTML de la página de TikTok Live.
    
    Busca el elemento con las clases: 'text-UIText3 SmallText1-Regular-App ms-[2px] whitespace-nowrap leading-[20px]'
    que está después de un SVG de corazón.
    
    Args:
        html_content: Contenido HTML de la página
    
    Returns:
        Número de likes como entero, o None si no se encuentra
    """
    try:
        soup = BeautifulSoup(html_content, 'lxml')
        
        # Buscar todos los elementos <p> que tengan las clases text-UIText3 y SmallText1-Regular-App
        likes_elements = soup.find_all('p', class_=lambda x: x and 'text-UIText3' in ' '.join(x) if isinstance(x, list) else 'text-UIText3' in str(x))
        
        # Filtrar los que también tienen SmallText1-Regular-App
        likes_elements = [elem for elem in likes_elements 
                         if 'SmallText1-Regular-App' in ' '.join(elem.get('class', []))]
        
        # Buscar el que está después de un SVG de corazón
        for elem in likes_elements:
            # Buscar SVG de corazón en el contexto cercano (padre o hermanos anteriores)
            parent = elem.parent
            if parent:
                # Buscar SVG con path de corazón en el mismo contenedor
                svg_heart = parent.find('svg')
                if svg_heart:
                    path = svg_heart.find('path')
                    if path and path.get('d'):
                        path_d = path['d']
                        # El SVG de corazón tiene un path específico que contiene "M24 9"
                        if 'M24 9' in path_d or 'M24 9.44' in path_d:
                            text = elem.get_text(strip=True)
                            # Intentar convertir a número
                            try:
                                # Remover comas, espacios y puntos, convertir a int
                                cleaned = text.replace(',', '').replace(' ', '').replace('.', '').replace('K', '000').replace('M', '000000')
                                # Manejar formato con K o M (ej: "1.5K" -> 1500)
                                if 'K' in text.upper() or 'M' in text.upper():
                                    # Si tiene K o M, intentar parsear como float primero
                                    num_str = text.replace(',', '').replace(' ', '').upper()
                                    if 'K' in num_str:
                                        num = float(num_str.replace('K', '')) * 1000
                                        return int(num)
                                    elif 'M' in num_str:
                                        num = float(num_str.replace('M', '')) * 1000000
                                        return int(num)
                                return int(cleaned)
                            except ValueError:
                                continue
                
                # También buscar en hermanos anteriores
                prev_sibling = elem.find_previous('svg')
                if prev_sibling:
                    path = prev_sibling.find('path')
                    if path and path.get('d'):
                        path_d = path['d']
                        if 'M24 9' in path_d or 'M24 9.44' in path_d:
                            text = elem.get_text(strip=True)
                            try:
                                cleaned = text.replace(',', '').replace(' ', '').replace('.', '').replace('K', '000').replace('M', '000000')
                                if 'K' in text.upper() or 'M' in text.upper():
                                    num_str = text.replace(',', '').replace(' ', '').upper()
                                    if 'K' in num_str:
                                        num = float(num_str.replace('K', '')) * 1000
                                        return int(num)
                                    elif 'M' in num_str:
                                        num = float(num_str.replace('M', '')) * 1000000
                                        return int(num)
                                return int(cleaned)
                            except ValueError:
                                continue
        
        # Si no se encontró, intentar búsqueda más amplia: buscar cualquier número cerca de un SVG de corazón
        all_svgs = soup.find_all('svg')
        for svg in all_svgs:
            path = svg.find('path')
            if path and path.get('d') and ('M24 9' in path['d'] or 'M24 9.44' in path['d']):
                # Buscar el siguiente elemento <p> con número
                next_p = svg.find_next('p')
                if next_p:
                    text = next_p.get_text(strip=True)
                    try:
                        cleaned = text.replace(',', '').replace(' ', '').replace('.', '').replace('K', '000').replace('M', '000000')
                        if cleaned.isdigit() or (cleaned.replace('-', '').isdigit()):
                            if 'K' in text.upper() or 'M' in text.upper():
                                num_str = text.replace(',', '').replace(' ', '').upper()
                                if 'K' in num_str:
                                    num = float(num_str.replace('K', '')) * 1000
                                    return int(num)
                                elif 'M' in num_str:
                                    num = float(num_str.replace('M', '')) * 1000000
                                    return int(num)
                            return int(cleaned)
                    except (ValueError, AttributeError):
                        continue
        
        return None
        
    except Exception as e:
        print(f"[TikTok-Scraper] Error extrayendo likes del HTML: {e}")
        import traceback
        traceback.print_exc()
        return None

def fetch_likes_count(username: str, timeout: int = 10) -> Optional[int]:
    """
    Obtiene el contador de likes de la página de TikTok Live.
    
    Args:
        username: Nombre de usuario de TikTok (con o sin @)
        timeout: Timeout en segundos para la petición HTTP
    
    Returns:
        Número de likes como entero, o None si hay error
    """
    try:
        url = get_tiktok_live_url(username)
        print(f"[TikTok-Scraper] Obteniendo página: {url}")
        
        response = requests.get(url, headers=HEADERS, timeout=timeout)
        response.raise_for_status()
        
        likes_count = extract_likes_count_from_html(response.text)
        
        if likes_count is not None:
            print(f"[TikTok-Scraper] ✅ Likes encontrados: {likes_count}")
        else:
            print(f"[TikTok-Scraper] ⚠️ No se pudo extraer el contador de likes")
        
        return likes_count
        
    except requests.exceptions.Timeout:
        print(f"[TikTok-Scraper] ❌ Timeout al obtener la página de TikTok")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[TikTok-Scraper] ❌ Error HTTP: {e}")
        return None
    except Exception as e:
        print(f"[TikTok-Scraper] ❌ Error inesperado: {e}")
        import traceback
        traceback.print_exc()
        return None

def test_scraper(username: str = "loonerdalv"):
    """
    Función de prueba para el scraper.
    """
    print(f"\n{'='*60}")
    print(f"Probando scraper de TikTok Live para: @{username}")
    print(f"{'='*60}\n")
    
    likes = fetch_likes_count(username)
    
    if likes is not None:
        print(f"\n✅ Éxito: {likes} likes")
    else:
        print(f"\n❌ No se pudo obtener el contador de likes")
    
    return likes

if __name__ == "__main__":
    # Prueba del scraper
    test_scraper("loonerdalv")


import os
import time
import requests
import json
import sqlite3
import threading
import urllib.parse

import sys

if getattr(sys, 'frozen', False):
    _app_data_dir = os.path.join(os.getenv('APPDATA', os.path.expanduser('~')), 'NovaStream')
else:
    _app_data_dir = os.path.dirname(__file__)

CACHE_DIR = os.path.join(_app_data_dir, 'data', 'cache')
IMAGES_DIR = os.path.join(CACHE_DIR, 'images')
META_DIR = os.path.join(CACHE_DIR, 'metadata')

os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(META_DIR, exist_ok=True)

def _get_conn():
    conn = sqlite3.connect(os.path.join(_app_data_dir, 'NovaStream.db'))
    conn.row_factory = sqlite3.Row
    return conn

def download_image(url, filepath):
    if not url or os.path.exists(filepath):
        return True
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(r.content)
            return True
    except Exception as e:
        print(f"Failed to download image {url}: {e}")
    return False

def sync_metadata():
    while True:
        try:
            conn = _get_conn()
            cur = conn.execute("SELECT id, title, poster FROM anime_library")
            animes = cur.fetchall()
            conn.close()
            
            for anime in animes:
                anime_id = anime["id"]
                title = anime["title"]
                poster_url = anime["poster"]
                
                # 1. Download Poster
                if poster_url:
                    poster_path = os.path.join(IMAGES_DIR, f"poster_{anime_id}.jpg")
                    download_image(poster_url, poster_path)
                
                # 2. Fetch Extended Metadata (Cast)
                meta_path = os.path.join(META_DIR, f"{anime_id}.json")
                if not os.path.exists(meta_path):
                    time.sleep(2) # rate limit 1 request/sec for Jikan to be very safe
                    try:
                        query = urllib.parse.quote(title)
                        res = requests.get(f"https://api.jikan.moe/v4/anime?q={query}&limit=1", timeout=10).json()
                        
                        if res.get('data') and len(res['data']) > 0:
                            jikan_id = res['data'][0]['mal_id']
                            time.sleep(2)
                            char_res = requests.get(f"https://api.jikan.moe/v4/anime/{jikan_id}/characters", timeout=10).json()
                            cast_info = char_res.get('data', [])[:10]
                            
                            metadata = {
                                'jikan_id': jikan_id,
                                'synopsis': res['data'][0].get('synopsis'),
                                'cast': []
                            }
                            
                            for c in cast_info:
                                char_name = c['character']['name']
                                char_img = c['character']['images']['jpg']['image_url']
                                va = next((v for v in c.get('voice_actors', []) if v['language'] == 'Japanese'), None)
                                
                                if va:
                                    va_name = va['person']['name']
                                    va_img = va['person']['images']['jpg']['image_url']
                                    
                                    char_filename = f"char_{jikan_id}_{c['character']['mal_id']}.jpg"
                                    va_filename = f"va_{va['person']['mal_id']}.jpg"
                                    download_image(char_img, os.path.join(IMAGES_DIR, char_filename))
                                    download_image(va_img, os.path.join(IMAGES_DIR, va_filename))
                                    
                                    metadata['cast'].append({
                                        'character': char_name,
                                        'character_image': f"/cache/images/{char_filename}",
                                        'actor': va_name,
                                        'actor_image': f"/cache/images/{va_filename}"
                                    })
                            
                            with open(meta_path, 'w', encoding='utf-8') as f:
                                json.dump(metadata, f)
                    except Exception as e:
                        print(f"Jikan fetch error for {title}:", e)
        except Exception as e:
            print("Metadata worker error:", e)
            
        time.sleep(3600) # Sync again in 1 hour

def start_worker():
    t = threading.Thread(target=sync_metadata, daemon=True)
    t.start()

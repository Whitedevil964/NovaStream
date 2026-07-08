"""
NovaStream v2.0 — Flask Application
Production-ready backend with SQLite persistence, FFmpeg checks,
settings management, and per-video quality support.
"""

from flask import (
    Flask, render_template, request, jsonify,
    Response, send_from_directory, stream_with_context, send_file,
)
from downloader import (
    get_video_info, get_playlist_info, download_video,
    download_audio, download_playlist, is_playlist_url,
    download_subtitle, sanitize_filename,
    PAUSE_FLAGS, CANCEL_FLAGS
)
from database import (
    init_db, add_download, update_download, get_history,
    get_download, delete_download, clear_history,
    get_setting, set_setting, get_all_settings,
    get_all_library_anime, get_library_anime,
    update_library_anime, remove_library_anime, get_watched_episodes, mark_episode_watched,
    bulk_update_library_status, bulk_delete_library_anime, get_watch_stats,
    get_full_backup, import_backup, check_achievements
)
import mpv_controller
import threading
import subprocess
import shutil
import uuid
import sys
import json
import tkinter as tk
from tkinter import filedialog
import time
import os
import glob
import urllib.parse
import queue
import logging
import datetime
import traceback
from concurrent.futures import ThreadPoolExecutor
from metadata_worker import start_worker

# ---------------------------------------------------------------------------
# Base directory (PyInstaller compatibility)
# ---------------------------------------------------------------------------
# BUNDLE_DIR = where templates/static are (inside the .exe temp extraction)
# BASE_DIR   = where user data lives (downloads, database — next to .exe)
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = sys._MEIPASS                          # Bundled resources
    BASE_DIR = os.path.dirname(sys.executable)         # User data
    # Add app dir to PATH so yt-dlp can find bundled deno.exe
    if BASE_DIR not in os.environ.get('PATH', ''):
        os.environ['PATH'] = BASE_DIR + os.pathsep + os.environ.get('PATH', '')
else:
    BUNDLE_DIR = os.path.dirname(os.path.abspath(__file__))
    BASE_DIR = BUNDLE_DIR

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

app = Flask(
    __name__,
    template_folder=os.path.join(BUNDLE_DIR, 'templates'),
    static_folder=os.path.join(BUNDLE_DIR, 'static'),
)

# ---------------------------------------------------------------------------
# Initialize database
# ---------------------------------------------------------------------------
init_db()

# Initialize Discord RPC globally
import discord_rpc
_settings = get_all_settings()
discord_rpc.init(
    _settings.get('discord_client_id', ''),
    _settings.get('discord_rpc_enabled', 'false')
)

# Start background metadata worker
start_worker()

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
download_tasks = {}
download_tasks_lock = threading.Lock()

progress_queues = {}
progress_queues_lock = threading.Lock()

if getattr(sys, 'frozen', False):
    _app_data_dir = os.path.join(os.getenv('APPDATA', os.path.expanduser('~')), 'NovaStream')
else:
    _app_data_dir = BASE_DIR

CACHE_DIR = os.path.join(_app_data_dir, 'data', 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)

# Load download dir from settings, fallback to ./downloads
_saved_dir = get_setting('download_dir')
if _saved_dir and os.path.isabs(_saved_dir):
    DOWNLOAD_DIR = _saved_dir
else:
    if getattr(sys, 'frozen', False):
        DOWNLOAD_DIR = os.path.join(os.path.expanduser('~'), 'Videos', 'NovaStream')
    else:
        DOWNLOAD_DIR = os.path.join(BASE_DIR, 'downloads')
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

executor = ThreadPoolExecutor(max_workers=6)


# ---------------------------------------------------------------------------
# FFmpeg Check
# ---------------------------------------------------------------------------
def check_ffmpeg():
    """Check if ffmpeg is installed and return version info."""
    path = shutil.which('ffmpeg')
    if path:
        try:
            result = subprocess.run(
                ['ffmpeg', '-version'],
                capture_output=True, text=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            first_line = result.stdout.split('\n')[0] if result.stdout else 'Unknown'
            return {'installed': True, 'path': path, 'version': first_line}
        except Exception:
            return {'installed': True, 'path': path, 'version': 'Unknown'}
    return {'installed': False, 'path': None, 'version': None}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _broadcast_progress(download_id, status_dict):
    """Push a progress update into every connected client queue + persist to DB."""
    payload = {
        'download_id': download_id,
        **status_dict,
    }

    with download_tasks_lock:
        if download_id in download_tasks:
            download_tasks[download_id].update(status_dict)

    # Persist to database
    db_update = {}
    if 'status' in status_dict:
        db_update['status'] = status_dict['status']
    if 'title' in status_dict and status_dict['title']:
        db_update['title'] = status_dict['title']
    if 'filename' in status_dict and status_dict['filename']:
        db_update['filename'] = os.path.basename(status_dict['filename'])
        db_update['filepath'] = status_dict['filename']
    if 'error' in status_dict and status_dict['error']:
        db_update['error'] = status_dict['error']
    if status_dict.get('status') == 'finished':
        db_update['completed_at'] = time.time()
        # Try to get file size
        fp = status_dict.get('filename', '')
        if fp and os.path.isfile(fp):
            try:
                db_update['filesize'] = os.path.getsize(fp)
            except OSError:
                pass
    if db_update:
        update_download(download_id, **db_update)

    # Fan-out to SSE queues
    with progress_queues_lock:
        dead_clients = []
        for client_id, q in progress_queues.items():
            try:
                q.put_nowait(payload)
            except queue.Full:
                dead_clients.append(client_id)
        for cid in dead_clients:
            progress_queues.pop(cid, None)


def _run_download(download_id, url, fmt, quality):
    """Worker executed inside the thread-pool."""
    global DOWNLOAD_DIR
    output_dir = DOWNLOAD_DIR
    try:
        if fmt == 'audio':
            download_audio(
                url=url,
                output_dir=output_dir,
                progress_callback=_broadcast_progress,
                download_id=download_id,
            )
        elif is_playlist_url(url):
            download_playlist(
                url=url,
                format_type=fmt,
                quality=quality,
                output_dir=output_dir,
                progress_callback=_broadcast_progress,
                download_id=download_id,
            )
        else:
            download_video(
                url=url,
                quality=quality,
                output_dir=output_dir,
                progress_callback=_broadcast_progress,
                download_id=download_id,
            )
    except Exception as e:
        logger.error("Download worker error for %s: %s", url, e, exc_info=True)
        _broadcast_progress(download_id, {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': '',
            'error': str(e),
        })
        update_download(download_id, status='error')


# ---------------------------------------------------------------------------
# Global error handlers
# ---------------------------------------------------------------------------
@app.errorhandler(Exception)
def handle_exception(e):
    logger.error('Unhandled exception: %s', e, exc_info=True)
    return jsonify({
        'error': 'An internal server error occurred',
        'detail': str(e),
    }), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
    return response


# ---------------------------------------------------------------------------
# Routes — Pages
# ---------------------------------------------------------------------------
APP_VERSION = "1.0.0"
BUILD_DATE = "2026-07"

@app.route('/')
def index():
    """Serve the main single-page application."""
    accent = get_setting('accent_color') or '#8b5cf6'
    resp = Response(render_template('index.html', app_version=APP_VERSION, build_date=BUILD_DATE, accent_color=accent))
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    resp.headers['Pragma'] = 'no-cache'
    resp.headers['Expires'] = '-1'
    return resp


# ---------------------------------------------------------------------------
# Routes — System
# ---------------------------------------------------------------------------
@app.route('/api/system-check', methods=['GET'])
def api_system_check():
    """Check system dependencies (ffmpeg)."""
    return jsonify({'ffmpeg': check_ffmpeg()}), 200


# ---------------------------------------------------------------------------
# Routes — Settings
# ---------------------------------------------------------------------------
@app.route('/api/settings', methods=['GET'])
def api_settings_get():
    """Return all application settings."""
    settings = get_all_settings()
    settings.setdefault('download_dir', DOWNLOAD_DIR)
    settings.setdefault('smart_download', 'false')
    settings.setdefault('auto_delete', 'false')
    settings.setdefault('discord_rpc_enabled', 'false')
    settings.setdefault('discord_client_id', '') # User must provide their own Application ID
    return jsonify(settings), 200


@app.route('/api/settings', methods=['POST'])
def api_settings_post():
    """Update application settings."""
    global DOWNLOAD_DIR
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    if 'download_dir' in data:
        new_dir = data['download_dir'].strip()
        if new_dir:
            try:
                os.makedirs(new_dir, exist_ok=True)
                set_setting('download_dir', new_dir)
                DOWNLOAD_DIR = new_dir
            except OSError as e:
                return jsonify({'error': f'Invalid directory: {e}'}), 400

    if 'default_language' in data:
        set_setting('default_language', data['default_language'])
    if 'default_subtitles' in data:
        set_setting('default_subtitles', data['default_subtitles'])
    if 'default_quality' in data:
        set_setting('default_quality', data['default_quality'])
    if 'accent_color' in data:
        set_setting('accent_color', data['accent_color'])

    if 'discord_rpc_enabled' in data:
        set_setting('discord_rpc_enabled', str(data['discord_rpc_enabled']).lower())
    if 'discord_client_id' in data:
        set_setting('discord_client_id', data['discord_client_id'].strip())
        
    # Re-init Discord RPC on setting change
    import discord_rpc
    settings = get_all_settings()
    rpc_enabled = settings.get('discord_rpc_enabled', 'false')
    rpc_client_id = settings.get('discord_client_id', '')
    discord_rpc.init(rpc_client_id, rpc_enabled)
    
    if 'smart_download' in data:
        set_setting('smart_download', str(data['smart_download']).lower())
        
    if 'auto_delete' in data:
        set_setting('auto_delete', str(data['auto_delete']).lower())

    return jsonify({'message': 'Settings saved', 'download_dir': DOWNLOAD_DIR}), 200


@app.route('/api/select-folder', methods=['POST'])
def api_select_folder():
    """Open a native folder picker and return the selected path."""
    try:
        script = """
import sys
import tkinter as tk
from tkinter import filedialog
root = tk.Tk()
root.withdraw()
root.attributes('-topmost', True)
root.lift()
root.focus_force()
path = filedialog.askdirectory(parent=root, initialdir=sys.argv[1], title='Select Download Directory')
root.destroy()
print(path)
"""
        result = subprocess.run([sys.executable, '-c', script, DOWNLOAD_DIR], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        folder_path = result.stdout.strip()
        
        if folder_path:
            # Normalize path for Windows
            folder_path = folder_path.replace('/', '\\')
            return jsonify({'folder': folder_path}), 200
        else:
            return jsonify({'folder': None}), 200
    except Exception as e:
        logger.error("Error opening folder picker: %s", e)
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Routes — Video / Playlist info
# ---------------------------------------------------------------------------
@app.route('/api/info', methods=['POST'])
def api_info():
    data = request.get_json(silent=True)
    if not data or 'url' not in data:
        return jsonify({'error': 'Missing "url" parameter'}), 400

    url = data['url'].strip()
    if not url:
        return jsonify({'error': 'URL cannot be empty'}), 400

    try:
        if is_playlist_url(url):
            info = get_playlist_info(url)
        else:
            info = get_video_info(url)

        if 'error' in info:
            return jsonify(info), 500

        return jsonify(info), 200
    except Exception as e:
        logger.error("api_info error for %s: %s", url, e, exc_info=True)
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Routes — Download trigger (supports per-video quality)
# ---------------------------------------------------------------------------
@app.route('/api/download', methods=['POST'])
def api_download():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400

    # New format: {items: [{url, format, quality}, ...]}
    items = data.get('items')
    if items and isinstance(items, list):
        pass  # use items directly
    else:
        # Backward compat: {urls, format, quality}
        urls = data.get('urls', [])
        if isinstance(urls, str):
            urls = [urls]
        if not urls:
            return jsonify({'error': 'No URLs provided'}), 400
        fmt = data.get('format', 'video')
        quality = data.get('quality', 'best')
        items = [{'url': u, 'format': fmt, 'quality': quality} for u in urls]

    created_ids = []

    for item in items:
        url = item.get('url', '').strip()
        if not url:
            continue

        fmt = item.get('format', 'video')
        quality = item.get('quality', 'best')
        download_id = str(uuid.uuid4())

        task_info = {
            'status': 'queued',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': '',
            'format': fmt,
            'quality': quality,
            'url': url,
            'error': None,
        }

        with download_tasks_lock:
            download_tasks[download_id] = task_info

        # Persist to database
        add_download(download_id, url, title='', fmt=fmt, quality=quality)

        executor.submit(_run_download, download_id, url, fmt, quality)
        created_ids.append(download_id)

    return jsonify({'download_ids': created_ids}), 200


# ---------------------------------------------------------------------------
# Routes — SSE progress streaming
# ---------------------------------------------------------------------------
@app.route('/api/progress/connect', methods=['GET'])
def api_progress_connect():
    client_id = str(uuid.uuid4())
    with progress_queues_lock:
        progress_queues[client_id] = queue.Queue(maxsize=500)
    return jsonify({'client_id': client_id}), 200


@app.route('/api/progress/<client_id>', methods=['GET'])
def api_progress(client_id):
    with progress_queues_lock:
        if client_id not in progress_queues:
            progress_queues[client_id] = queue.Queue(maxsize=500)
        q = progress_queues[client_id]

    def generate():
        try:
            while True:
                try:
                    payload = q.get(timeout=15)
                    yield f"data: {json.dumps(payload)}\n\n"
                except queue.Empty:
                    yield f"data: {json.dumps({'heartbeat': True})}\n\n"
        except GeneratorExit:
            pass
        finally:
            with progress_queues_lock:
                progress_queues.pop(client_id, None)

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        },
    )


# ---------------------------------------------------------------------------
# Routes — Queue management
# ---------------------------------------------------------------------------
@app.route('/api/queue', methods=['GET'])
def api_queue():
    with download_tasks_lock:
        snapshot = {did: dict(task) for did, task in download_tasks.items()}
    return jsonify(snapshot), 200

@app.route('/api/downloads/reorder', methods=['POST'])
def api_downloads_reorder():
    data = request.json
    if not data or not isinstance(data, list):
        return jsonify({'error': 'Expected list of IDs'}), 400
        
    with download_tasks_lock:
        global download_tasks
        new_tasks = {}
        # Add requested IDs first
        for did in data:
            if did in download_tasks:
                new_tasks[did] = download_tasks[did]
        # Add remaining IDs that were not in the requested order list
        for did, task in download_tasks.items():
            if did not in new_tasks:
                new_tasks[did] = task
        download_tasks = new_tasks
        
    return jsonify({'success': True}), 200


@app.route('/api/cancel/<download_id>', methods=['POST'])
def api_cancel(download_id):
    CANCEL_FLAGS[download_id] = True
    with download_tasks_lock:
        if download_id not in download_tasks:
            return jsonify({'error': 'Download ID not found'}), 404
        download_tasks[download_id]['status'] = 'cancelled'
        task = dict(download_tasks[download_id])

    update_download(download_id, status='cancelled')

    _broadcast_progress(download_id, {
        'status': 'cancelled',
        'progress': task.get('progress', 0),
        'speed': 'N/A',
        'eta': 'N/A',
        'filename': task.get('filename', ''),
        'title': task.get('title', ''),
    })

    return jsonify({'message': 'Download marked as cancelled'}), 200

@app.route('/api/pause/<download_id>', methods=['POST'])
def api_pause(download_id):
    PAUSE_FLAGS[download_id] = True
    with download_tasks_lock:
        if download_id not in download_tasks:
            return jsonify({'error': 'Download ID not found'}), 404
        download_tasks[download_id]['status'] = 'paused'
        task = dict(download_tasks[download_id])

    update_download(download_id, status='paused')

    _broadcast_progress(download_id, {
        'status': 'paused',
        'progress': task.get('progress', 0),
        'speed': 'Paused',
        'eta': 'Paused',
        'filename': task.get('filename', ''),
        'title': task.get('title', ''),
    })
    return jsonify({'message': 'Download paused'}), 200

@app.route('/api/resume/<download_id>', methods=['POST'])
def api_resume(download_id):
    PAUSE_FLAGS[download_id] = False
    with download_tasks_lock:
        if download_id not in download_tasks:
            return jsonify({'error': 'Download ID not found'}), 404
        download_tasks[download_id]['status'] = 'downloading'
        task = dict(download_tasks[download_id])

    update_download(download_id, status='downloading')

    _broadcast_progress(download_id, {
        'status': 'downloading',
        'progress': task.get('progress', 0),
        'speed': 'Resuming...',
        'eta': 'Resuming...',
        'filename': task.get('filename', ''),
        'title': task.get('title', ''),
    })
    return jsonify({'message': 'Download resumed'}), 200


# ---------------------------------------------------------------------------
# Routes — Download history (database-backed)
# ---------------------------------------------------------------------------
@app.route('/api/history', methods=['GET'])
def api_history():
    """Return download history from database."""
    limit = request.args.get('limit', 200, type=int)
    history = get_history(limit=limit)
    
    valid_history = []
    for d in history:
        if d.get('status') == 'finished':
            filepath = d.get('filepath') or d.get('filename')
            if filepath:
                if not os.path.isabs(filepath):
                    safe_name = filepath.replace('/', os.sep)
                    filepath = os.path.join(DOWNLOAD_DIR, safe_name)
                
                # Check if the file still exists on disk
                if not os.path.exists(filepath):
                    # File missing, likely deleted by user manually. Clean up DB.
                    delete_download(d.get('id'))
                    continue
        valid_history.append(d)
        
    return jsonify(valid_history), 200


@app.route('/api/history/<download_id>', methods=['DELETE'])
def api_history_delete(download_id):
    """Delete a single history entry."""
    if delete_download(download_id):
        return jsonify({'message': 'Deleted'}), 200
    return jsonify({'error': 'Not found'}), 404


@app.route('/api/history', methods=['DELETE'])
def api_history_clear():
    """Clear all download history."""
    clear_history()
    return jsonify({'message': 'History cleared'}), 200


# ---------------------------------------------------------------------------
# Routes — File management
# ---------------------------------------------------------------------------
@app.route('/api/downloads', methods=['GET'])
def api_downloads():
    """List all files in DOWNLOAD_DIR recursively."""
    files = []
    for root, _dirs, filenames in os.walk(DOWNLOAD_DIR):
        for fname in filenames:
            full_path = os.path.join(root, fname)
            rel_path = os.path.relpath(full_path, DOWNLOAD_DIR)
            try:
                stat = os.stat(full_path)
                files.append({
                    'filename': fname,
                    'path': rel_path.replace('\\', '/'),
                    'size': stat.st_size,
                    'modified': stat.st_mtime,
                })
            except OSError:
                continue

    return jsonify(files), 200


@app.route('/api/download-file/<path:filename>', methods=['GET'])
def api_download_file(filename):
    """Serve a file from DOWNLOAD_DIR."""
    safe_name = filename.replace('/', os.sep)
    directory = os.path.join(DOWNLOAD_DIR, os.path.dirname(safe_name))
    base = os.path.basename(safe_name)
    if not os.path.isfile(os.path.join(directory, base)):
        return jsonify({'error': 'File not found'}), 404
    return send_from_directory(directory, base, as_attachment=True)


@app.route('/api/open-folder', methods=['POST'])
def api_open_folder():
    """Open the download folder in Windows Explorer."""
    data = request.get_json(silent=True)
    if not data or 'filename' not in data:
        return jsonify({'error': 'Missing filename'}), 400
        
    identifier = data['filename']
    target_dir = DOWNLOAD_DIR
    
    with download_tasks_lock:
        if identifier in download_tasks:
            task = download_tasks[identifier]
            if task.get('filepath') and os.path.exists(task['filepath']):
                target_dir = os.path.dirname(task['filepath'])
            elif task.get('filename') and os.path.exists(os.path.join(DOWNLOAD_DIR, task['filename'])):
                target_dir = os.path.dirname(os.path.join(DOWNLOAD_DIR, task['filename']))
            elif task.get('format') == 'anime':
                title_parts = task.get('title', '').split(' - Ep')
                anime_title = title_parts[0] if title_parts else task.get('title', '')
                import re
                safe_anime_title = re.sub(r'[\\/*?:"<>|]', "", anime_title)
                anime_dir = os.path.join(DOWNLOAD_DIR, safe_anime_title)
                if os.path.exists(anime_dir):
                    target_dir = anime_dir
        else:
            safe_name = identifier.replace('/', os.sep)
            full_path = os.path.join(DOWNLOAD_DIR, safe_name)
            if os.path.isfile(full_path):
                target_dir = os.path.dirname(full_path)
            elif os.path.isdir(full_path):
                target_dir = full_path

    if not os.path.exists(target_dir):
        target_dir = DOWNLOAD_DIR
        
    directory = target_dir
        
    try:
        if os.name == 'nt':
            os.startfile(directory)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', directory])
        else:
            subprocess.Popen(['xdg-open', directory])
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ---------------------------------------------------------------------------
# Anime Downloader Helper Functions
# ---------------------------------------------------------------------------
def run_node_scraper(action, arg1, provider='hianime', sub_or_dub='SUB', server='auto'):
    """Run node anime_scraper.js action arg1 provider subOrDub server and return parsed JSON."""
    
    # Resolve path for PyInstaller
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    scraper_path = os.path.join(base_path, 'anime_scraper.js')
    
    try:
        cmd = ['node', scraper_path, action, arg1, provider, sub_or_dub, server]
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=30,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        if result.returncode != 0:
            logger.error("Node scraper error: %s", result.stderr)
            # Scraper may have printed valid JSON error before exiting with 1
            if result.stdout.strip():
                try:
                    return json.loads(result.stdout)
                except Exception:
                    pass
            return {'error': result.stderr or 'Node process failed'}
        return json.loads(result.stdout)
    except Exception as e:
        logger.error("Failed to run Node scraper: %s", e)
        return {'error': str(e)}


def _run_anime_download(download_id, episode_id, anime_title, episode_num, episode_title, provider, quality, sub_lang, sub_or_dub, server):
    """Worker executed inside the thread-pool for anime downloads."""
    global DOWNLOAD_DIR
    import re
    import os
    
    # Sanitize anime_title to ensure it's a valid Windows folder name
    safe_title = re.sub(r'[\\/*?:"<>|]', "", anime_title).strip()
    if not safe_title:
        safe_title = "Unknown Anime"
        
    output_dir = os.path.join(DOWNLOAD_DIR, safe_title)
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        _broadcast_progress(download_id, {
            'status': 'processing',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'Resolving stream link...',
            'title': f"{anime_title} - Ep {episode_num}",
        })
        
        sources_data = run_node_scraper('sources', episode_id, provider, sub_or_dub, server)
        if 'error' in sources_data:
            raise Exception(sources_data['error'])
            
        sources = sources_data.get('sources', [])
        if not sources:
            raise Exception("No streaming sources found for this episode.")
            
        # Select quality
        selected_sources = []
        
        if quality == 'best':
            quality_preferences = ['1080p', 'default', 'auto', '720p', '480p', '360p']
        else:
            quality_preferences = [quality, 'default', 'auto', '1080p', '720p', '480p', '360p']
            
        for q_pref in quality_preferences:
            for src in sources:
                src_q = str(src.get('quality', '')).lower()
                if q_pref in src_q and src not in selected_sources:
                    selected_sources.append(src)
                    
        # Add remaining sources
        for src in sources:
            if src not in selected_sources:
                selected_sources.append(src)
                
        if not selected_sources:
            selected_sources = sources
            
        episode_filename = f"{anime_title} - Episode {episode_num:02d}"
        if episode_title and episode_title.strip():
            episode_filename += f" - {episode_title}"
            
        success = False
        last_error = None
        
        for selected_source in selected_sources:
            stream_url = selected_source.get('url')
            headers = sources_data.get('headers', {})
            referer = headers.get('Referer') or headers.get('referer')
            
            # Download subtitle if zoro and requested
            subtitles = sources_data.get('subtitles', [])
            subtitle_url = None
            if subtitles and sub_lang:
                for sub in subtitles:
                    lang = str(sub.get('lang', '')).lower()
                    if sub_lang.lower() in lang:
                        subtitle_url = sub.get('url')
                        break
                if not subtitle_url:
                    for sub in subtitles:
                        lang = str(sub.get('lang', '')).lower()
                        if 'english' in lang or 'eng' in lang:
                            subtitle_url = sub.get('url')
                            break
                            
            try:
                # Download subtitles
                if subtitle_url:
                    sub_filename = f"{episode_filename}.vtt"
                    sub_path = os.path.join(output_dir, sanitize_filename(sub_filename))
                    download_subtitle(subtitle_url, sub_path, referer=referer)
                    
                # Download stream via yt-dlp
                from downloader import download_anime_episode
                download_anime_episode(
                    url=stream_url,
                    referer=referer,
                    output_dir=output_dir,
                    progress_callback=_broadcast_progress,
                    download_id=download_id,
                    filename=episode_filename,
                    custom_headers=headers
                )
                success = True
                break
            except Exception as e:
                last_error = str(e)
                logger.warning("Anime source %s failed: %s", stream_url, e)
                
        if not success:
            raise Exception(f"All sources failed. Last error: {last_error}")
        
    except Exception as e:
        logger.error("Anime download worker error for %s: %s", episode_id, e, exc_info=True)
        _broadcast_progress(download_id, {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': f"{anime_title} - Ep {episode_num}",
            'error': str(e),
        })


# ---------------------------------------------------------------------------
# Kitsu Metadata Resolvers (Bypasses Dead Scraper CDNs)
# ---------------------------------------------------------------------------
def resolve_kitsu_anime(title):
    """Search Kitsu for the anime title to get canonical poster and cover images."""
    import urllib.request
    import urllib.parse
    import json
    import ssl
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # Strip (Dub) or (Sub) or season info if present for better matching
    clean_title = re.sub(r'\s*\([^)]*\)', '', title).strip()
    encoded_title = urllib.parse.quote(clean_title)
    url = f"https://kitsu.io/api/edge/anime?filter[text]={encoded_title}&page[limit]=1"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            results = data.get('data', [])
            if results:
                anime = results[0]
                kitsu_id = anime.get('id')
                attrs = anime.get('attributes', {})
                
                poster = attrs.get('posterImage') or {}
                poster_url = poster.get('medium') or poster.get('original') or poster.get('small')
                
                cover = attrs.get('coverImage') or {}
                cover_url = attrs.get('large') or cover.get('original') or cover.get('small')
                
                return {
                    'kitsu_id': kitsu_id,
                    'poster': poster_url,
                    'cover': cover_url,
                    'title': attrs.get('canonicalTitle')
                }
    except Exception as e:
        logger.error("Kitsu anime search failed for title '%s': %s", title, e)
    return None


def fetch_kitsu_episodes(kitsu_id, max_ep_num):
    """Fetch episode thumbnails for a kitsu anime ID in parallel."""
    import urllib.request
    import json
    import ssl
    from concurrent.futures import ThreadPoolExecutor
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    # Kitsu API has a maximum page limit of 20.
    # Cap offsets to a reasonable number to avoid spamming the API (max 25 pages / 500 eps)
    offsets = list(range(0, min(max_ep_num, 500) + 1, 20))
    episodes_map = {}
    
    def fetch_page(offset):
        url = f"https://kitsu.io/api/edge/anime/{kitsu_id}/episodes?page[limit]=20&page[offset]={offset}"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
                data = json.loads(response.read().decode('utf-8'))
                page_map = {}
                for ep in data.get('data', []):
                    num = ep.get('attributes', {}).get('number')
                    thumb = ep.get('attributes', {}).get('thumbnail')
                    if num is not None and thumb:
                        thumb_url = thumb.get('original') or thumb.get('medium') or thumb.get('small')
                        if thumb_url:
                            page_map[int(num)] = thumb_url
                return page_map
        except Exception as e:
            logger.error("Kitsu episodes fetch failed for offset %s: %s", offset, e)
            return {}

    with ThreadPoolExecutor(max_workers=max(len(offsets), 1)) as t_executor:
        results = t_executor.map(fetch_page, offsets)
        for page_map in results:
            episodes_map.update(page_map)
            
    return episodes_map


# ---------------------------------------------------------------------------
# Routes — Anime Downloader
# ---------------------------------------------------------------------------
import re



@app.route('/api/anime/search', methods=['GET'])
def api_anime_search():
    query = request.args.get('query', '').strip()
    provider = request.args.get('provider', 'hianime').strip()
    filter_genre = request.args.get('genre', '').strip().lower()
    filter_year = request.args.get('year', '').strip()
    filter_status = request.args.get('status', '').strip().lower()
    
    if not query:
        return jsonify({'error': 'Missing query parameter'}), 400
    
    results = run_node_scraper('search', query, provider)
    if 'error' in results:
        return jsonify(results), 500
        
    results_list = results.get('results', []) if isinstance(results, dict) else results
    has_filters = bool(filter_genre or filter_year or filter_status)
    
    if isinstance(results_list, list) and results_list:
        from concurrent.futures import ThreadPoolExecutor
        
        def resolve_result_with_metadata(item):
            """Resolve Kitsu data for image + metadata (genres, year, status) for filtering."""
            title = item.get('title', '')
            if not title:
                return
            try:
                import urllib.request, urllib.parse, ssl
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                
                clean_title = re.sub(r'\s*\([^)]*\)', '', title).strip()
                encoded_title = urllib.parse.quote(clean_title)
                url = f"https://kitsu.io/api/edge/anime?filter[text]={encoded_title}&page[limit]=1"
                req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
                    data = json.loads(response.read().decode('utf-8'))
                    kitsu_results = data.get('data', [])
                    if kitsu_results:
                        attrs = kitsu_results[0].get('attributes', {})
                        poster = attrs.get('posterImage') or {}
                        poster_url = poster.get('medium') or poster.get('original') or poster.get('small')
                        if poster_url:
                            item['image'] = poster_url
                        
                        # Enrich with filterable metadata
                        if has_filters:
                            # Genres from Kitsu categories (stored as abbreviated in attrs)
                            # Use the dedicated genres relationship if available
                            genres_url = kitsu_results[0].get('relationships', {}).get('genres', {}).get('links', {}).get('related')
                            if genres_url:
                                try:
                                    greq = urllib.request.Request(genres_url, headers={'User-Agent': 'Mozilla/5.0'})
                                    with urllib.request.urlopen(greq, context=ctx, timeout=3) as gresp:
                                        gdata = json.loads(gresp.read().decode('utf-8'))
                                        genre_names = [g.get('attributes', {}).get('name', '').lower() for g in gdata.get('data', [])]
                                        item['_genres'] = genre_names
                                except Exception:
                                    item['_genres'] = []
                            else:
                                item['_genres'] = []
                            
                            # Year from startDate
                            start_date = attrs.get('startDate', '') or ''
                            item['_year'] = start_date[:4] if len(start_date) >= 4 else ''
                            
                            # Status mapping
                            kitsu_status = (attrs.get('status', '') or '').lower()
                            if kitsu_status == 'current':
                                item['_status'] = 'airing'
                            elif kitsu_status == 'finished':
                                item['_status'] = 'completed'
                            elif kitsu_status in ('upcoming', 'unreleased'):
                                item['_status'] = 'upcoming'
                            else:
                                item['_status'] = kitsu_status
            except Exception as e:
                logger.debug("Kitsu enrichment failed for '%s': %s", title, e)
        
        with ThreadPoolExecutor(max_workers=min(len(results_list), 10)) as t_executor:
            list(t_executor.map(resolve_result_with_metadata, results_list))
        
        # Apply post-fetch filters if any are active
        if has_filters:
            filtered = []
            for item in results_list:
                # Genre filter
                if filter_genre:
                    item_genres = item.get('_genres', [])
                    # Normalize filter value (e.g. "sci-fi" -> matches "sci-fi" or "science fiction")
                    genre_match = any(filter_genre in g or filter_genre.replace('-', ' ') in g for g in item_genres)
                    if not genre_match and item_genres:
                        continue
                    # If no genre data was fetched, keep the item (don't punish missing data)
                
                # Year filter
                if filter_year:
                    item_year = item.get('_year', '')
                    if filter_year == 'older':
                        if item_year and int(item_year) >= 2012:
                            continue
                    else:
                        if item_year and item_year != filter_year:
                            continue
                
                # Status filter
                if filter_status:
                    item_status = item.get('_status', '')
                    if item_status and item_status != filter_status:
                        continue
                
                filtered.append(item)
            
            # Clean up internal metadata keys before sending to frontend
            for item in filtered:
                item.pop('_genres', None)
                item.pop('_year', None)
                item.pop('_status', None)
            
            if isinstance(results, dict):
                results['results'] = filtered
            else:
                results = filtered
        else:
            # Clean up metadata keys even when no filters applied
            for item in results_list:
                item.pop('_genres', None)
                item.pop('_year', None)
                item.pop('_status', None)
            
    return jsonify(results), 200


@app.route('/api/anime/info', methods=['GET'])
def api_anime_info():
    anime_id = request.args.get('id', '').strip()
    provider = request.args.get('provider', 'hianime').strip()
    cache_first = request.args.get('cache_first', '') == '1'
    if not anime_id:
        return jsonify({'error': 'Missing id parameter'}), 400
        
    cache_dir = CACHE_DIR
    os.makedirs(cache_dir, exist_ok=True)
    cache_file = os.path.join(cache_dir, f"info_{provider}_{anime_id}.json")
    
    # Fast offline check: try to reach 1.1.1.1 or 8.8.8.8
    is_offline = False
    try:
        import socket
        socket.setdefaulttimeout(1)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("1.1.1.1", 53))
    except Exception:
        try:
            socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("8.8.8.8", 53))
        except Exception:
            is_offline = True

    if (is_offline or cache_first) and os.path.exists(cache_file):
        try:
            import json
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached_info = json.load(f)
            
            # Sync total episodes to library
            try:
                episodes = cached_info.get('episodes', [])
                if episodes:
                    lib_anime = get_library_anime(anime_id)
                    if lib_anime and len(episodes) > (lib_anime.get('total_episodes') or 0):
                        update_library_anime(anime_id, lib_anime['title'], lib_anime['provider'], lib_anime['poster'], lib_anime['status'], len(episodes), lib_anime['watched_episodes'])
            except Exception as e:
                logger.error("Failed to sync library episodes from cache: %s", e)

            return jsonify(cached_info)
        except Exception as e:
            logger.error("Failed to read cache: %s", e)
            
    info = run_node_scraper('info', anime_id, provider)
    
    if 'error' in info:
        # Fallback to cache if offline/error
        if os.path.exists(cache_file):
            try:
                import json
                with open(cache_file, 'r', encoding='utf-8') as f:
                    cached_info = json.load(f)
                return jsonify(cached_info)
            except Exception as e:
                logger.error("Failed to read cache: %s", e)
        return jsonify(info), 500
        
    # Resolve Kitsu poster, cover, and episode thumbnails
    title = info.get('title')
    if title:
        kitsu_data = resolve_kitsu_anime(title)
        if kitsu_data:
            if kitsu_data.get('poster'):
                info['image'] = kitsu_data['poster']
            if kitsu_data.get('cover'):
                info['cover'] = kitsu_data['cover']
                
            kitsu_id = kitsu_data.get('kitsu_id')
            episodes = info.get('episodes', [])
            if kitsu_id and episodes:
                # Find max episode number to know how many pages to query
                max_ep_num = 1
                for ep in episodes:
                    try:
                        num = float(ep.get('number', 1))
                        if num > max_ep_num:
                            max_ep_num = int(num)
                    except (ValueError, TypeError):
                        pass
                
                episodes_map = fetch_kitsu_episodes(kitsu_id, max_ep_num)
                for ep in episodes:
                    try:
                        num = int(float(ep.get('number', 1)))
                        if num in episodes_map:
                            ep['image'] = episodes_map[num]
                    except (ValueError, TypeError, KeyError):
                        pass
    
    # Save successful response to cache
    try:
        import json
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(info, f)
    except Exception as e:
        logger.error("Failed to save info cache: %s", e)
        
    # Sync total episodes to library
    try:
        episodes = info.get('episodes', [])
        if episodes:
            lib_anime = get_library_anime(anime_id)
            if lib_anime and len(episodes) > (lib_anime.get('total_episodes') or 0):
                update_library_anime(anime_id, lib_anime['title'], lib_anime['provider'], lib_anime['poster'], lib_anime['status'], len(episodes), lib_anime['watched_episodes'])
    except Exception as e:
        logger.error("Failed to sync library episodes: %s", e)
                        
    return jsonify(info), 200


@app.route('/api/anime/download', methods=['POST'])
def api_anime_download():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
        
    anime_title = data.get('anime_title', 'Anime').strip()
    episodes = data.get('episodes', [])
    provider = data.get('provider', 'hianime').strip()
    quality = data.get('quality', 'best').strip()
    sub_or_dub = data.get('sub_or_dub', 'SUB').strip()
    server = data.get('server', 'hd-1').strip()
    sub_lang = data.get('sub_lang')
    if sub_lang is not None:
        sub_lang = str(sub_lang).strip()
    else:
        sub_lang = 'English'
    
    if not episodes:
        return jsonify({'error': 'No episodes provided for download'}), 400
        
    created_ids = []
    for ep in episodes:
        ep_id = ep.get('id')
        ep_num = ep.get('number', 1)
        ep_title = ep.get('title', '')
        
        download_id = str(uuid.uuid4())
        
        task_info = {
            'status': 'queued',
            'progress': 0.0,
            'speed': 'N/A',
            'meta': 'N/A',
            'filename': '',
            'title': f"{anime_title} - Ep {ep_num}",
            'format': 'anime',
            'quality': quality,
            'url': ep_id,
            'error': None,
        }
        
        with download_tasks_lock:
            download_tasks[download_id] = task_info
            
        add_download(download_id, url=ep_id, title=f"{anime_title} - Ep {ep_num}", fmt='anime', quality=quality)
        
        executor.submit(_run_anime_download, download_id, ep_id, anime_title, ep_num, ep_title, provider, quality, sub_lang, sub_or_dub, server)
        created_ids.append(download_id)
        
    return jsonify({'download_ids': created_ids}), 200


@app.route('/api/anime/proxy-image', methods=['GET'])
def api_anime_proxy_image():
    img_url = request.args.get('url', '').strip()
    if not img_url:
        return 'Missing url', 400
        
    # Rewrite kaa.lt or kickass-anime.ru image URLs to kickassanime.ro
    if 'kaa.lt/image/' in img_url:
        img_url = img_url.replace('kaa.lt/image/', 'kickassanime.ro/image/')
    elif 'kickass-anime.ru/image/' in img_url:
        img_url = img_url.replace('kickass-anime.ru/image/', 'kickassanime.ro/image/')
        
    import hashlib
    cache_dir = CACHE_DIR
    os.makedirs(cache_dir, exist_ok=True)
    img_hash = hashlib.md5(img_url.encode('utf-8')).hexdigest()
    cache_path = os.path.join(cache_dir, f"img_{img_hash}.jpg")
    
    # Check cache BEFORE trying network for instant load & offline support
    if os.path.exists(cache_path):
        return send_file(cache_path, mimetype='image/jpeg')
        
    try:
        import urllib.request
        import ssl
        
        referer = 'https://kaa.lt/' if 'kaa.lt' in img_url else None
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        if referer:
            headers['Referer'] = referer
            
        req = urllib.request.Request(img_url, headers=headers)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            image_data = response.read()
            # Cache the image
            with open(cache_path, 'wb') as f:
                f.write(image_data)
            return Response(image_data, mimetype=response.headers.get('Content-Type', 'image/jpeg'))
            
    except Exception as e:
        # If offline/error, serve from cache if available
        if os.path.exists(cache_path):
            return send_file(cache_path, mimetype='image/jpeg')
        
        logger.error("Proxy image error: %s", e)
        return send_from_directory(os.path.join(BUNDLE_DIR, 'static', 'img'), 'logo.svg')


# ---------------------------------------------------------------------------
# Anime Tracker / Library API
# ---------------------------------------------------------------------------

@app.route('/api/continue-watching', methods=['GET'])
def api_continue_watching():
    limit = request.args.get('limit', default=10, type=int)
    from database import get_continue_watching
    results = get_continue_watching(limit)
    return jsonify({"success": True, "data": results})

@app.route('/api/movies/library', methods=['GET'])
def api_movies_library():
    # Placeholder for movies library to prevent 404 frontend crashes
    return jsonify({"success": True, "library": []})

@app.route('/api/log_error', methods=['POST'])
def api_log_error():
    data = request.get_json()
    app.logger.error(f"FRONTEND JS ERROR: {data.get('message')} at {data.get('url')}:{data.get('line')}:{data.get('col')}\nStack: {data.get('stack')}")
    return jsonify({"success": True})

@app.route('/api/library', methods=['GET'])
def api_get_library():
    try:
        anime_list = get_all_library_anime()
        
        # Auto-sync total_episodes from local cache if missing
        updated_any = False
        cache_dir = CACHE_DIR
        for anime in anime_list:
            if not anime.get('total_episodes'):
                cache_file = os.path.join(cache_dir, f"info_{anime['provider']}_{anime['id']}.json")
                if os.path.exists(cache_file):
                    try:
                        import json
                        with open(cache_file, 'r', encoding='utf-8') as f:
                            cached_info = json.load(f)
                            episodes = cached_info.get('episodes', [])
                            if episodes:
                                update_library_anime(anime['id'], anime['title'], anime['provider'], anime['poster'], anime['status'], len(episodes), anime['watched_episodes'])
                                updated_any = True
                    except Exception:
                        pass
                        
        if updated_any:
            anime_list = get_all_library_anime()
            
        return jsonify({'success': True, 'library': anime_list})
    except Exception as e:
        logger.error("Error fetching library: %s", e)
        return jsonify({'error': str(e)}), 500

@app.route('/api/library/local-files')
def api_library_local_files():
    """Scan the download directory and return a nested dictionary of discovered files."""
    return jsonify({'local': []})

# ─── MPV Player API ────────────────────────────────────────────────────────

@app.route('/api/player/play', methods=['POST'])
def api_player_play():
    """Launch MPV to play a specific file."""
    data = request.get_json(silent=True)
    if not data or 'path' not in data:
        return jsonify({'error': 'Missing path in request'}), 400
        
    path = data['path']
    logger.error(f"DEBUG: api_player_play received path: {path}")
    
    # If it's a remote URL, bypass local file checks
    is_remote = path.startswith('http://') or path.startswith('https://')
    
    if not is_remote:
        if not os.path.isabs(path):
            safe_name = path.replace('/', os.sep)
            path = os.path.join(DOWNLOAD_DIR, safe_name)
            
        logger.error(f"DEBUG: api_player_play absolute path resolved to: {path}")
        logger.error(f"DEBUG: Does path exist? {os.path.exists(path)}")
            
        if not os.path.exists(path):
            return jsonify({'error': 'File not found'}), 404
        
    # The video ID can be a database ID, or just the file path hash
    video_id = data.get('video_id') or path
    anime_id = data.get('anime_id')
    episode_num = data.get('episode_num')
    
    result = mpv_controller.play_video(video_id, path, anime_id, episode_num)
    if result.get('status') == 'error':
        return jsonify(result), 500
    return jsonify(result), 200

@app.route('/api/anime/play_remote', methods=['POST'])
def api_anime_play_remote():
    data = request.get_json(silent=True)
    if not data or 'episode_id' not in data or 'provider' not in data:
        return jsonify({'error': 'Missing episode_id or provider'}), 400
        
    episode_id = data['episode_id']
    provider = data['provider']
    quality = data.get('quality', 'best')
    sub_or_dub = data.get('subOrDub', 'SUB')
    server = data.get('server', 'auto')
    anime_id = data.get('anime_id')
    episode_num = data.get('episode_num')
    
    try:
        # Get streaming sources
        parsed = run_node_scraper('sources', episode_id, provider, sub_or_dub, server)
        
        if 'error' in parsed:
            return jsonify({'error': parsed['error']}), 400
            
        sources = parsed.get('sources', [])
        if not sources:
            return jsonify({'error': 'No streaming sources found'}), 404
            
        # Get highest quality source or first available
        best_source = sources[0]['url']
        for s in sources:
            if s.get('quality') == '1080p' or s.get('quality') == 'auto':
                best_source = s['url']
                break
                
        # Launch MPV with the remote URL
        video_id = episode_id
        result = mpv_controller.play_video(video_id, best_source, anime_id, episode_num)
        
        if result.get('status') == 'error':
            return jsonify(result), 500
        return jsonify({'success': True, 'message': 'Started MPV player for streaming'}), 200
        
    except Exception as e:
        logger.error(f"Error playing remote episode: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/player/status', methods=['GET'])
def api_player_status():
    """Get the current running status of the MPV player."""
    return jsonify(mpv_controller.get_player_status())

@app.route('/api/library/update', methods=['POST'])
def api_update_library():
    data = request.json
    if not data or not data.get('id'):
        return jsonify({'error': 'Missing anime id'}), 400
    
    success = update_library_anime(
        anime_id=data.get('id'),
        title=data.get('title', ''),
        provider=data.get('provider', ''),
        poster=data.get('poster', ''),
        status=data.get('status', 'plan_to_watch'),
        total_episodes=data.get('total_episodes', 0),
        watched_episodes=data.get('watched_episodes', 0),
        genres=data.get('genres', '')
    )
    if success:
        new_ach = check_achievements() or []
        return jsonify({'success': True, 'new_achievements': new_ach})
    else:
        return jsonify({'error': 'Database error'}), 500

@app.route('/api/stats', methods=['GET'])
def api_stats():
    stats = get_watch_stats()
    if stats is not None:
        print("API STATS RESULT:", stats)
        return jsonify(stats)
    return jsonify({'error': 'Failed to load stats'}), 500

@app.route('/api/notes/<anime_id>/<int:episode_number>', methods=['GET', 'POST'])
def api_notes(anime_id, episode_number):
    from database import save_note, get_note
    if request.method == 'POST':
        data = request.json
        if not data:
            return jsonify({'error': 'No data'}), 400
        success = save_note(anime_id, episode_number, data.get('note', ''), data.get('rating', 0))
        return jsonify({'success': success})
    else:
        note_data = get_note(anime_id, episode_number)
        return jsonify(note_data)

@app.route('/api/wrapped', methods=['GET'])
def api_wrapped():
    # Simplistic wrapped data generation based on existing stats
    stats = get_watch_stats()
    if not stats:
        return jsonify({'error': 'No stats'}), 500
        
    return jsonify({
        'year': datetime.datetime.now().year,
        'total_episodes': stats.get('total_episodes', 0),
        'estimated_hours': stats.get('estimated_hours', 0),
        'longest_streak': stats.get('longest_streak', 0),
        'top_genres': stats.get('genres', [])[:3],
        'time_of_day': stats.get('time_of_day', {})
    })

@app.route('/api/export', methods=['GET'])
def api_export():
    data = get_full_backup()
    if data is None:
        return jsonify({'error': 'Database error'}), 500
    
    payload = {
        "version": "1.0",
        "exported_at": datetime.datetime.now().isoformat(),
        **data
    }
    
    filename = f"novastream_backup_{datetime.datetime.now().strftime('%Y-%m-%d')}.json"
    
    return Response(
        json.dumps(payload, indent=2),
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename={filename}'}
    )

@app.route('/api/import', methods=['POST'])
def api_import():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    try:
        data = json.load(file)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON format'}), 400
        
    if data.get('version') != "1.0":
        return jsonify({'error': 'Unsupported backup version'}), 400
        
    counts = import_backup(data)
    if counts is None:
        return jsonify({'error': 'Database error during import'}), 500
        
    return jsonify(counts)


@app.route('/api/library/<path:anime_id>', methods=['DELETE'])
def api_delete_library(anime_id):
    success = remove_library_anime(anime_id)
    if success:
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Database error'}), 500

@app.route('/api/library/bulk-status', methods=['POST'])
def api_bulk_update_status():
    data = request.json or {}
    anime_ids = data.get('anime_ids', [])
    new_status = data.get('new_status')
    if not anime_ids or not new_status:
        return jsonify({'error': 'Missing anime_ids or new_status'}), 400
    success = bulk_update_library_status(anime_ids, new_status)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'Database error'}), 500

@app.route('/api/library/bulk-delete', methods=['POST'])
def api_bulk_delete_library():
    data = request.json or {}
    anime_ids = data.get('anime_ids', [])
    if not anime_ids:
        return jsonify({'error': 'Missing anime_ids'}), 400
        
    import shutil
    import os
    for anime_id in anime_ids:
        target_path = os.path.join(DOWNLOAD_DIR, anime_id)
        if os.path.exists(target_path) and os.path.isdir(target_path):
            try:
                shutil.rmtree(target_path)
            except Exception as e:
                app.logger.error(f"Failed to delete directory {target_path}: {e}")
                
    success = bulk_delete_library_anime(anime_ids)
    if success:
        return jsonify({'success': True})
    return jsonify({'error': 'Database error'}), 500

@app.route('/api/library/anime/delete', methods=['POST'])
def api_delete_local_anime():
    data = request.json
    anime_id = data.get('id') if data else None
    if not anime_id:
        return jsonify({'error': 'Missing id'}), 400
        
    target_path = os.path.join(DOWNLOAD_DIR, anime_id)
    if os.path.exists(target_path) and os.path.isdir(target_path):
        try:
            import shutil
            shutil.rmtree(target_path)
            from database import remove_library_anime
            remove_library_anime(anime_id)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        from database import remove_library_anime
        remove_library_anime(anime_id)
        return jsonify({'success': True})

@app.route('/api/library/anime/delete_folder', methods=['POST'])
def api_delete_anime_folder():
    data = request.json
    anime_title = data.get('title') if data else None
    if not anime_title:
        return jsonify({'error': 'Missing title'}), 400
    
    import re
    safe_anime_title = re.sub(r'[\\/*?:"<>|]', "", str(anime_title))
    target_path = os.path.join(DOWNLOAD_DIR, safe_anime_title)
    
    if os.path.exists(target_path) and os.path.isdir(target_path):
        try:
            import shutil
            shutil.rmtree(target_path)
            return jsonify({'success': True})
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        # Maybe it's named directly after ID?
        anime_id = data.get('id')
        if anime_id:
            target_path_id = os.path.join(DOWNLOAD_DIR, anime_id)
            if os.path.exists(target_path_id) and os.path.isdir(target_path_id):
                try:
                    import shutil
                    shutil.rmtree(target_path_id)
                    return jsonify({'success': True})
                except Exception as e:
                    return jsonify({'error': str(e)}), 500
                    
        return jsonify({'error': 'Folder not found'}), 404

@app.route('/api/library/<path:anime_id>/episodes', methods=['GET'])
def api_get_watched_episodes(anime_id):
    episodes = get_watched_episodes(anime_id)
    return jsonify({'success': True, 'watched': episodes})

def _smart_download_next(anime_id, episode_number):
    # Resolve path for PyInstaller
    import sys
    if getattr(sys, 'frozen', False):
        base_path = sys._MEIPASS
    else:
        base_path = os.path.dirname(os.path.abspath(__file__))
    
    scraper_path = os.path.join(base_path, 'anime_scraper.js')
    
    try:
        import subprocess, json
        result = subprocess.run(['node', scraper_path, 'info', 'hianime', anime_id], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        if result.returncode != 0:
            return
        anime_data = json.loads(result.stdout)
        episodes = anime_data.get('episodes', [])
        episodes.sort(key=lambda x: x['number'])
        
        current_idx = -1
        for i, ep in enumerate(episodes):
            if ep['number'] == episode_number:
                current_idx = i
                break
                
        if current_idx == -1: return
        next_eps = episodes[current_idx+1:current_idx+3]
        if not next_eps: return
        
        settings = get_all_settings()
        quality = settings.get('default_quality', 'best')
        
        for ep in next_eps:
            item = {
                'url': ep['id'],
                'format': 'anime',
                'quality': quality,
                'title': f"{anime_data.get('title', 'Anime')} - Ep {ep['number']}",
                'anime_id': anime_id,
                'episode_number': ep['number']
            }
            add_download_task(item)
            app.logger.info(f"Smart Download queued: {item['title']}")
    except Exception as e:
        app.logger.error(f"Smart download failed: {e}")

@app.route('/api/library/episode/watch', methods=['POST'])
def api_mark_episode_watched():
    data = request.json
    if not data or not data.get('anime_id') or 'episode_number' not in data:
        return jsonify({'error': 'Missing anime_id or episode_number'}), 400
    
    count = mark_episode_watched(
        anime_id=data.get('anime_id'),
        episode_number=data.get('episode_number'),
        watched=data.get('watched', True)
    )
    if count is not None:
        new_ach = check_achievements() or []
        
        settings = get_all_settings()
        if data.get('watched', True) and data.get('is_local', False):
            if str(settings.get('smart_download', 'false')).lower() == 'true':
                threading.Thread(target=_smart_download_next, args=(data.get('anime_id'), data.get('episode_number')), daemon=True).start()
            
            if str(settings.get('auto_delete', 'false')).lower() == 'true':
                import os, re
                anime_id_str = data.get('anime_id')
                if anime_id_str:
                    anime_path = os.path.join(DOWNLOAD_DIR, str(anime_id_str))
                    ep_num = data.get('episode_number')
                    if os.path.isdir(anime_path):
                        for f in os.listdir(anime_path):
                            if not f.endswith('.mp4'): continue
                            match = re.search(r'Episode\s+(\d+)', f, re.IGNORECASE)
                            if match and int(match.group(1)) == ep_num:
                                file_path = os.path.join(anime_path, f)
                                try:
                                    os.remove(file_path)
                                    app.logger.info(f'Auto-deleted watched episode: {file_path}')
                                    if not os.listdir(anime_path):
                                        os.rmdir(anime_path)
                                except OSError as e:
                                    app.logger.error(f'Failed to auto-delete {file_path}: {e}')
            
        return jsonify({'success': True, 'watched_count': count, 'new_achievements': new_ach})
    else:
        return jsonify({'error': 'Database error'}), 500

@app.route('/api/library/episode/delete', methods=['POST'])
def api_delete_episode():
    data = request.json
    if not data:
        return jsonify({'error': 'Missing data'}), 400
        
    path = data.get('path')
    
    if not path:
        anime_title = data.get('anime_title')
        ep_num = data.get('episode_number')
        if anime_title and ep_num is not None:
            import re
            safe_anime_title = re.sub(r'[\\/*?:"<>|]', "", str(anime_title))
            anime_dir = os.path.join(DOWNLOAD_DIR, safe_anime_title)
            if os.path.exists(anime_dir):
                for f in os.listdir(anime_dir):
                    if f.endswith('.mp4'):
                        match = re.search(r'Episode\s+(\d+)', f, re.IGNORECASE)
                        if match and int(match.group(1)) == int(ep_num):
                            path = os.path.join(anime_dir, f)
                            break

    if not path:
        return jsonify({'error': 'Missing path or invalid episode'}), 400
    
    if not os.path.isabs(path):
        safe_name = path.replace('/', os.sep)
        path = os.path.join(DOWNLOAD_DIR, safe_name)
    
    try:
        if os.path.exists(path):
            os.remove(path)
            
            # Optionally check if directory is empty and remove it
            directory = os.path.dirname(path)
            if os.path.exists(directory) and not os.listdir(directory):
                os.rmdir(directory)
                
            return jsonify({'success': True})
        else:
            return jsonify({'error': 'File not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting file {path}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/discover', methods=['GET'])
def api_discover():
    try:
        cache_dir = CACHE_DIR
        os.makedirs(cache_dir, exist_ok=True)
        cache_file = os.path.join(cache_dir, 'discover.json')
        
        # Check cache (30 mins validity)
        if os.path.exists(cache_file):
            if time.time() - os.path.getmtime(cache_file) < 1800:
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return jsonify({'success': True, 'data': json.load(f)})
                    
        # Run node scraper
        result = run_node_scraper('home', '', 'hianime')
        if not result or 'error' in result:
            logger.error("Scraper failed to fetch home: %s", result)
            return jsonify({'success': False, 'error': result.get('error', 'Unknown scraper error')}), 500
            
        # Save to cache
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False)
            
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        logger.error("Error fetching discover: %s", e)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/local', methods=['GET'])
def get_local_source():
    """Recursively scan DOWNLOAD_DIR and return grouped anime by folder."""
    import re
    anime_dict = {}
    
    if not os.path.exists(DOWNLOAD_DIR):
        return jsonify({'success': True, 'local': []})
        
    for root, _dirs, files in os.walk(DOWNLOAD_DIR):
        for file in files:
            if file.endswith(('.mp4', '.mkv', '.webm', '.avi')):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, DOWNLOAD_DIR)
                parts = rel_path.split(os.sep)
                if len(parts) > 1:
                    title = parts[-2]
                else:
                    title = "Local Downloads"
                
                # Try to extract episode number
                ep_match = re.search(r'(?:[Ee]pisode|[Ee]p|E)\s*0*(\d+)', file, re.IGNORECASE)
                ep_num = int(ep_match.group(1)) if ep_match else 0
                
                if title not in anime_dict:
                    anime_dict[title] = {
                        'id': title,
                        'title': title,
                        'poster': '/static/img/logo.svg',
                        'episodes': []
                    }
                
                anime_dict[title]['episodes'].append({
                    'number': ep_num,
                    'title': file,
                    'path': rel_path.replace(os.sep, '/')
                })
                
    for title in anime_dict:
        anime_dict[title]['episodes'].sort(key=lambda x: (x['number'], x['title']))
        
    # Sort library alphabetically
    sorted_library = sorted(anime_dict.values(), key=lambda x: x['title'])
    return jsonify({'success': True, 'local': sorted_library})

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)

@app.route('/cache/images/<path:filename>')
def serve_cached_image(filename):
    return send_from_directory(os.path.join(app.root_path, 'data', 'cache', 'images'), filename)

@app.route('/api/metadata/<anime_id>')
def api_metadata(anime_id):
    meta_path = os.path.join(app.root_path, 'data', 'cache', 'metadata', f"{anime_id}.json")
    if os.path.exists(meta_path):
        with open(meta_path, 'r', encoding='utf-8') as f:
            return jsonify(json.load(f))
    return jsonify({})

@app.route('/api/stream/<path:filename>', methods=['GET'])
def stream_local_video(filename):
    """Stream a local video file with 206 Partial Content support."""
    safe_name = filename.replace('/', os.sep)
    full_path = os.path.join(DOWNLOAD_DIR, safe_name)
    if not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404
        
    return send_file(full_path, conditional=True)


@app.route('/api/settings/statuses', methods=['GET'])
def api_get_statuses():
    import json
    from database import get_setting
    statuses_json = get_setting('custom_statuses')
    if statuses_json:
        try:
            statuses = json.loads(statuses_json)
            return jsonify({'success': True, 'statuses': statuses})
        except:
            pass
    
    default_statuses = [
        {'id': 'watching', 'label': 'Watching'},
        {'id': 'completed', 'label': 'Completed'},
        {'id': 'on_hold', 'label': 'On Hold'},
        {'id': 'dropped', 'label': 'Dropped'},
        {'id': 'plan_to_watch', 'label': 'Plan to Watch'}
    ]
    return jsonify({'success': True, 'statuses': default_statuses})

@app.route('/api/settings/statuses', methods=['POST'])
def api_set_statuses():
    import json
    data = request.json
    if not data or 'statuses' not in data:
        return jsonify({'error': 'Missing statuses'}), 400
    
    try:
        from database import set_setting
        set_setting('custom_statuses', json.dumps(data['statuses']))
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------------------------
# Entry-point (for development only — production uses main.py)
# ---------------------------------------------------------------------------
@app.route('/api/storage/stats', methods=['GET'])
def api_storage_stats():
    import os, shutil
    from database import get_watched_episodes
    
    total, used, free = shutil.disk_usage(DOWNLOAD_DIR)
    
    anime_stats = []
    total_nova_bytes = 0
    total_watched_bytes = 0
    
    # Simple scan of DOWNLOAD_DIR
    anime_base_dir = DOWNLOAD_DIR
    if os.path.isdir(anime_base_dir):
        for anime_id in os.listdir(anime_base_dir):
            anime_path = os.path.join(anime_base_dir, anime_id)
            if not os.path.isdir(anime_path): continue
            
            anime_size = 0
            anime_watched_size = 0
            watched_eps = get_watched_episodes(anime_id)
            
            for f in os.listdir(anime_path):
                file_path = os.path.join(anime_path, f)
                if not os.path.isfile(file_path) or not f.endswith('.mp4'): continue
                
                try:
                    size = os.path.getsize(file_path)
                    anime_size += size
                    total_nova_bytes += size
                    
                    import re
                    match = re.search(r'Episode\s+(\d+)', f, re.IGNORECASE)
                    if match:
                        ep_num = int(match.group(1))
                        if ep_num in watched_eps:
                            anime_watched_size += size
                            total_watched_bytes += size
                except OSError:
                    pass
                    
            if anime_size > 0:
                anime_stats.append({
                    'title': anime_id.replace('-', ' ').title(),
                    'bytes': anime_size,
                    'watched_bytes': anime_watched_size
                })
            
    anime_stats.sort(key=lambda x: x['bytes'], reverse=True)
        
    return jsonify({
        'total_disk_bytes': total,
        'free_disk_bytes': free,
        'nova_total_bytes': total_nova_bytes,
        'watched_bytes': total_watched_bytes,
        'anime_stats': anime_stats
    })
    
@app.route('/api/storage/clear-watched', methods=['POST'])
def api_storage_clear_watched():
    import os
    from database import get_watched_episodes
    
    freed_bytes = 0
    deleted_count = 0
    
    anime_base_dir = DOWNLOAD_DIR
    if os.path.isdir(anime_base_dir):
        for anime_id in os.listdir(anime_base_dir):
            anime_path = os.path.join(anime_base_dir, anime_id)
            if not os.path.isdir(anime_path): continue
            
            watched_eps = get_watched_episodes(anime_id)
            for f in os.listdir(anime_path):
                file_path = os.path.join(anime_path, f)
                if not os.path.isfile(file_path) or not f.endswith('.mp4'): continue
                
                import re
                match = re.search(r'Episode\s+(\d+)', f, re.IGNORECASE)
                if match:
                    ep_num = int(match.group(1))
                    if ep_num in watched_eps:
                        try:
                            size = os.path.getsize(file_path)
                            os.remove(file_path)
                            freed_bytes += size
                            deleted_count += 1
                        except OSError:
                            pass
                    
    return jsonify({
        'success': True,
        'freed_bytes': freed_bytes,
        'deleted_count': deleted_count
    })

# ===================================================================
# MANGA ROUTES
# ===================================================================
import database

@app.route('/api/manga/library', methods=['GET', 'POST'])
def api_manga_library():
    if request.method == 'GET':
        library = database.get_manga_library()
        for m in library:
            m['chapters_read_list'] = database.get_manga_chapters_read(m['id'])
        return jsonify({'success': True, 'library': library})
    
    if request.method == 'POST':
        data = request.json
        if not data or not data.get('id'):
            return jsonify({'error': 'Missing manga id'}), 400
        
        success = database.add_manga(
            data['id'],
            data.get('title', 'Unknown'),
            data.get('cover_url', ''),
            data.get('status', 'reading'),
            data.get('total_chapters', 0),
            data.get('genres', '')
        )
        return jsonify({'success': success})

@app.route('/api/manga/library/<manga_id>', methods=['DELETE'])
def api_manga_library_delete(manga_id):
    success = database.remove_manga(manga_id)
    return jsonify({'success': success})

@app.route('/api/manga/chapter/read', methods=['POST'])
def api_manga_chapter_read():
    data = request.json
    if not data or not data.get('manga_id') or not data.get('chapter_id'):
        return jsonify({'error': 'Missing manga_id or chapter_id'}), 400
    
    is_read = data.get('is_read', True)
    success = database.mark_manga_chapter_read(data['manga_id'], data['chapter_id'], is_read)
    return jsonify({'success': success})

if __name__ == '__main__':
    logging.getLogger('werkzeug').setLevel(logging.WARNING)
    print("Starting NovaStream with Webview...")

    # Initialize Discord RPC
    import discord_rpc
    settings = get_all_settings()
    rpc_enabled = settings.get('discord_rpc_enabled', 'false')
    rpc_client_id = settings.get('discord_client_id', '')
    discord_rpc.init(rpc_client_id, rpc_enabled)

    import threading
    import webview
    
    # Start Flask in a background thread
    def start_flask():
        app.run(host='127.0.0.1', port=5000, threaded=True, use_reloader=False)

    threading.Thread(target=start_flask, daemon=True).start()
    
    # Open PyWebView window
    webview.create_window('NovaStream', 'http://127.0.0.1:5000', width=1280, height=800, background_color='#0B0B0E')
    webview.start()

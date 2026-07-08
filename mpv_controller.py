import os
import sys
import json
import time
import threading
import subprocess
import urllib.request
import logging
from database import update_watch_progress, get_watch_progress, mark_episode_watched

logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    app_path = os.path.dirname(sys.executable)
else:
    app_path = os.path.dirname(os.path.abspath(__file__))

MPV_PATH = os.path.join(app_path, 'MPV', 'mpv.exe')
UPSCALE_PATH = os.path.join(app_path, 'Upscale', 'Anime4K_v4.0')
PIPE_NAME = r'\\.\pipe\mpv_novastream_ipc'

_mpv_process = None
_mpv_pipe = None
_mpv_thread = None
_current_video_id = None
_current_duration = 0
_current_skips = []
_current_anime_id = None
_current_anime_id = None
_current_episode_num = None
_already_marked_watched = False
_next_episode_requested = False
_stop_event = threading.Event()

def get_aniskip(anilist_id, episode_num):
    """Fetch skip times from AniSkip API using MAL/AniList ID."""
    if not anilist_id or not str(anilist_id).isdigit():
        return []
        
    try:
        # Note: AniSkip usually takes MAL ID. We can try AniList ID and see if it works,
        # but often it requires MAL ID. For now, we try Anilist ID directly as a fallback.
        # Ideally, we should resolve AniList ID to MAL ID via GraphQL.
        url = f"https://api.aniskip.com/v2/skip-times/{anilist_id}/{episode_num}?types=op&types=ed&episodeLength=0"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data.get("found"):
                return data.get("results", [])
    except Exception as e:
        logger.error(f"AniSkip error: {e}")
    return []

def _mpv_listener():
    global _mpv_pipe, _current_video_id, _current_duration, _current_skips, _current_anime_id, _current_episode_num, _already_marked_watched, _next_episode_requested, _current_title
    last_save_time = 0
    
    while not _stop_event.is_set():
        try:
            line = _mpv_pipe.readline()
            if not line:
                break # Pipe closed
            
            event = json.loads(line.decode('utf-8'))
            
            if 'event' in event:
                ev_name = event['event']
                if ev_name == 'file-loaded':
                    # Request duration
                    _send_cmd({"command": ["get_property", "duration"]})
                
                elif ev_name == 'end-file':
                    reason = event.get('reason')
                    if reason == 'eof':
                        # Mark as fully watched
                        if _current_video_id and _current_duration > 0:
                            update_watch_progress(_current_video_id, _current_duration, _current_duration, True)
                            if _current_anime_id and _current_episode_num:
                                try:
                                    mark_episode_watched(_current_anime_id, _current_episode_num, True)
                                    
                                    # Trigger smart download via API if it's a downloaded file
                                    if not str(_current_video_path).startswith('http'):
                                        import requests, threading
                                        threading.Thread(target=lambda: requests.post('http://127.0.0.1:5000/api/library/episode/watch', json={
                                            'anime_id': _current_anime_id,
                                            'episode_number': _current_episode_num,
                                            'watched': True,
                                            'is_local': True
                                        })).start()
                                except Exception as err:
                                    logger.error(f"Failed to auto mark episode watched: {err}")
                    
                    import discord_rpc
                    discord_rpc.clear_presence()
                    
                    _current_video_id = None
                    _current_skips = []
                    _current_anime_id = None
                    _current_episode_num = None
                    _already_marked_watched = False
                    _current_title = None
                    
                elif ev_name == 'property-change':
                    prop = event.get('name')
                    val = event.get('data')
                    
                    if prop == 'path' and val == 'novastream://next_ep':
                        _next_episode_requested = True
                        _send_cmd({"command": ["quit"]})
                    
                    elif prop == 'duration' and val:
                        _current_duration = float(val)
                    
                    elif prop == 'time-pos' and val:
                        pos = float(val)
                        
                        # Auto-skip intro/outro
                        for skip in _current_skips:
                            start = skip['interval']['startTime']
                            end = skip['interval']['endTime']
                            if start <= pos < end:
                                logger.info(f"Auto-skipping from {pos} to {end}")
                                _send_cmd({"command": ["set_property", "time-pos", end]})
                                break
                        
                        # Save progress every 15 seconds (respects Discord RPC rate limit)
                        now = time.time()
                        if now - last_save_time > 15 and _current_video_id and _current_duration > 0:
                            is_watched = pos >= (_current_duration * 0.85)
                            update_watch_progress(_current_video_id, pos, _current_duration, is_watched)
                            
                            # Discord RPC Update
                            import discord_rpc
                            try:
                                if _current_title is None and _current_anime_id:
                                    from database import get_library_anime
                                    anime = get_library_anime(_current_anime_id)
                                    _current_title = anime['title'] if anime else _current_anime_id
                                title = _current_title
                                details = f"Watching {title}" if title else "Watching Anime"
                                state = f"Episode {_current_episode_num}" if _current_episode_num else ""
                                start_t = int(time.time() - pos)
                                end_t = int(start_t + _current_duration)
                                discord_rpc.update_presence(
                                    details=details,
                                    state=state,
                                    start_time=start_t,
                                    end_time=end_t,
                                    large_image="novastream_logo",
                                    large_text="NovaStream"
                                )
                            except Exception as e:
                                logger.error(f"Discord RPC error: {e}")
                                
                            last_save_time = now

                            if is_watched and _current_anime_id and _current_episode_num and not _already_marked_watched:
                                try:
                                    mark_episode_watched(_current_anime_id, _current_episode_num, True)
                                    _already_marked_watched = True
                                    
                                    # Trigger smart download via API if it's a downloaded file
                                    if not str(_current_video_path).startswith('http'):
                                        import requests, threading
                                        threading.Thread(target=lambda: requests.post('http://127.0.0.1:5000/api/library/episode/watch', json={
                                            'anime_id': _current_anime_id,
                                            'episode_number': _current_episode_num,
                                            'watched': True,
                                            'is_local': True
                                        })).start()
                                        

                                except Exception as err:
                                    logger.error(f"Failed to auto mark episode watched: {err}")
                            last_save_time = now

        except Exception as e:
            if not _stop_event.is_set():
                logger.error(f"MPV IPC read error: {e}")
            break
            
    logger.info("MPV listener thread exiting.")
    _mpv_pipe.close()
    _mpv_pipe = None

def _send_cmd(cmd_dict):
    global _mpv_pipe
    if _mpv_pipe:
        try:
            msg = json.dumps(cmd_dict) + "\n"
            _mpv_pipe.write(msg.encode('utf-8'))
            _mpv_pipe.flush()
        except Exception as e:
            logger.error(f"MPV send error: {e}")

def play_video(video_id, path, anime_id=None, episode_num=None):
    global _mpv_process, _mpv_pipe, _mpv_thread, _current_video_id, _current_skips, _stop_event, _current_anime_id, _current_episode_num, _already_marked_watched, _next_episode_requested, _current_title
    
    # Check if MPV is already running
    if _mpv_process and _mpv_process.poll() is None:
        # Just load the new file
        _current_video_id = video_id
        _current_anime_id = anime_id
        _current_episode_num = episode_num
        _already_marked_watched = False
        _next_episode_requested = False
        _current_title = None
        
        # Load progress
        prog = get_watch_progress(video_id)
        start_time = prog['progress_time'] if prog else 0
        
        # Fetch AniSkip
        _current_skips = get_aniskip(anime_id, episode_num) if anime_id and episode_num else []
        
        _send_cmd({"command": ["loadfile", path]})
        _send_cmd({"command": ["loadfile", "novastream://next_ep", "append"]})
        if start_time > 0:
            _send_cmd({"command": ["set_property", "time-pos", start_time]})
            
        # Bring to front
        return {"status": "ok", "message": "Loaded in existing player"}
    
    # Launch new MPV process
    _stop_event.clear()
    _current_video_id = video_id
    _current_anime_id = anime_id
    _current_episode_num = episode_num
    _already_marked_watched = False
    _next_episode_requested = False
    _current_title = None
    
    prog = get_watch_progress(video_id)
    start_time = prog['progress_time'] if prog else 0
    _current_skips = get_aniskip(anime_id, episode_num) if anime_id and episode_num else []
    
    cmd = [
        MPV_PATH,
        f'--input-ipc-server={PIPE_NAME}',
        '--ontop',
        '--vo=gpu', 
    ]
    
    script_path = os.path.join(app_path, 'MPV', 'mpv', 'scripts', 'skip_intro.lua')
    if os.path.exists(script_path):
        cmd.append(f'--script={script_path}')
    
    if start_time > 0:
        cmd.append(f'--start={start_time}')
        
    # Enable Anime4K if available
    shader_path = os.path.join(UPSCALE_PATH, "GLSL_Mac_Linux_High-end", "Anime4K_Restore_CNN_VL.glsl")
    if os.path.exists(shader_path):
        # Temporarily disabled: Anime4K + some GPUs causes a hard crash (mpv.DMP)
        # cmd.append(f'--glsl-shaders={shader_path}')
        logger.warning(f"Anime4K shader found but disabled to prevent hardware crash.")
    else:
        logger.warning(f"Anime4K shader not found at {shader_path}, skipping upscaling.")
    
    cmd.append(path)
    cmd.append("novastream://next_ep")
    
    kwargs = {}
        
    _mpv_process = subprocess.Popen(cmd, **kwargs)
    
    # Wait for pipe to be created
    time.sleep(1)
    
    try:
        _mpv_pipe = open(PIPE_NAME, 'r+b')
    except Exception as e:
        logger.error(f"Failed to connect to MPV IPC: {e}")
        return {"status": "error", "error": "Could not connect to player"}
        
    # Request property observations
    _send_cmd({"command": ["observe_property", 1, "time-pos"]})
    _send_cmd({"command": ["observe_property", 2, "duration"]})
    _send_cmd({"command": ["observe_property", 3, "path"]})
    
    # Start listener thread
    _mpv_thread = threading.Thread(target=_mpv_listener, daemon=True)
    _mpv_thread.start()
    
    return {"status": "ok", "message": "Player started"}

def get_player_status():
    global _mpv_process, _current_video_id, _next_episode_requested
    is_running = _mpv_process is not None and _mpv_process.poll() is None
    return {
        "running": is_running,
        "video_id": _current_video_id if is_running else None,
        "next_requested": _next_episode_requested
    }

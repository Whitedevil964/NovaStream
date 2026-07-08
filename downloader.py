import yt_dlp
import os
import uuid
import re
import logging
import time

PAUSE_FLAGS = {}
CANCEL_FLAGS = {}

# ── DNS over HTTPS Interceptor for Hijacked/Blocked Domains ──
import socket
import urllib.request
import json
import ssl

RESOLVED_CACHE = {}
original_getaddrinfo = socket.getaddrinfo

def resolve_doh(hostname):
    urls = [
        f"https://cloudflare-dns.com/dns-query?name={hostname}&type=A",
        f"https://dns.google/resolve?name={hostname}&type=A"
    ]
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    for url in urls:
        try:
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/dns-json"}
            )
            with urllib.request.urlopen(req, context=ctx, timeout=3) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    answers = data.get("Answer", [])
                    ips = []
                    for ans in answers:
                        if ans.get("type") == 1: # A record
                            ips.append(ans.get("data"))
                    if ips:
                        return ips
        except Exception:
            continue
    return None

def custom_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    target_domains = ["kaa.lt", "krussdomi.com", "gogoanimes.cv", "hianime.to", "kickassanime.ro", "aniwatch.co.at"]
    is_target = any(domain in host for domain in target_domains)
    
    if is_target:
        if host in RESOLVED_CACHE:
            ips = RESOLVED_CACHE[host]
        else:
            ips = resolve_doh(host)
            if ips:
                RESOLVED_CACHE[host] = ips
            else:
                ips = []
        
        if ips:
            results = []
            for ip in ips:
                results.append((socket.AF_INET, type, proto, '', (ip, port)))
            return results
        else:
            raise socket.gaierror(socket.EAI_NONAME, "Name or service not known")
            
    return original_getaddrinfo(host, port, family, type, proto, flags)

socket.getaddrinfo = custom_getaddrinfo
# ─────────────────────────────────────────────────────────────

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

QUALITY_MAP = {
    '8k': 'bestvideo[height<=4320]+bestaudio/best',
    '4k': 'bestvideo[height<=2160]+bestaudio/best',
    '1440p': 'bestvideo[height<=1440]+bestaudio/best',
    '1080p': 'bestvideo[height<=1080]+bestaudio/best',
    '720p': 'bestvideo[height<=720]+bestaudio/best',
    '480p': 'bestvideo[height<=480]+bestaudio/best',
    '360p': 'bestvideo[height<=360]+bestaudio/best',
    'best': 'bestvideo+bestaudio/best',
}

QUALITY_HEIGHT_MAP = {
    '8k': 4320,
    '4k': 2160,
    '1440p': 1440,
    '1080p': 1080,
    '720p': 720,
    '480p': 480,
    '360p': 360,
}


def sanitize_filename(filename):
    """Remove invalid characters for Windows filenames."""
    if not filename:
        return "untitled"
    sanitized = re.sub(r'[<>:"/\\|?*]', '', filename)
    sanitized = sanitized.strip('. ')
    if not sanitized:
        return "untitled"
    if len(sanitized) > 200:
        sanitized = sanitized[:200]
    return sanitized


def format_duration(seconds):
    """Convert seconds to HH:MM:SS string."""
    if seconds is None or seconds == 0:
        return "00:00:00"
    try:
        seconds = int(seconds)
    except (ValueError, TypeError):
        return "00:00:00"
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def is_playlist_url(url):
    """Check if a URL is a playlist (contains 'list=' param)."""
    if not url:
        return False
    return 'list=' in url


def get_video_info(url):
    """
    Uses yt_dlp to extract info WITHOUT downloading.
    Returns dict with video metadata and available qualities.
    """
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': 'in_playlist' if is_playlist_url(url) else False,
            'skip_download': True,
            'no_color': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info is None:
            return {'error': 'Could not extract video information'}

        is_playlist = info.get('_type') == 'playlist' or 'entries' in info

        if is_playlist:
            entries = list(info.get('entries', []))
            return {
                'id': info.get('id', ''),
                'title': info.get('title', 'Unknown Playlist'),
                'thumbnail': info.get('thumbnails', [{}])[-1].get('url', '') if info.get('thumbnails') else '',
                'duration': format_duration(info.get('duration', 0)),
                'channel': info.get('uploader', info.get('channel', 'Unknown')),
                'view_count': info.get('view_count', 0),
                'upload_date': info.get('upload_date', ''),
                'available_qualities': list(QUALITY_MAP.keys()),
                'is_playlist': True,
                'playlist_count': len(entries),
            }

        # Determine max video height from available formats
        max_height = 0
        formats = info.get('formats', [])
        for fmt in formats:
            h = fmt.get('height')
            if h and isinstance(h, int) and h > max_height:
                max_height = h

        # Filter available qualities based on actual video height
        available_qualities = ['best']
        for label, height in QUALITY_HEIGHT_MAP.items():
            if max_height >= height:
                available_qualities.append(label)

        # Sort by resolution descending
        quality_order = ['8k', '4k', '1440p', '1080p', '720p', '480p', '360p', 'best']
        available_qualities = [q for q in quality_order if q in available_qualities]

        thumbnail = ''
        thumbnails = info.get('thumbnails', [])
        if thumbnails:
            thumbnail = thumbnails[-1].get('url', '')
        if not thumbnail:
            thumbnail = info.get('thumbnail', '')

        return {
            'id': info.get('id', ''),
            'title': info.get('title', 'Unknown'),
            'thumbnail': thumbnail,
            'duration': format_duration(info.get('duration', 0)),
            'channel': info.get('uploader', info.get('channel', 'Unknown')),
            'view_count': info.get('view_count', 0),
            'upload_date': info.get('upload_date', ''),
            'available_qualities': available_qualities,
            'is_playlist': False,
            'playlist_count': 0,
        }

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error fetching info for {url}: {e}")
        return {'error': f'Failed to fetch video info: {str(e)}'}
    except Exception as e:
        logger.error(f"Unexpected error fetching info for {url}: {e}")
        return {'error': f'An unexpected error occurred: {str(e)}'}


def get_playlist_info(url):
    """
    Extract playlist info with extract_flat=True.
    Returns dict with playlist metadata and list of entries.
    """
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'skip_download': True,
            'no_color': True,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if info is None:
            return {'error': 'Could not extract playlist information'}

        entries = []
        raw_entries = info.get('entries', [])
        for entry in raw_entries:
            if entry is None:
                continue
            entry_thumbnail = ''
            entry_thumbnails = entry.get('thumbnails', [])
            if entry_thumbnails:
                entry_thumbnail = entry_thumbnails[-1].get('url', '')
            if not entry_thumbnail:
                entry_thumbnail = entry.get('thumbnail', '')

            entry_url = entry.get('url', '')
            if not entry_url:
                video_id = entry.get('id', '')
                if video_id:
                    entry_url = f'https://www.youtube.com/watch?v={video_id}'

            entries.append({
                'id': entry.get('id', ''),
                'title': entry.get('title', 'Unknown'),
                'url': entry_url,
                'duration': format_duration(entry.get('duration', 0)),
                'thumbnail': entry_thumbnail,
            })

        return {
            'title': info.get('title', 'Unknown Playlist'),
            'id': info.get('id', ''),
            'playlist_count': len(entries),
            'entries': entries,
        }

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error fetching playlist info for {url}: {e}")
        return {'error': f'Failed to fetch playlist info: {str(e)}'}
    except Exception as e:
        logger.error(f"Unexpected error fetching playlist info for {url}: {e}")
        return {'error': f'An unexpected error occurred: {str(e)}'}


def _format_speed(speed_bytes):
    """Format speed in bytes/sec to a human-readable string."""
    if speed_bytes is None:
        return 'N/A'
    try:
        speed = float(speed_bytes)
    except (ValueError, TypeError):
        return 'N/A'
    if speed < 1024:
        return f"{speed:.0f} B/s"
    elif speed < 1024 * 1024:
        return f"{speed / 1024:.1f} KB/s"
    else:
        return f"{speed / (1024 * 1024):.2f} MB/s"


def _format_eta(eta_seconds):
    """Format ETA in seconds to a human-readable string."""
    if eta_seconds is None:
        return 'N/A'
    try:
        eta = int(eta_seconds)
    except (ValueError, TypeError):
        return 'N/A'
    if eta < 60:
        return f"{eta}s"
    elif eta < 3600:
        return f"{eta // 60}m {eta % 60}s"
    else:
        return f"{eta // 3600}h {(eta % 3600) // 60}m"


def _format_size(size_bytes):
    """Format bytes to human-readable size string."""
    if size_bytes is None or size_bytes == 0:
        return '0 B'
    try:
        size = float(size_bytes)
    except (ValueError, TypeError):
        return '0 B'
    if size < 1024:
        return f"{size:.0f} B"
    elif size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    elif size < 1024 * 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} MB"
    else:
        return f"{size / (1024 * 1024 * 1024):.2f} GB"


def _get_progress_info(d):
    """Helper to extract progress and sizes, especially handling fragmented HLS downloads."""
    total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
    downloaded = d.get('downloaded_bytes', 0)
    
    frag_index = d.get('fragment_index')
    frag_count = d.get('fragment_count')
    
    if frag_count and frag_count > 0 and frag_index is not None:
        progress = (frag_index / frag_count) * 100
        if downloaded == 0 and total > 0:
            downloaded = total * (frag_index / frag_count)
    else:
        progress = (downloaded / total * 100) if total > 0 else 0.0
        
    return progress, downloaded, total


def download_video(url, quality='best', output_dir='downloads', progress_callback=None, download_id=None):
    """
    Downloads video as MP4 with the specified quality.
    progress_callback receives (download_id, status_dict).
    """
    if download_id is None:
        download_id = str(uuid.uuid4())

    os.makedirs(output_dir, exist_ok=True)

    format_str = QUALITY_MAP.get(quality, QUALITY_MAP['best'])
    output_template = '%(title)s.%(ext)s'

    video_title = 'Unknown'

    def progress_hook(d):
        nonlocal video_title
        
        while PAUSE_FLAGS.get(download_id, False):
            if CANCEL_FLAGS.get(download_id, False):
                raise ValueError("Download cancelled by user")
            time.sleep(1)
            
        if CANCEL_FLAGS.get(download_id, False):
            raise ValueError("Download cancelled by user")
            
        if d.get('info_dict', {}).get('title'):
            video_title = d['info_dict']['title']

        status = d.get('status', '')

        if status == 'downloading':
            progress, downloaded, total = _get_progress_info(d)

            status_dict = {
                'status': 'downloading',
                'progress': round(progress, 2),
                'speed': _format_speed(d.get('speed')),
                'eta': _format_eta(d.get('eta')),
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(downloaded),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'finished':
            total = d.get('total_bytes') or d.get('downloaded_bytes') or 0
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(total),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'error':
            status_dict = {
                'status': 'error',
                'progress': 0.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': '',
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    def postprocessor_hook(d):
        status = d.get('status', '')
        if status == 'started':
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'Merging...',
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)
    import tempfile
    temp_dir = os.path.join(tempfile.gettempdir(), "NovaStream_temp")
    os.makedirs(temp_dir, exist_ok=True)

    ydl_opts = {
        'format': format_str,
        'outtmpl': output_template,
        'merge_output_format': 'mp4',
        'progress_hooks': [progress_hook],
        'postprocessor_hooks': [postprocessor_hook],
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'noplaylist': True,
        'overwrites': True,
        'concurrent_fragment_downloads': 5,
        'paths': {
            'home': os.path.abspath(output_dir),
            'temp': temp_dir
        },
        'keepvideo': False,
        'nokeep_fragments': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Ensure finished status is sent
        status_dict = {
            'status': 'finished',
            'progress': 100.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)

        return {'success': True, 'download_id': download_id, 'title': video_title}

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error for {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}

    except Exception as e:
        logger.error(f"Unexpected error downloading {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}


def download_audio(url, output_dir='downloads', progress_callback=None, download_id=None):
    """
    Downloads and converts to MP3 at 320kbps.
    progress_callback receives (download_id, status_dict).
    """
    if download_id is None:
        download_id = str(uuid.uuid4())

    os.makedirs(output_dir, exist_ok=True)

    output_template = os.path.join(output_dir, '%(title)s.%(ext)s')
    video_title = 'Unknown'

    def progress_hook(d):
        nonlocal video_title
        
        while PAUSE_FLAGS.get(download_id, False):
            if CANCEL_FLAGS.get(download_id, False):
                raise ValueError("Download cancelled by user")
            time.sleep(1)
            
        if CANCEL_FLAGS.get(download_id, False):
            raise ValueError("Download cancelled by user")
            
        if d.get('info_dict', {}).get('title'):
            video_title = d['info_dict']['title']

        status = d.get('status', '')

        if status == 'downloading':
            progress, downloaded, total = _get_progress_info(d)

            status_dict = {
                'status': 'downloading',
                'progress': round(progress, 2),
                'speed': _format_speed(d.get('speed')),
                'eta': _format_eta(d.get('eta')),
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(downloaded),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'finished':
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'Converting to MP3...',
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(d.get('total_bytes') or d.get('downloaded_bytes') or 0),
                'total_size': _format_size(d.get('total_bytes') or d.get('downloaded_bytes') or 0),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'error':
            status_dict = {
                'status': 'error',
                'progress': 0.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': '',
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    def postprocessor_hook(d):
        status = d.get('status', '')
        if status == 'started':
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'Converting to MP3...',
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)
        elif status == 'finished':
            status_dict = {
                'status': 'finished',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_template,
        'progress_hooks': [progress_hook],
        'postprocessor_hooks': [postprocessor_hook],
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'noplaylist': True,
        'overwrites': True,
        'postprocessors': [
            {
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '320',
            },
        ],
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        status_dict = {
            'status': 'finished',
            'progress': 100.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)

        return {'success': True, 'download_id': download_id, 'title': video_title}

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error for audio {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}

    except Exception as e:
        logger.error(f"Unexpected error downloading audio {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}


def download_playlist(url, format_type='video', quality='best', output_dir='downloads',
                      progress_callback=None, download_id=None):
    """
    Downloads an entire playlist.
    format_type: 'video' or 'audio'
    progress_callback receives (download_id, status_dict) where progress reflects
    overall playlist completion combined with individual video progress.
    """
    if download_id is None:
        download_id = str(uuid.uuid4())

    os.makedirs(output_dir, exist_ok=True)

    # First, get playlist metadata to know total video count
    try:
        flat_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,
            'skip_download': True,
            'no_color': True,
        }
        with yt_dlp.YoutubeDL(flat_opts) as ydl:
            playlist_meta = ydl.extract_info(url, download=False)

        total_videos = len(list(playlist_meta.get('entries', [])))
        if total_videos == 0:
            total_videos = 1
        playlist_title = playlist_meta.get('title', 'Unknown Playlist')
    except Exception:
        total_videos = 1
        playlist_title = 'Unknown Playlist'

    current_video_index = {'value': 0}
    current_video_title = {'value': playlist_title}

    output_template = '%(playlist_title)s/%(playlist_index)s - %(title)s.%(ext)s'

    def progress_hook(d):
        while PAUSE_FLAGS.get(download_id, False):
            if CANCEL_FLAGS.get(download_id, False):
                raise ValueError("Download cancelled by user")
            time.sleep(1)
            
        if CANCEL_FLAGS.get(download_id, False):
            raise ValueError("Download cancelled by user")
            
        if d.get('info_dict', {}).get('title'):
            current_video_title['value'] = d['info_dict']['title']

        # Detect video index from info_dict
        info = d.get('info_dict', {})
        pi = info.get('playlist_index') or info.get('playlist_autonumber')
        if pi:
            try:
                current_video_index['value'] = int(pi)
            except (ValueError, TypeError):
                pass

        status = d.get('status', '')
        idx = max(current_video_index['value'], 1)

        if status == 'downloading':
            video_progress, downloaded, total = _get_progress_info(d)

            # Overall progress: completed videos + fraction of current video
            overall = ((idx - 1) / total_videos * 100) + (video_progress / total_videos)
            overall = min(overall, 100.0)

            status_dict = {
                'status': 'downloading',
                'progress': round(overall, 2),
                'speed': _format_speed(d.get('speed')),
                'eta': _format_eta(d.get('eta')),
                'filename': d.get('filename', ''),
                'title': current_video_title['value'],
                'playlist_title': playlist_title,
                'current_video': idx,
                'total_videos': total_videos,
                'downloaded_size': _format_size(downloaded),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'finished':
            overall = (idx / total_videos) * 100
            overall = min(overall, 100.0)
            total = d.get('total_bytes') or d.get('downloaded_bytes') or 0

            pp_status = 'processing' if idx < total_videos or format_type == 'audio' else 'processing'
            status_dict = {
                'status': pp_status,
                'progress': round(overall, 2),
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': d.get('filename', ''),
                'title': current_video_title['value'],
                'playlist_title': playlist_title,
                'current_video': idx,
                'total_videos': total_videos,
                'downloaded_size': _format_size(total),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'error':
            status_dict = {
                'status': 'error',
                'progress': 0.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': '',
                'title': current_video_title['value'],
                'playlist_title': playlist_title,
                'current_video': idx,
                'total_videos': total_videos,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    def postprocessor_hook(d):
        status = d.get('status', '')
        idx = max(current_video_index['value'], 1)
        if status == 'started':
            overall = ((idx - 1) / total_videos * 100) + (100.0 / total_videos)
            overall = min(overall, 100.0)
            pp_msg = 'Merging...' if format_type == 'video' else 'Converting to MP3...'
            status_dict = {
                'status': 'processing',
                'progress': round(overall, 2),
                'speed': 'N/A',
                'eta': pp_msg,
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': current_video_title['value'],
                'playlist_title': playlist_title,
                'current_video': idx,
                'total_videos': total_videos,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)
        elif status == 'finished':
            overall = (idx / total_videos) * 100
            overall = min(overall, 100.0)
            final_status = 'finished' if idx >= total_videos else 'downloading'
            status_dict = {
                'status': final_status,
                'progress': round(overall, 2),
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': current_video_title['value'],
                'playlist_title': playlist_title,
                'current_video': idx,
                'total_videos': total_videos,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    if format_type == 'audio':
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': output_template,
            'progress_hooks': [progress_hook],
            'postprocessor_hooks': [postprocessor_hook],
            'quiet': True,
            'no_warnings': True,
            'no_color': True,
            'noplaylist': False,
            'yes_playlist': True,
            'overwrites': True,
            'ignoreerrors': True,
            'postprocessors': [
                {
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '320',
                },
            ],
        }
    else:
        import tempfile
        temp_dir = os.path.join(tempfile.gettempdir(), "NovaStream_temp")
        os.makedirs(temp_dir, exist_ok=True)

        ydl_opts = {
            'format': format_str,
            'outtmpl': output_template,
            'merge_output_format': 'mp4',
            'progress_hooks': [progress_hook],
            'postprocessor_hooks': [postprocessor_hook],
            'quiet': True,
            'no_warnings': True,
            'no_color': True,
            'noplaylist': False,
            'yes_playlist': True,
            'overwrites': True,
            'ignoreerrors': True,
            'concurrent_fragment_downloads': 5,
            'paths': {
                'home': os.path.abspath(output_dir),
                'temp': temp_dir
            }
        }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        status_dict = {
            'status': 'finished',
            'progress': 100.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': playlist_title,
            'playlist_title': playlist_title,
            'current_video': total_videos,
            'total_videos': total_videos,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)

        return {'success': True, 'download_id': download_id, 'title': playlist_title}

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error for playlist {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': playlist_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}

    except Exception as e:
        logger.error(f"Unexpected error downloading playlist {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': playlist_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}


def download_subtitle(sub_url, output_path, referer=None):
    """Download subtitle file (typically VTT) to output_path."""
    import urllib.request
    import ssl
    
    # Normalize URL if it is protocol relative or malformed
    if sub_url.startswith('//'):
        sub_url = 'https:' + sub_url
    elif sub_url.startswith('https:////'):
        sub_url = sub_url.replace('https:////', 'https://')
    elif sub_url.startswith('https:///'):
        sub_url = sub_url.replace('https:///', 'https://')
        
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        if referer:
            headers['Referer'] = referer
            
        req = urllib.request.Request(
            sub_url,
            headers=headers
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(req, context=ctx, timeout=15) as response:
            if response.status == 200:
                with open(output_path, 'wb') as f:
                    f.write(response.read())
                return True
    except Exception as e:
        logger.error(f"Failed to download subtitle from {sub_url}: {e}")
    return False


def test_manifest_host(hostname, test_path, headers):
    import urllib.request
    import ssl
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    url = f"https://{hostname}{test_path}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=ctx, timeout=5) as res:
            if res.status == 200:
                return True
    except urllib.error.HTTPError as e:
        logger.warning(f"test_manifest_host {hostname} returned HTTP error: {e.code}")
    except Exception as e:
        logger.warning(f"test_manifest_host {hostname} failed with error: {e}")
    return False


def prepare_local_m3u8(master_url, referer, temp_dir, custom_headers=None):
    """
    Downloads the master manifest and its playlist files, rewriting segment
    hostnames to the first working hostname that doesn't return 403.
    Returns the file:// URL of the local master manifest.
    """
    import urllib.request
    import ssl
    import re
    import os
    
    os.makedirs(temp_dir, exist_ok=True)
    
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    headers = {
        'Referer': referer or 'https://kaa.lt/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    if custom_headers:
        headers.update(custom_headers)
    
    # 1. Fetch master manifest
    try:
        req = urllib.request.Request(master_url, headers=headers)
        master_content = urllib.request.urlopen(req, context=ctx, timeout=10).read().decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to fetch master manifest from {master_url}: {e}")
        return master_url
    
    base_url = master_url.rsplit('/', 1)[0] + '/'
    
    # Find all relative URIs in master
    relative_uris = re.findall(r'(?:URI="([^"]+)"|^(?!#)(.+)$)', master_content, re.MULTILINE)
    uris = []
    for match in relative_uris:
        val = match[0] or match[1]
        if val and not val.startswith('http'):
            uris.append(val.strip())
            
    # 2. Fetch playlists
    playlist_contents = {}
    
    for uri in uris:
        abs_url = base_url + uri
        try:
            req = urllib.request.Request(abs_url, headers=headers)
            content = urllib.request.urlopen(req, context=ctx, timeout=10).read().decode('utf-8')
            playlist_contents[uri] = content
        except Exception as e:
            logger.error(f"Failed to fetch playlist from {abs_url}: {e}")
            continue
            
    if not playlist_contents:
        logger.warning("No playlist manifests could be downloaded, falling back to original master URL")
        return master_url
        
    # Determine the working host
    working_host = None
    tested_hosts = {} # cache: host -> bool
    
    for content in playlist_contents.values():
        if working_host:
            break
        # Find segment hostnames
        segments = re.findall(r'^(?!#)(.+)$', content, re.MULTILINE)
        for seg in segments:
            seg = seg.strip()
            if seg.startswith('//'):
                seg = 'https:' + seg
            if seg.startswith('http'):
                # Extract host and path
                parts = seg.split('//', 1)[1].split('/', 1)
                host = parts[0]
                # Strip query parameters from the path for the segment check
                path = '/' + parts[1].split('?')[0]
                
                # Check host status in cache to prevent duplicate slow checks
                if host in tested_hosts:
                    if tested_hosts[host]:
                        working_host = host
                        break
                    continue
                
                # Test if this host works
                if test_manifest_host(host, path, headers):
                    tested_hosts[host] = True
                    working_host = host
                    break
                else:
                    tested_hosts[host] = False
                        
    if not working_host:
        logger.warning("No working segment host found, falling back to original master URL")
        return master_url
        
    # 3. Rewrite playlists and save them locally
    for uri, content in playlist_contents.items():
        clean_uri = uri.split('?', 1)[0].strip()
        local_path = os.path.join(temp_dir, clean_uri.replace('/', os.sep))
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        # Rewrite hosts
        lines = content.split('\n')
        new_lines = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith('//') or stripped.startswith('http'):
                if stripped.startswith('//'):
                    stripped = 'https:' + stripped
                # Strip query parameters for actual segment downloads
                path = stripped.split('//', 1)[1].split('/', 1)[1].split('?')[0]
                line = f"https://{working_host}/{path}"
            new_lines.append(line)
            
        with open(local_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_lines))
            
    # 4. Save rewritten master manifest locally
    master_lines = master_content.split('\n')
    new_master_lines = []
    lines_to_skip = set()
    
    for i, line in enumerate(master_lines):
        if i in lines_to_skip:
            continue
            
        stripped = line.strip()
        if not stripped:
            new_master_lines.append(line)
            continue
            
        if stripped.startswith('#EXT-X-MEDIA:'):
            match = re.search(r'URI="([^"]+)"', stripped)
            if match:
                original_uri = match.group(1)
                clean_uri = original_uri.split('?', 1)[0].strip()
                if original_uri in playlist_contents:
                    rewritten_line = stripped.replace(f'URI="{original_uri}"', f'URI="{clean_uri}"')
                    new_master_lines.append(rewritten_line)
                else:
                    logger.warning(f"Omit failed media line: {stripped}")
            else:
                new_master_lines.append(line)
                
        elif stripped.startswith('#EXT-X-STREAM-INF:'):
            next_idx = i + 1
            while next_idx < len(master_lines) and not master_lines[next_idx].strip():
                next_idx += 1
                
            if next_idx < len(master_lines):
                next_line = master_lines[next_idx].strip()
                if not next_line.startswith('#'):
                    original_uri = next_line
                    clean_uri = original_uri.split('?', 1)[0].strip()
                    if original_uri in playlist_contents:
                        new_master_lines.append(line)
                        new_master_lines.append(clean_uri)
                    else:
                        logger.warning(f"Omit failed stream: {line} -> {original_uri}")
                    
                    for skip_idx in range(i + 1, next_idx + 1):
                        lines_to_skip.add(skip_idx)
                else:
                    new_master_lines.append(line)
            else:
                new_master_lines.append(line)
        else:
            new_master_lines.append(line)
            
    master_path = os.path.join(temp_dir, 'master.m3u8')
    with open(master_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(new_master_lines))
        
    # Convert path to file:// URL for yt-dlp
    abs_path = os.path.abspath(master_path).replace('\\', '/')
    if not abs_path.startswith('/'):
        abs_path = '/' + abs_path
    file_url = 'file://' + abs_path
        
    return file_url


def download_anime_episode(url, referer=None, output_dir='downloads', progress_callback=None, download_id=None, filename=None, custom_headers=None):
    """
    Downloads an anime episode stream (.m3u8) using yt_dlp.
    url: the stream m3u8 URL.
    referer: optional Referer header to bypass 403.
    """
    if download_id is None:
        download_id = str(uuid.uuid4())

    os.makedirs(output_dir, exist_ok=True)

    # Use the passed filename or fall back to template
    if filename:
        safe_name = sanitize_filename(filename)
        output_template = f"{safe_name}.%(ext)s"
        video_title = safe_name
    else:
        output_template = '%(title)s.%(ext)s'
        video_title = 'Anime Episode'

    # Check if this is a KickAssAnime manifest that needs host domain rewriting
    local_manifest_dir = None
    if 'krussdomi.com' in url or (referer and 'kaa.lt' in referer):
        try:
            if progress_callback:
                progress_callback(download_id, {
                    'status': 'processing',
                    'progress': 0.0,
                    'speed': 'N/A',
                    'eta': 'Bypassing Cloudflare protection...',
                    'title': video_title,
                })
            temp_name = f"kaa_m3u8_{uuid.uuid4().hex}"
            local_manifest_dir = os.path.join(os.path.dirname(os.path.abspath(output_dir)), 'scratch', temp_name)
            url = prepare_local_m3u8(url, referer, local_manifest_dir, custom_headers=custom_headers)
        except Exception as e:
            logger.error("Failed to prepare local KAA m3u8: %s", e)

    def progress_hook(d):
        nonlocal video_title
        
        while PAUSE_FLAGS.get(download_id, False):
            if CANCEL_FLAGS.get(download_id, False):
                raise ValueError("Download cancelled by user")
            time.sleep(1)
            
        if CANCEL_FLAGS.get(download_id, False):
            raise ValueError("Download cancelled by user")
            
        if d.get('info_dict', {}).get('title'):
            if not filename:
                video_title = d['info_dict']['title']

        status = d.get('status', '')

        if status == 'downloading':
            progress, downloaded, total = _get_progress_info(d)

            status_dict = {
                'status': 'downloading',
                'progress': round(progress, 2),
                'speed': _format_speed(d.get('speed')),
                'eta': _format_eta(d.get('eta')),
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(downloaded),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'finished':
            total = d.get('total_bytes') or d.get('downloaded_bytes') or 0
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': d.get('filename', ''),
                'title': video_title,
                'downloaded_size': _format_size(total),
                'total_size': _format_size(total),
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

        elif status == 'error':
            status_dict = {
                'status': 'error',
                'progress': 0.0,
                'speed': 'N/A',
                'eta': 'N/A',
                'filename': '',
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)

    def postprocessor_hook(d):
        status = d.get('status', '')
        if status == 'started':
            status_dict = {
                'status': 'processing',
                'progress': 100.0,
                'speed': 'N/A',
                'eta': 'Merging stream...',
                'filename': d.get('info_dict', {}).get('filepath', ''),
                'title': video_title,
            }
            if progress_callback:
                progress_callback(download_id, status_dict)
        elif status == 'finished':
            pass

    # Format selector prioritizing Hindi audio, then English, then Japanese, then any audio
    audio_priorities = [
        'bestaudio[language*=hi]',
        'bestaudio[language*=hin]',
        'bestaudio[language*=en]',
        'bestaudio[language*=eng]',
        'bestaudio[language*=ja]',
        'bestaudio[language*=jpn]',
        'bestaudio'
    ]
    format_choices = [f"bestvideo+{ap}" for ap in audio_priorities] + ["best"]
    format_str = "/".join(format_choices)

    import tempfile
    temp_dir = os.path.join(tempfile.gettempdir(), "NovaStream_temp")
    os.makedirs(temp_dir, exist_ok=True)

    ydl_opts = {
        'format': format_str,
        'outtmpl': output_template,
        'merge_output_format': 'mp4',
        'progress_hooks': [progress_hook],
        'postprocessor_hooks': [postprocessor_hook],
        'quiet': True,
        'no_warnings': True,
        'no_color': True,
        'noplaylist': True,
        'overwrites': True,
        'nocheckcertificate': True,
        'enable_file_urls': True,
        'socket_timeout': 15,
        'retries': 5,
        'ratelimit': 3000000, # 3 MB/s to prevent abuse detection
        'sleep_interval_requests': 0.5, # Wait half a second between fragment requests
        'paths': {
            'home': os.path.abspath(output_dir),
            'temp': temp_dir
        },
        'keepvideo': False,
        'nokeep_fragments': True
    }

    ydl_opts['http_headers'] = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    if referer:
        ydl_opts['http_headers']['Referer'] = referer
        
    if custom_headers:
        ydl_opts['http_headers'].update(custom_headers)

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])

        # Ensure finished status is sent
        status_dict = {
            'status': 'finished',
            'progress': 100.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': os.path.join(output_dir, f"{video_title}.mp4"),
            'title': video_title,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)

        return {'success': True, 'download_id': download_id, 'title': video_title}

    except yt_dlp.utils.DownloadError as e:
        logger.error(f"yt-dlp download error for {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}

    except Exception as e:
        logger.error(f"Unexpected error downloading {url}: {e}")
        error_msg = str(e)
        status_dict = {
            'status': 'error',
            'progress': 0.0,
            'speed': 'N/A',
            'eta': 'N/A',
            'filename': '',
            'title': video_title,
            'error': error_msg,
        }
        if progress_callback:
            progress_callback(download_id, status_dict)
        return {'success': False, 'download_id': download_id, 'error': error_msg}
    finally:
        if local_manifest_dir and os.path.exists(local_manifest_dir):
            try:
                import shutil
                shutil.rmtree(local_manifest_dir)
            except Exception:
                pass



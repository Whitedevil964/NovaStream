import time
import logging
import threading

try:
    from pypresence import Presence
    _HAS_PYPRESENCE = True
except ImportError:
    _HAS_PYPRESENCE = False

logger = logging.getLogger(__name__)

_rpc = None
_client_id = None
_enabled = False
_lock = threading.Lock()
_connected = False

def init(client_id, enabled):
    global _client_id, _enabled
    _client_id = client_id
    # Ensure enabled is a boolean
    _enabled = str(enabled).lower() == 'true'
    
    if _enabled:
        threading.Thread(target=_connect, daemon=True).start()
    else:
        clear_presence()
        _disconnect()

def _connect():
    global _rpc, _connected
    with _lock:
        if _connected: return
        if not _HAS_PYPRESENCE:
            logger.error("Discord RPC enabled but pypresence is not installed.")
            return
            
        if not _client_id or str(_client_id).strip() == '':
            logger.warning("Discord RPC enabled but no Client ID provided. Skipping connection.")
            return
            
        try:
            _rpc = Presence(_client_id)
            _rpc.connect()
            _connected = True
            logger.info("Discord RPC connected.")
        except Exception as e:
            logger.error(f"Failed to connect to Discord RPC: {e}")
            _connected = False

def _disconnect():
    global _rpc, _connected
    with _lock:
        if _rpc:
            try:
                _rpc.close()
            except:
                pass
            _rpc = None
        _connected = False
        logger.info("Discord RPC disconnected.")

def update_presence(details, state=None, start_time=None, end_time=None, large_image=None, large_text=None):
    global _connected
    with _lock:
        if not _enabled or not _connected or not _rpc:
            return
            
        try:
            _rpc.update(
                details=details,
                state=state,
                start=start_time,
                end=end_time,
                large_image=large_image,
                large_text=large_text
            )
        except Exception as e:
            logger.error(f"Failed to update Discord presence: {e}")
            _connected = False

def clear_presence():
    global _connected
    with _lock:
        if not _enabled or not _connected or not _rpc:
            return
            
        try:
            _rpc.clear()
        except Exception as e:
            logger.error(f"Failed to clear Discord presence: {e}")
            _connected = False

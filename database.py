"""
NovaStream — SQLite Persistence Layer
Stores download history and application settings.
"""

import sqlite3
import os
import threading
import time
import sys
import logging

logger = logging.getLogger(__name__)

if getattr(sys, 'frozen', False):
    # When compiled, save mutable data in AppData to avoid permission errors
    _data_dir = os.path.join(os.getenv('APPDATA', os.path.expanduser('~')), 'NovaStream')
else:
    _data_dir = os.path.dirname(os.path.abspath(__file__))

os.makedirs(_data_dir, exist_ok=True)
DB_PATH = os.path.join(_data_dir, 'NovaStream.db')

_local = threading.local()


def _get_conn():
    """Get a thread-local SQLite connection."""
    if not hasattr(_local, 'conn') or _local.conn is None:
        _local.conn = sqlite3.connect(DB_PATH, check_same_thread=False)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn


def init_db():
    """Create tables if they don't exist."""
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS downloads (
            id              TEXT PRIMARY KEY,
            url             TEXT NOT NULL,
            title           TEXT DEFAULT '',
            format          TEXT DEFAULT 'video',
            quality         TEXT DEFAULT 'best',
            status          TEXT DEFAULT 'queued',
            filename        TEXT DEFAULT '',
            filepath        TEXT DEFAULT '',
            filesize        INTEGER DEFAULT 0,
            error           TEXT DEFAULT '',
            created_at      REAL NOT NULL,
            completed_at    REAL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key     TEXT PRIMARY KEY,
            value   TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);

        CREATE TABLE IF NOT EXISTS achievements_unlocked (
            id              TEXT PRIMARY KEY,
            unlocked_at     REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS anime_notes (
            anime_id        TEXT NOT NULL,
            episode_number  INTEGER NOT NULL,
            note            TEXT,
            rating          INTEGER,
            updated_at      REAL NOT NULL,
            PRIMARY KEY (anime_id, episode_number)
        );
        CREATE INDEX IF NOT EXISTS idx_downloads_created ON downloads(created_at DESC);

        CREATE TABLE IF NOT EXISTS anime_library (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            provider        TEXT,
            poster          TEXT,
            status          TEXT DEFAULT 'plan_to_watch',
            total_episodes  INTEGER DEFAULT 0,
            watched_episodes INTEGER DEFAULT 0,
            genres          TEXT DEFAULT '',
            added_at        REAL NOT NULL,
            updated_at      REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS anime_episodes_watched (
            anime_id        TEXT NOT NULL,
            episode_number  INTEGER NOT NULL,
            watched_at      REAL NOT NULL,
            PRIMARY KEY (anime_id, episode_number),
            FOREIGN KEY (anime_id) REFERENCES anime_library(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS manga_library (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            cover_url       TEXT,
            status          TEXT DEFAULT 'reading',
            total_chapters  INTEGER DEFAULT 0,
            read_chapters   INTEGER DEFAULT 0,
            genres          TEXT DEFAULT '',
            added_at        REAL NOT NULL,
            updated_at      REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS manga_chapters_read (
            manga_id        TEXT NOT NULL,
            chapter_id      TEXT NOT NULL,
            read_at         REAL NOT NULL,
            PRIMARY KEY (manga_id, chapter_id),
            FOREIGN KEY (manga_id) REFERENCES manga_library(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS watch_history (
            video_id        TEXT PRIMARY KEY,
            progress_time   REAL DEFAULT 0,
            duration        REAL DEFAULT 0,
            is_watched      BOOLEAN DEFAULT 0,
            updated_at      REAL NOT NULL
        );

    """)
    try:
        conn.execute("ALTER TABLE anime_library ADD COLUMN genres TEXT DEFAULT '';")
    except sqlite3.OperationalError:
        pass # Column already exists
    conn.commit()
    logger.info("Database initialized at %s", DB_PATH)


# ─── Download History ────────────────────────────────────────────────────────

def add_download(download_id, url, title='', fmt='video', quality='best'):
    """Insert a new download record."""
    conn = _get_conn()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO downloads
               (id, url, title, format, quality, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'queued', ?)""",
            (download_id, url, title, fmt, quality, time.time())
        )
        conn.commit()
    except sqlite3.Error as e:
        logger.error("DB add_download error: %s", e)


def update_download(download_id, **kwargs):
    """Update fields on a download record. Pass any column as a kwarg."""
    if not kwargs:
        return
    conn = _get_conn()
    allowed = {'title', 'status', 'filename', 'filepath', 'filesize', 'error', 'completed_at'}
    filtered = {k: v for k, v in kwargs.items() if k in allowed}
    if not filtered:
        return

    # Auto-set completed_at when status is finished
    if filtered.get('status') == 'finished' and 'completed_at' not in filtered:
        filtered['completed_at'] = time.time()

    set_clause = ', '.join(f"{k} = ?" for k in filtered)
    values = list(filtered.values()) + [download_id]

    try:
        conn.execute(f"UPDATE downloads SET {set_clause} WHERE id = ?", values)
        conn.commit()
    except sqlite3.Error as e:
        logger.error("DB update_download error: %s", e)


def get_history(limit=100, offset=0):
    """Get recent download history, newest first."""
    conn = _get_conn()
    try:
        rows = conn.execute(
            """SELECT * FROM downloads
               ORDER BY created_at DESC
               LIMIT ? OFFSET ?""",
            (limit, offset)
        ).fetchall()
        return [dict(row) for row in rows]
    except sqlite3.Error as e:
        logger.error("DB get_history error: %s", e)
        return []


def get_download(download_id):
    """Get a single download record."""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM downloads WHERE id = ?", (download_id,)
        ).fetchone()
        return dict(row) if row else None
    except sqlite3.Error as e:
        logger.error("DB get_download error: %s", e)
        return None


def delete_download(download_id):
    """Delete a download record."""
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM downloads WHERE id = ?", (download_id,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB delete_download error: %s", e)
        return False


def clear_history():
    """Delete all download records."""
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM downloads")
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB clear_history error: %s", e)
        return False


# ─── Settings ────────────────────────────────────────────────────────────────

def get_setting(key, default=None):
    """Retrieve a setting by key."""
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row['value'] if row else default
    except sqlite3.Error as e:
        logger.error("DB get_setting error: %s", e)
        return default


def set_setting(key, value):
    """Set a setting value (upsert)."""
    conn = _get_conn()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, str(value))
        )
        conn.commit()
    except sqlite3.Error as e:
        logger.error("DB set_setting error: %s", e)


def get_all_settings():
    """Retrieve all settings as a dictionary."""
    conn = _get_conn()
    cursor = conn.execute("SELECT key, value FROM settings")
    return {row['key']: row['value'] for row in cursor.fetchall()}

# ─── Watch History ──────────────────────────────────────────────────────────

def update_watch_progress(video_id: str, progress_time: float, duration: float, is_watched: bool):
    """Update or insert progress for a video (can be URL, local path, or download ID)."""
    conn = _get_conn()
    now = time.time()
    try:
        conn.execute(
            """INSERT OR REPLACE INTO watch_history 
               (video_id, progress_time, duration, is_watched, updated_at) 
               VALUES (?, ?, ?, ?, ?)""",
            (video_id, progress_time, duration, is_watched, now)
        )
        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("Database error in update_watch_progress: %s", e)

def get_watch_progress(video_id: str) -> dict:
    """Get the watch progress for a video ID."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT progress_time, duration, is_watched, updated_at FROM watch_history WHERE video_id = ?",
        (video_id,)
    ).fetchone()
    if row:
        return dict(row)
    return None


# ─── Anime Tracker / Library ────────────────────────────────────────────────────────

def get_all_library_anime():
    conn = _get_conn()
    try:
        cur = conn.execute("SELECT * FROM anime_library ORDER BY updated_at DESC")
        return [dict(row) for row in cur.fetchall()]
    except sqlite3.Error as e:
        logger.error("DB get_all_library_anime error: %s", e)
        return []


def get_library_anime(anime_id):
    conn = _get_conn()
    try:
        cur = conn.execute("SELECT * FROM anime_library WHERE id = ?", (anime_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    except sqlite3.Error as e:
        logger.error("DB get_library_anime error: %s", e)
        return None


def update_library_anime(anime_id, title, provider, poster, status, total_episodes, watched_episodes, genres=''):
    conn = _get_conn()
    try:
        now = time.time()
        conn.execute("""
            INSERT INTO anime_library (id, title, provider, poster, status, total_episodes, watched_episodes, genres, added_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                provider=excluded.provider,
                poster=excluded.poster,
                status=excluded.status,
                total_episodes=excluded.total_episodes,
                watched_episodes=excluded.watched_episodes,
                genres=excluded.genres,
                updated_at=excluded.updated_at
        """, (anime_id, title, provider, poster, status, total_episodes, watched_episodes, genres, now, now))
        conn.commit()
        return True
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("DB update_library_anime error: %s", e)
        return False


def remove_library_anime(anime_id):
    conn = _get_conn()
    try:
        conn.execute("DELETE FROM anime_library WHERE id = ?", (anime_id,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("DB remove_library_anime error: %s", e)
        return False


def bulk_update_library_status(anime_ids, new_status):
    if not anime_ids: return True
    conn = _get_conn()
    try:
        placeholders = ','.join('?' for _ in anime_ids)
        query = f"UPDATE anime_library SET status = ?, updated_at = ? WHERE id IN ({placeholders})"
        conn.execute(query, [new_status, time.time()] + anime_ids)
        conn.commit()
        return True
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("DB bulk_update_library_status error: %s", e)
        return False


def bulk_delete_library_anime(anime_ids):
    if not anime_ids: return True
    conn = _get_conn()
    try:
        placeholders = ','.join('?' for _ in anime_ids)
        for anime_id in anime_ids:
            conn.execute("DELETE FROM watch_history WHERE video_id LIKE ?", (f"{anime_id}$%",))
        conn.execute(f"DELETE FROM anime_episodes_watched WHERE anime_id IN ({placeholders})", anime_ids)
        conn.execute(f"DELETE FROM anime_library WHERE id IN ({placeholders})", anime_ids)
        conn.commit()
        return True
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("DB bulk_delete_library_anime error: %s", e)
        return False


def get_watched_episodes(anime_id):
    conn = _get_conn()
    try:
        cur = conn.execute("SELECT episode_number FROM anime_episodes_watched WHERE anime_id = ?", (anime_id,))
        return [row["episode_number"] for row in cur.fetchall()]
    except sqlite3.Error as e:
        logger.error("DB get_watched_episodes error: %s", e)
        return []


def mark_episode_watched(anime_id, episode_number, watched=True):
    conn = _get_conn()
    try:
        # Ensure anime exists in library to satisfy foreign key constraint for local files
        conn.execute("INSERT OR IGNORE INTO anime_library (id, title, provider, added_at, updated_at) VALUES (?, ?, 'local', ?, ?)",
                     (anime_id, anime_id, time.time(), time.time()))

        if watched:
            conn.execute("INSERT OR IGNORE INTO anime_episodes_watched (anime_id, episode_number, watched_at) VALUES (?, ?, ?)",
                         (anime_id, episode_number, time.time()))
        else:
            conn.execute("DELETE FROM anime_episodes_watched WHERE anime_id = ? AND episode_number = ?", (anime_id, episode_number))
        
        # Update the watched_episodes count in library if present
        cur = conn.execute("SELECT COUNT(*) as c FROM anime_episodes_watched WHERE anime_id = ?", (anime_id,))
        count = cur.fetchone()["c"]
        conn.execute("UPDATE anime_library SET watched_episodes = ?, updated_at = ? WHERE id = ?", (count, time.time(), anime_id))
        conn.commit()
        return count
    except sqlite3.Error as e:
        conn.rollback()
        logger.error("DB mark_episode_watched error: %s", e)
        return None

def get_watch_streak():
    """Calculates current and longest watch streak based on distinct local dates."""
    conn = _get_conn()
    try:
        cur = conn.execute("SELECT watched_at FROM anime_episodes_watched")
        rows = cur.fetchall()
        
        if not rows:
            return {"current_streak": 0, "longest_streak": 0}
            
        import datetime
        watched_dates = set()
        for row in rows:
            dt = datetime.datetime.fromtimestamp(row["watched_at"])
            watched_dates.add(dt.date())
            
        if not watched_dates:
             return {"current_streak": 0, "longest_streak": 0}
             
        sorted_dates_asc = sorted(list(watched_dates))
        
        longest_streak = 1
        current_run = 1
        for i in range(1, len(sorted_dates_asc)):
            if (sorted_dates_asc[i] - sorted_dates_asc[i-1]).days == 1:
                current_run += 1
            else:
                if current_run > longest_streak:
                    longest_streak = current_run
                current_run = 1
        if current_run > longest_streak:
            longest_streak = current_run

        sorted_dates_desc = sorted(list(watched_dates), reverse=True)
        today = datetime.datetime.now().date()
        yesterday = today - datetime.timedelta(days=1)
        
        current_streak = 0
        if sorted_dates_desc[0] == today or sorted_dates_desc[0] == yesterday:
            current_streak = 1
            expected_next = sorted_dates_desc[0] - datetime.timedelta(days=1)
            for i in range(1, len(sorted_dates_desc)):
                if sorted_dates_desc[i] == expected_next:
                    current_streak += 1
                    expected_next -= datetime.timedelta(days=1)
                else:
                    break
                    
        return {"current_streak": current_streak, "longest_streak": longest_streak}
    except sqlite3.Error as e:
        logger.error("DB get_watch_streak error: %s", e)
        return {"current_streak": 0, "longest_streak": 0}

def get_watch_stats():
    """Returns watch statistics for the dashboard."""
    conn = _get_conn()
    try:
        streak_data = get_watch_streak()
        
        stats = {
            "statuses": {"watching": 0, "completed": 0, "plan_to_watch": 0, "dropped": 0},
            "total_episodes": 0,
            "estimated_hours": 0,
            "genres": [],
            "monthly_activity": [],
            "current_streak": streak_data["current_streak"],
            "longest_streak": streak_data["longest_streak"]
        }

        # 1. Total library count by status
        cur = conn.execute("SELECT status, COUNT(*) as c FROM anime_library GROUP BY status")
        for row in cur.fetchall():
            s = row["status"]
            if s in stats["statuses"]:
                stats["statuses"][s] = row["c"]

        # 2. Total episodes watched & estimated time (24 mins per ep)
        cur = conn.execute("SELECT SUM(watched_episodes) as c FROM anime_library")
        total_eps = cur.fetchone()["c"]
        if total_eps is None:
            total_eps = 0
        stats["total_episodes"] = total_eps
        stats["estimated_hours"] = round((total_eps * 24) / 60, 1)

        # 3. Monthly watch activity (last 6 months)
        import datetime
        now = datetime.datetime.now()
        months = []
        for i in range(5, -1, -1):
            d = now - datetime.timedelta(days=30 * i)
            months.append(d.strftime("%b"))
        
        # Initialize month counts
        month_counts = {m: 0 for m in months}
        
        # Fetch timestamps from the last ~6 months from watch_history instead
        six_months_ago = (now - datetime.timedelta(days=180)).timestamp()
        cur = conn.execute("SELECT updated_at FROM watch_history WHERE updated_at >= ?", (six_months_ago,))
        for row in cur.fetchall():
            dt = datetime.datetime.fromtimestamp(row["updated_at"])
            m_str = dt.strftime("%b")
            if m_str in month_counts:
                month_counts[m_str] += 1
                
        stats["monthly_activity"] = [{"month": m, "episodes_watched": month_counts[m]} for m in months]

        # 4. Genre breakdown
        cur = conn.execute("SELECT genres FROM anime_library WHERE genres IS NOT NULL AND genres != ''")
        genre_counts = {}
        for row in cur.fetchall():
            genres_str = row["genres"]
            for g in genres_str.split(','):
                g = g.strip()
                if g:
                    genre_counts[g] = genre_counts.get(g, 0) + 1
                    
        # Sort and get top 5
        sorted_genres = sorted([{"name": k, "count": v} for k, v in genre_counts.items()], key=lambda x: x["count"], reverse=True)
        stats["genres"] = sorted_genres[:5]

        # 5. Time-of-Day Insights
        time_of_day = {"morning": 0, "afternoon": 0, "evening": 0, "night": 0}
        cur = conn.execute("SELECT watched_at FROM anime_episodes_watched")
        for row in cur.fetchall():
            hour = datetime.datetime.fromtimestamp(row["watched_at"]).hour
            if 6 <= hour < 12:
                time_of_day["morning"] += 1
            elif 12 <= hour < 18:
                time_of_day["afternoon"] += 1
            elif 18 <= hour <= 23:
                time_of_day["evening"] += 1
            else:
                time_of_day["night"] += 1
        stats["time_of_day"] = time_of_day

        achievements_dict = {
            "first_blood": {"id": "first_blood", "title": "First Blood", "desc": "Watch your first episode", "unlocked": False},
            "binger": {"id": "binger", "title": "The Binger", "desc": "Watch 10 episodes in one day", "unlocked": False},
            "streak_5": {"id": "streak_5", "title": "Consistent Otaku", "desc": "Reach a 5-day watch streak", "unlocked": False},
            "genre_master": {"id": "genre_master", "title": "Genre Master", "desc": "Have 5 different genres in your library", "unlocked": False},
            "night_owl": {"id": "night_owl", "title": "Night Owl", "desc": "Watch 20 episodes at night (12AM - 6AM)", "unlocked": False},
            "hundred_club": {"id": "hundred_club", "title": "Century Club", "desc": "Watch 100 episodes total", "unlocked": False},
            "library_hoarder": {"id": "library_hoarder", "title": "Hoarder", "desc": "Add 20 anime to your library", "unlocked": False},
            "completionist": {"id": "completionist", "title": "Completionist", "desc": "Finish watching 5 entire anime", "unlocked": False}
        }

        # 6. Achievements Check
        check_achievements()

        # Fetch unlocked achievements
        cur = conn.execute("SELECT id FROM achievements_unlocked")
        unlocked_ids = set(r["id"] for r in cur.fetchall())
        for aid in unlocked_ids:
            if aid in achievements_dict:
                achievements_dict[aid]["unlocked"] = True
                
        stats["achievements"] = list(achievements_dict.values())

        return stats
    except sqlite3.Error as e:
        logger.error("DB get_watch_stats error: %s", e)
        return None

def check_achievements():
    """Checks unlock conditions and returns newly unlocked achievement IDs."""
    conn = _get_conn()
    newly_unlocked = []
    try:
        now = time.time()
        import datetime
        
        # 1. Total episodes
        cur = conn.execute("SELECT SUM(watched_episodes) as c FROM anime_library")
        total_eps = cur.fetchone()["c"] or 0
        if total_eps >= 1:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("first_blood", now))
                newly_unlocked.append("first_blood")
            except sqlite3.IntegrityError:
                pass
                
        if total_eps >= 100:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("hundred_club", now))
                newly_unlocked.append("hundred_club")
            except sqlite3.IntegrityError:
                pass
            
        # Library Hoarder & Completionist
        cur = conn.execute("SELECT COUNT(*) as c FROM anime_library")
        library_count = cur.fetchone()["c"] or 0
        if library_count >= 20:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("library_hoarder", now))
                newly_unlocked.append("library_hoarder")
            except sqlite3.IntegrityError:
                pass
                
        cur = conn.execute("SELECT COUNT(*) as c FROM anime_library WHERE status = 'Completed'")
        completed_count = cur.fetchone()["c"] or 0
        if completed_count >= 5:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("completionist", now))
                newly_unlocked.append("completionist")
            except sqlite3.IntegrityError:
                pass
            
        # 2. Streak
        streak_data = get_watch_streak()
        if streak_data["longest_streak"] >= 5:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("streak_5", now))
                newly_unlocked.append("streak_5")
            except sqlite3.IntegrityError:
                pass
            
        # 3. Genre Master
        cur = conn.execute("SELECT genres FROM anime_library WHERE genres IS NOT NULL AND genres != ''")
        genre_counts = {}
        for row in cur.fetchall():
            for g in row["genres"].split(","):
                g = g.strip()
                if g:
                    genre_counts[g] = genre_counts.get(g, 0) + 1
        if len(genre_counts) >= 5:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("genre_master", now))
                newly_unlocked.append("genre_master")
            except sqlite3.IntegrityError:
                pass
            
        # 4. Night Owl & Binger
        cur = conn.execute("SELECT watched_at FROM anime_episodes_watched")
        night_count = 0
        day_counts = {}
        for row in cur.fetchall():
            dt = datetime.datetime.fromtimestamp(row["watched_at"])
            hour = dt.hour
            if hour < 6:
                night_count += 1
            day_str = dt.strftime("%Y-%m-%d")
            day_counts[day_str] = day_counts.get(day_str, 0) + 1
            
        if night_count >= 20:
            try:
                conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("night_owl", now))
                newly_unlocked.append("night_owl")
            except sqlite3.IntegrityError:
                pass
            
        for count in day_counts.values():
            if count >= 10:
                try:
                    conn.execute("INSERT INTO achievements_unlocked (id, unlocked_at) VALUES (?, ?)", ("binger", now))
                    newly_unlocked.append("binger")
                except sqlite3.IntegrityError:
                    pass
                break
                
        conn.commit()
        return newly_unlocked
    except sqlite3.Error as e:
        logger.error("DB check_achievements error: %s", e)
        return []

def save_note(anime_id, episode_number, note, rating):
    """Save an episode or anime-level note."""
    conn = _get_conn()
    try:
        now = time.time()
        conn.execute("""
            INSERT INTO anime_notes (anime_id, episode_number, note, rating, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(anime_id, episode_number) DO UPDATE SET
                note=excluded.note,
                rating=excluded.rating,
                updated_at=excluded.updated_at
        """, (anime_id, episode_number, note, rating, now))
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB save_note error: %s", e)
        return False

def get_note(anime_id, episode_number):
    """Retrieve a note."""
    conn = _get_conn()
    try:
        cur = conn.execute("SELECT note, rating FROM anime_notes WHERE anime_id = ? AND episode_number = ?", (anime_id, episode_number))
        row = cur.fetchone()
        if row:
            return dict(row)
        return {"note": "", "rating": 0}
    except sqlite3.Error as e:
        logger.error("DB get_note error: %s", e)
        return {"note": "", "rating": 0}

def get_full_backup():
    """Retrieve full database contents for export."""
    try:
        conn = _get_conn()
        
        library_cur = conn.execute("SELECT * FROM anime_library")
        library = [dict(r) for r in library_cur.fetchall()]
        
        episodes_cur = conn.execute("SELECT * FROM anime_episodes_watched")
        episodes = [dict(r) for r in episodes_cur.fetchall()]
        
        history_cur = conn.execute("SELECT * FROM watch_history")
        history = [dict(r) for r in history_cur.fetchall()]
        
        return {
            "library": library,
            "episodes_watched": episodes,
            "watch_history": history
        }
    except sqlite3.Error as e:
        logger.error("DB get_full_backup error: %s", e)
        return None

def import_backup(data):
    """Import backup data with conflict resolution."""
    try:
        conn = _get_conn()
        
        library = data.get("library", [])
        episodes = data.get("episodes_watched", [])
        history = data.get("watch_history", [])
        
        counts = {"added": 0, "updated": 0, "skipped": 0}
        
        for lib in library:
            cur = conn.execute("SELECT id FROM anime_library WHERE id = ?", (lib["id"],))
            exists = cur.fetchone() is not None
            
            try:
                conn.execute('''
                    INSERT OR REPLACE INTO anime_library (
                        id, title, provider, poster, status, total_episodes, watched_episodes, genres, added_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    lib["id"], lib["title"], lib.get("provider", ""), lib.get("poster", ""),
                    lib.get("status", "plan_to_watch"), lib.get("total_episodes", 0),
                    lib.get("watched_episodes", 0), lib.get("genres", ""),
                    lib.get("added_at", time.time()), lib.get("updated_at", time.time())
                ))
                if exists:
                    counts["updated"] += 1
                else:
                    counts["added"] += 1
            except Exception as e:
                logger.error("Error importing library item: %s", e)
                counts["skipped"] += 1

        for ep in episodes:
            try:
                conn.execute('''
                    INSERT OR IGNORE INTO anime_episodes_watched (anime_id, episode_number, watched_at)
                    VALUES (?, ?, ?)
                ''', (ep["anime_id"], ep["episode_number"], ep["watched_at"]))
            except Exception:
                pass
                
        for h in history:
            try:
                conn.execute('''
                    INSERT OR REPLACE INTO watch_history (video_id, progress_time, duration, is_watched, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                ''', (h["video_id"], h.get("progress_time", 0), h.get("duration", 0), h.get("is_watched", 0), h.get("updated_at", time.time())))
            except Exception:
                pass

        conn.commit()
        return counts
    except sqlite3.Error as e:
        logger.error("DB import_backup error: %s", e)
        return None

def get_continue_watching(limit=10):
    try:
        conn = _get_conn()
        cur = conn.execute("""
            SELECT al.*, MAX(aew.watched_at) as last_watched
            FROM anime_library al
            JOIN anime_episodes_watched aew ON al.id = aew.anime_id
            WHERE al.status = 'watching' 
              AND al.watched_episodes > 0 
              AND (al.total_episodes = 0 OR al.watched_episodes < al.total_episodes)
            GROUP BY al.id
            ORDER BY last_watched DESC
            LIMIT ?
        """, (limit,))
        
        results = []
        for row in cur.fetchall():
            results.append(dict(row))
        return results
    except sqlite3.Error as e:
        logger.error("DB get_continue_watching error: %s", e)
        return []

# ===================================================================
# MANGA LIBRARY
# ===================================================================

def add_manga(manga_id, title, cover_url, status='reading', total_chapters=0, genres=''):
    try:
        conn = _get_conn()
        now = time.time()
        
        cur = conn.execute("SELECT 1 FROM manga_library WHERE id = ?", (manga_id,))
        exists = cur.fetchone() is not None
        
        if exists:
            conn.execute("""
                UPDATE manga_library 
                SET title = ?, cover_url = ?, status = ?, total_chapters = ?, genres = ?, updated_at = ?
                WHERE id = ?
            """, (title, cover_url, status, total_chapters, genres, now, manga_id))
        else:
            conn.execute("""
                INSERT INTO manga_library (id, title, cover_url, status, total_chapters, read_chapters, genres, added_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
            """, (manga_id, title, cover_url, status, total_chapters, genres, now, now))
        
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB add_manga error: %s", e)
        return False

def remove_manga(manga_id):
    try:
        conn = _get_conn()
        conn.execute("DELETE FROM manga_library WHERE id = ?", (manga_id,))
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB remove_manga error: %s", e)
        return False

def get_manga_library():
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT * FROM manga_library ORDER BY updated_at DESC")
        results = []
        for row in cur.fetchall():
            results.append(dict(row))
        return results
    except sqlite3.Error as e:
        logger.error("DB get_manga_library error: %s", e)
        return []

def get_manga(manga_id):
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT * FROM manga_library WHERE id = ?", (manga_id,))
        row = cur.fetchone()
        return dict(row) if row else None
    except sqlite3.Error as e:
        logger.error("DB get_manga error: %s", e)
        return None

def mark_manga_chapter_read(manga_id, chapter_id, is_read=True):
    try:
        conn = _get_conn()
        now = time.time()
        
        if is_read:
            conn.execute("""
                INSERT OR IGNORE INTO manga_chapters_read (manga_id, chapter_id, read_at)
                VALUES (?, ?, ?)
            """, (manga_id, chapter_id, now))
        else:
            conn.execute("""
                DELETE FROM manga_chapters_read 
                WHERE manga_id = ? AND chapter_id = ?
            """, (manga_id, chapter_id))
            
        # Update read_chapters count
        conn.execute("""
            UPDATE manga_library 
            SET read_chapters = (
                SELECT COUNT(*) FROM manga_chapters_read WHERE manga_id = ?
            ), updated_at = ?
            WHERE id = ?
        """, (manga_id, now, manga_id))
        
        conn.commit()
        return True
    except sqlite3.Error as e:
        logger.error("DB mark_manga_chapter_read error: %s", e)
        return False

def get_manga_chapters_read(manga_id):
    try:
        conn = _get_conn()
        cur = conn.execute("SELECT chapter_id FROM manga_chapters_read WHERE manga_id = ?", (manga_id,))
        return [row['chapter_id'] for row in cur.fetchall()]
    except sqlite3.Error as e:
        logger.error("DB get_manga_chapters_read error: %s", e)
        return []

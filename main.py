"""
NovaStream v3.0 — Native Windows Desktop Application
Pure native GUI using CustomTkinter. No browser, no web server.
"""

import customtkinter as ctk
import threading
import shutil
import uuid
import os
import sys
import time
import subprocess
import logging

from downloader import (
    get_video_info, get_playlist_info, download_video,
    download_audio, download_playlist, is_playlist_url, QUALITY_MAP,
)
from database import (
    init_db, add_download, update_download, get_history,
    delete_download, clear_history,
    get_setting, set_setting,
)

# ── Base directory ──
if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Theme ──
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# ── Colors ──
BG_DARK = "#0f0f1a"
BG_CARD = "#1a1a2e"
BG_INPUT = "#16162a"
ACCENT = "#7c3aed"
ACCENT_HOVER = "#6d28d9"
ACCENT_2 = "#06b6d4"
GREEN = "#10b981"
RED = "#ef4444"
AMBER = "#f59e0b"
TEXT = "#f1f5f9"
TEXT_DIM = "#94a3b8"
BORDER = "#2d2d50"


class DownloadItem(ctk.CTkFrame):
    """A single download row with progress bar."""

    def __init__(self, master, download_id, title, fmt, quality, **kwargs):
        super().__init__(master, fg_color=BG_CARD, corner_radius=10, border_width=1, border_color=BORDER, **kwargs)
        self.download_id = download_id
        self.columnconfigure(0, weight=1)

        # Row 1: Title + format badge
        row1 = ctk.CTkFrame(self, fg_color="transparent")
        row1.grid(row=0, column=0, sticky="ew", padx=14, pady=(10, 2))
        row1.columnconfigure(0, weight=1)

        self.title_label = ctk.CTkLabel(
            row1, text=title[:70], font=("Segoe UI", 13, "bold"),
            text_color=TEXT, anchor="w"
        )
        self.title_label.grid(row=0, column=0, sticky="w")

        badge_text = f"{'🎬' if fmt == 'video' else '🎵'} {fmt.upper()} • {quality}"
        self.badge = ctk.CTkLabel(
            row1, text=badge_text, font=("Segoe UI", 11),
            text_color=ACCENT_2, anchor="e"
        )
        self.badge.grid(row=0, column=1, sticky="e", padx=(10, 0))

        # Row 2: Progress bar
        self.progress = ctk.CTkProgressBar(
            self, width=400, height=10, corner_radius=5,
            fg_color="#1e1e3a", progress_color=ACCENT, border_width=0
        )
        self.progress.grid(row=1, column=0, sticky="ew", padx=14, pady=(4, 2))
        self.progress.set(0)

        # Row 3: Status text
        row3 = ctk.CTkFrame(self, fg_color="transparent")
        row3.grid(row=2, column=0, sticky="ew", padx=14, pady=(0, 10))
        row3.columnconfigure(1, weight=1)

        self.status_label = ctk.CTkLabel(
            row3, text="Queued", font=("Segoe UI", 11),
            text_color=TEXT_DIM, anchor="w"
        )
        self.status_label.grid(row=0, column=0, sticky="w")

        self.detail_label = ctk.CTkLabel(
            row3, text="", font=("Consolas", 11),
            text_color=TEXT_DIM, anchor="e"
        )
        self.detail_label.grid(row=0, column=1, sticky="e")

    def update_progress(self, status_dict):
        status = status_dict.get('status', '')
        progress = status_dict.get('progress', 0) / 100.0
        speed = status_dict.get('speed', '')
        eta = status_dict.get('eta', '')
        title = status_dict.get('title', '')

        if title:
            self.title_label.configure(text=title[:70])

        self.progress.set(min(progress, 1.0))

        if status == 'downloading':
            self.status_label.configure(text="Downloading...", text_color=ACCENT_2)
            dl_size = status_dict.get('downloaded_size', '0 B')
            tot_size = status_dict.get('total_size', '0 B')
            self.detail_label.configure(text=f"{dl_size} / {tot_size} ({status_dict.get('progress', 0):.1f}%)  |  {speed}  |  ETA: {eta}")
            self.progress.configure(progress_color=ACCENT)
        elif status == 'processing':
            self.status_label.configure(text="Processing...", text_color=AMBER)
            self.detail_label.configure(text=eta if eta != 'N/A' else "Merging...")
            self.progress.configure(progress_color=AMBER)
        elif status == 'finished':
            self.status_label.configure(text="✓ Completed", text_color=GREEN)
            self.detail_label.configure(text="")
            self.progress.set(1.0)
            self.progress.configure(progress_color=GREEN)
            self.configure(border_color=GREEN)
        elif status == 'error':
            err = status_dict.get('error', 'Unknown error')
            self.status_label.configure(text=f"✕ Error", text_color=RED)
            self.detail_label.configure(text=err[:60])
            self.progress.configure(progress_color=RED)
            self.configure(border_color=RED)


class NovaStreamApp(ctk.CTk):
    """Main application window."""

    def __init__(self):
        super().__init__()

        # ── Window setup ──
        self.title("NovaStream")
        self.geometry("900x720")
        self.minsize(700, 550)
        self.configure(fg_color=BG_DARK)

        # Try to set icon
        ico_path = os.path.join(BASE_DIR, "static", "img", "logo.ico")
        if os.path.exists(ico_path):
            self.iconbitmap(ico_path)

        import sys
        if getattr(sys, 'frozen', False):
            default_dl = os.path.join(os.path.expanduser('~'), 'Videos', 'NovaStream')
        else:
            default_dl = os.path.join(BASE_DIR, 'downloads')
        self.download_dir = get_setting('download_dir', default_dl)
        os.makedirs(self.download_dir, exist_ok=True)
        self.download_widgets = {}  # download_id -> DownloadItem
        self.active_threads = []

        # ── Build UI ──
        self._build_header()
        self._build_input_section()
        self._build_options_section()
        self._build_downloads_section()

        # ── FFmpeg check ──
        self.after(500, self._check_ffmpeg)

    # ================================================================
    #  HEADER
    # ================================================================
    def _build_header(self):
        header = ctk.CTkFrame(self, fg_color=BG_CARD, corner_radius=0, height=60)
        header.pack(fill="x")
        header.pack_propagate(False)

        title = ctk.CTkLabel(
            header, text="NovaStream",
            font=("Segoe UI Black", 24, "bold"), text_color=ACCENT
        )
        title.pack(side="left", padx=24, pady=12)

        subtitle = ctk.CTkLabel(
            header, text="YouTube Video & Audio Downloader",
            font=("Segoe UI", 12), text_color=TEXT_DIM
        )
        subtitle.pack(side="left", pady=12)

        # Settings button
        settings_btn = ctk.CTkButton(
            header, text="⚙ Settings", width=100, height=32,
            font=("Segoe UI", 12), fg_color="transparent",
            border_width=1, border_color=BORDER, hover_color=BG_INPUT,
            command=self._open_settings
        )
        settings_btn.pack(side="right", padx=24, pady=12)

    # ================================================================
    #  URL INPUT
    # ================================================================
    def _build_input_section(self):
        frame = ctk.CTkFrame(self, fg_color="transparent")
        frame.pack(fill="x", padx=24, pady=(16, 8))

        label = ctk.CTkLabel(
            frame, text="Paste YouTube URLs (one per line)",
            font=("Segoe UI", 13, "bold"), text_color=TEXT
        )
        label.pack(anchor="w", pady=(0, 6))

        input_frame = ctk.CTkFrame(frame, fg_color=BG_CARD, corner_radius=10, border_width=1, border_color=BORDER)
        input_frame.pack(fill="x")

        self.url_textbox = ctk.CTkTextbox(
            input_frame, height=90, font=("Consolas", 12),
            fg_color=BG_INPUT, text_color=TEXT, corner_radius=8,
            border_width=0, wrap="word"
        )
        self.url_textbox.pack(fill="x", padx=10, pady=10)
        self.url_textbox.insert("1.0", "")

        # Buttons row
        btn_frame = ctk.CTkFrame(frame, fg_color="transparent")
        btn_frame.pack(fill="x", pady=(8, 0))

        self.download_btn = ctk.CTkButton(
            btn_frame, text="⬇  Download", width=160, height=40,
            font=("Segoe UI", 14, "bold"), fg_color=ACCENT,
            hover_color=ACCENT_HOVER, corner_radius=10,
            command=self._start_downloads
        )
        self.download_btn.pack(side="left")

        self.fetch_btn = ctk.CTkButton(
            btn_frame, text="🔍  Fetch Info", width=130, height=40,
            font=("Segoe UI", 13), fg_color="transparent",
            border_width=1, border_color=ACCENT, text_color=ACCENT,
            hover_color=BG_CARD, corner_radius=10,
            command=self._fetch_info
        )
        self.fetch_btn.pack(side="left", padx=(10, 0))

        self.clear_btn = ctk.CTkButton(
            btn_frame, text="Clear", width=80, height=40,
            font=("Segoe UI", 12), fg_color="transparent",
            border_width=1, border_color=BORDER, text_color=TEXT_DIM,
            hover_color=BG_CARD, corner_radius=10,
            command=self._clear_all
        )
        self.clear_btn.pack(side="left", padx=(10, 0))

        # Open download folder
        folder_btn = ctk.CTkButton(
            btn_frame, text="📁 Open Folder", width=120, height=40,
            font=("Segoe UI", 12), fg_color="transparent",
            border_width=1, border_color=BORDER, text_color=TEXT_DIM,
            hover_color=BG_CARD, corner_radius=10,
            command=self._open_download_folder
        )
        folder_btn.pack(side="right")

    # ================================================================
    #  OPTIONS (Format + Quality)
    # ================================================================
    def _build_options_section(self):
        frame = ctk.CTkFrame(self, fg_color="transparent")
        frame.pack(fill="x", padx=24, pady=(4, 8))

        # Format
        fmt_label = ctk.CTkLabel(frame, text="Format:", font=("Segoe UI", 12), text_color=TEXT_DIM)
        fmt_label.pack(side="left")

        self.format_var = ctk.StringVar(value="video")
        self.format_menu = ctk.CTkSegmentedButton(
            frame, values=["video", "audio"],
            variable=self.format_var, font=("Segoe UI", 12),
            fg_color=BG_INPUT, selected_color=ACCENT,
            selected_hover_color=ACCENT_HOVER,
            unselected_color=BG_CARD, unselected_hover_color=BG_INPUT,
            corner_radius=8,
            command=self._on_format_change
        )
        self.format_menu.pack(side="left", padx=(8, 20))

        # Quality
        qual_label = ctk.CTkLabel(frame, text="Quality:", font=("Segoe UI", 12), text_color=TEXT_DIM)
        qual_label.pack(side="left")

        self.quality_var = ctk.StringVar(value="best")
        self.quality_menu = ctk.CTkOptionMenu(
            frame, values=["best", "8k", "4k", "1440p", "1080p", "720p", "480p", "360p"],
            variable=self.quality_var, font=("Segoe UI", 12),
            fg_color=BG_INPUT, button_color=ACCENT,
            button_hover_color=ACCENT_HOVER,
            dropdown_fg_color=BG_CARD, dropdown_hover_color=BG_INPUT,
            corner_radius=8, width=120
        )
        self.quality_menu.pack(side="left", padx=(8, 0))

        # FFmpeg warning (hidden by default)
        self.ffmpeg_label = ctk.CTkLabel(
            frame, text="", font=("Segoe UI", 11),
            text_color=AMBER
        )
        self.ffmpeg_label.pack(side="right", padx=(10, 0))

    def _on_format_change(self, value):
        if value == "audio":
            self.quality_menu.configure(state="disabled")
        else:
            self.quality_menu.configure(state="normal")

    # ================================================================
    #  DOWNLOADS AREA (scrollable)
    # ================================================================
    def _build_downloads_section(self):
        # Section header
        section_header = ctk.CTkFrame(self, fg_color="transparent")
        section_header.pack(fill="x", padx=24, pady=(8, 4))

        dl_label = ctk.CTkLabel(
            section_header, text="Downloads",
            font=("Segoe UI", 15, "bold"), text_color=TEXT
        )
        dl_label.pack(side="left")

        self.count_label = ctk.CTkLabel(
            section_header, text="0 items",
            font=("Segoe UI", 11), text_color=TEXT_DIM
        )
        self.count_label.pack(side="left", padx=(10, 0))

        clear_history_btn = ctk.CTkButton(
            section_header, text="Clear History", width=100, height=28,
            font=("Segoe UI", 11), fg_color="transparent",
            border_width=1, border_color=BORDER, text_color=TEXT_DIM,
            hover_color=BG_CARD, corner_radius=6,
            command=self._clear_history
        )
        clear_history_btn.pack(side="right")

        # Scrollable frame for download items
        self.scroll_frame = ctk.CTkScrollableFrame(
            self, fg_color="transparent", corner_radius=0,
            scrollbar_button_color=BORDER, scrollbar_button_hover_color=ACCENT
        )
        self.scroll_frame.pack(fill="both", expand=True, padx=24, pady=(0, 16))
        self.scroll_frame.columnconfigure(0, weight=1)

        # Status bar at bottom
        self.status_bar = ctk.CTkLabel(
            self, text="Ready", font=("Segoe UI", 11), text_color=TEXT_DIM,
            fg_color=BG_CARD, height=28, corner_radius=0, anchor="w"
        )
        self.status_bar.pack(fill="x", side="bottom")

    # ================================================================
    #  ACTIONS
    # ================================================================
    def _get_urls(self):
        """Parse URLs from the textbox."""
        text = self.url_textbox.get("1.0", "end-1c").strip()
        if not text:
            return []
        urls = [line.strip() for line in text.split('\n') if line.strip()]
        return urls

    def _set_status(self, text):
        self.status_bar.configure(text=f"  {text}")

    def _start_downloads(self):
        urls = self._get_urls()
        if not urls:
            self._set_status("⚠ Please paste at least one URL")
            return

        fmt = self.format_var.get()
        quality = self.quality_var.get()
        self._set_status(f"Starting {len(urls)} download(s)...")

        for url in urls:
            download_id = str(uuid.uuid4())
            title = url[:60]

            # Create UI widget
            item = DownloadItem(
                self.scroll_frame, download_id, title, fmt, quality
            )
            item.pack(fill="x", pady=(0, 6))
            self.download_widgets[download_id] = item

            # Persist to DB
            add_download(download_id, url, title, fmt, quality)

            # Start download thread
            t = threading.Thread(
                target=self._download_worker,
                args=(download_id, url, fmt, quality),
                daemon=True
            )
            t.start()
            self.active_threads.append(t)

        self._update_count()

    def _download_worker(self, download_id, url, fmt, quality):
        """Run download in background thread."""
        def progress_cb(did, status_dict):
            # Schedule UI update on main thread
            self.after(0, self._on_progress, did, status_dict)

        try:
            if is_playlist_url(url):
                download_playlist(
                    url, format_type=fmt, quality=quality,
                    output_dir=self.download_dir,
                    progress_callback=progress_cb, download_id=download_id
                )
            elif fmt == 'audio':
                download_audio(
                    url, output_dir=self.download_dir,
                    progress_callback=progress_cb, download_id=download_id
                )
            else:
                download_video(
                    url, quality=quality, output_dir=self.download_dir,
                    progress_callback=progress_cb, download_id=download_id
                )
        except Exception as e:
            logger.error(f"Download error: {e}")
            self.after(0, self._on_progress, download_id, {
                'status': 'error', 'progress': 0, 'error': str(e)
            })

    def _on_progress(self, download_id, status_dict):
        """Update UI from progress callback (runs on main thread)."""
        widget = self.download_widgets.get(download_id)
        if widget:
            widget.update_progress(status_dict)

        # Update DB
        status = status_dict.get('status', '')
        update_kwargs = {'status': status}
        if status_dict.get('title'):
            update_kwargs['title'] = status_dict['title']
        if status_dict.get('filename'):
            update_kwargs['filename'] = os.path.basename(status_dict['filename'])
        if status_dict.get('error'):
            update_kwargs['error'] = status_dict['error']
        if status == 'finished':
            update_kwargs['completed_at'] = time.time()
        update_download(download_id, **update_kwargs)

        if status in ('finished', 'error'):
            self._update_count()

    def _fetch_info(self):
        urls = self._get_urls()
        if not urls:
            self._set_status("⚠ Please paste at least one URL")
            return

        self.fetch_btn.configure(state="disabled", text="Fetching...")
        self._set_status("Fetching video info...")

        def worker():
            results = []
            for url in urls:
                info = get_video_info(url)
                results.append((url, info))
            self.after(0, self._show_info_results, results)

        threading.Thread(target=worker, daemon=True).start()

    def _show_info_results(self, results):
        self.fetch_btn.configure(state="normal", text="🔍  Fetch Info")

        for url, info in results:
            if 'error' in info:
                self._set_status(f"⚠ {info['error'][:80]}")
                continue

            title = info.get('title', 'Unknown')
            channel = info.get('channel', '')
            duration = info.get('duration', '')
            qualities = info.get('available_qualities', [])
            is_pl = info.get('is_playlist', False)
            pl_count = info.get('playlist_count', 0)

            # Show info in a popup
            popup = ctk.CTkToplevel(self)
            popup.title("Video Info")
            popup.geometry("500x320")
            popup.configure(fg_color=BG_DARK)
            popup.transient(self)
            popup.grab_set()

            ctk.CTkLabel(popup, text=title, font=("Segoe UI", 15, "bold"), text_color=TEXT, wraplength=460).pack(padx=20, pady=(20, 4), anchor="w")
            ctk.CTkLabel(popup, text=f"Channel: {channel}", font=("Segoe UI", 12), text_color=TEXT_DIM).pack(padx=20, anchor="w")
            ctk.CTkLabel(popup, text=f"Duration: {duration}", font=("Consolas", 12), text_color=TEXT_DIM).pack(padx=20, anchor="w")

            if is_pl:
                ctk.CTkLabel(popup, text=f"📋 Playlist — {pl_count} videos", font=("Segoe UI", 13, "bold"), text_color=ACCENT_2).pack(padx=20, pady=(10, 0), anchor="w")

            if qualities:
                ctk.CTkLabel(popup, text=f"Available: {', '.join(qualities)}", font=("Segoe UI", 12), text_color=GREEN).pack(padx=20, pady=(8, 0), anchor="w")

            ctk.CTkButton(popup, text="Close", width=100, fg_color=ACCENT, hover_color=ACCENT_HOVER, command=popup.destroy).pack(pady=20)

        if results:
            self._set_status(f"Fetched info for {len(results)} URL(s)")

    def _clear_all(self):
        self.url_textbox.delete("1.0", "end")
        for widget in list(self.download_widgets.values()):
            widget.destroy()
        self.download_widgets.clear()
        self._update_count()
        self._set_status("Cleared")

    def _clear_history(self):
        clear_history()
        for widget in list(self.download_widgets.values()):
            widget.destroy()
        self.download_widgets.clear()
        self._update_count()
        self._set_status("History cleared")

    def _open_download_folder(self):
        path = self.download_dir.replace('/', '\\')
        os.makedirs(path, exist_ok=True)
        subprocess.Popen(['explorer', path])

    def _update_count(self):
        count = len(self.download_widgets)
        self.count_label.configure(text=f"{count} item{'s' if count != 1 else ''}")

    def _check_ffmpeg(self):
        path = shutil.which('ffmpeg')
        if path:
            self.ffmpeg_label.configure(text="✓ FFmpeg", text_color=GREEN)
        else:
            self.ffmpeg_label.configure(text="⚠ FFmpeg not found — install it for merging/conversion", text_color=AMBER)

    # ================================================================
    #  SETTINGS DIALOG
    # ================================================================
    def _open_settings(self):
        settings = ctk.CTkToplevel(self)
        settings.title("Settings")
        settings.geometry("480x280")
        settings.configure(fg_color=BG_DARK)
        settings.transient(self)
        settings.grab_set()
        settings.resizable(False, False)

        ctk.CTkLabel(settings, text="⚙  Settings", font=("Segoe UI", 18, "bold"), text_color=TEXT).pack(padx=24, pady=(20, 16), anchor="w")

        # Download directory
        ctk.CTkLabel(settings, text="Download Directory", font=("Segoe UI", 12), text_color=TEXT_DIM).pack(padx=24, anchor="w")

        dir_frame = ctk.CTkFrame(settings, fg_color="transparent")
        dir_frame.pack(fill="x", padx=24, pady=(4, 16))

        dir_entry = ctk.CTkEntry(
            dir_frame, font=("Consolas", 12), fg_color=BG_INPUT,
            text_color=TEXT, border_color=BORDER, corner_radius=8, height=36
        )
        dir_entry.pack(side="left", fill="x", expand=True)
        dir_entry.insert(0, self.download_dir)

        def browse():
            from tkinter import filedialog
            path = filedialog.askdirectory(initialdir=self.download_dir)
            if path:
                dir_entry.delete(0, "end")
                dir_entry.insert(0, path)

        browse_btn = ctk.CTkButton(
            dir_frame, text="Browse", width=80, height=36,
            font=("Segoe UI", 12), fg_color=BG_CARD,
            border_width=1, border_color=BORDER,
            hover_color=BG_INPUT, corner_radius=8,
            command=browse
        )
        browse_btn.pack(side="right", padx=(8, 0))

        # FFmpeg status
        ffmpeg_path = shutil.which('ffmpeg')
        ffmpeg_text = f"✓ Installed: {ffmpeg_path}" if ffmpeg_path else "✕ Not installed — download from ffmpeg.org"
        ffmpeg_color = GREEN if ffmpeg_path else RED

        ctk.CTkLabel(settings, text="FFmpeg Status", font=("Segoe UI", 12), text_color=TEXT_DIM).pack(padx=24, anchor="w")
        ctk.CTkLabel(settings, text=ffmpeg_text, font=("Consolas", 11), text_color=ffmpeg_color).pack(padx=24, anchor="w", pady=(2, 16))

        # Save button
        def save():
            new_dir = dir_entry.get().strip()
            if new_dir:
                os.makedirs(new_dir, exist_ok=True)
                self.download_dir = new_dir
                set_setting('download_dir', new_dir)
                self._set_status(f"Download directory set to: {new_dir}")
            settings.destroy()

        ctk.CTkButton(
            settings, text="💾  Save Settings", width=160, height=38,
            font=("Segoe UI", 13, "bold"), fg_color=ACCENT,
            hover_color=ACCENT_HOVER, corner_radius=10,
            command=save
        ).pack(pady=(0, 20))


def main():
    init_db()
    app = NovaStreamApp()
    app.mainloop()


if __name__ == '__main__':
    main()

<p align="center">
  <img src="static/img/logo.png" alt="NovaStream Logo" width="120" />
</p>

<h1 align="center">NovaStream</h1>

<p align="center">
  <strong>🎬 Your All-in-One Anime Streaming & Media Manager</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#license">License</a>
</p>

---

## ✨ Features

- 🎌 **Anime Streaming** — Browse, search, and stream anime from multiple providers
- 📥 **YouTube Downloader** — Download videos and playlists in up to 8K quality
- 🎵 **Audio Extraction** — Extract audio from any video as MP3/M4A
- 📚 **Media Library** — Track your watchlist, favorites, and watch progress
- 🏆 **Achievements System** — Unlock achievements as you explore the app
- 📊 **Stats Dashboard** — Beautiful visualizations of your watching habits
- 🎮 **Discord Rich Presence** — Show what you're watching on Discord
- 🖥️ **MPV Integration** — Stream with the powerful MPV player with upscaling
- 🌙 **Glassmorphism UI** — Stunning dark-mode interface with smooth animations
- 🔍 **Discover Page** — Find trending and popular anime

## 📦 Installation

### Quick Install (Recommended)

1. Go to the [**Releases**](../../releases) page
2. Download `NovaStream_Setup.exe`
3. Run the installer and choose your install location
4. Launch NovaStream from your Desktop or Start Menu!

### Prerequisites

- **Windows 10/11** (64-bit)
- **Node.js** v18+ — [Download](https://nodejs.org/)
- **FFmpeg** — Required for video merging and audio extraction ([Download](https://ffmpeg.org/download.html))

## 🛠️ Development

### From Source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/NovaStream.git
cd NovaStream

# Install Python dependencies
pip install -r requirements.txt

# Install Node.js dependencies
npm install

# Run the app
python app.py
```

### Building the Executable

```bash
# Build with PyInstaller
python -m PyInstaller --name NovaStream --onefile --noconsole ^
  --icon="static\img\logo.ico" ^
  --add-data "templates;templates" ^
  --add-data "static;static" ^
  --add-data "anime_scraper.js;." ^
  --add-data "node_modules;node_modules" ^
  --hidden-import yt_dlp --hidden-import webview ^
  app.py -y
```

The compiled executable will be in `dist/NovaStream.exe`.

## 🖼️ Screenshots

> *Screenshots coming soon!*

## 📁 Project Structure

```
NovaStream/
├── app.py               # Flask web server & API routes
├── main.py              # Desktop GUI wrapper (CustomTkinter)
├── database.py          # SQLite persistence layer
├── downloader.py        # yt-dlp download engine
├── anime_scraper.js     # Node.js anime source scraper
├── mpv_controller.py    # MPV player integration
├── discord_rpc.py       # Discord Rich Presence
├── metadata_worker.py   # Background metadata fetcher
├── templates/
│   └── index.html       # Main web UI
├── static/
│   ├── css/             # Stylesheets
│   ├── js/              # Frontend JavaScript
│   └── img/             # Icons & assets
├── installer.iss        # Inno Setup installer script
└── requirements.txt     # Python dependencies
```

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, Flask |
| Frontend | HTML, CSS, JavaScript |
| Desktop | pywebview, CustomTkinter |
| Scraping | Node.js, Puppeteer |
| Downloads | yt-dlp, FFmpeg |
| Player | MPV |
| Database | SQLite |
| Installer | Inno Setup |

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

NovaStream is intended for personal use only. Please respect copyright laws and the terms of service of the content providers. The developers are not responsible for any misuse of this software.

---

<p align="center">Made with ❤️ by the NovaStream team</p>

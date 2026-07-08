# 🌟 NovaStream - Comprehensive Feature List

This document serves as a complete catalog of every feature in the NovaStream desktop application, separated by their current implementation status.

---

## ✅ Working (Fully Implemented)

### 🎬 Video & Streaming Engine
- **Custom MPV Player Integration**: Leverages the highly efficient MPV engine for hardware-accelerated playback (`gpu-next`).
- **Anime4K Video Upscaling**: Built-in support for Anime4K shaders to upscale 1080p anime to crystal clear 4K in real-time. *(While an episode is playing, press `CTRL + 1` through `CTRL + 6` to activate different upscale modes. Press `CTRL + 0` to disable).*
- **Ad-Free Extraction**: Automatically scrapes and extracts raw `.mp4`/`.m3u8` streams from web sources (via `yt-dlp` and Deno) to bypass all website advertisements.
- **Auto-Play Next Episode**: Seamlessly transitions to the next episode upon completion.
- **Continue Watching Hooks**: Saves exact timestamps so users can resume episodes right where they left off.

### 🎨 UI/UX & Design (Premium Glassmorphism)
- **Spotlight Hero Trailers**: The discover page features a massive rotating carousel. When an anime is in focus, its official YouTube trailer silently autoplays in the background.
- **Ambient Light (Ambilight)**: A cinematic CSS glow effect spills the colors of the active spotlight poster onto the surrounding UI.
- **3D Card Flips**: Anime posters in grids tilt and rotate in 3D space based on mouse movement (`preserve-3d`).
- **Micro-Interactions**: Custom particle bursts (confetti) and synthesized audio chimes play when unlocking achievements or adding to the library.
- **Custom Theming**: Users can pick their own UI accent color from a settings picker, applying it globally.
- **Skeleton Shimmer Loading**: Smooth placeholder animations while waiting for API data, avoiding jarring pop-ins.
- **Custom Dialogs**: Native browser alerts replaced with beautifully blurred, glassmorphic modal prompts.

### 📚 Library & Watch Tracking
- **Local SQLite Database**: Privacy-first, offline storage of all user watch data (`library.db`).
- **Franchise Hub (Watch Order)**: Inside an anime's details, it maps out Sequels, Spin-offs, and Side Stories via the Jikan API so users know exactly what to watch next.
- **Offline Metadata Caching**: A background Python worker automatically downloads high-res posters and character images to disk so the library loads instantly offline.
- **Cast & Voice Actors**: Displays the top characters and their Japanese Voice Actors for every show using data fetched from the Jikan API.
- **Episode Notes**: A built-in, auto-saving notepad attached to every anime for users to jot down thoughts or theories.

### 📊 Analytics, Stats & Achievements
- **Watch Streaks**: Tracks consecutive days of watching anime, complete with a pulsing flame animation for active streaks.
- **Time of Day Insights**: A beautiful chart breaking down if the user is a Morning, Afternoon, Evening, or Night watcher.
- **Achievement System**: Unlockable badges granted for hitting milestones (e.g., "The Binger", "Night Owl", "Genre Explorer").
- **Smart Recommendations Engine**: Analyzes the user's local library, determines their most-watched genre, and suggests highly-rated anime they *haven't* seen yet (powered by the Jikan API).
- **Annual Wrapped**: A fullscreen, animated "Spotify Wrapped"-style presentation summarizing the user's anime year.

### 📅 Discovery & Extras
- **Airing Release Calendar**: A day-by-day schedule tab showing exactly what anime are airing today (Monday-Sunday).
- **OP/ED Radio Playlist**: The "Radio" tab gathers all the Openings and Endings from the user's library and creates a continuous, randomized music video stream via the AnimeThemes API.
- **Storage Management Dashboard**: Visual pie charts showing disk usage for cached images, downloaded episodes, and database size.

---

## 🚧 Partially Working (Requires Setup)

- **Discord Rich Presence (RPC)**: Automatically updates the user's Discord status to show the anime and episode they are currently watching. *(Note: Requires the user to generate and enter their own Discord Application Client ID in the Settings menu).*

---

## 📋 Planned (Not Yet Built)

- **Built-in Manga Reader**: Seamlessly transition from watching anime to reading the source material via MangaDex integration.
- **NovaStream Account System**: A custom login system to sync user profiles.
- **Cloud Sync**: Automatically backup the local SQLite database to the cloud to sync watch history, libraries, and achievements across multiple devices.

/* ============================================================
   NovaStream v2.0 — Frontend Application
   Vanilla JS · No Dependencies
   ============================================================ */

(() => {
  'use strict';

  // ── Application State ──
  const state = {
    format: 'video',
    quality: 'best',
    previews: [],
    previewQualities: {},
    downloads: {},
    history: [],
    clientId: null,
    eventSource: null,
    settings: { download_dir: '' },
    ffmpeg: { installed: false },
    // Anime Downloader State
    animeResults: [],
    selectedAnime: null,
    episodeFilter: 'all',
    animeCurrentPage: 1,
    selectedEpisodes: new Set(),
    currentFormat: 'video', // 'video', 'audio', 'playlist', 'anime'
    selectedQualities: {},
    isQueueExpanded: false,
    libraryAnime: [],
    libraryMovies: [],
    discoverAnime: [],
    libraryFilter: '',
    libraryType: 'anime',
    librarySort: 'added_desc',
    
    customCollections: [],
    animeCollectionsMap: {},

    libraryStatuses: [],
    lastView: null,
    selectMode: false,
    selectedIds: [],
    statsAnimated: false,
    searchFilters: { genre: '', year: '', status: '' }
  };

  // ── DOM Cache ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const dom = {};

  function cacheDom() {
    dom.urlInput = $('#urlInput');
    dom.fetchBtn = $('#fetchBtn');
    dom.downloadBtn = $('#downloadBtn');
    dom.clearBtn = $('#clearBtn');
    dom.formatToggle = $('#formatToggle');
    dom.qualitySelect = $('#qualitySelect');
    dom.qualityGroup = $('#qualityGroup');
    dom.previewSection = $('#previewSection');
    dom.previewGrid = $('#previewGrid');
    dom.previewCount = $('#previewCount');
    dom.downloadAllBtn = $('#downloadAllBtn');
    dom.downloadQueue = $('#downloadQueue');
    dom.queueCount = $('#queueCount');
    dom.queueEmpty = $('#queueEmpty');

    // New Downloads Tab UI
    dom.tabActiveDownloads = $('#tabActiveDownloads');
    dom.tabCompletedDownloads = $('#tabCompletedDownloads');
    dom.activeDownloadsView = $('#activeDownloadsView');
    dom.completedDownloadsView = $('#completedDownloadsView');
    dom.completedQueue = $('#completedQueue');
    dom.completedEmpty = $('#completedEmpty');
    dom.batchControlsContainer = $('#batchControlsContainer');
    dom.pauseAllBtn = $('#pauseAllBtn');
    dom.cancelAllBtn = $('#cancelAllBtn');

    // Header
    dom.serverStatus = $('#serverStatus');
    dom.toastContainer = $('#toastContainer');
    dom.playlistModal = $('#playlistModal');
    dom.modalCancelBtn = $('#modalCancelBtn');
    dom.modalDownloadBtn = $('#modalDownloadBtn');
    dom.modalPlaylistTitle = $('#modalPlaylistTitle');
    dom.modalVideoCount = $('#modalVideoCount');
    dom.modalFormat = $('#modalFormat');
    dom.modalQuality = $('#modalQuality');
    // Settings
    dom.settingsBtn = $('#settingsBtn');
    dom.settingsDrawer = $('#settingsDrawer');
    dom.settingsOverlay = $('#settingsOverlay');
    dom.settingsCloseBtn = $('#settingsCloseBtn');
    dom.saveSettingsBtn = $('#saveSettingsBtn');
    dom.downloadDirInput = $('#downloadDirInput');
    dom.browseDirBtn = $('#browseDirBtn');
    dom.settingsLanguage = $('#settingsLanguage');
    dom.settingsSubtitles = $('#settingsSubtitles');
    dom.settingsQuality = $('#settingsQuality');
    dom.customStatusesContainer = $('#customStatusesContainer');
    dom.newStatusInput = $('#newStatusInput');
    dom.addStatusBtn = $('#addStatusBtn');
    dom.settingsSmartDownload = $('#settingsSmartDownload');
    dom.settingsAutoDelete = $('#settingsAutoDelete');
    dom.settingsDiscordRpc = $('#settingsDiscordRpc');
    dom.settingsDiscordClientId = $('#settingsDiscordClientId');
    dom.storageChart = $('#storageChart');
    dom.storageNovaBytes = $('#storageNovaBytes');
    dom.storageWatchedBytes = $('#storageWatchedBytes');
    dom.storageFreeBytes = $('#storageFreeBytes');
    dom.clearWatchedBtn = $('#clearWatchedBtn');
    // FFmpeg warning
    dom.ffmpegWarning = $('#ffmpegWarning');
    dom.ffmpegWarningClose = $('#ffmpegWarningClose');
    // Anime Downloader DOM Elements
    dom.tabYoutube = $('#tabYoutube');
    dom.tabDiscover = $('#tabDiscover');
    dom.tabSchedule = $('#tabSchedule');
    dom.tabRadio = $('#tabRadio');
    dom.radioPanel = $('#radioPanel');
    dom.radioVideoPlayer = $('#radioVideoPlayer');
    dom.radioQueueList = $('#radioQueueList');
    dom.radioGenerateBtn = $('#radioGenerateBtn');
    dom.schedulePanel = $('#schedulePanel');
    dom.scheduleGrid = $('#scheduleGrid');
    dom.tabAnime = $('#tabAnime');
    dom.tabLibrary = $('#tabLibrary');
    dom.tabStats = $('#tabStats');
    dom.tabAchievements = $('#tabAchievements');
    dom.downloadsDropdownBtn = $('#downloadsDropdownBtn');
    dom.downloadsDropdown = $('#downloadsDropdown');
    dom.youtubePanel = $('#youtubePanel');
    dom.discoverPanel = $('#discoverPanel');
    dom.animePanel = $('#animePanel');
    dom.libraryPanel = $('#libraryPanel');
    dom.statsPanel = $('#statsPanel');
    dom.achievementsPanel = $('#achievementsPanel');
    dom.animeSearchInput = $('#animeSearchInput');
    dom.animeSearchClearBtn = $('#animeSearchClearBtn');
    dom.searchAutocompleteDropdown = $('#searchAutocompleteDropdown');
    dom.animeSearchBtn = $('#animeSearchBtn');
    dom.animeProviderSelect = $('#animeProviderSelect');
    dom.filterGenre = $('#filterGenre');
    dom.filterYear = $('#filterYear');
    dom.filterStatus = $('#filterStatus');

    dom.clearFiltersBtn = $('#clearFiltersBtn');
    dom.animeResultsSection = $('#animeResultsSection');
    dom.animeResultsGrid = $('#animeResultsGrid');
    dom.animeBackBtn = $('#animeBackBtn');
    dom.animeDetailSection = $('#animeDetailSection');
    dom.animeDetailHeader = $('#animeDetailHeader');
    dom.animeEpisodesContainer = $('#animeEpisodesContainer');
    dom.animeNotesTextarea = $('#animeNotesTextarea');
    dom.animeNotesStatus = $('#animeNotesStatus');
    dom.animeResultsEmpty = $('#animeResultsEmpty');

    dom.generateWrappedBtn = $('#generateWrappedBtn');
    dom.wrappedModal = $('#wrappedModal');
    dom.closeWrappedBtn = $('#closeWrappedBtn');
    dom.finishWrappedBtn = $('#finishWrappedBtn');
    dom.wrappedSlides = $$('.wrapped-slide');
    dom.animeDetailBackBtn = $('#animeDetailBackBtn');
    dom.animeDetailHeader = $('#animeDetailHeader');
    dom.librarySortSelect = $('#librarySortSelect');
    dom.librarySelectToggleBtn = $('#librarySelectToggleBtn');
    dom.librarySelectAllBtn = $('#librarySelectAllBtn');
    dom.libraryFloatingActionBar = $('#libraryFloatingActionBar');
    dom.bulkSelectedCount = $('#bulkSelectedCount');
    dom.bulkStatusSelect = $('#bulkStatusSelect');
    dom.bulkDeleteBtn = $('#bulkDeleteBtn');
    dom.bulkCancelBtn = $('#bulkCancelBtn');
    dom.animeQualitySelect = $('#animeQualitySelect');
    dom.animeSubOrDubSelect = $('#animeSubOrDubSelect');
    dom.animeServerSelect = $('#animeServerSelect');
    dom.selectAllEpisodes = $('#selectAllEpisodes');
    dom.animeBulkDownloadBtn = $('#animeBulkDownloadBtn');
    dom.selectedEpisodesCount = $('#selectedEpisodesCount');
    dom.episodesCountBadge = $('#episodesCountBadge');
    dom.animeFabPlayBtn = $('#animeFabPlayBtn');
    dom.animeFabPlayText = $('#animeFabPlayText');
    dom.episodesGrid = $('#episodesGrid');
    dom.episodeFilterBtns = $$('#episodeFilters .lib-filter-btn');
    dom.animePagination = $('#animePagination');
    dom.animeLoading = $('#animeLoading');
    dom.animeLoadingText = $('#animeLoadingText');
    dom.animeEmptyState = $('#animeEmptyState');

    dom.rangeStartEp = $('#rangeStartEp');
    dom.rangeEndEp = $('#rangeEndEp');
    dom.selectRangeBtn = $('#selectRangeBtn');
    dom.queueExpandContainer = $('#queueExpandContainer');
    dom.queueExpandBtn = $('#queueExpandBtn');
    dom.sidebarQueueBtn = $('#sidebarQueueBtn');
    dom.sidebarSettingsBtn = $('#sidebarSettingsBtn');
    dom.recentSearches = $('#recentSearches');
    dom.recentSearchesList = $('#recentSearchesList');
    dom.exportBackupBtn = $('#exportBackupBtn');
    dom.importBackupBtn = $('#importBackupBtn');
    dom.importBackupInput = $('#importBackupInput');

    // Tracker / Library DOMs
    dom.discoverLoading = $('#discoverLoading');
    dom.discoverSpotlight = $('#discoverSpotlight');
    dom.discoverRecommendedSection = $('#discoverRecommendedSection');
    dom.discoverRecommendedGrid = $('#discoverRecommendedGrid');
    dom.discoverRecommendedTitle = $('#discoverRecommendedTitle');
    dom.discoverTrendingGrid = $('#discoverTrendingGrid');
    dom.discoverOngoingGrid = $('#discoverOngoingGrid');
    dom.discoverLatestEpisodesGrid = $('#discoverLatestEpisodesGrid');
    dom.discoverScheduleList = $('#discoverScheduleList');
    dom.discoverMostPopularList = $('#discoverMostPopularList');
    dom.discoverLatestCompletedList = $('#discoverLatestCompletedList');
    dom.libraryGrid = $('#libraryGrid');
    dom.libraryEmpty = $('#libraryEmpty');
    dom.libraryFiltersContainer = $('#libraryFiltersContainer');
    dom.ctxAddLibSubmenu = $('#ctxAddLibSubmenu');
    dom.ctxChangeStatusSubmenu = $('#ctxChangeStatusSubmenu');
  }



  // ============================================================
  //  RADIO (Feature 24)
  // ============================================================
  if (dom.radioGenerateBtn) {
    dom.radioGenerateBtn.addEventListener('click', generateRadioPlaylist);
  }

  if (dom.radioVideoPlayer) {
    dom.radioVideoPlayer.addEventListener('ended', () => {
      if (state.radioCurrentIndex < state.radioPlaylist.length - 1) {
        playRadioTrack(state.radioCurrentIndex + 1);
      }
    });
  }

  async function generateRadioPlaylist() {
    if (!state.libraryAnime || state.libraryAnime.length === 0) {
      showToast('Your library is empty! Add some anime first.', 'warning');
      return;
    }
    
    dom.radioGenerateBtn.disabled = true;
    dom.radioGenerateBtn.innerHTML = '<span>⏳</span> Generating...';
    
    // Get all MAL IDs from the library. (Limit to 50 random anime to prevent long loading times)
    let animeIds = state.libraryAnime.map(a => a.id).filter(id => !isNaN(parseInt(id)));
    // Shuffle the array of IDs
    animeIds = animeIds.sort(() => 0.5 - Math.random());
    const batchIds = animeIds.slice(0, 50).join(',');
    
    if (!batchIds) {
      showToast('No valid MAL IDs found in library.', 'error');
      dom.radioGenerateBtn.disabled = false;
      dom.radioGenerateBtn.innerHTML = '<span>✨</span> Generate from Library';
      return;
    }

    try {
      const filter = document.getElementById('radioFilterSelect').value;
      const res = await fetch(`https://api.animethemes.moe/anime?filter[has]=resources&filter[site]=MyAnimeList&filter[external_id]=${batchIds}&include=animethemes.animethemeentries.videos`);
      const data = await res.json();
      
      let tracks = [];
      if (data && data.anime) {
        data.anime.forEach(anime => {
          if (anime.animethemes) {
            anime.animethemes.forEach(theme => {
              if (filter === 'op' && theme.type !== 'OP') return;
              if (filter === 'ed' && theme.type !== 'ED') return;
              
              if (theme.animethemeentries && theme.animethemeentries.length > 0) {
                const entry = theme.animethemeentries[0];
                if (entry.videos && entry.videos.length > 0) {
                  // Find a good video, preferably one without lyrics or at least high res
                  const video = entry.videos[0]; 
                  // Look up poster from our local library cache using MAL ID
                  const libAnime = state.libraryAnime.find(a => a.id == anime.resources?.find(r=>r.site==='MyAnimeList')?.external_id || anime.id); // It might not match easily, we can just use Jikan proxy or search local library by title
                  const localAnime = state.libraryAnime.find(a => a.title.toLowerCase() === anime.name.toLowerCase() || (a.title.includes(anime.name)));
                  const poster = localAnime ? getProxyImageUrl(localAnime.image) : '/static/img/placeholder.jpg';

                  tracks.push({
                    id: theme.id,
                    animeTitle: anime.name,
                    themeName: theme.slug + ' - ' + (theme.song ? theme.song.title : 'Theme'),
                    videoUrl: video.link,
                    poster: poster
                  });
                }
              }
            });
          }
        });
      }
      
      if (tracks.length === 0) {
        showToast('No tracks found for these filters.', 'warning');
        dom.radioGenerateBtn.disabled = false;
        dom.radioGenerateBtn.innerHTML = '<span>✨</span> Generate from Library';
        return;
      }
      
      // Shuffle tracks
      tracks = tracks.sort(() => 0.5 - Math.random());
      state.radioPlaylist = tracks;
      
      showToast(`Generated playlist with ${tracks.length} tracks!`, 'success');
      playRadioTrack(0);
      
    } catch (err) {
      console.error(err);
      showToast('Failed to generate playlist from AnimeThemes API.', 'error');
    }
    
    dom.radioGenerateBtn.disabled = false;
    dom.radioGenerateBtn.innerHTML = '<span>✨</span> Generate from Library';
  }

  function playRadioTrack(index) {
    if (index < 0 || index >= state.radioPlaylist.length) return;
    state.radioCurrentIndex = index;
    const track = state.radioPlaylist[index];
    
    dom.radioVideoPlayer.src = track.videoUrl;
    dom.radioVideoPlayer.play().catch(e => console.log('Autoplay blocked', e));
    
    document.getElementById('radioNowPlayingTitle').innerText = track.themeName;
    document.getElementById('radioNowPlayingAnime').innerText = track.animeTitle;
    
    const backdrop = document.getElementById('radioBackdrop');
    if (backdrop) backdrop.style.backgroundImage = `url('${track.poster}')`;
    
    renderRadioQueue();
  }

  function renderRadioQueue() {
    dom.radioQueueList.innerHTML = '';
    
    // Only render the next 50 tracks to keep DOM light
    const maxRender = Math.min(state.radioPlaylist.length, state.radioCurrentIndex + 50);
    
    for (let i = state.radioCurrentIndex; i < maxRender; i++) {
      const track = state.radioPlaylist[i];
      const div = document.createElement('div');
      div.className = `radio-queue-item ${i === state.radioCurrentIndex ? 'active' : ''}`;
      
      div.innerHTML = `
        <img src="${track.poster}" class="queue-item-thumb" onerror="this.src='/static/img/placeholder.jpg'">
        <div class="queue-item-info">
          <div class="queue-item-title">${escapeHtml(track.themeName)}</div>
          <div class="queue-item-anime">${escapeHtml(track.animeTitle)}</div>
        </div>
      `;
      div.addEventListener('click', () => {
        playRadioTrack(i);
      });
      dom.radioQueueList.appendChild(div);
    }
  }
  // ============================================================

  // ============================================================
  //  SCHEDULE (Feature 10)
  // ============================================================
  document.querySelectorAll('.schedule-day-picker .day-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.schedule-day-picker .day-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      fetchSchedule(e.target.dataset.day);
    });
  });

  async function fetchSchedule(day) {
    const grid = document.getElementById('scheduleGrid');
    const loading = document.getElementById('scheduleLoading');
    if (!grid || !loading) return;
    grid.innerHTML = '';
    loading.classList.remove('hidden');

    try {
      const res = await fetch(`https://api.jikan.moe/v4/schedules?filter=${day}&limit=25`);
      const data = await res.json();
      loading.classList.add('hidden');
      
      if (data && data.data) {
        if (data.data.length === 0) {
          grid.innerHTML = '<div class="empty-state">No anime scheduled for this day.</div>';
          return;
        }
        
        data.data.forEach(item => {
          const card = document.createElement('div');
          card.className = 'anime-result-card';
          
          const imageSrc = item.images && item.images.jpg ? item.images.jpg.image_url : '/static/img/placeholder.jpg';
          const title = item.title;
          const time = item.broadcast && item.broadcast.string ? item.broadcast.string : 'Unknown time';
          const score = item.score ? item.score : 'N/A';
          const excerpt = item.synopsis ? (item.synopsis.length > 80 ? item.synopsis.substring(0, 80) + '...' : item.synopsis) : 'No description available.';
          
          card.innerHTML = `
            <div class="anime-card-poster-wrapper card-flip-container">
              <div class="card-flip-inner">
                <div class="card-face-front">
                  <img class="anime-card-poster" src="${imageSrc}" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src='/static/img/placeholder.jpg'">
                  <div class="anime-card-badge-row">
                    <span class="card-badge eps">⭐ ${score}</span>
                  </div>
                </div>
                <div class="card-face-back">
                  <div class="card-back-content">
                    <h3 class="card-back-title">${escapeHtml(title)}</h3>
                    <p class="card-back-meta"><b>Airs:</b> ${escapeHtml(time)}</p>
                    <p class="card-back-desc">${escapeHtml(excerpt)}</p>
                  </div>
                </div>
              </div>
            </div>
            <div class="anime-card-info">
              <div class="anime-card-title">${escapeHtml(title)}</div>
              <div class="anime-card-year" style="color: var(--accent-color); font-weight: 500; margin-top:4px;">${escapeHtml(time.split(' ')[0] + ' ' + (time.split(' ')[1] || ''))}</div>
            </div>
          `;
          
          card.addEventListener('click', () => {
            window.searchAndOpenAnime(title);
          });
          
          grid.appendChild(card);
        });
      }
    } catch (err) {
      console.error(err);
      loading.classList.add('hidden');
      grid.innerHTML = '<div class="empty-state">Failed to load schedule.</div>';
    }
  }
  
  window.searchAndOpenAnime = async function(title) {

    showAnimeLoading(`Searching for ${title}...`);
    try {
      const provider = dom.animeProviderSelect.value || 'hianime';
      const cleanTitle = title.split(' (')[0];
      const res = await fetch(`/api/anime/search?query=${encodeURIComponent(cleanTitle)}&provider=${provider}`);
      const data = await res.json();
      
      if (data.results && data.results.length > 0) {
        openAnimeDetails(data.results[0].id, provider);
      } else {
        hideAnimeLoading();
        showToast('Anime not found in current provider.', 'warning');
      }
    } catch (e) {
      hideAnimeLoading();
      showToast('Search failed.', 'error');
    }
  }

  // ============================================================

  //  UI/UX HELPERS
  // ============================================================

  function fadeTransition(container, swapFn) {
    if (!container) return;
    container.classList.add('fade-transition');
    container.style.opacity = '0';
    setTimeout(() => {
      swapFn();
      container.style.opacity = '1';
    }, 150);
  }

  
  function showSkeleton(container, count = 6) {
    if (!container) return;
    let cards = '';
    for (let i = 0; i < count; i++) {
      cards += '<div class="skeleton-card"></div>';
    }
    container.innerHTML = '<div class="skeleton-grid">' + cards + '</div>';
  }

  function showSpinner(container) {
    if (!container) return;
    container.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
  }

  function hideSpinner(container) {
    if (!container) return;
    const spinner = container.querySelector('.spinner-container');
    if (spinner) spinner.remove();
  }

  function renderEmptyState(container, message, iconClass = 'fa-solid fa-ghost', actionHTML = '') {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <i class="${iconClass}"></i>
        <p>${escapeHtml(message)}</p>
        ${actionHTML}
      </div>
    `;
  }

  // ============================================================
  //  INITIALIZATION
  // ============================================================
  async function init() {

  // Jump to Top
  const jumpBtn = document.getElementById('jumpToTopBtn');
  if (jumpBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        jumpBtn.classList.add('visible');
      } else {
        jumpBtn.classList.remove('visible');
      }
    });
    jumpBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

    cacheDom();
    bindEvents();
    setupFormatToggle();
    connectSSE();
    checkFFmpeg();
    await fetchSettings();
    await fetchStatuses();
    await fetchHistory();
    await fetchQueue();
    setupTabs();
    
    
    dom.tabLibrary.click();
  }

  async function fetchHistory() {
    try {
      const res = await fetch('/api/history?limit=1000');
      if (res.ok) {
        state.history = await res.json();
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }

  async function fetchQueue() {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        for (const [id, task] of Object.entries(data)) {
          state.downloads[id] = task;
        }
        renderQueue();
      }
    } catch (e) {
      console.error('Failed to fetch queue', e);
    }
  }

  // Close dropdowns when clicking outside
  document.addEventListener('click', function (event) {
    if (!event.target.matches('.btn-more')) {
      const dropdowns = document.querySelectorAll('.dropdown-content');
      dropdowns.forEach(dd => {
        if (dd.classList.contains('show')) {
          dd.classList.remove('show');
        }
      });
    }
  });

  function bindEvents() {
    // YouTube Panel Events
    dom.fetchBtn.addEventListener('click', (e) => { addRipple(e); fetchInfo(); });
    dom.downloadBtn.addEventListener('click', (e) => { addRipple(e); startDownload(); });
    dom.clearBtn.addEventListener('click', (e) => { addRipple(e); clearAll(); });
    dom.downloadAllBtn.addEventListener('click', (e) => { addRipple(e); downloadAllPreviews(); });

    if (dom.librarySortSelect) {
      dom.librarySortSelect.addEventListener('change', (e) => {
        state.librarySort = e.target.value;
        renderLibrary();
      });
    }

    if (dom.librarySelectToggleBtn) {
      dom.librarySelectToggleBtn.addEventListener('click', () => {
        state.selectMode = !state.selectMode;
        state.selectedIds = [];
        updateBulkSelectUI();
      });
    }

    if (dom.librarySelectAllBtn) {
      dom.librarySelectAllBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.anime-result-card');
        const allIds = Array.from(cards).map(c => c.dataset.id).filter(id => id);
        if (allIds.length === 0) return;

        const allSelected = allIds.every(id => state.selectedIds.includes(id));
        if (allSelected) {
          state.selectedIds = [];
        } else {
          state.selectedIds = allIds;
        }
        updateBulkSelectUI();
      });
    }

    if (dom.bulkCancelBtn) {
      dom.bulkCancelBtn.addEventListener('click', () => {
        state.selectMode = false;
        state.selectedIds = [];
        updateBulkSelectUI();
      });
    }

    if (dom.bulkStatusSelect) {
      dom.bulkStatusSelect.addEventListener('change', (e) => {
        if (!e.target.value) return;
        submitBulkStatus(e.target.value);
        e.target.value = '';
      });
    }

    if (dom.bulkDeleteBtn) {
      dom.bulkDeleteBtn.addEventListener('click', submitBulkDelete);
    }

    dom.qualitySelect.addEventListener('change', () => {
      state.quality = dom.qualitySelect.value;
    });

    dom.urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        fetchInfo();
      }
    });

    dom.urlInput.addEventListener('paste', () => {
      setTimeout(() => {
        const urls = getUrlsFromInput();
        if (urls.length > 0) {
          showToast(`Detected ${urls.length} URL${urls.length > 1 ? 's' : ''}`, 'info');
        }
      }, 100);
    });

    // Anime Panel Events
    dom.animeSearchBtn.addEventListener('click', (e) => {
      addRipple(e);
      if (dom.searchAutocompleteDropdown) dom.searchAutocompleteDropdown.classList.add('hidden');
      searchAnime();
    });
    dom.animeSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (dom.searchAutocompleteDropdown) dom.searchAutocompleteDropdown.classList.add('hidden');
        searchAnime();
      }
    });

    let notesTimeout = null;
    dom.animeNotesTextarea.addEventListener('input', (e) => {
      if (!state.selectedAnime) return;
      clearTimeout(notesTimeout);
      dom.animeNotesStatus.style.opacity = '0';
      
      notesTimeout = setTimeout(async () => {
        try {
          const res = await fetch(`/api/notes/${encodeURIComponent(state.selectedAnime.id)}/0`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: e.target.value })
          });
          if (res.ok) {
            dom.animeNotesStatus.style.opacity = '1';
            setTimeout(() => { dom.animeNotesStatus.style.opacity = '0'; }, 2000);
          }
        } catch (err) {
          console.error('Failed to save note', err);
        }
      }, 1000);
    });

    // Wrapped Logic
    let currentWrappedSlide = 0;
    if (dom.generateWrappedBtn) {
      dom.generateWrappedBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/wrapped');
          const data = await res.json();
          
          document.getElementById('wrappedTotalEpisodes').textContent = formatNumber(data.total_episodes || 0);
          document.getElementById('wrappedTotalHours').textContent = (data.estimated_hours || 0).toFixed(1);
          document.getElementById('wrappedLongestStreak').textContent = data.longest_streak || 0;
          
          const genresHtml = (data.top_genres || []).map(g => `<div>${g.name}</div>`).join('');
          document.getElementById('wrappedTopGenres').innerHTML = genresHtml || 'Everything!';
          
          dom.wrappedModal.classList.remove('hidden');
          currentWrappedSlide = 0;
          dom.wrappedSlides.forEach((s, i) => {
            if (i === 0) s.classList.add('active');
            else s.classList.remove('active');
          });
        } catch (e) {
          console.error('Failed to load wrapped stats', e);
        }
      });
    }

    if (dom.closeWrappedBtn) {
      dom.closeWrappedBtn.addEventListener('click', () => {
        dom.wrappedModal.classList.add('hidden');
      });
    }

    if (dom.finishWrappedBtn) {
      dom.finishWrappedBtn.addEventListener('click', () => {
        dom.wrappedModal.classList.add('hidden');
      });
    }

    document.querySelectorAll('.next-slide-btn').forEach(btn => {
      if (btn.id === 'finishWrappedBtn') return; // Handled above
      btn.addEventListener('click', () => {
        if (currentWrappedSlide < dom.wrappedSlides.length - 1) {
          dom.wrappedSlides[currentWrappedSlide].classList.remove('active');
          currentWrappedSlide++;
          dom.wrappedSlides[currentWrappedSlide].classList.add('active');
        }
      });
    });

    let searchAutocompleteTimer = null;

    dom.animeSearchInput.addEventListener('input', () => {
      const query = dom.animeSearchInput.value.trim();
      if (query.length > 0) {
        dom.animeSearchClearBtn.classList.remove('hidden');
      } else {
        dom.animeSearchClearBtn.classList.add('hidden');
        if (dom.searchAutocompleteDropdown) dom.searchAutocompleteDropdown.classList.add('hidden');
      }

      if (searchAutocompleteTimer) clearTimeout(searchAutocompleteTimer);

      if (query.length > 2) {
        searchAutocompleteTimer = setTimeout(() => {
          if (dom.searchAutocompleteDropdown) {
            dom.searchAutocompleteDropdown.innerHTML = '<div style="padding: 12px; text-align: center; color: #a1a1aa; font-size: 0.9rem;">Searching...</div>';
            dom.searchAutocompleteDropdown.classList.remove('hidden');
          }
          fetchAutocomplete(query);
        }, 200);
      } else {
        if (dom.searchAutocompleteDropdown) dom.searchAutocompleteDropdown.classList.add('hidden');
      }
    });

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      if (dom.searchAutocompleteDropdown && !dom.searchAutocompleteDropdown.classList.contains('hidden')) {
        if (!e.target.closest('.anime-input-wrapper')) {
          dom.searchAutocompleteDropdown.classList.add('hidden');
        }
      }
    });

    dom.animeSearchClearBtn.addEventListener('click', () => {
      dom.animeSearchInput.value = '';
      dom.animeSearchClearBtn.classList.add('hidden');
      dom.animeSearchInput.focus();
    });

    // --- Search Filter Listeners ---
    function updateClearFiltersVisibility() {
      const { genre, year, status } = state.searchFilters;
      if (dom.clearFiltersBtn) {
        dom.clearFiltersBtn.style.display = (genre || year || status) ? 'inline-flex' : 'none';
      }
    }

    function onFilterChange() {
      if (dom.filterGenre) state.searchFilters.genre = dom.filterGenre.value;
      if (dom.filterYear) state.searchFilters.year = dom.filterYear.value;
      if (dom.filterStatus) state.searchFilters.status = dom.filterStatus.value;
      updateClearFiltersVisibility();
      // Re-run search if there's an active query
      const query = dom.animeSearchInput ? dom.animeSearchInput.value.trim() : '';
      if (query) searchAnime();
    }

    if (dom.filterGenre) dom.filterGenre.addEventListener('change', onFilterChange);
    if (dom.filterYear) dom.filterYear.addEventListener('change', onFilterChange);
    if (dom.filterStatus) dom.filterStatus.addEventListener('change', onFilterChange);

    if (dom.clearFiltersBtn) {
      dom.clearFiltersBtn.addEventListener('click', () => {
        state.searchFilters = { genre: '', year: '', status: '' };
        if (dom.filterGenre) dom.filterGenre.value = '';
        if (dom.filterYear) dom.filterYear.value = '';
        if (dom.filterStatus) dom.filterStatus.value = '';
        updateClearFiltersVisibility();
        const query = dom.animeSearchInput ? dom.animeSearchInput.value.trim() : '';
        if (query) searchAnime();
      });
    }

    if (dom.episodeFilterBtns) {
      dom.episodeFilterBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const newFilter = e.target.getAttribute('data-val');
          
          if (newFilter !== 'all' && newFilter !== 'downloaded') {
            const makeGlobal = await showCustomConfirm(`Do you want to set "${e.target.textContent}" as the default filter for ALL anime?\n\n(Click OK for All Anime, Cancel for just this anime)`);
            if (makeGlobal) {
              localStorage.setItem('default_episode_filter', newFilter);
            }
          }
          
          dom.episodeFilterBtns.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          state.episodeFilter = newFilter;
          state.animeCurrentPage = 1;
          if (state.selectedAnime) {
            renderAnimeDetail();
          }
        });
      });
    }

    dom.animeDetailBackBtn.addEventListener('click', () => {
      hideAnimeDetail();
      if (state.lastView === 'library') {
        state.lastView = null;
        if (dom.animePanel && dom.animeDetailSection && dom.animeLoading) {
          dom.animePanel.appendChild(dom.animeLoading);
          dom.animePanel.appendChild(dom.animeDetailSection);
        }
        $$('#libraryPanel > *:not(#animeDetailSection):not(#animeLoading)').forEach(el => el.classList.remove('hidden'));
        fetchLibrary();
      } else {
        renderAnimeResults();
      }
    });

    dom.selectAllEpisodes.addEventListener('change', () => {
      const checked = dom.selectAllEpisodes.checked;
      state.selectedEpisodes.clear();

      const chks = dom.episodesGrid.querySelectorAll('.episode-chk');
      chks.forEach((chk) => {
        chk.checked = checked;
        if (checked) {
          const epId = chk.getAttribute('data-ep-id');
          const epNum = parseInt(chk.getAttribute('data-ep-num'));
          const epTitle = chk.getAttribute('data-ep-title');
          state.selectedEpisodes.add(JSON.stringify({ id: epId, number: epNum, title: epTitle }));
        }
      });
      updateSelectedCount();
    });

    dom.animeBulkDownloadBtn.addEventListener('click', (e) => {
      e.preventDefault();
      downloadSelectedEpisodes();
    });

    if (dom.selectRangeBtn) {
      dom.selectRangeBtn.addEventListener('click', () => {
        const start = parseInt(dom.rangeStartEp.value) || 1;
        const end = parseInt(dom.rangeEndEp.value) || 99999;

        if (state.selectedAnime && state.selectedAnime.episodes) {
          state.selectedAnime.episodes.forEach(ep => {
            const epData = { id: ep.id, number: ep.number, title: ep.title || '' };
            const epDataStr = JSON.stringify(epData);

            if (ep.number >= start && ep.number <= end) {
              state.selectedEpisodes.add(epDataStr);
            } else {
              for (const item of state.selectedEpisodes) {
                const parsed = JSON.parse(item);
                if (parsed.id === ep.id) {
                  state.selectedEpisodes.delete(item);
                  break;
                }
              }
            }
          });
          updateSelectedCount();
          renderAnimeDetail();
        }
      });
    }

    if (dom.queueExpandBtn) {
      dom.queueExpandBtn.addEventListener('click', () => {
        state.isQueueExpanded = !state.isQueueExpanded;
        renderQueue();
      });
    }

    if (dom.sidebarQueueBtn) {
      dom.sidebarQueueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Toggle the downloads dropdown
        if (dom.downloadsDropdownBtn) {
          dom.downloadsDropdownBtn.click();
        }
      });
    }

    // Settings
    dom.settingsBtn.addEventListener('click', () => openSettings());
    if (dom.sidebarSettingsBtn) {
      dom.sidebarSettingsBtn.addEventListener('click', () => openSettings());
    }
    dom.settingsCloseBtn.addEventListener('click', () => closeSettings());
    
    if (dom.clearWatchedBtn) {
      dom.clearWatchedBtn.addEventListener('click', async () => {
        if (!(await showCustomConfirm('Are you sure you want to delete ALL watched episodes? This cannot be undone.'))) return;
        
        try {
          const res = await fetch('/api/storage/clear-watched', { method: 'POST' });
          const data = await res.json();
          if (data.success) {
            showToast(`Deleted ${data.deleted_count} files, freed ${(data.freed_bytes / (1024*1024*1024)).toFixed(2)} GB`, 'success');
            fetchStorageStats();
            // Re-render library if needed
            fetchLibrary();
          }
        } catch (e) {
          console.error(e);
          showToast('Failed to clear watched downloads', 'error');
        }
      });
    }

    // Modal
    dom.modalCancelBtn.addEventListener('click', () => hideModal());
    dom.modalDownloadBtn.addEventListener('click', () => {
      hideModal();
      startDownload(state._pendingPlaylistUrls || null);
    });
    dom.playlistModal.addEventListener('click', (e) => {
      if (e.target === dom.playlistModal) hideModal();
    });

    // Settings
    dom.settingsBtn.addEventListener('click', () => openSettings());
    dom.settingsCloseBtn.addEventListener('click', () => closeSettings());
    dom.settingsOverlay.addEventListener('click', () => closeSettings());
    dom.saveSettingsBtn.addEventListener('click', (e) => { addRipple(e); saveSettings(); });
    
    // Appearance Swatches
    document.querySelectorAll('.accent-swatch').forEach(swatch => {
      swatch.addEventListener('click', async (e) => {
        addRipple(e);
        const color = e.target.getAttribute('data-color');
        document.documentElement.style.setProperty('--accent', color);
        state.settings.accent_color = color;
        // Save immediately
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accent_color: color })
          });
        } catch (err) {
          console.error("Failed to save accent color", err);
        }
      });
    });

    if (dom.exportBackupBtn) {
      dom.exportBackupBtn.addEventListener('click', (e) => { addRipple(e); exportBackup(); });
    }
    if (dom.importBackupBtn && dom.importBackupInput) {
      dom.importBackupBtn.addEventListener('click', (e) => { addRipple(e); dom.importBackupInput.click(); });
      dom.importBackupInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          importBackup(e.target.files[0]);
        }
      });
    }
    if (dom.browseDirBtn) {
      dom.browseDirBtn.addEventListener('click', async (e) => {
        addRipple(e);
        try {
          const res = await fetch('/api/select-folder', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.folder) {
              dom.downloadDirInput.value = data.folder;
            }
          }
        } catch (err) {
          console.error('Failed to browse folder', err);
        }
      });
    }

    
    if (dom.addStatusBtn) {
      dom.addStatusBtn.addEventListener('click', (e) => {
        addRipple(e);
        const label = dom.newStatusInput.value.trim();
        if (!label) return;
        const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        if (state.libraryStatuses.some(s => s.id === id)) {
          showToast('Status already exists', 'error');
          return;
        }
        const newStatuses = [...state.libraryStatuses, { id, label }];
        saveStatuses(newStatuses);
        dom.newStatusInput.value = '';
      });
    }

    // Downloads Dropdown Events
    if (dom.downloadsDropdownBtn) {
      dom.downloadsDropdownBtn.addEventListener('click', (e) => {
        addRipple(e);
        dom.downloadsDropdown.classList.toggle('show');
        e.stopPropagation();
      });
    }

    // Close downloads dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (dom.downloadsDropdown && dom.downloadsDropdown.classList.contains('show')) {
        if (!dom.downloadsDropdown.contains(e.target) && !dom.downloadsDropdownBtn.contains(e.target)) {
          dom.downloadsDropdown.classList.remove('show');
        }
      }
    });

    // Close modals on outside click
    if (dom.downloadDirInput) {
      dom.downloadDirInput.addEventListener('click', () => {
        if (dom.downloadDirInput.value) {
          fetch('/api/open_folder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_path: dom.downloadDirInput.value })
          }).catch(() => { });
        }
      });
    }

    // FFmpeg warning
    if (dom.ffmpegWarningClose) {
      dom.ffmpegWarningClose.addEventListener('click', () => {
        dom.ffmpegWarning.classList.add('hidden');
      });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (dom.settingsDrawer && dom.settingsDrawer.classList.contains('open')) closeSettings();
        if (dom.playlistModal && dom.playlistModal.classList.contains('visible')) hideModal();
        
        const customDialog = document.getElementById('customDialogModal');
        if (customDialog && !customDialog.classList.contains('hidden')) {
          const cancelBtn = document.getElementById('customDialogCancel');
          if (cancelBtn) cancelBtn.click();
        }
        
        const settingsOverlay = document.querySelector('.settings-overlay.visible');
        if (settingsOverlay) closeSettings();

        if (dom.animeDetailSection && !dom.animeDetailSection.classList.contains('hidden')) {
           dom.animeDetailBackBtn.click();
        }

        document.querySelectorAll('.dropdown-content.show').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.context-menu:not(.hidden)').forEach(el => el.classList.add('hidden'));
      }
    });
  }

  // ============================================================
  //  SYSTEM CHECK
  // ============================================================
  async function checkFFmpeg() {
    try {
      const res = await fetch('/api/system-check');
      if (!res.ok) return;
      const data = await res.json();
      state.ffmpeg = data.ffmpeg || { installed: false };

      if (!state.ffmpeg.installed) {
        dom.ffmpegWarning.classList.remove('hidden');
      }

    } catch {
      // Silent fail
    }
  }

  // ============================================================
  //  SETTINGS
  // ============================================================
  async function fetchStorageStats() {
    if (!dom.storageChart) return;
    try {
      const res = await fetch('/api/storage/stats');
      const data = await res.json();
      
      if (!res.ok || data.error) {
        console.error('Failed to load storage stats:', data.error || res.status);
        if (dom.storageNovaBytes) dom.storageNovaBytes.textContent = 'Error loading';
        return;
      }
      
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
      };

      if (dom.storageNovaBytes) dom.storageNovaBytes.textContent = formatBytes(data.nova_total_bytes);
      if (dom.storageWatchedBytes) dom.storageWatchedBytes.textContent = formatBytes(data.watched_bytes);
      if (dom.storageFreeBytes) dom.storageFreeBytes.textContent = formatBytes(data.free_disk_bytes);
      
      const totalDisk = data.total_disk_bytes;
      if (totalDisk > 0) {
        const novaActiveBytes = Math.max(0, data.nova_total_bytes - data.watched_bytes);
        
        // Give a minimum visual representation if non-zero but < 1%
        let pctNova = (novaActiveBytes / totalDisk) * 100;
        let pctWatched = (data.watched_bytes / totalDisk) * 100;
        
        if (pctNova > 0 && pctNova < 1) pctNova = 1;
        if (pctWatched > 0 && pctWatched < 1) pctWatched = 1;
        
        dom.storageChart.style.background = `conic-gradient(var(--accent) 0% ${pctNova}%, #ef4444 ${pctNova}% ${pctNova + pctWatched}%, var(--bg-tertiary) ${pctNova + pctWatched}% 100%)`;
      }
      
    } catch (e) {
      console.error('Failed to fetch storage stats', e);
    }
  }

  
  function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  async function fetchStorageStats() {
    try {
      const res = await fetch('/api/storage/stats');
      if (!res.ok) return;
      const data = await res.json();
      updateStorageDashboard(data);
    } catch (e) { console.error('Storage stats error', e); }
  }

  function updateStorageDashboard(stats) {
    if (!dom.storageChart || !dom.storageNovaBytes) return;
    
    dom.storageNovaBytes.textContent = formatBytes(stats.nova_total_bytes);
    dom.storageWatchedBytes.textContent = formatBytes(stats.watched_bytes);
    dom.storageFreeBytes.textContent = formatBytes(stats.free_disk_bytes);
    
    // Draw Pie Chart with CSS conic-gradient
    const total = stats.nova_total_bytes || 1; // avoid division by 0
    const watchedPct = (stats.watched_bytes / total) * 100;
    // We only chart nova_total_bytes here as a 100% circle, where red is watched, accent is unwatched
    // Or we chart against total_disk_bytes? The user wants 'how much disk space your downloaded episodes are consuming'.
    // Let's show: 
    // red = watched_bytes
    // accent = nova_total_bytes - watched_bytes
    // We can just use degrees:
    const watchedDeg = (stats.watched_bytes / total) * 360;
    
    dom.storageChart.style.background = `conic-gradient(
      #ef4444 0deg ${watchedDeg}deg, 
      var(--accent) ${watchedDeg}deg 360deg
    )`;
  }

  async function fetchSettings() {
    try {
      fetchStorageStats();
      const res = await fetch('/api/settings');
      if (!res.ok) return;
      const data = await res.json();
      state.settings = data;
      if (dom.downloadDirInput) {
        dom.downloadDirInput.value = data.download_dir || '';
      }
      if (dom.settingsLanguage) dom.settingsLanguage.value = data.default_language || 'SUB';
      if (dom.settingsSubtitles) dom.settingsSubtitles.value = data.default_subtitles || 'Yes';
      if (dom.settingsQuality) dom.settingsQuality.value = data.default_quality || 'best';
      if (dom.settingsSmartDownload) dom.settingsSmartDownload.value = data.smart_download || 'false';
      if (dom.settingsAutoDelete) dom.settingsAutoDelete.value = data.auto_delete || 'false';
      if (dom.settingsDiscordRpc) dom.settingsDiscordRpc.value = data.discord_rpc_enabled || 'false';
      if (dom.settingsDiscordClientId) dom.settingsDiscordClientId.value = data.discord_client_id || '';

      // Also sync the Anime tab dropdowns to match user settings
      if (dom.animeQualitySelect && data.default_quality) {
        dom.animeQualitySelect.value = data.default_quality;
      }
      if (dom.animeSubOrDubSelect && data.default_language) {
        dom.animeSubOrDubSelect.value = data.default_language;
      }
    } catch {
      // Silent
    }
  }

  async function saveSettings() {
    const dir = dom.downloadDirInput.value.trim();
    const lang = dom.settingsLanguage ? dom.settingsLanguage.value : 'SUB';
    const subs = dom.settingsSubtitles ? dom.settingsSubtitles.value : 'Yes';
    const qual = dom.settingsQuality ? dom.settingsQuality.value : 'best';
    const smartDown = dom.settingsSmartDownload ? dom.settingsSmartDownload.value : 'false';
    const autoDel = dom.settingsAutoDelete ? dom.settingsAutoDelete.value : 'false';
    const discordRpc = dom.settingsDiscordRpc ? dom.settingsDiscordRpc.value : 'false';
    const discordClientId = dom.settingsDiscordClientId ? dom.settingsDiscordClientId.value : '';

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          download_dir: dir,
          default_language: lang,
          default_subtitles: subs,
          default_quality: qual,
          smart_download: smartDown,
          auto_delete: autoDel,
          discord_rpc_enabled: discordRpc,
          discord_client_id: discordClientId
        }),
      });
      const data = await res.json();
      if (res.ok) {
        state.settings.download_dir = data.download_dir || dir;
        state.settings.default_language = data.default_language || lang;
        state.settings.default_subtitles = data.default_subtitles || subs;
        state.settings.default_quality = data.default_quality || qual;
        state.settings.smart_download = data.smart_download || smartDown;
        state.settings.auto_delete = data.auto_delete || autoDel;
        
        // Sync Dropdowns in main UI

        // Sync UI
        if (dom.animeQualitySelect) dom.animeQualitySelect.value = state.settings.default_quality;
        if (dom.animeSubOrDubSelect) dom.animeSubOrDubSelect.value = state.settings.default_language;

        showToast('Settings saved!', 'success');
        closeSettings();
      } else {
        showToast(data.error || 'Failed to save settings', 'error');
      }
    } catch {
      showToast('Failed to save settings', 'error');
    }
  }

  // ============================================================
  //  BACKUP & RESTORE
  // ============================================================
  async function exportBackup() {
    try {
      showToast('Generating backup...', 'info');
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const filename = res.headers.get('content-disposition')?.split('filename=')[1] || 'novastream_backup.json';

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('Backup exported successfully', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to export backup', 'error');
    }
  }

  async function importBackup(file) {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      showToast('Importing backup...', 'info');
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      showToast(`Imported: ${data.added} added, ${data.updated} updated, ${data.skipped} skipped`, 'success');

      // Refresh UI
      fetchLibrary();
      fetchStats();
      dom.importBackupInput.value = ''; // Reset input
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
      dom.importBackupInput.value = '';
    }
  }

  // ============================================================
  //  STATUSES
  // ============================================================
  
  async function fetchStatuses() {
    try {
      const res = await fetch('/api/settings/statuses');
      if (!res.ok) throw new Error('API not available');
      const data = await res.json();
      if (data.success) {
        state.libraryStatuses = data.statuses;
        if (!state.libraryFilter && state.libraryStatuses.length > 0) {
            state.libraryFilter = state.libraryStatuses[0].id;
        }
        renderLibraryTabs();
        renderCustomStatusesList();
        renderContextSubmenus();
        updateBulkStatusSelect();
      }
    } catch (err) {
      console.warn("Could not fetch statuses from backend, falling back to default.", err);
      state.libraryStatuses = [
        { id: 'watching', label: 'Watching' },
        { id: 'completed', label: 'Completed' },
        { id: 'on_hold', label: 'On Hold' },
        { id: 'dropped', label: 'Dropped' },
        { id: 'plan_to_watch', label: 'Plan to Watch' }
      ];
      if (!state.libraryFilter && state.libraryStatuses.length > 0) {
          state.libraryFilter = state.libraryStatuses[0].id;
      }
      renderLibraryTabs();
      renderCustomStatusesList();
      renderContextSubmenus();
    }
  }

  async function saveStatuses(statuses) {
    try {
      const res = await fetch('/api/settings/statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statuses })
      });
      if (res.ok) {
        state.libraryStatuses = statuses;
        renderLibraryTabs();
        renderCustomStatusesList();
        renderContextSubmenus();
      }
    } catch (err) { }
  }

  function renderLibraryTabs() {
    if (!dom.libraryFiltersContainer) return;

    let html = ``;

    (state.libraryStatuses || []).forEach(status => {
      const count = (state.libraryAnime || []).filter(a => a.status === status.id).length;
      const isActive = state.libraryFilter === status.id ? 'active' : '';
      html += `<button class="lib-filter-btn ${isActive}" data-status="${status.id}">${status.label} (${count})</button>`;
    });

    dom.libraryFiltersContainer.innerHTML = html;

    // Bind events
    dom.libraryFilters = $$('#libraryFiltersContainer .lib-filter-btn');
    dom.libraryFilters.forEach(btn => {
      btn.addEventListener('click', (e) => {
        dom.libraryFilters.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.libraryFilter = e.target.dataset.status;
        renderLibrary();
      });
    });
  }

  function renderContextSubmenus() {
    if (!dom.ctxAddLibSubmenu || !dom.ctxChangeStatusSubmenu) return;
    let html = '';
    (state.libraryStatuses || []).forEach(status => {
      html += `<div class="context-menu-item" data-status="${status.id}">${status.label}</div>`;
    });
    dom.ctxAddLibSubmenu.innerHTML = html;
    dom.ctxChangeStatusSubmenu.innerHTML = html;
  }

  function renderCustomStatusesList() {
    if (!dom.customStatusesContainer) return;
    let html = '';
    (state.libraryStatuses || []).forEach((status, i) => {
      html += `
        <div class="custom-status-item">
          <span>${status.label}</span>
          <div style="display:flex; gap: 12px;">
            <button class="custom-status-edit" data-idx="${i}" title="Edit Name" aria-label="Edit Name">✏️</button>
            <button class="custom-status-up" data-idx="${i}" title="Move Up" aria-label="Move Up">⬆️</button>
            <button class="custom-status-down" data-idx="${i}" title="Move Down" aria-label="Move Down">⬇️</button>
            <button class="custom-status-remove" data-id="${status.id}" title="Remove" aria-label="Remove status">✖</button>
          </div>
        </div>
      `;
    });
    dom.customStatusesContainer.innerHTML = html;

    dom.customStatusesContainer.querySelectorAll('.custom-status-edit').forEach(btn => {
      btn.onclick = async (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const status = state.libraryStatuses[idx];
        const newName = await showCustomPrompt('Enter new name for status:', status.label);
        if (newName && newName.trim() !== '' && newName !== status.label) {
          const arr = [...state.libraryStatuses];
          arr[idx].label = newName.trim();
          saveStatuses(arr);
        }
      }
    });

    dom.customStatusesContainer.querySelectorAll('.custom-status-up').forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        if (idx > 0) {
          const arr = [...state.libraryStatuses];
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          saveStatuses(arr);
        }
      }
    });

    dom.customStatusesContainer.querySelectorAll('.custom-status-down').forEach(btn => {
      btn.onclick = (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        if (idx < state.libraryStatuses.length - 1) {
          const arr = [...state.libraryStatuses];
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
          saveStatuses(arr);
        }
      }
    });

    // Bind remove buttons
    const removeBtns = dom.customStatusesContainer.querySelectorAll('.custom-status-remove');
    removeBtns.forEach(btn => {
      btn.onclick = (e) => {
        const id = e.target.dataset.id;
        const newStatuses = state.libraryStatuses.filter(s => s.id !== id);
        saveStatuses(newStatuses);
      };
    });
  }

  function openSettings() {
    dom.settingsDrawer.classList.add('open');
    dom.settingsDrawer.setAttribute('aria-hidden', 'false');
    dom.settingsOverlay.classList.add('visible');
    dom.settingsOverlay.setAttribute('aria-hidden', 'false');
    dom.downloadDirInput.focus();
  }

  function closeSettings() {
    dom.settingsDrawer.classList.remove('open');
    dom.settingsDrawer.setAttribute('aria-hidden', 'true');
    dom.settingsOverlay.classList.remove('visible');
    dom.settingsOverlay.setAttribute('aria-hidden', 'true');
  }

  // ============================================================
  //  FORMAT TOGGLE
  // ============================================================
  function setupFormatToggle() {
    const buttons = dom.formatToggle.querySelectorAll('.toggle-btn');
    const indicator = dom.formatToggle.querySelector('.toggle-indicator');

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const format = btn.dataset.format;
        state.format = format;

        buttons.forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });

        if (format === 'audio') {
          indicator.classList.add('audio');
          dom.qualityGroup.style.opacity = '0.4';
          dom.qualityGroup.style.pointerEvents = 'none';
        } else {
          indicator.classList.remove('audio');
          dom.qualityGroup.style.opacity = '1';
          dom.qualityGroup.style.pointerEvents = 'auto';
        }
      });
    });
  }

  // ============================================================
  //  SSE CONNECTION
  // ============================================================
  function connectSSE() {
    fetch('/api/progress/connect')
      .then((res) => {
        if (!res.ok) throw new Error('SSE connect failed');
        return res.json();
      })
      .then((data) => {
        state.clientId = data.client_id;
        setupEventSource();
      })
      .catch(() => {
        setTimeout(connectSSE, 3000);
      });
  }

  function setupEventSource() {
    if (state.eventSource) state.eventSource.close();

    const es = new EventSource(`/api/progress/${state.clientId}`);
    state.eventSource = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.heartbeat) return;
        handleProgressUpdate(data);
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      es.close();
      state.eventSource = null;
      setTimeout(connectSSE, 3000);
    };
  }

  function handleProgressUpdate(data) {
    const { download_id, title, format, progress, speed, eta, status, message, filename, filesize, downloaded_size, total_size } = data;
    if (!download_id) return;

    state.downloads[download_id] = {
      ...state.downloads[download_id],
      title: title || state.downloads[download_id]?.title || 'Downloading...',
      format: format || state.downloads[download_id]?.format || state.format,
      progress: progress ?? state.downloads[download_id]?.progress ?? 0,
      speed: speed || '',
      eta: eta || '',
      status: status || 'downloading',
      message: message || '',
      filename: filename || state.downloads[download_id]?.filename || '',
      filesize: filesize || state.downloads[download_id]?.filesize || 0,
      downloaded_size: downloaded_size || state.downloads[download_id]?.downloaded_size || '',
      total_size: total_size || state.downloads[download_id]?.total_size || '',
    };

    updateQueueItem(download_id, state.downloads[download_id]);

    if (status === 'finished') {
      showToast(`✅ ${title || 'Download'} completed!`, 'success');
      const el = document.querySelector(`[data-download-id="${download_id}"]`);
      if (el) spawnConfetti(el);

      // If we are currently viewing an anime detail page, re-render it to update the buttons dynamically
      if (dom.animeDetailSection && !dom.animeDetailSection.classList.contains('hidden') && state.selectedAnime) {
        renderAnimeDetail();
      }
    }

    if (status === 'error') {
      const errMsg = data.error || message || 'Unknown error';
      showToast(`❌ ${title || 'Download'} failed: ${errMsg}`, 'error');
    }
  }

  // ============================================================
  //  URL HELPERS
  // ============================================================
  function getUrlsFromInput() {
    const raw = dom.urlInput.value.trim();
    if (!raw) return [];
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && (l.includes('youtube.com') || l.includes('youtu.be')));
  }

  // ============================================================
  //  FETCH INFO
  // ============================================================
  async function fetchInfo() {
    const urls = getUrlsFromInput();
    if (urls.length === 0) {
      showToast('Please paste at least one YouTube URL', 'warning');
      dom.urlInput.focus();
      return;
    }

    dom.fetchBtn.disabled = true;
    dom.fetchBtn.innerHTML = '<span class="loading-spinner"></span> Fetching...';

    state.previews = [];
    state.previewQualities = {};
    dom.previewGrid.innerHTML = '';

    try {
      const results = await Promise.allSettled(
        urls.map((url) =>
          fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          }).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
        )
      );

      const videos = [];
      let playlistDetected = null;

      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.is_playlist && data.entries) {
            playlistDetected = data;
            data.entries.forEach((entry) => videos.push(entry));
          } else {
            data._sourceUrl = urls[i];
            videos.push(data);
          }
        } else {
          showToast(`Failed to fetch info for URL #${i + 1}`, 'error');
        }
      });

      state.previews = videos;
      renderPreviews(videos);

      if (playlistDetected) {
        showPlaylistModal(playlistDetected);
      }

      if (videos.length > 0) {
        showToast(`Found ${videos.length} video${videos.length > 1 ? 's' : ''}`, 'success');
      }
    } catch (err) {
      showToast('Failed to fetch video info.', 'error');
    } finally {
      dom.fetchBtn.disabled = false;
      dom.fetchBtn.innerHTML = '<span>🔍</span> Fetch Info';
    }
  }

  // ============================================================
  //  START DOWNLOAD
  // ============================================================
  async function startDownload(urls) {
    const downloadUrls = urls || getUrlsFromInput();
    if (downloadUrls.length === 0) {
      showToast('Please paste at least one YouTube URL', 'warning');
      dom.urlInput.focus();
      return;
    }

    dom.downloadBtn.disabled = true;
    dom.downloadBtn.innerHTML = '<span class="loading-spinner"></span> Starting...';

    try {
      const items = downloadUrls.map((u) => ({
        url: u,
        format: state.format,
        quality: state.quality,
      }));

      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const downloadIds = data.download_ids || [];

      downloadIds.forEach((id, i) => {
        state.downloads[id] = {
          title: downloadUrls[i] || 'Downloading...',
          format: state.format,
          progress: 0,
          speed: '',
          eta: '',
          status: 'queued',
          message: '',
        };
      });

      renderQueue();
      showToast(`Download started for ${downloadIds.length} file${downloadIds.length > 1 ? 's' : ''}`, 'success');
      dom.urlInput.value = '';
    } catch {
      showToast('Failed to start download.', 'error');
    } finally {
      dom.downloadBtn.disabled = false;
      dom.downloadBtn.innerHTML = '<span>⬇️</span> Download';
    }
  }

  // ============================================================
  //  RENDER QUEUE
  // ============================================================
  const downloadContextMenu = document.getElementById('downloadContextMenu');

  function toggleDropdown(e, id) {
    e.stopPropagation();
    if (!downloadContextMenu) return;

    const data = state.downloads[id];
    if (!data) return;

    const left = e.pageX + 180 > window.innerWidth ? window.innerWidth - 190 : e.pageX;
    downloadContextMenu.style.left = left + 'px';
    downloadContextMenu.style.top = e.pageY + 'px';
    downloadContextMenu.classList.remove('hidden');

    document.getElementById('dlCtxOpenFolder').onclick = (ev) => { ev.stopPropagation(); downloadContextMenu.classList.add('hidden'); openFolder(id); };
    document.getElementById('dlCtxPause').onclick = (ev) => { ev.stopPropagation(); downloadContextMenu.classList.add('hidden'); pauseDownload(id); };
    document.getElementById('dlCtxResume').onclick = (ev) => { ev.stopPropagation(); downloadContextMenu.classList.add('hidden'); resumeDownload(id); };
    document.getElementById('dlCtxCopyUrl').onclick = (ev) => { ev.stopPropagation(); downloadContextMenu.classList.add('hidden'); copyUrl(data.url); };
    document.getElementById('dlCtxDelete').onclick = (ev) => { ev.stopPropagation(); downloadContextMenu.classList.add('hidden'); cancelDownload(id); };
  }

  function renderQueue() {
    const ids = Object.keys(state.downloads).filter(id => state.downloads[id].status !== 'finished');
    dom.queueCount.textContent = ids.length;

    if (ids.length === 0) {
      dom.downloadQueue.innerHTML = '';
      dom.queueEmpty.style.display = '';
      dom.batchControlsContainer.style.display = 'none';
      return;
    }

    dom.queueEmpty.style.display = 'none';
    dom.batchControlsContainer.style.display = ids.length >= 2 ? 'flex' : 'none';

    // To preserve order, append elements in the order of `ids`
    // We re-append them so they match the `ids` array order
    ids.forEach((id) => {
      let item = document.querySelector(`[data-download-id="${id}"]`);
      if (!item) {
        item = createQueueItem(id, state.downloads[id]);
      }
      dom.downloadQueue.appendChild(item);
    });

    // Remove items that are no longer active
    Array.from(dom.downloadQueue.children).forEach(child => {
      if (!ids.includes(child.dataset.downloadId)) {
        child.remove();
      }
    });
  }

  function createQueueItem(downloadId, data) {
    const item = document.createElement('div');
    item.className = 'download-card';
    item.setAttribute('data-download-id', downloadId);
    item.setAttribute('draggable', 'true');

    // Drag events for reordering
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', downloadId);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      // Re-evaluate order
      const newOrder = Array.from(dom.downloadQueue.children).map(c => c.dataset.downloadId);
      fetch('/api/downloads/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      }).catch(console.error);
    });
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = getDragAfterElement(dom.downloadQueue, e.clientY);
      if (afterElement == null) {
        dom.downloadQueue.appendChild(item);
      } else {
        dom.downloadQueue.insertBefore(item, afterElement);
      }
    });

    const isAnime = data.format === 'anime';
    const statusClass = data.status || 'queued';

    item.innerHTML = `
      <div class="download-card-drag" title="Drag to reorder">⋮⋮</div>
      <img src="${data.thumbnail || '/static/img/placeholder.jpg'}" class="download-card-thumb" onerror="this.onerror=null; this.src='/static/img/placeholder.jpg'">
      <div class="download-card-body">
        <div class="download-card-title" data-el="title">${escapeHtml(data.title || 'Unknown Title')}</div>
        <div class="download-card-meta">
          <span data-el="size"></span>
          <span data-el="speed">${data.speed || '—'}</span>
          <span data-el="eta">${data.eta ? `ETA: ${data.eta}` : ''}</span>
        </div>
        <div class="download-card-progress">
          <div class="download-card-progress-fill" data-el="progressFill" style="width: ${data.progress || 0}%"></div>
        </div>
      </div>
      <div class="download-card-actions">
        <button class="download-card-btn btn-pause" onclick="window.NovaStream.pauseDownload('${downloadId}')" title="Pause" aria-label="Pause">⏸</button>
        <button class="download-card-btn btn-resume" onclick="window.NovaStream.resumeDownload('${downloadId}')" title="Resume" aria-label="Resume" style="display:none;">▶️</button>
        <button class="download-card-btn danger btn-cancel" onclick="window.NovaStream.cancelDownload('${downloadId}')" title="Cancel" aria-label="Cancel">✖</button>
      </div>
    `;

    return item;
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.download-card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  function updateQueueItem(downloadId, data) {
    const item = document.querySelector(`[data-download-id="${downloadId}"]`);
    if (!item) return;

    const fill = item.querySelector('[data-el="progressFill"]');
    if (fill) fill.style.width = `${data.progress || 0}%`;

    // Update Actions
    const pauseBtn = item.querySelector('.btn-pause');
    const resumeBtn = item.querySelector('.btn-resume');

    if (pauseBtn) pauseBtn.style.display = (data.status === 'downloading' || data.status === 'processing' || data.status === 'queued') ? 'flex' : 'none';
    if (resumeBtn) resumeBtn.style.display = data.status === 'paused' ? 'flex' : 'none';

    const speed = item.querySelector('[data-el="speed"]');
    if (speed) speed.textContent = data.speed || '—';

    const sizeEl = item.querySelector('[data-el="size"]');
    if (sizeEl) {
      if (data.downloaded_size) {
        sizeEl.textContent = data.total_size && data.total_size !== '0 B' ? `${data.downloaded_size} / ${data.total_size}` : `${data.downloaded_size} downloaded`;
      } else {
        sizeEl.textContent = `${Math.round(data.progress || 0)}%`;
      }
    }

    const eta = item.querySelector('[data-el="eta"]');
    if (eta) eta.textContent = data.eta ? `ETA: ${data.eta}` : '';

    const titleEl = item.querySelector('[data-el="title"]');
    if (titleEl && data.title) titleEl.textContent = data.title;
  }

  function removeFromQueue(downloadId) {
    const item = document.querySelector(`[data-download-id="${downloadId}"]`);
    if (item) {
      item.style.transition = 'opacity 0.3s, transform 0.3s';
      item.style.opacity = '0';
      item.style.transform = 'translateX(20px)';
      setTimeout(() => item.remove(), 300);
    }

    if (state.downloads[downloadId] && state.downloads[downloadId].status === 'finished') {
      // It finished, move to completed
      fetchCompletedDownloads();
    }

    delete state.downloads[downloadId];
    renderQueue();
  }

  // --- Completed Queue ---
  async function fetchCompletedDownloads() {
    dom.completedQueue.innerHTML = '';
    showSpinner(dom.completedQueue);
    try {
      const res = await fetch('/api/history?limit=50');
      const data = await res.json();
      hideSpinner(dom.completedQueue);
      renderCompletedQueue(data);
    } catch (e) {
      console.error('Failed to fetch completed downloads', e);
      hideSpinner(dom.completedQueue);
    }
  }

  function renderCompletedQueue(items) {
    dom.completedQueue.innerHTML = '';
    if (!items || items.length === 0 || !items.some(i => i.status === 'finished')) {
      renderEmptyState(dom.completedQueue, 'No completed downloads yet.', 'fa-solid fa-box-open');
      return;
    }

    items.forEach(item => {
      if (item.status !== 'finished') return;
      const el = document.createElement('div');
      el.className = 'download-card';
      const sizeStr = item.filesize ? (item.filesize / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown size';
      const dateStr = item.completed_at ? new Date(item.completed_at * 1000).toLocaleDateString() : '';
      const filepath = item.filepath || item.filename || item.id;

      el.innerHTML = `
        <img src="/static/img/placeholder.jpg" class="download-card-thumb">
        <div class="download-card-body">
          <div class="download-card-title">${escapeHtml(item.title || item.url)}</div>
          <div class="download-card-meta">
            <span>${sizeStr}</span>
            <span>${dateStr}</span>
          </div>
        </div>
        <div class="download-card-actions">
          <button class="download-card-btn" onclick="window.NovaStream.openFolder('${escapeHtml(item.id)}')" title="Open Folder">📁</button>
          <button class="download-card-btn" onclick="window.NovaStream.playRemoteFile('${escapeHtml(filepath)}')" title="Play">▶️</button>
        </div>
      `;
      dom.completedQueue.appendChild(el);
    });
  }

  // --- Tab Toggles & Batch ---
  if (dom.tabActiveDownloads) {
    dom.tabActiveDownloads.onclick = () => {
      dom.tabActiveDownloads.classList.add('active');
      dom.tabCompletedDownloads.classList.remove('active');
      fadeTransition(dom.activeDownloadsView.parentElement, () => {
        dom.activeDownloadsView.style.display = 'block';
        dom.completedDownloadsView.style.display = 'none';
      });
    };
  }
  if (dom.tabCompletedDownloads) {
    dom.tabCompletedDownloads.onclick = () => {
      dom.tabCompletedDownloads.classList.add('active');
      dom.tabActiveDownloads.classList.remove('active');
      fadeTransition(dom.activeDownloadsView.parentElement, () => {
        dom.activeDownloadsView.style.display = 'none';
        dom.completedDownloadsView.style.display = 'block';
      });
      fetchCompletedDownloads();
    };
  }
  if (dom.pauseAllBtn) {
    dom.pauseAllBtn.onclick = () => {
      const activeIds = Object.keys(state.downloads).filter(id => state.downloads[id].status === 'downloading' || state.downloads[id].status === 'queued');
      activeIds.forEach(id => pauseDownload(id));
    };
  }
  if (dom.cancelAllBtn) {
    dom.cancelAllBtn.onclick = () => {
      const activeIds = Object.keys(state.downloads).filter(id => state.downloads[id].status !== 'finished');
      activeIds.forEach(id => cancelDownload(id));
    };
  }


  async function openFolder(filename) {
    if (!filename) return;
    try {
      await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
    } catch (e) {
      console.error('Failed to open folder', e);
    }
  }

  function copyUrl(url) {
    if (!url) return;
    navigator.clipboard.writeText(url)
      .then(() => showToast('URL copied to clipboard!', 'success'))
      .catch(err => showToast('Failed to copy URL', 'error'));
  }

  // ============================================================
  //  DOWNLOAD FILE
  // ============================================================
  function downloadFile(filename) {
    const a = document.createElement('a');
    a.href = `/api/download-file/${encodeURIComponent(filename)}`;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Downloading ${filename}`, 'info');
  }

  // ============================================================
  //  CANCEL / PAUSE / RESUME
  // ============================================================
  async function cancelDownload(downloadId) {
    try {
      await fetch(`/api/cancel/${downloadId}`, { method: 'POST' });
      showToast('Download cancelled', 'warning');
      removeFromQueue(downloadId);
    } catch {
      showToast('Failed to cancel download', 'error');
    }
  }

  async function pauseDownload(downloadId) {
    try {
      await fetch(`/api/pause/${downloadId}`, { method: 'POST' });
      showToast('Download paused', 'info');
    } catch {
      showToast('Failed to pause download', 'error');
    }
  }

  async function resumeDownload(downloadId) {
    try {
      await fetch(`/api/resume/${downloadId}`, { method: 'POST' });
      showToast('Download resuming', 'info');
    } catch {
      showToast('Failed to resume download', 'error');
    }
  }

  // ============================================================
  //  CLEAR ALL
  // ============================================================
  function clearAll() {
    dom.urlInput.value = '';
    state.previews = [];
    state.previewQualities = {};
    dom.previewGrid.innerHTML = '';
    dom.previewSection.classList.remove('visible');
    dom.urlInput.focus();
    showToast('Cleared', 'info');
  }

  // ============================================================
  //  PLAYLIST MODAL
  // ============================================================
  function showPlaylistModal(playlistData) {
    state._pendingPlaylistUrls = (playlistData.entries || [])
      .map((e) => e.url || e.webpage_url)
      .filter(Boolean);

    dom.modalPlaylistTitle.textContent = playlistData.title || 'Untitled Playlist';
    dom.modalVideoCount.textContent = (playlistData.entries || []).length;
    dom.modalFormat.textContent = state.format === 'audio' ? 'MP3 (Audio)' : 'MP4 (Video)';
    dom.modalQuality.textContent = state.quality === 'best' ? 'Best Available' : state.quality;

    dom.playlistModal.classList.add('visible');
    dom.playlistModal.setAttribute('aria-hidden', 'false');
    dom.modalDownloadBtn.focus();
  }

  function hideModal() {
    dom.playlistModal.classList.remove('visible');
    dom.playlistModal.setAttribute('aria-hidden', 'true');
    state._pendingPlaylistUrls = null;
  }

  // ============================================================
  //  MICRO-INTERACTIONS (Feature 32)
  // ============================================================
  window.AudioFX = {
    ctx: null,
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); },
    playPop() {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
      osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    },
    playTriumph() {
      this.init();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
      osc.start(); osc.stop(this.ctx.currentTime + 1.0);
    },
    playChime() {
      this.init();
      [523.25, 659.25, 783.99].forEach((freq, i) => { // C5, E5, G5
        setTimeout(() => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain); gain.connect(this.ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0, this.ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
          osc.start(); osc.stop(this.ctx.currentTime + 1.0);
        }, i * 100);
      });
    }
  };

  window.spawnParticles = (x, y, color = '#7c3aed', count = 20) => {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'micro-particle';
      p.style.backgroundColor = color;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      document.body.appendChild(p);
      const angle = Math.random() * Math.PI * 2;
      const velocity = 50 + Math.random() * 100;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;
      p.animate([
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(0)`, opacity: 0 }
      ], {
        duration: 600 + Math.random() * 400,
        easing: 'cubic-bezier(0, .9, .57, 1)'
      }).onfinish = () => p.remove();
    }
  };

  const achievementNames = {
    "first_blood": "First Blood",
    "binger": "The Binger",
    "streak_5": "Consistent Otaku",
    "genre_master": "Genre Master",
    "night_owl": "Night Owl",
    "hundred_club": "Century Club",
    "library_hoarder": "Hoarder",
    "completionist": "Completionist"
  };

  window.handleNewAchievements = (achievements) => {
    if (!achievements || achievements.length === 0) return;
    window.AudioFX.playChime();
    window.spawnParticles(window.innerWidth / 2, window.innerHeight / 2, '#fbbf24', 50); // Gold particles
    achievements.forEach(achId => {
      const name = achievementNames[achId] || achId;
      showToast(`🏆 Achievement Unlocked: ${name}`, 'success');
    });
  };

  // ============================================================
  //  TOAST NOTIFICATIONS
  // ============================================================
  function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button class="toast-close" aria-label="Dismiss">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
    dom.toastContainer.appendChild(toast);
    setTimeout(() => dismissToast(toast), 4000);
  }

  function dismissToast(toast) {
    if (!toast || toast.classList.contains('toast-dismissing')) return;
    toast.classList.add('toast-dismissing');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }

  // ============================================================
  //  RIPPLE EFFECT
  // ============================================================
  function addRipple(event) {
    const btn = event.currentTarget;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = ripple.style.height = `${Math.max(rect.width, rect.height)}px`;

    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  // ============================================================
  //  CONFETTI
  // ============================================================
  function spawnConfetti(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const colors = ['#7c3aed', '#2563eb', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

    for (let i = 0; i < 12; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * 100}px`;
      piece.style.top = `${rect.top + 10}px`;
      piece.style.position = 'fixed';
      piece.style.zIndex = '9999';
      piece.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
      piece.style.animationDelay = `${Math.random() * 0.2}s`;
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1500);
    }
  }

  // ============================================================
  //  UTILITY FUNCTIONS
  // ============================================================
  function formatBytes(bytes, dm = 2) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  function formatDuration(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatViews(count) {
    if (!count) return '';
    if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B views`;
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
    return `${count} views`;
  }

  function formatRelativeTime(timestamp) {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return 'Just now';
    
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), 'minute');
    if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), 'hour');
    if (seconds < 604800) return rtf.format(-Math.floor(seconds / 86400), 'day');
    if (seconds < 2592000) return rtf.format(-Math.floor(seconds / 604800), 'week');
    if (seconds < 31536000) return rtf.format(-Math.floor(seconds / 2592000), 'month');
    return rtf.format(-Math.floor(seconds / 31536000), 'year');
  }

  function formatNumber(num) {
    return Number(num).toLocaleString();
  }

  function showCustomDialog(type, message, defaultValue = '') {
    return new Promise(resolve => {
      const modal = document.getElementById('customDialogModal');
      const title = document.getElementById('customDialogTitle');
      const msgEl = document.getElementById('customDialogMessage');
      const input = document.getElementById('customDialogInput');
      const cancelBtn = document.getElementById('customDialogCancel');
      const confirmBtn = document.getElementById('customDialogConfirm');

      if (!modal) {
        if (type === 'confirm') resolve(window.confirm(message));
        else resolve(window.prompt(message, defaultValue));
        return;
      }

      title.textContent = type === 'prompt' ? 'Input Required' : 'Confirm Action';
      msgEl.textContent = message;
      
      if (type === 'prompt') {
        input.classList.remove('hidden');
        input.value = defaultValue;
        input.focus();
      } else {
        input.classList.add('hidden');
        confirmBtn.focus();
      }

      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.add('visible'), 10);

      const cleanup = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 200);
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
      };

      const onCancel = () => {
        cleanup();
        resolve(type === 'prompt' ? null : false);
      };

      const onConfirm = () => {
        cleanup();
        resolve(type === 'prompt' ? input.value : true);
      };

      cancelBtn.addEventListener('click', onCancel);
      confirmBtn.addEventListener('click', onConfirm);
    });
  }

  window.showCustomConfirm = (msg) => showCustomDialog('confirm', msg);
  window.showCustomPrompt = (msg, def) => showCustomDialog('prompt', msg, def);

  function escapeHtml(str) {
    if (!str) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(str).replace(/[&<>"']/g, (m) => map[m]);
  }

  // ============================================================
  //  ANIME DOWNLOADER SYSTEM
  // ============================================================

  // 1. Tab Switching Logic
  function setupTabs() {
    const tabs = [
      { btn: dom.tabYoutube, panel: dom.youtubePanel },
      { btn: dom.tabDiscover, panel: dom.discoverPanel },
        { btn: dom.tabSchedule, panel: dom.schedulePanel },
        { btn: dom.tabRadio, panel: dom.radioPanel },
      { btn: dom.tabAnime, panel: dom.animePanel },
      { btn: dom.tabMovies, panel: dom.moviePanel },
      { btn: dom.tabLibrary, panel: dom.libraryPanel },
      { btn: dom.tabStats, panel: dom.statsPanel },
      { btn: dom.tabAchievements, panel: dom.achievementsPanel }
    ];
    tabs.forEach(t => {
      if (!t.btn || !t.panel) return;
      t.btn.addEventListener('click', () => {
        // Ensure detail section returns to its normal home if it was moved to library
        if (dom.animePanel && dom.animeDetailSection && dom.animeDetailSection.parentElement !== dom.animePanel) {
          dom.animePanel.appendChild(dom.animeDetailSection);
          dom.animeDetailSection.classList.add('hidden');
          $$('#libraryPanel > *').forEach(el => el.classList.remove('hidden'));
        }

        tabs.forEach(x => {
          if (x.btn && x.panel) {
            x.btn.classList.remove('active');
            x.btn.setAttribute('aria-selected', 'false');
            x.panel.classList.add('hidden');
            x.panel.style.display = ''; // fallback
          }
        });
        t.btn.classList.add('active');
        t.btn.setAttribute('aria-selected', 'true');
        t.panel.classList.remove('hidden');
        t.panel.style.display = 'block'; // force show

        if (t.btn === dom.tabSchedule && !state.scheduleLoaded) {
          state.scheduleLoaded = true;
          fetchSchedule('monday');
        }
        if (t.btn === dom.tabDiscover && (!state.discoverTrending || state.discoverTrending.length === 0)) {
          fetchDiscover();
        }
        if (t.btn === dom.tabLibrary) {
          fetchLibrary();
        }
        if (t.btn === dom.tabStats || t.btn === dom.tabAchievements) {
          fetchStats();
        }
      });
    });

    // Type Filters
    const typeFilters = $$('.lib-type-btn');
    if (typeFilters) {
      typeFilters.forEach(btn => {
        btn.addEventListener('click', (e) => {
          typeFilters.forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          state.libraryType = e.target.dataset.type;
          renderLibrary();
        });
      });
    }
  }

  // 2. Search Logic
  let isAutocompleteFetching = false;
  async function fetchAutocomplete(query) {
    if (!dom.searchAutocompleteDropdown) return;
    const provider = dom.animeProviderSelect ? dom.animeProviderSelect.value : 'hianime';

    try {
      isAutocompleteFetching = true;
      const res = await fetch(`/api/anime/search?query=${encodeURIComponent(query)}&provider=${provider}`);
      if (!res.ok) throw new Error('Search failed');

      const data = await res.json();
      const results = (data.results || []).slice(0, 5);

      if (results.length === 0) {
        dom.searchAutocompleteDropdown.innerHTML = '<div style="padding: 12px; text-align: center; color: #a1a1aa; font-size: 0.9rem;">No results found.</div>';
        return;
      }

      let html = '';
      results.forEach(item => {
        const title = escapeQuotes(item.title || '');
        const poster = getProxyImageUrl(item.image || item.poster || '');
        const type = item.type || 'TV';

        const sub = item.sub ? `<span class="tick-item tick-sub" style="margin-right:4px;">Sub ${item.sub}</span>` : '';
        const dub = item.dub ? `<span class="tick-item tick-dub" style="margin-right:4px;">Dub ${item.dub}</span>` : '';
        const eps = item.eps ? `<span class="tick-item tick-eps">Eps ${item.eps}</span>` : '';

        let metaDots = [];
        if (item.rating) metaDots.push(`<span>${item.rating}</span>`);
        metaDots.push(`<span>${type}</span>`);

        html += `
          <div class="autocomplete-item" onclick="window.searchForAnime('${title}')">
            <img class="autocomplete-poster" src="${poster}" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src='/static/images/placeholder.jpg'">
            <div class="autocomplete-info">
              <div class="autocomplete-title" title="${title}">${item.title}</div>
              <div class="autocomplete-meta">
                ${metaDots.join('<span class="autocomplete-meta-dot">•</span>')}
                ${(sub || dub || eps) ? `<span class="autocomplete-meta-dot">•</span> <div class="tick" style="display:inline-flex;">${sub}${dub}${eps}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `
        <div class="autocomplete-view-all" onclick="document.getElementById('animeSearchBtn').click();">
          View all results <span class="icon">›</span>
        </div>
      `;

      dom.searchAutocompleteDropdown.innerHTML = html;
      dom.searchAutocompleteDropdown.classList.remove('hidden');

    } catch (e) {
      console.error('Autocomplete error:', e);
    } finally {
      isAutocompleteFetching = false;
    }
  }

  async function searchAnime() {
    const query = dom.animeSearchInput.value.trim();
    if (!query) {
      showToast('Please enter an anime name to search.', 'warning');
      return;
    }

    const provider = dom.animeProviderSelect.value;

    // Ensure loading UI is in the correct panel
    if (dom.animePanel && dom.animeLoading) {
      dom.animePanel.appendChild(dom.animeLoading);
    }

    // Show Loading
    showAnimeLoading(`Searching for "${query}" on ${provider}...`);
    hideAnimeResults();
    hideAnimeDetail();

    try {
      let searchUrl = `/api/anime/search?query=${encodeURIComponent(query)}&provider=${provider}`;
      if (state.searchFilters.genre) searchUrl += `&genre=${encodeURIComponent(state.searchFilters.genre)}`;
      if (state.searchFilters.year) searchUrl += `&year=${encodeURIComponent(state.searchFilters.year)}`;
      if (state.searchFilters.status) searchUrl += `&status=${encodeURIComponent(state.searchFilters.status)}`;
      const res = await fetch(searchUrl);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await res.json();
      state.animeResults = data.results || [];

      hideAnimeLoading();

      if (state.animeResults.length === 0) {
        showToast('No anime found with that name.', 'info');
        showAnimeEmptyState('No Results Found', 'Try searching for something else or changing the provider.');
      } else {
        renderAnimeResults();
      }
    } catch (err) {
      hideAnimeLoading();
      showToast(`Error: ${err.message}`, 'error');
      showAnimeEmptyState('Search Failed', 'Please try again later. Verify your internet connection or try another provider.');
    }
  }

  function getProxyImageUrl(url) {
    if (!url || url.startsWith('/static/') || url.startsWith('data:')) {
      return url || '/static/img/logo.svg';
    }
    return `/api/anime/proxy-image?url=${encodeURIComponent(url)}`;
  }

  function renderAnimeResults() {
    dom.animeResultsGrid.innerHTML = '';

    state.animeResults.forEach((anime) => {
      const card = document.createElement('div');
      card.className = 'anime-result-card';

      const subBadge = anime.subOrDub ? `<span class="card-badge ${anime.subOrDub.toLowerCase()}">${anime.subOrDub}</span>` : '';
      const statusBadge = anime.status ? `<span class="card-badge status">${anime.status}</span>` : '';
      const imageSrc = getProxyImageUrl(anime.image);
      const yearText = anime.releaseDate ? ` · ${anime.releaseDate}` : '';


      const excerpt = anime.description ? (anime.description.length > 80 ? anime.description.substring(0, 80) + '...' : anime.description) : 'No description available.';
      card.innerHTML = `
        <div class="anime-card-poster-wrapper card-flip-container">
          <div class="card-flip-inner">
            <div class="card-face-front">
              <img class="anime-card-poster" src="/cache/images/poster_${anime.id}.jpg" alt="${escapeHtml(anime.title)}" onerror="this.onerror=null; this.src=\'${imageSrc}\'">
              <div class="anime-card-badge-row">
                ${subBadge}
                ${statusBadge}
              </div>
            </div>
            <div class="card-face-back">
              <div class="back-title">${escapeHtml(anime.title)}</div>
              <div class="back-meta">${anime.releaseDate ? '· ' + escapeHtml(anime.releaseDate) : ''}</div>
              <div class="back-desc">${escapeHtml(excerpt)}</div>
            </div>
          </div>
        </div>
        <div class="anime-card-content">
          <h4 class="anime-card-title" title="${escapeHtml(anime.title)}">${escapeHtml(anime.title)}</h4>
        </div>
      `;
      card.onclick = (e) => {
        e.preventDefault();
        viewAnimeDetails(anime.id);
      };
      card.oncontextmenu = (e) => {
        e.preventDefault();
        window.NovaStream.showContextMenu(e, anime);
      };
      dom.animeResultsGrid.appendChild(card);
    });

    dom.animeEmptyState.style.display = 'none';
    dom.animeResultsSection.classList.remove('hidden');
  }

  // 3. Anime Details Logic
  async function viewAnimeDetails(animeId, forceRefresh = false) {
    const provider = dom.animeProviderSelect.value;

    // Load saved filter preference
    const savedGlobal = localStorage.getItem('default_episode_filter') || 'all';
    const savedSpecific = localStorage.getItem('episode_filter_' + animeId);
    state.episodeFilter = savedSpecific || savedGlobal;
    if (dom.episodeFilterBtns) {
      dom.episodeFilterBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.filter === state.episodeFilter);
      });
    }

    showAnimeLoading('Fetching anime episodes...');
    hideAnimeResults();
    hideAnimeDetail();

    try {
      const cacheParam = forceRefresh ? '' : '&cache_first=1';
      const res = await fetch(`/api/anime/info?id=${encodeURIComponent(animeId)}&provider=${provider}${cacheParam}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to fetch details');
      }

      const info = await res.json();
      state.selectedAnime = info;
      state.selectedEpisodes.clear();

      try {
        const wtRes = await fetch(`/api/library/${encodeURIComponent(animeId)}/episodes`);
        const wtData = await wtRes.json();
        if (wtData.success) {
          state.watchedEpisodes = wtData.watched || [];
        } else {
          state.watchedEpisodes = [];
        }
      } catch (e) {
        state.watchedEpisodes = [];
      }

      try {
        const notesRes = await fetch(`/api/notes/${encodeURIComponent(animeId)}/0`);
        const notesData = await notesRes.json();
        state.animeNotes = notesData.note || '';
        if (dom.animeNotesTextarea) {
          dom.animeNotesTextarea.value = state.animeNotes;
        }
      } catch (e) {
        state.animeNotes = '';
      }

      hideAnimeLoading();
      renderAnimeDetail();

      
      // Feature Franchise Hub (Watch Order)
      try {
        const jikanRes = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(info.title)}&limit=1`);
        const jikanData = await jikanRes.json();
        if (jikanData && jikanData.data && jikanData.data.length > 0) {
          const malId = jikanData.data[0].mal_id;
          const relRes = await fetch(`https://api.jikan.moe/v4/anime/${malId}/relations`);
          const relData = await relRes.json();
          if (relData && relData.data) {
            renderFranchiseHub(relData.data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch franchise relations", err);
      }

      // Feature 27: Fetch offline metadata (Cast Info)
      fetch(`/api/metadata/${encodeURIComponent(animeId)}`)
        .then(res => res.json())
        .then(meta => {
          if (meta && meta.cast && meta.cast.length > 0) {
            renderCastInfo(meta.cast);
          }
        })
        .catch(err => console.error("No offline metadata found", err));
    } catch (err) {
      hideAnimeLoading();
      showToast(`Error: ${err.message}`, 'error');
      if (state.animeResults.length > 0) {
        renderAnimeResults();
      } else {
        showAnimeEmptyState('Fetch Failed', 'Failed to retrieve anime info.');
      }
    }
  }


  function renderFranchiseHub(relations) {
    const container = document.getElementById('anime-franchise-container');
    if (!container) return;
    
    // Filter out non-anime relations
    let validRelations = relations.filter(r => r.entry.some(e => e.type === 'anime'));
    if (validRelations.length === 0) {
      container.innerHTML = '';
      return;
    }
    
    let html = '<h3 style="margin-top:25px; margin-bottom:15px; font-size: 1.1rem; color: var(--text-color); display: flex; align-items: center; gap: 8px;"><span class="icon">🔗</span> Franchise Hub & Watch Order</h3>';
    html += '<div class="franchise-timeline">';
    
    validRelations.forEach(rel => {
      const animeEntries = rel.entry.filter(e => e.type === 'anime');
      if (animeEntries.length === 0) return;
      
      html += `
        <div class="franchise-group">
          <div class="franchise-relation-type">${escapeHtml(rel.relation)}</div>
          <div class="franchise-items">
      `;
      
      animeEntries.forEach(entry => {
        html += `
            <div class="franchise-item" onclick="window.searchAndOpenAnime('${escapeHtml(entry.name.replace(/'/g, "\\'"))}')">
              <span class="icon">▶️</span>
              <span class="franchise-item-title">${escapeHtml(entry.name)}</span>
            </div>
        `;
      });
      
      html += `
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
  }

  function renderCastInfo(castArray) {
    const container = document.getElementById('anime-cast-container');
    if (!container) return;
    
    let html = '<h3 style="margin-top:20px; margin-bottom:10px; font-size: 1.1rem; color: var(--text-muted);">Cast & Characters</h3>';
    html += '<div class="cast-scroll-container">';
    castArray.forEach(c => {
      html += `
        <div class="cast-member">
          <div class="cast-avatars">
            <img src="${c.character_image}" class="character-img" onerror="this.src='/static/img/placeholder.jpg'">
            <img src="${c.actor_image}" class="actor-img" onerror="this.src='/static/img/placeholder.jpg'">
          </div>
          <div class="cast-names">
            <div class="char-name">${escapeHtml(c.character)}</div>
            <div class="actor-name">${escapeHtml(c.actor)}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  function renderAnimeDetail() {
    const info = state.selectedAnime;

    const imageSrc = getProxyImageUrl(info.image);
    const subBadge = info.subOrDub ? `<span class="card-badge ${info.subOrDub.toLowerCase()}">${info.subOrDub}</span>` : '';
    const statusBadge = info.status ? `<span class="card-badge status">${info.status}</span>` : '';

    let trackerStatus = 'none';
    const libItem = state.libraryAnime.find(a => a.id === info.id);
    if (libItem) trackerStatus = libItem.status;

    const trackerWidget = `
      <div class="tracker-widget">
        <span class="icon">🔖</span>
        <select class="tracker-status-select" onchange="window.updateTrackerStatus('${escapeHtml(info.id)}', this.value)">
          <option value="none" ${trackerStatus === 'none' ? 'selected' : ''}>Add to Library...</option>
          <option value="watching" ${trackerStatus === 'watching' ? 'selected' : ''}>Watching</option>
          <option value="plan_to_watch" ${trackerStatus === 'plan_to_watch' ? 'selected' : ''}>Plan to Watch</option>
          <option value="completed" ${trackerStatus === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="on_hold" ${trackerStatus === 'on_hold' ? 'selected' : ''}>On Hold</option>
          <option value="dropped" ${trackerStatus === 'dropped' ? 'selected' : ''}>Dropped</option>
        </select>
      </div>
    `;

    dom.animeDetailHeader.innerHTML = `
        <div class="immersive-backdrop" style="background-image: url('${imageSrc}');"></div>
        <div class="anime-detail-poster-wrapper">
          <img class="anime-detail-poster" src="${imageSrc}" alt="${escapeHtml(info.title)}" onerror="this.onerror=null; this.src='/static/img/placeholder.jpg'">
        </div>
        <div class="anime-detail-info glass-card">
          <h2 class="anime-detail-title">${escapeHtml(info.title)}</h2>
          <div class="anime-detail-meta-row">
            ${subBadge}
            ${statusBadge}
            ${info.type ? `<span class="card-badge status">${info.type}</span>` : ''}
            ${info.releaseDate ? `<span class="history-item-date">${info.releaseDate}</span>` : ''}
          </div>
          ${info.genres && info.genres.length > 0 ? `<p class="anime-card-meta"><b>Genres:</b> ${info.genres.join(', ')}</p>` : ''}
          <p class="anime-detail-desc">${escapeHtml(info.description || 'No description available.')}</p>
          <div id="anime-cast-container" class="anime-cast-container"></div>
          <div id="anime-franchise-container" class="anime-franchise-container"></div>
          ${trackerWidget}
          <div style="margin-top: 15px;">
            <button onclick="window.NovaStream.viewAnimeDetails('${info.id}', true)" class="btn-secondary btn-sm" type="button" style="padding: 6px 12px; border-radius: var(--radius-sm); font-size: 0.8rem;">
              <span>🔄</span> Refresh Episodes
            </button>
          </div>
        </div>
    `;

    // Calculate Next Episode to Play for FAB
    if (dom.animeFabPlayBtn) {
      dom.animeFabPlayBtn.classList.add('hidden');
      if (info.episodes && info.episodes.length > 0) {
        let nextEp = null;
        let watchedCount = 0;
        for (const ep of info.episodes) {
          if (state.watchedEpisodes && state.watchedEpisodes.includes(ep.number)) {
            watchedCount++;
          } else if (!nextEp) {
            nextEp = ep;
          }
        }
        if (!nextEp) nextEp = info.episodes[0];

        if (nextEp) {
          dom.animeFabPlayBtn.classList.remove('hidden');
          dom.animeFabPlayText.textContent = watchedCount === 0 ? 'Start' : 'Continue';
          dom.animeFabPlayBtn.onclick = () => {
            let downloadId = null;
            if (!info.isLocal) {
              for (const dlId in state.downloads) {
                const d = state.downloads[dlId];
                if (d.format === 'anime' && d.url === nextEp.id && (d.status === 'finished' || d.status === 'completed')) {
                  downloadId = dlId; break;
                }
              }
              if (!downloadId && state.history) {
                for (const h of state.history) {
                  if (h.format === 'anime' && h.url === nextEp.id && h.status === 'finished') {
                    downloadId = h.id; break;
                  }
                }
              }
            }
            if (info.isLocal) {
              window.NovaStream.playLocalEpisodeById(nextEp.id);
            } else if (downloadId) {
              window.NovaStream.playDownloadedEpisode(downloadId, nextEp.number, info.id, nextEp.id);
            } else {
              window.NovaStream.playRemoteEpisode(nextEp.id, nextEp.number, info.id);
            }
          };
        }
      }
    }

    dom.selectAllEpisodes.checked = false;
    updateSelectedCount();

    dom.episodesGrid.innerHTML = '';
    let episodes = info.episodes || [];

    if (state.episodeFilter === 'unseen') {
      episodes = episodes.filter(ep => !(state.watchedEpisodes && state.watchedEpisodes.includes(ep.number)));
    } else if (state.episodeFilter === 'downloaded') {
      episodes = episodes.filter(ep => {
        if (info.isLocal) return true;
        for (const dlId in state.downloads) {
          const d = state.downloads[dlId];
          if (d.format === 'anime' && d.url === ep.id && (d.status === 'finished' || d.status === 'completed' || d.status === 'queued' || d.status === 'downloading')) {
            return true;
          }
        }
        if (state.history) {
          for (const h of state.history) {
            if (h.format === 'anime' && h.url === ep.id && h.status === 'finished') {
              return true;
            }
          }
        }
        return false;
      });
    }

    dom.episodesCountBadge.textContent = episodes.length;

    // Pagination logic
    const pageSize = 50;
    const totalPages = Math.ceil(episodes.length / pageSize);
    if (state.animeCurrentPage > totalPages && totalPages > 0) state.animeCurrentPage = totalPages;
    if (state.animeCurrentPage < 1) state.animeCurrentPage = 1;

    const startIndex = (state.animeCurrentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const currentEpisodes = episodes.slice(startIndex, endIndex);

    currentEpisodes.forEach((ep) => {
      const epCard = document.createElement('div');
      epCard.className = 'episode-card';

      const thumbSrc = getProxyImageUrl(ep.image);
      const epTitle = ep.title ? ep.title : `Episode ${ep.number}`;

      // Check if this episode is in selectedEpisodes
      let isChecked = false;
      for (const item of state.selectedEpisodes) {
        const parsed = JSON.parse(item);
        if (parsed.id === ep.id) {
          isChecked = true;
          break;
        }
      }

      const isWatched = state.watchedEpisodes && state.watchedEpisodes.includes(ep.number);
      if (isWatched) epCard.classList.add('is-watched');
      const watchedBtn = `
        <button type="button" class="episode-watched-btn ${isWatched ? 'watched' : ''}" onclick="window.NovaStream.toggleWatched(this, '${escapeHtml(info.id)}', ${ep.number})" title="Mark as Watched">
          ${isWatched ? '✓' : '👁'}
        </button>
      `;

      // Find the download matching this episode
      let downloadId = null;
      let download = null;

      // Check active session downloads
      for (const [did, dinfo] of Object.entries(state.downloads)) {
        if (dinfo.format === 'anime' && dinfo.url === ep.id && dinfo.status === 'finished') {
          downloadId = did;
          download = dinfo;
          break;
        }
      }

      // If not found in active session, check history
      if (!downloadId && state.history) {
        for (const h of state.history) {
          if (h.format === 'anime' && h.url === ep.id && h.status === 'finished') {
            downloadId = h.id;
            download = h;
            break;
          }
        }
      }

      const isDownloaded = !!downloadId;

      epCard.oncontextmenu = (e) => {
        e.preventDefault();
        window.NovaStream.showEpisodeContextMenu(e, ep, info, isDownloaded, downloadId, isWatched);
      };

      let actionBtn = '';
      if (info.isLocal) {
        actionBtn = `<button class="episode-download-btn" onclick="window.NovaStream.deleteLocalEpisode('${escapeHtml(ep.id)}')" title="Delete Episode" style="background:#ef4444; margin-right:4px;">🗑</button>
           <button class="episode-download-btn" onclick="window.NovaStream.playLocalEpisodeById('${escapeHtml(ep.id)}')" title="Play Episode" style="background:var(--accent);">▶</button>`;
      } else if (isDownloaded) {
        actionBtn = `<button class="episode-download-btn" onclick="window.NovaStream.playDownloadedEpisode('${escapeHtml(downloadId)}', ${ep.number}, '${escapeHtml(info.id)}', '${escapeHtml(ep.id)}')" title="Play Downloaded Episode" style="background:var(--accent); margin-right:4px;">▶</button>`;
      } else {
        actionBtn = `<button class="episode-download-btn" onclick="window.NovaStream.playRemoteEpisode('${escapeHtml(ep.id)}', ${ep.number}, '${escapeHtml(info.id)}')" title="Play Episode" style="background:var(--accent); margin-right:4px;">▶</button>
           <button class="episode-download-btn" onclick="window.NovaStream.downloadEpisode('${escapeHtml(ep.id)}', ${ep.number}, '${escapeHtml(ep.title || '')}', this)" title="Download Episode">⬇️</button>`;
      }

      epCard.innerHTML = `
        <div class="episode-checkbox-wrapper" style="margin-right: 8px;">
          <input type="checkbox" class="anime-checkbox episode-chk" data-ep-id="${escapeHtml(ep.id)}" data-ep-num="${ep.number}" data-ep-title="${escapeHtml(ep.title || '')}" ${isChecked ? 'checked' : ''} />
        </div>
        <div class="episode-card-info">
          <span class="episode-number-title">Episode ${ep.number}</span>
          <span class="episode-title-name" title="${escapeHtml(epTitle)}">${escapeHtml(ep.title || 'Untitled')}</span>
        </div>
        <div class="ep-row-actions" style="display: flex; gap: 8px; align-items: center;">
          ${watchedBtn}
          ${actionBtn}
        </div>
      `;

      const chk = epCard.querySelector('.episode-chk');
      chk.addEventListener('change', () => {
        const epData = { id: ep.id, number: ep.number, title: ep.title || '' };
        if (chk.checked) {
          state.selectedEpisodes.add(JSON.stringify(epData));
        } else {
          for (const item of state.selectedEpisodes) {
            const parsed = JSON.parse(item);
            if (parsed.id === ep.id) {
              state.selectedEpisodes.delete(item);
              break;
            }
          }
          dom.selectAllEpisodes.checked = false;
        }
        updateSelectedCount();
      });

      dom.episodesGrid.appendChild(epCard);
    });

    dom.animeEmptyState.style.display = 'none';
    dom.animeDetailSection.classList.remove('hidden');

    renderAnimePagination(totalPages);
  }

  function renderAnimePagination(totalPages) {
    if (totalPages <= 1) {
      dom.animePagination.style.display = 'none';
      dom.animePagination.innerHTML = '';
      return;
    }

    dom.animePagination.style.display = 'flex';
    dom.animePagination.innerHTML = '';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'page-btn';
    prevBtn.textContent = 'Prev';
    prevBtn.disabled = state.animeCurrentPage === 1;
    prevBtn.onclick = () => {
      if (state.animeCurrentPage > 1) {
        state.animeCurrentPage--;
        renderAnimeDetail();
      }
    };
    dom.animePagination.appendChild(prevBtn);

    // Determine page range to show (max 5 pages)
    let startPage = Math.max(1, state.animeCurrentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      const pBtn = document.createElement('button');
      pBtn.className = 'page-btn';
      if (i === state.animeCurrentPage) pBtn.classList.add('active');
      pBtn.textContent = i;
      pBtn.onclick = () => {
        state.animeCurrentPage = i;
        renderAnimeDetail();
      };
      dom.animePagination.appendChild(pBtn);
    }

    const nextBtn = document.createElement('button');
    nextBtn.className = 'page-btn';
    nextBtn.textContent = 'Next';
    nextBtn.disabled = state.animeCurrentPage === totalPages;
    nextBtn.onclick = () => {
      if (state.animeCurrentPage < totalPages) {
        state.animeCurrentPage++;
        renderAnimeDetail();
      }
    };
    dom.animePagination.appendChild(nextBtn);
  }

  function updateSelectedCount() {
    const count = state.selectedEpisodes.size;
    dom.selectedEpisodesCount.textContent = count;
    dom.animeBulkDownloadBtn.disabled = count === 0;
  }

  // 4. Download Triggering
  async function downloadEpisode(episodeId, episodeNum, episodeTitle, btnElement) {
    const provider = dom.animeProviderSelect.value;
    const quality = dom.animeQualitySelect.value;
    const subOrDub = dom.animeSubOrDubSelect ? dom.animeSubOrDubSelect.value : 'SUB';
    const server = dom.animeServerSelect ? dom.animeServerSelect.value : 'auto';
    const animeTitle = state.selectedAnime ? state.selectedAnime.title : 'Anime';

    const payload = {
      anime_title: animeTitle,
      provider: provider,
      quality: quality || state.settings.default_quality || 'best',
      sub_lang: null,
      sub_or_dub: subOrDub,
      server: server,
      episodes: [
        { id: episodeId, number: episodeNum, title: episodeTitle }
      ]
    };

    showToast(`Queued download for Episode ${episodeNum}...`, 'success');

    try {
      const res = await fetch('/api/anime/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to start download');
      }

      const data = await res.json();
      if (!state.eventSource) connectSSE();

      if (data.download_ids) {
        data.download_ids.forEach(id => {
          state.downloads[id] = {
            title: `Episode ${episodeNum} - ${animeTitle}`,
            format: 'anime',
            progress: 0,
            status: 'queued',
            url: episodeId
          };
        });
        renderQueue();
        if (dom.downloadsDropdown) dom.downloadsDropdown.classList.add('show');
      }

      if (btnElement) spawnConfetti(btnElement);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  async function downloadSelectedEpisodes() {
    if (state.selectedEpisodes.size === 0) return;

    const provider = dom.animeProviderSelect.value;
    const quality = dom.animeQualitySelect.value;
    const subOrDub = dom.animeSubOrDubSelect ? dom.animeSubOrDubSelect.value : 'SUB';
    const server = dom.animeServerSelect ? dom.animeServerSelect.value : 'auto';
    const animeTitle = state.selectedAnime ? state.selectedAnime.title : 'Anime';

    const episodes = [];
    for (const item of state.selectedEpisodes) {
      episodes.push(JSON.parse(item));
    }

    episodes.sort((a, b) => a.number - b.number);

    const payload = {
      anime_title: animeTitle,
      provider: provider,
      quality: quality || state.settings.default_quality || 'best',
      sub_lang: null,
      sub_or_dub: subOrDub,
      server: server,
      episodes: episodes
    };

    showToast(`Queuing ${episodes.length} episode${episodes.length === 1 ? '' : 's'} for download...`, 'success');

    try {
      const res = await fetch('/api/anime/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to start download');
      }

      const data = await res.json();
      if (!state.eventSource) connectSSE();

      if (data.download_ids) {
        data.download_ids.forEach((id, i) => {
          const ep = episodes[i] || {};
          state.downloads[id] = {
            title: ep.title ? `Episode ${ep.number} - ${ep.title}` : `Episode ${ep.number} - ${animeTitle}`,
            format: 'anime',
            progress: 0,
            status: 'queued'
          };
        });
        renderQueue();
        if (dom.downloadsDropdown) dom.downloadsDropdown.classList.add('show');
      }

      state.selectedEpisodes.clear();
      const chks = dom.episodesGrid.querySelectorAll('.episode-chk');
      chks.forEach(chk => chk.checked = false);
      dom.selectAllEpisodes.checked = false;
      updateSelectedCount();

      spawnConfetti(dom.animeBulkDownloadBtn);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  function showAnimeLoading(text) {
    dom.animeLoadingText.textContent = text;
    dom.animeLoading.classList.remove('hidden');
    dom.animeEmptyState.style.display = 'none';
  }

  function hideAnimeLoading() {
    dom.animeLoading.classList.add('hidden');
  }

  function hideAnimeResults() {
    dom.animeResultsSection.classList.add('hidden');
  }

  function hideAnimeDetail() {
    dom.animeDetailSection.classList.add('hidden');
  }

  function showAnimeEmptyState(title, subtitle) {
    dom.animeEmptyState.querySelector('.empty-state-text').textContent = title;
    dom.animeEmptyState.querySelector('.empty-state-subtext').textContent = subtitle;
    dom.animeEmptyState.style.display = '';
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  window.NovaStream = {
    toggleDropdown,
    openFolder,
    copyUrl,
    cancelDownload,
    pauseDownload,
    resumeDownload,
    downloadFile,
    viewAnimeDetails,
    downloadEpisode,
    downloadSelectedEpisodes,
    playLocalAnime,
    playLocalEpisode
  };

  // ============================================================
  //  LIBRARY & DISCOVER
  // ============================================================

  async function fetchDiscover() {
    dom.discoverLoading.classList.remove('hidden');
    if (dom.discoverSpotlight) dom.discoverSpotlight.innerHTML = '';
    
    // Feature 8: Smart Recommendations
    async function loadRecommendations() {
      if (!state.libraryAnime || state.libraryAnime.length === 0) return;
      
      const genreCounts = {};
      state.libraryAnime.forEach(anime => {
        if (anime.genres) {
          const list = anime.genres.split(',').map(g => g.trim());
          list.forEach(g => {
            if (g) genreCounts[g] = (genreCounts[g] || 0) + 1;
          });
        }
      });
      
      let topGenre = null;
      let maxCount = 0;
      for (const [genre, count] of Object.entries(genreCounts)) {
        if (count > maxCount) {
          maxCount = count;
          topGenre = genre;
        }
      }
      
      if (!topGenre) return;
      
      const genreMap = {
        "Action": 1, "Adventure": 2, "Comedy": 4, "Drama": 8, "Fantasy": 10,
        "Romance": 22, "Sci-Fi": 24, "Slice of Life": 36, "Sports": 30,
        "Supernatural": 37, "Mecha": 18, "Isekai": 62, "Horror": 14, "Mystery": 7,
        "Psychological": 40, "Thriller": 41
      };
      
      const genreId = genreMap[topGenre];
      if (!genreId) return;
      
      if (dom.discoverRecommendedSection) dom.discoverRecommendedSection.style.display = 'block';
      if (dom.discoverRecommendedTitle) dom.discoverRecommendedTitle.innerHTML = `<span class="icon" aria-hidden="true">✨</span> Recommended for You: Because you watch ${escapeHtml(topGenre)}`;
      
      try {
        const res = await fetch(`https://api.jikan.moe/v4/anime?genres=${genreId}&order_by=score&sort=desc&limit=15`);
        const data = await res.json();
        
        if (data && data.data && dom.discoverRecommendedGrid) {
          const recommendations = data.data.filter(jikanAnime => {
            return !state.libraryAnime.some(libAnime => 
              libAnime.id == jikanAnime.mal_id || 
              libAnime.title.toLowerCase() === jikanAnime.title.toLowerCase()
            );
          }).slice(0, 10);
          
          dom.discoverRecommendedGrid.innerHTML = '';
          if (recommendations.length > 0) {
            recommendations.forEach(anime => {
               const mappedAnime = {
                 id: anime.mal_id,
                 title: anime.title,
                 poster: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
                 status: 'plan_to_watch', // For UI fallback
               };
               dom.discoverRecommendedGrid.appendChild(createCard(mappedAnime));
            });
          } else {
            if (dom.discoverRecommendedSection) dom.discoverRecommendedSection.style.display = 'none';
          }
        }
      } catch (err) {
        console.error('Recommendations failed', err);
        if (dom.discoverRecommendedSection) dom.discoverRecommendedSection.style.display = 'none';
      }
    }
    
    // Call it asynchronously so it doesn't block Trending
    loadRecommendations();

    if (dom.discoverTrendingGrid) dom.discoverTrendingGrid.innerHTML = '';
    if (dom.discoverOngoingGrid) dom.discoverOngoingGrid.innerHTML = '';
    if (dom.discoverLatestEpisodesGrid) dom.discoverLatestEpisodesGrid.innerHTML = '';
    if (dom.discoverMostPopularList) dom.discoverMostPopularList.innerHTML = '';
    if (dom.discoverLatestCompletedList) dom.discoverLatestCompletedList.innerHTML = '';

    try {
      const res = await fetch('/api/discover');
      const resData = await res.json();
      if (resData.success && resData.data) {
        state.discoverData = resData.data;
        renderDiscover();
      } else {
        dom.discoverTrendingGrid.innerHTML = `<p class="error-text">Failed to load discover: ${resData.error}</p>`;
      }
    } catch (e) {
      console.error(e);
      dom.discoverTrendingGrid.innerHTML = `<p class="error-text">Error fetching discover API.</p>`;
    } finally {
      dom.discoverLoading.classList.add('hidden');
    }
  }

  function renderDiscover() {
    if (dom.discoverSpotlight) dom.discoverSpotlight.innerHTML = '';
    if (dom.discoverTrendingGrid) dom.discoverTrendingGrid.innerHTML = '';
    if (dom.discoverOngoingGrid) dom.discoverOngoingGrid.innerHTML = '';
    if (dom.discoverLatestEpisodesGrid) dom.discoverLatestEpisodesGrid.innerHTML = '';
    if (dom.discoverScheduleList) dom.discoverScheduleList.innerHTML = '';
    if (dom.discoverMostPopularList) dom.discoverMostPopularList.innerHTML = '';
    if (dom.discoverLatestCompletedList) dom.discoverLatestCompletedList.innerHTML = '';

    if (!state.discoverData) return;
    const data = state.discoverData;

    function createCard(anime) {
      const card = document.createElement('div');
      card.className = 'anime-result-card';
      const badge = anime.epsInfo ? `<span class="card-badge eps">${anime.epsInfo}</span>` : '';
      const imageSrc = getProxyImageUrl(anime.poster);

      const excerpt = anime.description ? (anime.description.length > 80 ? anime.description.substring(0, 80) + '...' : anime.description) : 'No description available.';
      card.innerHTML = `
        <div class="anime-card-poster-wrapper card-flip-container">
          <div class="card-flip-inner">
            <div class="card-face-front">
              <img class="anime-card-poster" src="/cache/images/poster_${anime.id}.jpg" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src=\'${imageSrc}\'">
              <div class="anime-card-badge-row">
                ${badge}
              </div>
            </div>
            <div class="card-face-back">
              <div class="back-title">${escapeQuotes(anime.title)}</div>
              <div class="back-meta">${anime.epsInfo || ''}</div>
              <div class="back-desc">${escapeHtml(excerpt)}</div>
            </div>
          </div>
        </div>
        <div class="anime-card-content">
          <h4 class="anime-card-title" title="${escapeQuotes(anime.title)}">${anime.title}</h4>
        </div>
      `;
      card.onclick = () => window.searchForAnime(anime.title);
      card.oncontextmenu = (e) => { e.preventDefault(); window.NovaStream.showContextMenu(e, anime); };
      return card;
    }

    function createListCard(anime, index) {
      const card = document.createElement('div');
      card.className = 'list-anime-card';
      const imageSrc = getProxyImageUrl(anime.poster);
      card.innerHTML = `
        <div class="list-card-poster-wrapper">
          <img src="${imageSrc}" loading="lazy" onerror="this.onerror=null; this.src='/static/img/placeholder.jpg'">
        </div>
        <div class="list-card-info">
          <h4 class="list-card-title" title="${escapeQuotes(anime.title)}">${anime.title}</h4>
          <span class="list-card-eps">${anime.epsInfo || ''}</span>
        </div>
      `;
      card.onclick = () => window.searchForAnime(anime.title);
      card.oncontextmenu = (e) => { e.preventDefault(); window.NovaStream.showContextMenu(e, anime); };
      return card;
    }

    function createTrendingCard(anime, index) {
      const card = document.createElement('div');
      card.className = 'trending-card';
      const imageSrc = getProxyImageUrl(anime.poster);

      card.innerHTML = `
        <div class="trending-card-left">
          <div class="trending-card-title" title="${escapeQuotes(anime.title)}">${anime.title}</div>
          <div class="trending-card-rank">${index + 1}</div>
        </div>
        <div class="trending-card-poster-wrapper">
          <img class="trending-card-poster" src="${imageSrc}" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src='/static/img/placeholder.jpg'">
        </div>
      `;
      card.onclick = () => window.searchForAnime(anime.title);
      card.oncontextmenu = (e) => { e.preventDefault(); window.NovaStream.showContextMenu(e, anime); };
      return card;
    }

    (data.trending || []).forEach((anime, i) => {
      dom.discoverTrendingGrid.appendChild(createTrendingCard(anime, i));
    });

    (data.topAiring || []).forEach(anime => {
      dom.discoverOngoingGrid.appendChild(createCard(anime));
    });

    (data.latestEpisode || []).forEach(anime => {
      dom.discoverLatestEpisodesGrid.appendChild(createCard(anime));
    });

    const dateTextEl = document.getElementById('scheduleDateText');
    if (dateTextEl) {
      dateTextEl.textContent = '(' + new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) + ')';
    }

    if (data.schedule && data.schedule.length > 0 && dom.discoverScheduleList) {
      data.schedule.forEach(item => {
        const row = document.createElement('div');
        row.className = 'schedule-row';
        const d = new Date(item.time);
        const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        row.innerHTML = `
          <div class="schedule-time">
            <div class="schedule-local-time">${timeStr}</div>
            <div class="live-countdown" data-timestamp="${item.time}">--:--:--</div>
          </div>
          <div class="schedule-title" title="${escapeQuotes(item.title)}">${item.title}</div>
          <div class="schedule-ep">${item.ep}</div>
        `;
        row.onclick = () => window.searchForAnime(item.title);
        dom.discoverScheduleList.appendChild(row);
      });
    }

    (data.mostPopular || []).slice(0, 10).forEach((anime, i) => {
      if (dom.discoverMostPopularList) dom.discoverMostPopularList.appendChild(createListCard(anime, i));
    });

    (data.latestCompleted || []).slice(0, 10).forEach((anime, i) => {
      if (dom.discoverLatestCompletedList) dom.discoverLatestCompletedList.appendChild(createListCard(anime, i));
    });

    if (data.spotlight && data.spotlight.length > 0 && dom.discoverSpotlight) {
      let slidesHTML = '<div id="spotlight-trailer-container"><div id="spotlight-trailer-player"></div></div>';
      let dotsHTML = '<div class="spotlight-dots">';

      data.spotlight.forEach((s, index) => {
        const imageSrc = getProxyImageUrl(s.poster);
        const isActive = index === 0 ? 'active' : '';

        slidesHTML += `
          <div class="spotlight-banner ${isActive}" data-index="${index}">
            <div class="spotlight-ambilight" style="background-image: url('${imageSrc}');"></div>
            <div class="spotlight-backdrop" style="background-image: url('${imageSrc}');"></div>
            <div class="spotlight-inner">
              <div class="spotlight-content">
                <span class="spotlight-rank">#${index + 1} Spotlight</span>
                <h2 class="spotlight-title">${s.title}</h2>
                <p class="spotlight-desc">${s.description}</p>
                <button class="primary-btn" onclick="window.searchForAnime('${escapeQuotes(s.title)}')"><span class="icon">▶</span> Watch Now</button>
              </div>
            </div>
          </div>
        `;

        dotsHTML += `<span class="spotlight-dot ${isActive}" data-index="${index}"></span>`;
      });

      dotsHTML += '</div>';
      dom.discoverSpotlight.innerHTML = slidesHTML + dotsHTML;

      // Initialize animation
      let currentSlide = 0;
      const slides = dom.discoverSpotlight.querySelectorAll('.spotlight-banner');
      const dots = dom.discoverSpotlight.querySelectorAll('.spotlight-dot');

      if (window.spotlightInterval) clearInterval(window.spotlightInterval);

      const updateSlide = (newIndex) => {
        slides[currentSlide].classList.remove('active');
        dots[currentSlide].classList.remove('active');
        currentSlide = newIndex;
        slides[currentSlide].classList.add('active');
        dots[currentSlide].classList.add('active');
        if (window.playSpotlightTrailer) {
          window.playSpotlightTrailer(data.spotlight[currentSlide].title);
        }
      };

      const startInterval = () => {
        window.spotlightInterval = setInterval(() => {
          updateSlide((currentSlide + 1) % slides.length);
        }, 10000);
      };

      if (!window.ytIframeApiInjected) {
        window.ytIframeApiInjected = true;
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        window.spotlightTrailerCache = {};
        window.onYouTubeIframeAPIReady = () => {
          window.spotlightYTPlayer = new YT.Player('spotlight-trailer-player', {
            height: '100%', width: '100%',
            playerVars: { 'autoplay': 1, 'controls': 0, 'autohide': 1, 'wmode': 'opaque', 'disablekb': 1, 'loop': 1, 'mute': 1, 'showinfo': 0, 'modestbranding': 1, 'iv_load_policy': 3 },
            events: {
              'onStateChange': (event) => {
                const container = document.getElementById('spotlight-trailer-container');
                if (container) {
                  if (event.data === YT.PlayerState.PLAYING) {
                    container.style.opacity = '1';
                  } else if (event.data === YT.PlayerState.UNSTARTED || event.data === YT.PlayerState.ENDED) {
                    container.style.opacity = '0';
                  }
                }
              }
            }
          });
          if (data.spotlight.length > 0) window.playSpotlightTrailer(data.spotlight[currentSlide].title);
        };
        
        window.playSpotlightTrailer = async (title) => {
          const container = document.getElementById('spotlight-trailer-container');
          if (container) container.style.opacity = '0';
          if (!window.spotlightYTPlayer || typeof window.spotlightYTPlayer.loadVideoById !== 'function') return;
          
          if (window.spotlightTrailerCache[title] !== undefined) {
            const id = window.spotlightTrailerCache[title];
            if (id) { window.spotlightYTPlayer.loadVideoById({videoId: id}); }
            else { window.spotlightYTPlayer.stopVideo(); }
            return;
          }
          
          try {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
            const jikanData = await res.json();
            const ytid = jikanData?.data?.[0]?.trailer?.youtube_id;
            window.spotlightTrailerCache[title] = ytid || null;
            if (ytid) {
              window.spotlightYTPlayer.loadVideoById({videoId: ytid});
            } else {
              window.spotlightYTPlayer.stopVideo();
            }
          } catch(e) {
            console.error('Trailer error', e);
            window.spotlightTrailerCache[title] = null;
          }
        };
      } else {
         if (window.playSpotlightTrailer) window.playSpotlightTrailer(data.spotlight[currentSlide].title);
      }

      updateSlide(0);
      startInterval();

      dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
          clearInterval(window.spotlightInterval);
          updateSlide(index);
          startInterval();
        });
      });

      startInterval();
    }
  }

  window.searchForAnime = function (title) {
    dom.tabAnime.click();
    dom.animeSearchInput.value = title;
    searchAnime();
  };

  function escapeQuotes(str) {
    if (!str) return '';
    return str.replace(/'/g, "\'").replace(/"/g, '&quot;');
  }

  async function fetchLibrary() {
    dom.libraryGrid.innerHTML = '';
    showSkeleton(dom.libraryGrid, 12);
    try {
      const [resLib, resLocal, resMovie] = await Promise.all([
        fetch('/api/library'),
        fetch('/api/local'),
        fetch('/api/movies/library')
      ]);
      const dataLib = await resLib.json();
      const dataLocal = await resLocal.json();
      const dataMovie = await resMovie.json();

      if (dataLib.success) {
        state.libraryAnime = dataLib.library || [];
      }
      if (dataLocal.success) {
        state.localAnime = dataLocal.local || [];
      }
      if (dataMovie.success) {
        state.libraryMovies = dataMovie.library || [];
      }
      renderLibraryTabs();
      renderLibrary();
      
      await fetchContinueWatching();
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchContinueWatching() {
    const container = document.getElementById('continueWatchingContainer');
    const section = document.getElementById('continueWatchingSection');
    if (!container || !section) return;

    section.classList.remove('hidden');
    showSkeleton(container, 4);

    try {
      const res = await fetch('/api/continue-watching');
      const json = await res.json();
      hideSpinner(container);
      
      if (!json.data || json.data.length === 0) {
        section.classList.add('hidden');
        return;
      }
      
      section.classList.remove('hidden');
      let html = '';
      json.data.forEach(anime => {
        const total = anime.total_episodes || '?';
        const progressPct = anime.total_episodes ? (anime.watched_episodes / anime.total_episodes) * 100 : 0;
        
        // Escape quotes
        const titleSafe = anime.title ? anime.title.replace(/'/g, "&apos;").replace(/"/g, "&quot;") : '';
        
        html += `
          <div class="cw-card">
            <img src="${anime.poster || ''}" class="cw-poster" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\\'http://www.w3.org/2000/svg\\'/%3e'">
            <div class="cw-info">
              <div class="cw-title" title="${titleSafe}">${titleSafe}</div>
              <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-bottom: 4px;">
                Episode ${anime.watched_episodes} / ${total}
              </div>
              <div class="cw-progress-bg">
                <div class="cw-progress-fill" style="width: ${progressPct}%"></div>
              </div>
              <button class="btn-primary cw-resume-btn" onclick="window.NovaStream.resumeAnime('${anime.id}')">
                ▶ Resume
              </button>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    } catch (e) {
      console.error(e);
    }
  }

  window.NovaStream.resumeAnime = async function(animeId) {
    showToast('Loading episode...', 'info');
    await window.NovaStream.viewAnimeDetails(animeId);
    if (dom.animeFabPlayBtn && !dom.animeFabPlayBtn.classList.contains('hidden')) {
      dom.animeFabPlayBtn.click();
    } else {
      showToast('No unwatched episodes found.', 'warning');
    }
  };

  function renderLibrary() {
    dom.libraryGrid.innerHTML = '';

    if (state.libraryFilter === 'local' || state.libraryFilter === 'downloaded') {
      let filtered = state.localAnime || [];
      filtered = [...filtered];
      if (state.librarySort === 'added_asc') {
        filtered.reverse();
      } else if (state.librarySort === 'a_z') {
        filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (state.librarySort === 'z_a') {
        filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
      } else if (state.librarySort === 'most_watched') {
        filtered.sort((a, b) => (b.watched_episodes || 0) - (a.watched_episodes || 0));
      } else if (state.librarySort === 'least_watched') {
        filtered.sort((a, b) => (a.watched_episodes || 0) - (b.watched_episodes || 0));
      }

      if (filtered.length === 0) {
        dom.libraryEmpty.classList.add('hidden');
        renderEmptyState(dom.libraryGrid, 'No local files or downloads match this filter.', 'fa-solid fa-folder-open');
      } else {
        dom.libraryEmpty.classList.add('hidden');
        filtered.forEach(anime => {
          const card = document.createElement('div');
          card.className = 'anime-result-card';
          card.dataset.id = anime.id;
          const isSelected = state.selectedIds.includes(anime.id);
          if (isSelected) card.classList.add('selected');
          const imageSrc = getProxyImageUrl(anime.poster);

          card.innerHTML = `
            <div class="anime-card-poster-wrapper card-flip-container">
              <input type="checkbox" class="anime-card-checkbox" ${isSelected ? 'checked' : ''}>
              <div class="card-flip-inner">
                <div class="card-face-front">
                  <img class="anime-card-poster" src="/cache/images/poster_${anime.id}.jpg" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src=\'${imageSrc}\'">
                  <div class="anime-card-badge-row">
                    <span class="card-badge eps">${anime.episodes ? anime.episodes.length : 0} Eps</span>
                  </div>
                </div>
                <div class="card-face-back">
                  <div class="back-title">${escapeQuotes(anime.title)}</div>
                  <div class="back-meta">Local Directory</div>
                  <div class="back-desc">Offline library anime.</div>
                </div>
              </div>
            </div>
            <div class="anime-card-content">
              <h4 class="anime-card-title" title="${escapeQuotes(anime.title)}">${anime.title}</h4>
            </div>
          `;
          card.onclick = (e) => {
            if (state.selectMode) {
              e.preventDefault();
              toggleAnimeSelection(anime.id);
              return;
            }
            window.NovaStream.playLocalAnime(anime);
          };
          card.oncontextmenu = (e) => { e.preventDefault(); window.NovaStream.showContextMenu(e, { ...anime, isLocal: true }); };
          dom.libraryGrid.appendChild(card);
        });
      }
      return;
    }

    let dataSource = state.libraryType === 'movie' ? state.libraryMovies : state.libraryAnime;
    let filtered = dataSource || [];

    if (state.libraryFilter === 'downloaded' || state.libraryFilter === 'local') {
      filtered = state.localAnime || [];
    } else if (state.libraryFilter === 'unseen') {
      filtered = filtered.filter(a => (a.watched_episodes || 0) === 0);
    } else if (state.libraryFilter !== 'all') {
      filtered = filtered.filter(a => a.status === state.libraryFilter);
    }

    filtered = [...filtered];
    if (state.librarySort === 'added_asc') {
      filtered.reverse();
    } else if (state.librarySort === 'a_z') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (state.librarySort === 'z_a') {
      filtered.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    } else if (state.librarySort === 'most_watched') {
      filtered.sort((a, b) => (b.watched_episodes || 0) - (a.watched_episodes || 0));
    } else if (state.librarySort === 'least_watched') {
      filtered.sort((a, b) => (a.watched_episodes || 0) - (b.watched_episodes || 0));
    }

    if (filtered.length === 0) {
      dom.libraryEmpty.classList.add('hidden');
      renderEmptyState(dom.libraryGrid, 'No anime in this status category.', 'fa-solid fa-ghost');
    } else {
      dom.libraryEmpty.classList.add('hidden');
      filtered.forEach(anime => {
        const card = document.createElement('div');
        card.className = 'anime-result-card';
        card.dataset.id = anime.id;
        const isSelected = state.selectedIds.includes(anime.id);
        if (isSelected) card.classList.add('selected');
        const imageSrc = getProxyImageUrl(anime.poster);

        let statusDisplay = anime.status.replace(/_/g, ' ');

        const excerpt = anime.description ? (anime.description.length > 80 ? anime.description.substring(0, 80) + '...' : anime.description) : 'No description available.';
        card.innerHTML = `
          <div class="anime-card-poster-wrapper card-flip-container">
            <input type="checkbox" class="anime-card-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="card-flip-inner">
              <div class="card-face-front">
                <img class="anime-card-poster" src="/cache/images/poster_${anime.id}.jpg" alt="Poster" loading="lazy" onerror="this.onerror=null; this.src=\'${imageSrc}\'">
                <div class="anime-card-badge-row">
                  <span class="card-badge eps">${anime.watched_episodes} / ${anime.total_episodes || '?'}</span>
                </div>
              </div>
              <div class="card-face-back">
                <div class="back-title">${escapeQuotes(anime.title)}</div>
                <div class="back-meta">${statusDisplay} · ${anime.watched_episodes}/${anime.total_episodes || '?'} Eps</div>
                <div class="back-desc">${escapeHtml(excerpt)}</div>
              </div>
            </div>
          </div>
            <div class="anime-card-content">
              <h4 class="anime-card-title" title="${escapeQuotes(anime.title)}">${anime.title}</h4>
            </div>
        `;
        card.onclick = (e) => {
          if (state.selectMode) {
            e.preventDefault();
            toggleAnimeSelection(anime.id);
            return;
          }
          if (anime.provider) {
            dom.animeProviderSelect.value = anime.provider;
          }
          state.lastView = 'library';
          if (dom.libraryPanel && dom.animeDetailSection && dom.animeLoading) {
            dom.libraryPanel.appendChild(dom.animeLoading);
            dom.libraryPanel.appendChild(dom.animeDetailSection);
            $$('#libraryPanel > *:not(#animeDetailSection):not(#animeLoading)').forEach(el => el.classList.add('hidden'));
          }
          viewAnimeDetails(anime.id);
        };
        card.oncontextmenu = (e) => { e.preventDefault(); window.NovaStream.showContextMenu(e, anime); };
        dom.libraryGrid.appendChild(card);
      });
    }
  }

  // ============================================================
  //  BULK ACTIONS
  // ============================================================

  function updateBulkStatusSelect() {
    if (!dom.bulkStatusSelect) return;
    let html = `<option value="">Change Status...</option>`;
    (state.libraryStatuses || []).forEach(s => {
      html += `<option value="${s.id}">${s.label}</option>`;
    });
    dom.bulkStatusSelect.innerHTML = html;
  }

  function updateBulkSelectUI() {
    if (state.selectMode) {
      if (dom.librarySelectToggleBtn) {
        dom.librarySelectToggleBtn.classList.add('active');
        dom.librarySelectToggleBtn.textContent = 'Cancel Select';
      }
      if (dom.librarySelectAllBtn) dom.librarySelectAllBtn.classList.remove('hidden');
      if (dom.libraryGrid) dom.libraryGrid.classList.add('select-mode-active');

      if (state.selectedIds.length > 0) {
        if (dom.libraryFloatingActionBar) dom.libraryFloatingActionBar.classList.remove('hidden');
        if (dom.bulkSelectedCount) dom.bulkSelectedCount.textContent = `${state.selectedIds.length} selected`;
      } else {
        if (dom.libraryFloatingActionBar) dom.libraryFloatingActionBar.classList.add('hidden');
      }
    } else {
      if (dom.librarySelectToggleBtn) {
        dom.librarySelectToggleBtn.classList.remove('active');
        dom.librarySelectToggleBtn.textContent = 'Select';
      }
      if (dom.librarySelectAllBtn) dom.librarySelectAllBtn.classList.add('hidden');
      if (dom.libraryGrid) dom.libraryGrid.classList.remove('select-mode-active');
      if (dom.libraryFloatingActionBar) dom.libraryFloatingActionBar.classList.add('hidden');
    }

    document.querySelectorAll('.anime-result-card').forEach(card => {
      const id = card.dataset.id;
      if (!id) return;
      const isSelected = state.selectedIds.includes(id);
      const checkbox = card.querySelector('.anime-card-checkbox');
      if (checkbox) checkbox.checked = isSelected;
      if (isSelected) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  function toggleAnimeSelection(animeId) {
    if (state.selectedIds.includes(animeId)) {
      state.selectedIds = state.selectedIds.filter(id => id !== animeId);
    } else {
      state.selectedIds.push(animeId);
    }
    updateBulkSelectUI();
  }

  async function submitBulkStatus(newStatus) {
    if (state.selectedIds.length === 0) return;

    try {
      const res = await fetch('/api/library/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_ids: state.selectedIds, new_status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Status updated for ${state.selectedIds.length} title${state.selectedIds.length === 1 ? '' : 's'}`, 'success');

        if (state.libraryAnime) {
          state.libraryAnime.forEach(a => {
            if (state.selectedIds.includes(a.id)) {
              a.status = newStatus;
            }
          });
        }

        state.selectMode = false;
        state.selectedIds = [];
        updateBulkSelectUI();
        renderLibraryTabs();
        renderLibrary();
      } else {
        showToast(data.error || 'Failed to update status', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error updating status', 'error');
    }
  }

  async function submitBulkDelete() {
    if (state.selectedIds.length === 0) return;

    if (!(await showCustomConfirm(`Are you sure you want to delete ${state.selectedIds.length} title${state.selectedIds.length === 1 ? '' : 's'} from your library?\n\nThis will also delete watch history for these titles.`))) {
      return;
    }

    try {
      const res = await fetch('/api/library/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anime_ids: state.selectedIds })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Deleted ${state.selectedIds.length} title${state.selectedIds.length === 1 ? '' : 's'}`, 'success');

        if (state.libraryAnime) {
          state.libraryAnime = state.libraryAnime.filter(a => !state.selectedIds.includes(a.id));
        }
        if (state.localAnime) {
          state.localAnime = state.localAnime.filter(a => !state.selectedIds.includes(a.id));
        }
        if (state.libraryMovies) {
          state.libraryMovies = state.libraryMovies.filter(a => !state.selectedIds.includes(a.id));
        }

        state.selectMode = false;
        state.selectedIds = [];
        updateBulkSelectUI();
        renderLibraryTabs();
        renderLibrary();
      } else {
        showToast(data.error || 'Failed to delete anime', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error deleting anime', 'error');
    }
  }

  // ============================================================
  //  VIDEO PLAYER & LOCAL PLAYBACK
  // ============================================================

  function playLocalAnime(anime) {
    if (!anime.episodes || anime.episodes.length === 0) {
      showToast('No episodes found.', 'error');
      return;
    }

    // Map local anime to look like a scraped anime so we can use the same UI!
    state.selectedAnime = {
      id: anime.id,
      title: anime.title,
      image: anime.poster,
      description: "Downloaded Anime",
      isLocal: true,
      episodes: anime.episodes.map(ep => ({
        id: ep.path, // Use path as ID so we can pass it to the play button
        number: ep.number,
        title: ep.title,
        path: ep.path
      }))
    };

    // Switch UI views
    state.lastView = 'library';
    dom.tabAnime.click();
    dom.animeResultsSection.classList.add('hidden');

    state.animeCurrentPage = 1;
    renderAnimeDetail();
  }

  // Context Menu Logic
  const ctxMenu = document.getElementById('customContextMenu');
  const ctxAddLib = document.getElementById('ctxAddLib');
  const ctxChangeStatus = document.getElementById('ctxChangeStatus');
  const ctxRemoveLib = document.getElementById('ctxRemoveLib');
  const ctxDelete = document.getElementById('ctxDelete');
  const ctxDeleteFolder = document.getElementById('ctxDeleteFolder');

  async function updateLibraryStatus(anime, status) {
    try {
      const res = await fetch('/api/library/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: anime.id,
          title: anime.title,
          provider: 'hianime',
          poster: anime.image || anime.poster,
          total_episodes: anime.episodes ? anime.episodes.length : (anime.total_episodes || 0),
          status: status,
          genres: (anime.genres || []).join(',')
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (window.AudioFX) window.AudioFX.playPop();
        if (window.spawnParticles) window.spawnParticles(window.innerWidth/2, window.innerHeight/2, '#7c3aed', 30);
        showToast('Library updated', 'success');
        fetchLibrary();
        if (data.new_achievements) window.handleNewAchievements(data.new_achievements);
      } else {
        showToast('Failed to update library', 'error');
      }
    } catch (err) {
      showToast('Error', 'error');
    }
  }

  window.NovaStream.showContextMenu = function (e, anime) {
    if (!ctxMenu) return;
    ctxMenu.style.left = `${e.pageX}px`;
    ctxMenu.style.top = `${e.pageY}px`;
    ctxMenu.classList.remove('hidden');

    if (anime.isLocal) {
      if (ctxAddLib) ctxAddLib.style.display = 'none';
      if (ctxChangeStatus) ctxChangeStatus.style.display = 'none';
      if (ctxRemoveLib) ctxRemoveLib.style.display = 'none';
      if (ctxDeleteFolder) ctxDeleteFolder.style.display = 'none';
      if (ctxDelete) {
        ctxDelete.style.display = 'flex';
        ctxDelete.onclick = async () => {
          ctxMenu.classList.add('hidden');
          if (!(await showCustomConfirm(`Delete local anime folder for "${anime.title}"? This cannot be undone.`))) return;
          try {
            const res = await fetch('/api/library/anime/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: anime.id })
            });
            const data = await res.json();
            if (data.success) {
              showToast('Anime deleted', 'success');
              fetchLibrary();
            } else {
              showToast(data.error || 'Delete failed', 'error');
            }
          } catch (err) {
            showToast('Error', 'error');
          }
        };
      }
    } else {
      if (ctxDelete) ctxDelete.style.display = 'none';

      const inLib = state.libraryAnime && state.libraryAnime.some(a => a.id === anime.id);

      if (inLib) {
        if (ctxAddLib) ctxAddLib.style.display = 'none';
        if (ctxChangeStatus) ctxChangeStatus.style.display = 'flex';
        if (ctxRemoveLib) ctxRemoveLib.style.display = 'flex';
        
        if (ctxDeleteFolder) {
          ctxDeleteFolder.style.display = 'flex';
          ctxDeleteFolder.onclick = async () => {
            ctxMenu.classList.add('hidden');
            if (!(await showCustomConfirm(`Delete all downloaded episodes for "${anime.title}"? This will free up storage but keep the anime in your library.`))) return;
            try {
              const res = await fetch('/api/library/anime/delete_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: anime.title, id: anime.id })
              });
              const data = await res.json();
              if (data.success) {
                showToast('Local episodes deleted', 'success');
                if (state.downloads) {
                  state.downloads = state.downloads.filter(d => !d.id.startsWith(anime.id + '_'));
                }
                fetchStorageStats();
              } else {
                showToast(data.error || 'Delete failed', 'error');
              }
            } catch (err) {
              showToast('Error', 'error');
            }
          };
        }

        if (ctxRemoveLib) {
          ctxRemoveLib.onclick = async () => {
            ctxMenu.classList.add('hidden');
            try {
              const res = await fetch(`/api/library/${encodeURIComponent(anime.id)}`, { method: 'DELETE' });
              if (res.ok) {
                showToast('Removed from library', 'success');
                fetchLibrary();
              } else {
                showToast('Error removing', 'error');
              }
            } catch (err) { }
          };
        }

        if (ctxChangeStatus) {
          const items = ctxChangeStatus.querySelectorAll('.context-menu-item[data-status]');
          items.forEach(el => {
            el.onclick = async (ev) => {
              ev.stopPropagation();
              ctxMenu.classList.add('hidden');
              const status = el.getAttribute('data-status');
              updateLibraryStatus(anime, status);
            };
          });
        }
      } else {
        if (ctxAddLib) ctxAddLib.style.display = 'flex';
        if (ctxChangeStatus) ctxChangeStatus.style.display = 'none';
        if (ctxRemoveLib) ctxRemoveLib.style.display = 'none';
        if (ctxDeleteFolder) ctxDeleteFolder.style.display = 'none';

        if (ctxAddLib) {
          const items = ctxAddLib.querySelectorAll('.context-menu-item[data-status]');
          items.forEach(el => {
            el.onclick = async (ev) => {
              ev.stopPropagation();
              ctxMenu.classList.add('hidden');
              const status = el.getAttribute('data-status');
              updateLibraryStatus(anime, status);
            };
          });
        }
      }
    }
  };

  document.addEventListener('click', (e) => {
    if (ctxMenu && !ctxMenu.classList.contains('hidden')) {
      ctxMenu.classList.add('hidden');
    }
    if (downloadContextMenu && !downloadContextMenu.classList.contains('hidden')) {
      downloadContextMenu.classList.add('hidden');
    }
    const episodeContextMenu = document.getElementById('episodeContextMenu');
    if (episodeContextMenu && !episodeContextMenu.classList.contains('hidden')) {
      episodeContextMenu.classList.add('hidden');
    }
  });

  window.NovaStream.showEpisodeContextMenu = function (e, ep, info, isDownloaded, downloadId, isWatched) {
    const episodeContextMenu = document.getElementById('episodeContextMenu');
    if (!episodeContextMenu) return;

    episodeContextMenu.style.left = `${e.pageX}px`;
    episodeContextMenu.style.top = `${e.pageY}px`;
    episodeContextMenu.classList.remove('hidden');

    document.getElementById('epCtxPlay').onclick = (ev) => {
      ev.stopPropagation(); episodeContextMenu.classList.add('hidden');
      if (info.isLocal) window.NovaStream.playLocalEpisodeById(ep.id);
      else if (isDownloaded) window.NovaStream.playDownloadedEpisode(downloadId, ep.number, info.id, ep.id);
      else window.NovaStream.playRemoteEpisode(ep.id, ep.number, info.id);
    };

    document.getElementById('epCtxMarkWatched').onclick = (ev) => {
      ev.stopPropagation(); episodeContextMenu.classList.add('hidden');
      // Create a dummy button to pass to toggleWatched which expects it
      const dummyBtn = document.createElement('button');
      if (isWatched) dummyBtn.classList.add('watched');
      window.NovaStream.toggleWatched(dummyBtn, info.id, ep.number);
    };

    document.getElementById('epCtxCopyTitle').onclick = (ev) => {
      ev.stopPropagation(); episodeContextMenu.classList.add('hidden');
      navigator.clipboard.writeText(ep.title || `Episode ${ep.number}`);
      showToast('Episode title copied', 'success');
    };

    const delBtn = document.getElementById('epCtxDelete');
    if (info.isLocal || isDownloaded) {
      delBtn.classList.remove('hidden');
      delBtn.onclick = (ev) => {
        ev.stopPropagation(); episodeContextMenu.classList.add('hidden');
        window.NovaStream.deleteLocalEpisode(ep.id);
      };
    } else {
      delBtn.classList.add('hidden');
    }
  };

  window.NovaStream.deleteLocalEpisode = async function (epId) {
    if (!state.selectedAnime || !state.selectedAnime.episodes) return;
    const epIndex = state.selectedAnime.episodes.findIndex(e => e.id === epId);
    if (epIndex === -1) return;
    const ep = state.selectedAnime.episodes[epIndex];

    if (!(await showCustomConfirm(`Are you sure you want to delete ${state.selectedAnime.title} - Episode ${ep.number}?`))) return;

    try {
      const res = await fetch('/api/library/episode/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          path: ep.path,
          anime_title: state.selectedAnime.title,
          episode_number: ep.number
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Episode deleted.', 'success');
        
        if (state.selectedAnime.isLocal) {
          state.selectedAnime.episodes.splice(epIndex, 1);
        } else {
          const downloadId = `${state.selectedAnime.id}_${ep.number}`;
          state.downloads = state.downloads.filter(d => d.id !== downloadId);
        }
        
        renderAnimeDetail(); // Refresh the list
        fetchLibrary(); // Refresh library in background
        fetchStorageStats(); // Refresh storage stats
      } else {
        showToast(data.error || 'Failed to delete episode', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error deleting episode', 'error');
    }
  };

  window.NovaStream.playNextEpisode = function () {
    if (!state.selectedAnime || !state.selectedAnime.episodes) return;
    if (!state.currentlyPlayingEpNumber) return;

    const episodes = state.selectedAnime.episodes;
    const currentIndex = episodes.findIndex(e => e.number === state.currentlyPlayingEpNumber);
    if (currentIndex >= 0 && currentIndex < episodes.length - 1) {
      const nextEp = episodes[currentIndex + 1];
      const info = state.selectedAnime;

      let downloadId = null;
      if (!info.isLocal) {
        for (const dlId in state.downloads) {
          const d = state.downloads[dlId];
          if (d.format === 'anime' && d.url === nextEp.id && (d.status === 'finished' || d.status === 'completed')) {
            downloadId = dlId; break;
          }
        }
        if (!downloadId && state.history) {
          for (const h of state.history) {
            if (h.format === 'anime' && h.url === nextEp.id && h.status === 'finished') {
              downloadId = h.id; break;
            }
          }
        }
      }
      if (info.isLocal) {
        window.NovaStream.playLocalEpisodeById(nextEp.id);
      } else if (downloadId) {
        window.NovaStream.playDownloadedEpisode(downloadId, nextEp.number, info.id, nextEp.id);
      } else {
        window.NovaStream.playRemoteEpisode(nextEp.id, nextEp.number, info.id);
      }
    }
  };

  // ============================================================
  //  AUTO-COMPLETE (Anime Search)
  // ============================================================

  window.NovaStream.playLocalEpisodeById = function (epId) {
    if (!state.selectedAnime || !state.selectedAnime.episodes) return;
    const ep = state.selectedAnime.episodes.find(e => e.id === epId);
    if (ep) playLocalEpisode(state.selectedAnime, ep);
  };

  window.NovaStream.playRemoteEpisode = async function (epId, epNumber, animeId) {
    state.currentlyPlayingEpNumber = epNumber;
    if (!dom.animeProviderSelect) return;
    showToast('Fetching streaming sources...', 'info');

    const server = dom.animeServerSelect ? dom.animeServerSelect.value : 'auto';

    try {
      const res = await fetch('/api/anime/play_remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          episode_id: epId,
          episode_num: epNumber,
          anime_id: animeId,
          provider: dom.animeProviderSelect.value,
          subOrDub: dom.animeSubOrDubSelect ? dom.animeSubOrDubSelect.value : 'SUB',
          server: server
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start stream');

      showToast('MPV Player started streaming!', 'success');
      startPlayerPolling();
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
    }
  };

  window.NovaStream.playDownloadedEpisode = async function (downloadId, epNumber, animeId, epId) {
    state.currentlyPlayingEpNumber = epNumber;
    let download = state.downloads[downloadId];
    if (!download && state.history) {
      download = state.history.find(h => h.id === downloadId);
    }

    // In database, the file path is usually stored in 'filename'
    const filepath = download ? (download.filepath || download.filename) : null;

    if (!download || !filepath) {
      showToast('Could not find downloaded file path, falling back to stream...', 'warning');
      if (epId) window.NovaStream.playRemoteEpisode(epId, epNumber, animeId);
      return;
    }

    showToast(`Launching MPV player for downloaded episode...`, 'info');

    try {
      const res = await fetch('/api/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filepath,
          anime_id: animeId,
          episode_num: epNumber,
          video_id: downloadId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch MPV');

      showToast('MPV Player started!', 'success');
      startPlayerPolling();
    } catch (e) {
      console.error(e);
      showToast('File not found locally, falling back to stream...', 'warning');

      // Cleanup the database entry since the file is missing
      fetch(`/api/history/${downloadId}`, { method: 'DELETE' }).catch(err => console.error(err));

      if (epId) window.NovaStream.playRemoteEpisode(epId, epNumber, animeId);
    }
  };

  async function playLocalEpisode(anime, ep) {
    state.currentlyPlayingEpNumber = ep.number;
    showToast(`Launching MPV player for ${anime.title} Episode ${ep.number}...`, 'info');

    try {
      const res = await fetch('/api/player/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: ep.path,
          anime_id: anime.id,
          episode_num: ep.number,
          video_id: ep.id || ep.path
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch MPV');

      showToast('MPV Player started!', 'success');

      // Start polling for status to update UI highlights when watched
      startPlayerPolling();
    } catch (e) {
      console.error(e);
      showToast(e.message, 'error');
    }
  }

  let playerPollInterval = null;
  async function startPlayerPolling() {
    if (playerPollInterval) clearInterval(playerPollInterval);
    playerPollInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/player/status');
        const data = await res.json();
        if (!data.running) {
          clearInterval(playerPollInterval);
          playerPollInterval = null;
          // Refresh library to show updated watch status
          await fetchLibrary();
          if (data.next_requested) {
            window.NovaStream.playNextEpisode();
          } else if (state.selectedAnime) {
            window.NovaStream.viewAnimeDetails(state.selectedAnime.id);
          }
        }
      } catch (e) {
        clearInterval(playerPollInterval);
        playerPollInterval = null;
      }
    }, 5000);
  }

  window.removeFromLibrary = async function (id) {
    if (!(await showCustomConfirm('Remove from library?'))) return;
    try {
      const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) fetchLibrary();
    } catch (e) {
      console.error(e);
    }
  };

  window.updateTrackerStatus = async function (animeId, status) {
    if (status === 'none') {
      removeFromLibrary(animeId);
      return;
    }
    const info = state.selectedAnime;
    try {
      const res = await fetch('/api/library/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: info.id,
          title: info.title,
          provider: dom.animeProviderSelect.value,
          poster: info.image,
          status: status,
          total_episodes: info.episodes ? info.episodes.length : 0,
          watched_episodes: state.watchedEpisodes ? state.watchedEpisodes.length : 0,
          genres: (info.genres || []).join(',')
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (window.AudioFX) window.AudioFX.playPop();
        if (window.spawnParticles) window.spawnParticles(window.innerWidth/2, window.innerHeight/2, '#7c3aed', 30);
        showToast('Tracker updated', 'success');
        state.trackerStatus = status;
        fetchLibrary();
        if (data.new_achievements) window.handleNewAchievements(data.new_achievements);
        renderEpisodeList(state.selectedAnime.episodes);
      }
    } catch (e) {
      console.error(e);
      showToast('Error updating library', 'error');
    }
  };

  window.NovaStream.toggleWatched = async function (btn, animeId, episodeNum) {
    const isWatched = btn.classList.contains('watched');
    const newWatchedState = !isWatched;

    const isLocal = state.selectedAnime ? state.selectedAnime.isLocal : false;

    try {
      const res = await fetch('/api/library/episode/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anime_id: animeId,
          episode_number: episodeNum,
          watched: newWatchedState,
          is_local: isLocal
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.new_achievements) window.handleNewAchievements(data.new_achievements);
        
        if (newWatchedState) {
          if (data.watched_count && state.selectedAnime && state.selectedAnime.episodes && data.watched_count >= state.selectedAnime.episodes.length) {
            if (window.AudioFX) window.AudioFX.playTriumph();
            if (window.spawnParticles) window.spawnParticles(window.innerWidth/2, window.innerHeight/2, '#10b981', 80);
          }
          btn.classList.add('watched');
          btn.textContent = '✓';
          if (!state.watchedEpisodes) state.watchedEpisodes = [];
          state.watchedEpisodes.push(episodeNum);
          const card = btn.closest('.episode-card');
          if (card) card.classList.add('is-watched');
          
          if (isLocal && state.settings.auto_delete === 'true') {
            const ep = state.selectedAnime.episodes.find(e => e.number === episodeNum);
            if (ep && ep.path) {
              let deleted = false;
              showUndoToast(`Episode ${episodeNum} watched. Auto-deleting in 10s...`, 'Undo Delete', () => {
                deleted = true; 
                showToast(`Auto-delete for episode ${episodeNum} cancelled.`, 'info');
              });
              
              setTimeout(async () => {
                if (deleted) return;
                try {
                  await fetch('/api/library/episode/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: ep.path })
                  });
                  state.selectedAnime.episodes = state.selectedAnime.episodes.filter(e => e.number !== episodeNum);
                  renderAnimeDetail();
                  showToast(`Episode ${episodeNum} auto-deleted to save space.`, 'success');
                } catch (e) {
                  console.error("Auto-delete failed", e);
                }
              }, 10000);
            }
          }
        } else {
          btn.classList.remove('watched');
          btn.textContent = '👁';
          state.watchedEpisodes = state.watchedEpisodes.filter(n => n !== episodeNum);
          const card = btn.closest('.episode-card');
          if (card) card.classList.remove('is-watched');
        }
        fetchLibrary(); // update watched counts
      }
    } catch (e) {
      console.error(e);
      showToast('Error updating watched status', 'error');
    }
  };

  // ============================================================
  //  STATS
  // ============================================================
  async function fetchStats() {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const stats = await res.json();
        renderStats(stats);
      }
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  }

  function renderStats(stats) {
    if (!stats) return;

    const totalHoursEl = document.getElementById('statsTotalHours');
    if (totalHoursEl) {
      const target = stats.estimated_hours || 0;
      totalHoursEl.textContent = target > 0 ? target.toFixed(1) : "0.0";
    }

    const currentStreakEl = document.getElementById('statsCurrentStreak');
    if (currentStreakEl) {
      currentStreakEl.textContent = stats.current_streak || 0;
      const icon = currentStreakEl.parentElement.querySelector('.streak-icon');
      if (stats.current_streak > 0 && icon) {
        icon.classList.add('streak-active');
      } else if (icon) {
        icon.classList.remove('streak-active');
      }
    }
    const longestStreakEl = document.getElementById('statsLongestStreak');
    if (longestStreakEl) {
      longestStreakEl.textContent = `Best: ${stats.longest_streak || 0} days`;
    }

    if (document.getElementById('statsCompleted')) {
      document.getElementById('statsCompleted').textContent = formatNumber(stats.statuses.completed || 0);
    }
    if (document.getElementById('statsWatching')) {
      document.getElementById('statsWatching').textContent = formatNumber(stats.statuses.watching || 0);
    }
    if (document.getElementById('statsTotalEpisodes')) {
      document.getElementById('statsTotalEpisodes').textContent = formatNumber(stats.total_episodes || 0);
    }
    if (document.getElementById('statsPlanToWatch')) {
      document.getElementById('statsPlanToWatch').textContent = formatNumber(stats.statuses.plan_to_watch || 0);
    }

    // Monthly Activity Chart
    const monthlyChart = document.getElementById('monthlyActivityChart');
    if (monthlyChart && stats.monthly_activity) {
      monthlyChart.innerHTML = '';

      const counts = stats.monthly_activity.map(m => m.episodes_watched || 0);
      const maxCount = Math.max(...counts, 0);

      const activeMonths = stats.monthly_activity.filter(m => (m.episodes_watched || 0) > 0);

      if (maxCount === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-chart-state';
        emptyMsg.textContent = "No activity tracked yet";
        monthlyChart.appendChild(emptyMsg);
      } else if (activeMonths.length === 1) {
        const monthMap = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" };
        const fullMonth = monthMap[activeMonths[0].month] || activeMonths[0].month;
        const currentYear = new Date().getFullYear();
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-chart-state';
        emptyMsg.textContent = `Tracking activity from ${fullMonth} ${currentYear} onward — history before this wasn't dated`;
        monthlyChart.appendChild(emptyMsg);
      } else {
        stats.monthly_activity.forEach(m => {
          const count = m.episodes_watched || 0;
          const barCol = document.createElement('div');
          barCol.className = 'bar-col';

          const barValue = document.createElement('div');
          barValue.className = 'bar-value';
          barValue.textContent = count;

          const barFill = document.createElement('div');
          barFill.className = 'bar-fill';

          // Add a min-height for baseline visibility
          const heightPct = (count / maxCount) * 100;
          barFill.style.minHeight = '4px';

          // Add title for hover
          barFill.title = `${count} episode${count === 1 ? '' : 's'}`;

          // Timeout for animation effect
          setTimeout(() => {
            barFill.style.height = `calc(${heightPct}% - 4px)`;
          }, 100);

          const barLabel = document.createElement('div');
          barLabel.className = 'bar-label';
          barLabel.textContent = m.month;

          barCol.appendChild(barValue);
          barCol.appendChild(barFill);
          barCol.appendChild(barLabel);
          monthlyChart.appendChild(barCol);
        });
      }
    }

    // Top Genres Chart
    const genresChart = document.getElementById('topGenresChart');
    if (genresChart && stats.genres) {
      genresChart.innerHTML = '';
      const maxGenre = Math.max(...stats.genres.map(g => g.count), 1);
      stats.genres.forEach(g => {
        const row = document.createElement('div');
        row.className = 'bar-row';

        const label = document.createElement('div');
        label.className = 'bar-row-label';
        label.textContent = g.name;

        const track = document.createElement('div');
        track.className = 'bar-row-track';

        const fill = document.createElement('div');
        fill.className = 'bar-row-fill';
        fill.title = `${g.count} items`;
        const widthPct = (g.count / maxGenre) * 100;

        setTimeout(() => {
          fill.style.width = `${widthPct}%`;
        }, 100);

        track.appendChild(fill);
        row.appendChild(label);
        row.appendChild(track);
      });
    }

    // Time of Day Chart
    const todChart = document.getElementById('timeOfDayChart');
    if (todChart && stats.time_of_day) {
      todChart.innerHTML = '';
      const times = [
        { label: 'Morning', key: 'morning' },
        { label: 'Afternoon', key: 'afternoon' },
        { label: 'Evening', key: 'evening' },
        { label: 'Night', key: 'night' }
      ];
      const maxTod = Math.max(...times.map(t => stats.time_of_day[t.key] || 0), 1);
      
      times.forEach(t => {
        const count = stats.time_of_day[t.key] || 0;
        const row = document.createElement('div');
        row.className = 'bar-row';
        
        const label = document.createElement('div');
        label.className = 'bar-row-label';
        label.textContent = t.label;
        
        const track = document.createElement('div');
        track.className = 'bar-row-track';
        
        const fill = document.createElement('div');
        fill.className = 'bar-row-fill';
        fill.style.background = 'linear-gradient(90deg, #10b981, #059669)';
        fill.title = `${count} episodes`;
        const widthPct = (count / maxTod) * 100;
        
        setTimeout(() => { fill.style.width = `${widthPct}%`; }, 100);
        
        track.appendChild(fill);
        row.appendChild(label);
        row.appendChild(track);
        todChart.appendChild(row);
      });
    }

    // Achievements
    const achGrid = document.getElementById('achievementsGrid');
    if (achGrid && stats.achievements) {
      achGrid.innerHTML = '';
      const iconMap = {
        'first_blood': 'fa-play',
        'binger': 'fa-fire-flame-curved',
        'streak_5': 'fa-bolt',
        'genre_master': 'fa-layer-group',
        'night_owl': 'fa-moon'
      };
      
      // Sort: Unlocked first, then locked
      stats.achievements.sort((a, b) => (b.unlocked === a.unlocked) ? 0 : b.unlocked ? 1 : -1);

      stats.achievements.forEach(ach => {
        const card = document.createElement('div');
        card.className = `achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}`;
        card.title = ach.unlocked ? '' : ach.desc; // Tooltip for locked

        const iconClass = ach.unlocked ? (iconMap[ach.id] || 'fa-trophy') : 'fa-lock';
        const displayDesc = ach.desc;
        const displayTitle = ach.title;

        card.innerHTML = `
          <div class="achievement-icon">
            <i class="fa-solid ${iconClass}"></i>
          </div>
          <div class="achievement-info">
            <h4>${displayTitle}</h4>
            <p class="achievement-desc">${displayDesc}</p>
          </div>
        `;
        achGrid.appendChild(card);
      });

      // Add "Coming Soon" banner
      const comingSoon = document.createElement('div');
      comingSoon.className = 'achievement-coming-soon';
      comingSoon.style.gridColumn = '1 / -1';
      comingSoon.style.textAlign = 'center';
      comingSoon.style.padding = '40px 20px';
      comingSoon.style.background = 'rgba(255,255,255,0.02)';
      comingSoon.style.borderRadius = 'var(--radius-md)';
      comingSoon.style.border = '1px dashed rgba(255,255,255,0.1)';
      comingSoon.style.marginTop = '10px';
      comingSoon.innerHTML = `
        <i class="fa-solid fa-rocket" style="font-size: 2rem; color: var(--text-dim); margin-bottom: 10px; opacity: 0.7;"></i>
        <h3 style="color: var(--text); font-size: 1.2rem; margin: 0 0 5px 0;">More Achievements Coming Soon</h3>
        <p style="color: var(--text-dim); font-size: 0.9rem; margin: 0;">We're designing new challenges for you to unlock in the next major update!</p>
      `;
      achGrid.appendChild(comingSoon);

      // Update progress bar
      const totalAch = stats.achievements.length;
      const unlockedAch = stats.achievements.filter(a => a.unlocked).length;
      const progressText = document.getElementById('achievementProgressText');
      const progressBar = document.getElementById('achievementProgressBar');
      if (progressText && progressBar) {
        progressText.textContent = `${unlockedAch} / ${totalAch} Unlocked`;
        progressBar.style.width = `${(unlockedAch / totalAch) * 100}%`;
      }
    }
  }

  // ============================================================
  //  BOOT
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
    });
  } else {
    init();
  }

  // Global Countdown Ticker
  setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.live-countdown').forEach(el => {
      const target = parseInt(el.getAttribute('data-timestamp'), 10);
      if (isNaN(target)) return;
      const diff = target - now;
      if (diff <= 0) {
        el.textContent = "Aired";
        el.classList.add('aired');
        return;
      }

      const hours = Math.floor((diff / (1000 * 60 * 60)));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let out = "";
      if (hours > 24) {
        const days = Math.floor(hours / 24);
        out = `${days}d ${hours % 24}h`;
      } else {
        out = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      el.textContent = out;
    });
  }, 1000);
})();

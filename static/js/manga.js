
const MangaApp = {
  state: {
    library: [],
    searchResults: [],
    currentManga: null,
    currentChapters: [],
    reader: {
      chapterId: null,
      images: [],
      baseUrl: '',
      hash: '',
      currentPage: 0,
      direction: 'ltr'
    }
  },

  dom: {},

  init() {
    this.cacheDom();
    this.bindEvents();
    this.fetchLibrary();
  },

  cacheDom() {
    this.dom.tabLibrary = document.getElementById('mangaTabLibrary');
    this.dom.tabSearch = document.getElementById('mangaTabSearch');
    
    this.dom.libraryView = document.getElementById('mangaLibraryView');
    this.dom.searchView = document.getElementById('mangaSearchView');
    this.dom.detailsView = document.getElementById('mangaDetailsView');
    
    this.dom.libraryGrid = document.getElementById('mangaLibraryGrid');
    this.dom.libraryEmpty = document.getElementById('mangaLibraryEmpty');
    
    this.dom.searchInput = document.getElementById('mangaSearchInput');
    this.dom.searchGrid = document.getElementById('mangaSearchGrid');
    
    this.dom.backBtn = document.getElementById('mangaBackBtn');
    this.dom.detailsCover = document.getElementById('mangaDetailsCover');
    this.dom.detailsTitle = document.getElementById('mangaDetailsTitle');
    this.dom.detailsTags = document.getElementById('mangaDetailsTags');
    this.dom.detailsDesc = document.getElementById('mangaDetailsDesc');
    this.dom.addBtn = document.getElementById('mangaDetailsAddBtn');
    this.dom.chapterList = document.getElementById('mangaChapterList');
    
    this.dom.readerModal = document.getElementById('mangaReaderModal');
    this.dom.closeReaderBtn = document.getElementById('closeReaderBtn');
    this.dom.readerTitle = document.getElementById('readerTitle');
    this.dom.readerDirection = document.getElementById('readerDirection');
    this.dom.readerPageCount = document.getElementById('readerPageCount');
    this.dom.readerImage = document.getElementById('readerImage');
    this.dom.readerPrevBtn = document.getElementById('readerPrevBtn');
    this.dom.readerNextBtn = document.getElementById('readerNextBtn');
  },

  bindEvents() {
    this.dom.tabLibrary.addEventListener('click', () => this.switchTab('library'));
    this.dom.tabSearch.addEventListener('click', () => this.switchTab('search'));
    
    let searchTimeout;
    this.dom.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if(e.target.value.trim().length > 2) this.searchManga(e.target.value.trim());
      }, 500);
    });

    this.dom.backBtn.addEventListener('click', () => {
      this.dom.detailsView.classList.add('hidden');
      if (this.dom.tabLibrary.classList.contains('active')) {
        this.dom.libraryView.classList.remove('hidden');
        this.fetchLibrary();
      } else {
        this.dom.searchView.classList.remove('hidden');
      }
    });

    this.dom.addBtn.addEventListener('click', () => this.toggleLibraryStatus());

    this.dom.closeReaderBtn.addEventListener('click', () => this.closeReader());
    this.dom.readerPrevBtn.addEventListener('click', () => this.turnPage(-1));
    this.dom.readerNextBtn.addEventListener('click', () => this.turnPage(1));
    
    this.dom.readerDirection.addEventListener('change', (e) => {
      this.state.reader.direction = e.target.value;
      this.updateReaderControls();
    });

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (!this.dom.readerModal.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') {
          this.turnPage(this.state.reader.direction === 'ltr' ? -1 : 1);
        } else if (e.key === 'ArrowRight') {
          this.turnPage(this.state.reader.direction === 'ltr' ? 1 : -1);
        } else if (e.key === 'Escape') {
          this.closeReader();
        }
      }
    });
  },

  switchTab(tab) {
    this.dom.tabLibrary.classList.toggle('active', tab === 'library');
    this.dom.tabSearch.classList.toggle('active', tab === 'search');
    
    this.dom.libraryView.classList.add('hidden');
    this.dom.searchView.classList.add('hidden');
    this.dom.detailsView.classList.add('hidden');
    
    if (tab === 'library') {
      this.dom.libraryView.classList.remove('hidden');
      this.fetchLibrary();
    } else {
      this.dom.searchView.classList.remove('hidden');
    }
  },

  async fetchLibrary() {
    try {
      const res = await fetch('/api/manga/library');
      const data = await res.json();
      this.state.library = data.library || [];
      this.renderLibrary();
    } catch (e) {
      console.error(e);
    }
  },

  renderLibrary() {
    this.dom.libraryGrid.innerHTML = '';
    if (this.state.library.length === 0) {
      this.dom.libraryEmpty.classList.remove('hidden');
    } else {
      this.dom.libraryEmpty.classList.add('hidden');
      this.state.library.forEach(manga => {
        const card = this.createMangaCard(manga);
        this.dom.libraryGrid.appendChild(card);
      });
    }
  },

  async searchManga(query) {
    this.dom.searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Searching...</div>';
    try {
      // Content rating safe and suggestive. Adult stuff is excluded by default.
      const res = await fetch(`https://api.mangadex.org/manga?title=${encodeURIComponent(query)}&limit=20&contentRating[]=safe&contentRating[]=suggestive&includes[]=cover_art`);
      const data = await res.json();
      this.state.searchResults = data.data.map(m => this.formatMangaData(m));
      this.renderSearchResults();
    } catch (e) {
      this.dom.searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Error fetching results.</div>';
      console.error(e);
    }
  },

  formatMangaData(apiManga) {
    const title = apiManga.attributes.title.en || Object.values(apiManga.attributes.title)[0] || 'Unknown Title';
    const desc = apiManga.attributes.description.en || 'No description available.';
    const coverRel = apiManga.relationships.find(r => r.type === 'cover_art');
    const coverFile = coverRel ? coverRel.attributes.fileName : '';
    const coverUrl = coverFile ? `https://uploads.mangadex.org/covers/${apiManga.id}/${coverFile}.256.jpg` : '';
    const tags = apiManga.attributes.tags.map(t => t.attributes.name.en);
    
    return {
      id: apiManga.id,
      title: title,
      desc: desc,
      cover_url: coverUrl,
      genres: tags.join(', ')
    };
  },

  renderSearchResults() {
    this.dom.searchGrid.innerHTML = '';
    if (this.state.searchResults.length === 0) {
      this.dom.searchGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">No results found.</div>';
      return;
    }
    
    this.state.searchResults.forEach(manga => {
      const card = this.createMangaCard(manga);
      this.dom.searchGrid.appendChild(card);
    });
  },

  createMangaCard(manga) {
    const div = document.createElement('div');
    div.className = 'anime-card';
    div.innerHTML = `
      <div class="anime-poster">
        <img src="${manga.cover_url || '/static/img/placeholder.png'}" alt="${manga.title}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;">
      </div>
      <div class="anime-info" style="padding: 10px;">
        <h3 class="anime-title" style="margin: 0; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${manga.title}</h3>
      </div>
    `;
    div.addEventListener('click', () => this.showDetails(manga));
    return div;
  },

  async showDetails(manga) {
    this.state.currentManga = manga;
    this.dom.libraryView.classList.add('hidden');
    this.dom.searchView.classList.add('hidden');
    this.dom.detailsView.classList.remove('hidden');
    
    this.dom.detailsCover.src = manga.cover_url || '/static/img/placeholder.png';
    this.dom.detailsTitle.textContent = manga.title;
    this.dom.detailsDesc.textContent = manga.desc || 'No description';
    
    this.dom.detailsTags.innerHTML = (manga.genres ? manga.genres.split(',') : []).map(g => `<span class="badge" style="background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${g.trim()}</span>`).join('');
    
    this.updateAddBtnState();
    
    this.dom.chapterList.innerHTML = '<div>Loading chapters...</div>';
    
    try {
      const res = await fetch(`https://api.mangadex.org/manga/${manga.id}/feed?translatedLanguage[]=en&order[chapter]=desc&limit=100`);
      const data = await res.json();
      
      // Get read chapters from local DB if exists
      const libManga = this.state.library.find(m => m.id === manga.id);
      const readChapters = libManga ? (libManga.chapters_read_list || []) : [];
      
      this.state.currentChapters = data.data;
      this.renderChapters(readChapters);
    } catch (e) {
      this.dom.chapterList.innerHTML = '<div>Error loading chapters.</div>';
      console.error(e);
    }
  },

  renderChapters(readChapters) {
    this.dom.chapterList.innerHTML = '';
    if (this.state.currentChapters.length === 0) {
      this.dom.chapterList.innerHTML = '<div>No English chapters found.</div>';
      return;
    }
    
    this.state.currentChapters.forEach(chap => {
      const isRead = readChapters.includes(chap.id);
      const div = document.createElement('div');
      div.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 6px; cursor: pointer; transition: background 0.2s;`;
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="checkbox" class="chapter-read-cb" ${isRead ? 'checked' : ''} style="cursor: pointer;">
          <span style="${isRead ? 'color: var(--text-secondary);' : 'font-weight: 500;'}">Chapter ${chap.attributes.chapter || '?'} ${chap.attributes.title ? '- ' + chap.attributes.title : ''}</span>
        </div>
        <button class="btn-primary btn-sm" style="padding: 4px 10px;">Read</button>
      `;
      
      // Add hover effect
      div.onmouseenter = () => div.style.background = 'rgba(255,255,255,0.1)';
      div.onmouseleave = () => div.style.background = 'rgba(255,255,255,0.05)';
      
      const cb = div.querySelector('.chapter-read-cb');
      cb.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.toggleChapterRead(chap.id, e.target.checked);
        this.fetchLibrary(); // refresh library stats
      });
      
      div.addEventListener('click', () => this.openReader(chap));
      
      this.dom.chapterList.appendChild(div);
    });
  },

  updateAddBtnState() {
    const isInLibrary = this.state.library.some(m => m.id === this.state.currentManga.id);
    if (isInLibrary) {
      this.dom.addBtn.textContent = 'Remove from Library';
      this.dom.addBtn.style.background = 'var(--danger-color, #ef4444)';
    } else {
      this.dom.addBtn.textContent = 'Add to Library';
      this.dom.addBtn.style.background = 'var(--accent)';
    }
  },

  async toggleLibraryStatus() {
    const isInLibrary = this.state.library.some(m => m.id === this.state.currentManga.id);
    try {
      if (isInLibrary) {
        await fetch(`/api/manga/library/${this.state.currentManga.id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/manga/library`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.state.currentManga)
        });
      }
      await this.fetchLibrary();
      this.updateAddBtnState();
    } catch (e) {
      console.error(e);
    }
  },

  async toggleChapterRead(chapterId, isRead) {
    try {
      await fetch('/api/manga/chapter/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manga_id: this.state.currentManga.id,
          chapter_id: chapterId,
          is_read: isRead
        })
      });
    } catch (e) {
      console.error(e);
    }
  },

  async openReader(chapter) {
    this.dom.readerModal.classList.remove('hidden');
    this.dom.readerTitle.textContent = `Chapter ${chapter.attributes.chapter || '?'}`;
    this.dom.readerImage.src = '';
    this.dom.readerPageCount.textContent = 'Loading...';
    
    try {
      const res = await fetch(`https://api.mangadex.org/at-home/server/${chapter.id}`);
      const data = await res.json();
      
      this.state.reader.chapterId = chapter.id;
      this.state.reader.baseUrl = data.baseUrl;
      this.state.reader.hash = data.chapter.hash;
      this.state.reader.images = data.chapter.data;
      this.state.reader.currentPage = 0;
      
      this.renderReaderPage();
      
      // Auto mark as read when opened
      await this.toggleChapterRead(chapter.id, true);
      
      // Refresh chapter list visually
      const libManga = this.state.library.find(m => m.id === this.state.currentManga.id);
      let readChapters = libManga ? (libManga.chapters_read_list || []) : [];
      if (!readChapters.includes(chapter.id)) readChapters.push(chapter.id);
      this.renderChapters(readChapters);

    } catch (e) {
      console.error("Failed to load chapter images", e);
      this.closeReader();
    }
  },

  renderReaderPage() {
    const r = this.state.reader;
    if (r.images.length === 0) return;
    
    const imgFile = r.images[r.currentPage];
    this.dom.readerImage.src = `${r.baseUrl}/data/${r.hash}/${imgFile}`;
    this.dom.readerPageCount.textContent = `Page ${r.currentPage + 1} / ${r.images.length}`;
    
    // Preload next image
    if (r.currentPage < r.images.length - 1) {
      const preload = new Image();
      preload.src = `${r.baseUrl}/data/${r.hash}/${r.images[r.currentPage + 1]}`;
    }
    
    this.updateReaderControls();
  },

  updateReaderControls() {
    const isLtr = this.state.reader.direction === 'ltr';
    
    // In RTL, Prev means "Go Right" and Next means "Go Left"
    // To make it intuitive, we swap the buttons visually or semantically
    if (isLtr) {
      this.dom.readerPrevBtn.textContent = 'Previous';
      this.dom.readerNextBtn.textContent = 'Next';
    } else {
      this.dom.readerPrevBtn.textContent = 'Next';
      this.dom.readerNextBtn.textContent = 'Previous';
    }
  },

  turnPage(delta) {
    const r = this.state.reader;
    const isLtr = r.direction === 'ltr';
    
    // If RTL, invert delta for physical button clicks to match reading direction
    // Wait, physically clicking "Next" button on right side in RTL should turn page forward.
    // I handled the text in updateReaderControls. Let's just do:
    let actualDelta = delta;
    if (!isLtr && event && event.type === 'click') {
      // If clicking the button that says "Next" (which is on the left in RTL if we swapped text)
      // Actually we didn't swap DOM positions, we just swapped text. 
      // If LTR: left btn = Prev(-1), right btn = Next(+1)
      // If RTL: left btn = Next(+1), right btn = Prev(-1)
      if (event.target === this.dom.readerPrevBtn) {
        actualDelta = isLtr ? -1 : 1;
      } else if (event.target === this.dom.readerNextBtn) {
        actualDelta = isLtr ? 1 : -1;
      }
    } else if (!isLtr && event && event.type === 'keydown') {
       // Handled in event listener properly
       actualDelta = delta;
    }

    const newPage = r.currentPage + actualDelta;
    if (newPage >= 0 && newPage < r.images.length) {
      r.currentPage = newPage;
      this.renderReaderPage();
      this.dom.readerImage.scrollIntoView();
    }
  },

  closeReader() {
    this.dom.readerModal.classList.add('hidden');
    this.state.reader.images = [];
    this.dom.readerImage.src = '';
  }
};

// Initialize after DOM loads
document.addEventListener('DOMContentLoaded', () => {
  MangaApp.init();
});

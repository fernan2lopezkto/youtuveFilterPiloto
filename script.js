// CONSTANTES
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';
const LS_THEME = 'youtube_filter_theme'; 
const MAX_HISTORY_ITEMS = 100; // Subido a 100
const HISTORY_BATCH_SIZE = 15; // Carga de a 15 en el historial
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// ESTADO GLOBAL
let API_KEY = '';
let activeView = 'home'; // 'home' (historial) | 'search'
let nextPageToken = ''; // Para API de YouTube
let historyOffset = 0;  // Para paginación del historial local
let isFetching = false;
let currentQuery = '';
let observer;

// ELEMENTOS DOM
const fixedPlayerContainer = document.getElementById('fixed-player-container');
const scrollSentinel = document.getElementById('scroll-sentinel');
const loadingIndicator = document.getElementById('loading-indicator');
const resultsDiv = document.getElementById('results');
const body = document.body;

// =================================================================
// 0. INICIALIZACIÓN
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    setupTheme();
    setupScrollObserver();
    switchView('home'); // Arrancamos en HOME (Historial)
    lucide.createIcons();
});

// =================================================================
// 1. GESTIÓN DE VISTAS (ROUTER SIMPLIFICADO)
// =================================================================

function switchView(viewName) {
    activeView = viewName;
    updateBtmNav(viewName);

    // Elementos UI
    const searchBar = document.getElementById('search-bar-container');
    const configContainer = document.getElementById('config-container');
    const headerMobile = document.getElementById('header-mobile');
    const sectionTitle = document.getElementById('section-title');
    const footer = document.getElementById('main-footer');

    // Resetear scroll y estados
    scrollSentinel.style.display = 'block';

    if (viewName === 'config') {
        configContainer.classList.remove('hidden');
        // Abrir el collapse si entra a config
        document.getElementById('config-toggle-cb').checked = true;
        searchBar.classList.add('hidden');
        resultsDiv.classList.add('hidden');
        sectionTitle.classList.add('hidden');
        headerMobile.classList.remove('hidden');
        footer.classList.remove('hidden');
        scrollSentinel.style.display = 'none';
    } else {
        // Cerrar config
        document.getElementById('config-toggle-cb').checked = false;
        resultsDiv.classList.remove('hidden');
        sectionTitle.classList.remove('hidden');
        footer.classList.remove('hidden'); // Footer visible en home y search

        if (viewName === 'search') {
            searchBar.classList.remove('hidden');
            headerMobile.classList.add('hidden'); // Ocultar header en búsqueda para más espacio
            sectionTitle.innerHTML = `<i data-lucide="search" class="w-5 h-5"></i> Resultados`;

            // Si no hay búsqueda previa, limpiar
            if (!currentQuery) {
                resultsDiv.innerHTML = '<div class="col-span-full text-center opacity-50 py-10">Escribe arriba para buscar videos nuevos.</div>';
                scrollSentinel.style.display = 'none';
            } else if (resultsDiv.childElementCount === 0) {
                 // Restaurar búsqueda si volvimos
                 searchVideos(false); 
            }

        } else if (viewName === 'home') {
            searchBar.classList.add('hidden');
            headerMobile.classList.remove('hidden');
            sectionTitle.innerHTML = `<i data-lucide="clock" class="w-5 h-5"></i> Tu Historial`;

            // Cargar Historial (Reset)
            loadHistoryBatch(true);
        }
    }

    // Manejo del reproductor fijo
    if (viewName === 'config') {
        // Opcional: Ocultar reproductor en config
    } else if (fixedPlayerContainer.classList.contains('fixed-player-active')) {
        body.classList.add('body-push-down');
    }

    lucide.createIcons();
}

function updateBtmNav(activeId) {
    document.querySelectorAll('.btm-nav button').forEach(btn => {
        btn.classList.remove('active', 'text-primary');
        btn.classList.add('text-neutral');
        if (btn.getAttribute('data-target') === activeId) {
            btn.classList.add('active', 'text-primary');
            btn.classList.remove('text-neutral');
        }
    });
}

// =================================================================
// 2. SCROLL INFINITO UNIFICADO
// =================================================================

function setupScrollObserver() {
    const options = {
        root: null, 
        rootMargin: '150px',
        threshold: 0.1
    };

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isFetching) {
            if (activeView === 'search' && nextPageToken) {
                searchVideos(false);
            } else if (activeView === 'home') {
                loadHistoryBatch(false);
            }
        }
    }, options);

    observer.observe(scrollSentinel);
}

// =================================================================
// 3. LÓGICA: HISTORIAL CON PAGINACIÓN
// =================================================================

function loadHistoryBatch(isReset = false) {
    if (isReset) {
        historyOffset = 0;
        resultsDiv.innerHTML = '';
        scrollSentinel.style.display = 'block';
    }

    const fullHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');

    // Si no hay nada en absoluto
    if (fullHistory.length === 0) {
        resultsDiv.innerHTML = `
            <div class="col-span-full text-center py-10 opacity-60 flex flex-col items-center">
                <i data-lucide="film" class="w-12 h-12 mb-2"></i>
                <p>Aún no has visto ningún video.</p>
                <button onclick="switchView('search')" class="btn btn-sm btn-primary mt-4">Ir a Buscar</button>
            </div>
        `;
        scrollSentinel.style.display = 'none';
        lucide.createIcons();
        return;
    }

    // Calcular el lote
    const batch = fullHistory.slice(historyOffset, historyOffset + HISTORY_BATCH_SIZE);

    if (batch.length > 0) {
        renderVideosEfficiently(batch);
        historyOffset += HISTORY_BATCH_SIZE;
    }

    // Si ya mostramos todo, ocultar centinela
    if (historyOffset >= fullHistory.length) {
        scrollSentinel.style.display = 'none';
        if(resultsDiv.children.length > 0) {
             resultsDiv.insertAdjacentHTML('beforeend', 
                '<div class="col-span-full text-center text-xs opacity-40 py-4">Fin del historial</div>'
             );
        }
    }
}

function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    // Evitar duplicados por ID
    history = history.filter(v => v.id.videoId !== video.id.videoId);

    history.unshift(video);

    // Limitar a 100 items
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
}

// =================================================================
// 4. LÓGICA: BÚSQUEDA (API)
// =================================================================

async function searchVideos(isNewSearch = true) {
    if (!API_KEY) {
        showToast('⚠️ Configura tu API Key primero', 'warning');
        switchView('config');
        return;
    }

    if (isFetching) return;

    if (isNewSearch) {
        const input = document.getElementById('query');
        currentQuery = input ? input.value.trim() : '';
        if (!currentQuery) return;

        nextPageToken = '';
        resultsDiv.innerHTML = '';
        scrollSentinel.style.display = 'block';
    }

    isFetching = true;
    loadingIndicator.classList.remove('hidden');

    const params = new URLSearchParams({
        part: 'snippet',
        q: currentQuery,
        key: API_KEY,
        type: 'video',
        maxResults: 15,
        videoEmbeddable: 'true',
        safeSearch: 'strict'
    });

    if (nextPageToken) params.append('pageToken', nextPageToken);

    try {
        const response = await fetch(`${BASE_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            showToast(`Error API: ${data.error.message}`, 'error');
            return;
        }

        nextPageToken = data.nextPageToken || '';

        if (data.items) {
            // Filtrar antes de renderizar
            const safeVideos = data.items.filter(v => !filterVideo(v.snippet));
            renderVideosEfficiently(safeVideos);
        }

    } catch (error) {
        showToast('Error de conexión', 'error');
        console.error(error);
    } finally {
        isFetching = false;
        loadingIndicator.classList.add('hidden');
        if (!nextPageToken) scrollSentinel.style.display = 'none';
    }
}

// =================================================================
// 5. RENDERIZADO Y REPRODUCTOR
// =================================================================

function renderVideosEfficiently(videos) {
    const fragment = document.createDocumentFragment();

    videos.forEach(video => {
        if (!video.id.videoId) return;
        // Doble chequeo de filtro por las dudas
        if (filterVideo(video.snippet)) return;

        const card = createVideoCard(video);
        fragment.appendChild(card);
    });

    resultsDiv.appendChild(fragment);
    lucide.createIcons();
}

function createVideoCard(video) {
    const div = document.createElement('div');
    div.className = 'card card-compact bg-base-100 shadow-sm video-item-anim hover:shadow-md transition-shadow duration-200';

    const titleSafe = video.snippet.title.replace(/"/g, '&quot;');

    div.innerHTML = `
        <div class="video-player-wrapper cursor-pointer group">
            <img src="${video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url}" 
                 class="w-full h-full object-cover" loading="lazy" alt="${titleSafe}">
            <div class="video-overlay group-hover:bg-black/40 transition-colors">
                <div class="bg-white/20 backdrop-blur-sm p-3 rounded-full ring-1 ring-white/50">
                    <i data-lucide="play" class="w-8 h-8 text-white fill-current"></i>
                </div>
            </div>
        </div>
        <div class="p-3">
            <h3 class="font-semibold text-sm leading-tight line-clamp-2 mb-1" title="${titleSafe}">${video.snippet.title}</h3>
            <p class="text-xs text-base-content/60 flex items-center gap-1">
                <i data-lucide="user" class="w-3 h-3"></i> ${video.snippet.channelTitle}
            </p>
        </div>
    `;

    div.querySelector('.video-player-wrapper').addEventListener('click', () => {
        addToHistory(video); // Guarda en historial
        playVideo(video.id.videoId, titleSafe);
    });

    return div;
}

function playVideo(videoId, title) {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`;

    fixedPlayerContainer.innerHTML = `
        <div class="video-player-wrapper">
            <iframe class="video-player" src="${embedUrl}" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen title="${title}"></iframe>
            <button id="close-player-btn" class="absolute top-2 right-2 btn btn-circle btn-xs btn-error z-20 text-white opacity-70 hover:opacity-100">✕</button>
        </div>
    `;

    document.getElementById('close-player-btn').addEventListener('click', closePlayer);

    fixedPlayerContainer.classList.remove('fixed-player-hidden');
    fixedPlayerContainer.classList.add('fixed-player-active');
    body.classList.add('body-push-down');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function closePlayer() {
    fixedPlayerContainer.classList.add('fixed-player-hidden');
    fixedPlayerContainer.classList.remove('fixed-player-active');
    setTimeout(() => { fixedPlayerContainer.innerHTML = ''; }, 300);
    body.classList.remove('body-push-down');
}

// =================================================================
// 6. UTILIDADES
// =================================================================

function loadConfig() {
    API_KEY = localStorage.getItem(LS_API_KEY) || '';
    if (API_KEY && document.getElementById('api-key-input')) {
        document.getElementById('api-key-input').value = API_KEY;
    }
    const keywords = localStorage.getItem(LS_KEYWORDS);
    if (keywords && document.getElementById('filter-keywords-input')) {
        document.getElementById('filter-keywords-input').value = keywords;
    }
}

function saveApiKey() {
    const val = document.getElementById('api-key-input').value.trim();
    if(val) {
        localStorage.setItem(LS_API_KEY, val);
        API_KEY = val;
        showToast('API Key Guardada', 'success');
        // Si estamos en home, recargar historial por si acaso
        if (activeView === 'home') loadHistoryBatch(true);
    }
}

function saveKeywords() {
    localStorage.setItem(LS_KEYWORDS, document.getElementById('filter-keywords-input').value.trim());
    showToast('Filtros Guardados', 'success');
}

function filterVideo(snippet) {
    const rawKeywords = localStorage.getItem(LS_KEYWORDS) || '';
    const forbidden = rawKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
    if (!forbidden.length) return false;
    const text = (snippet.title + ' ' + snippet.description).toLowerCase();
    return forbidden.some(badWord => text.includes(badWord));
}

function setupTheme() {
    const toggle = document.getElementById('theme-toggle');
    if(!toggle) return;
    const saved = localStorage.getItem(LS_THEME) || 'cupcake';
    document.documentElement.setAttribute('data-theme', saved);
    toggle.checked = saved === 'night';
    toggle.addEventListener('change', (e) => {
        const theme = e.target.checked ? 'night' : 'cupcake';
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(LS_THEME, theme);
    });
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast toast-center z-[100]';
    toast.innerHTML = `<div class="alert alert-${type} shadow-lg"><span>${msg}</span></div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
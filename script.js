// CONSTANTES
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';
const LS_THEME = 'youtube_filter_theme'; 
const MAX_HISTORY_ITEMS = 100;
const HISTORY_BATCH_SIZE = 15; 
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// ESTADO GLOBAL
let API_KEY = '';
let activeView = 'home'; 
let nextPageToken = ''; 
let historyOffset = 0;
let isFetching = false;
let currentQuery = '';
let observer;

// ESTADO DEL PLAYER & SESIÓN
let player; 
let isPlayerReady = false;
let currentPlayerTitle = ''; 
// 🆕 NUEVO: Set para evitar repetir videos en el autoplay (Anti-Loop)
let sessionWatchedIds = new Set(); 

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
    switchView('home'); 
    lucide.createIcons();
    loadYouTubeIframeAPI();
});

function loadYouTubeIframeAPI() {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    isPlayerReady = true;
    console.log("📺 YouTube Player API lista para la TV");
};

// =================================================================
// 1. GESTIÓN DE VISTAS
// =================================================================

function switchView(viewName) {
    activeView = viewName;
    updateBtmNav(viewName);
    
    const searchBar = document.getElementById('search-bar-container');
    const configContainer = document.getElementById('config-container');
    const headerMobile = document.getElementById('header-mobile');
    const sectionTitle = document.getElementById('section-title');
    const footer = document.getElementById('main-footer');
    
    scrollSentinel.style.display = 'block';
    
    if (viewName === 'config') {
        configContainer.classList.remove('hidden');
        document.getElementById('config-toggle-cb').checked = true;
        searchBar.classList.add('hidden');
        resultsDiv.classList.add('hidden');
        sectionTitle.classList.add('hidden');
        headerMobile.classList.remove('hidden');
        footer.classList.remove('hidden');
        scrollSentinel.style.display = 'none';
    } else {
        document.getElementById('config-toggle-cb').checked = false;
        resultsDiv.classList.remove('hidden');
        sectionTitle.classList.remove('hidden');
        footer.classList.remove('hidden');
        
        if (viewName === 'search') {
            searchBar.classList.remove('hidden');
            headerMobile.classList.add('hidden'); 
            sectionTitle.innerHTML = `<i data-lucide="search" class="w-5 h-5"></i> Resultados`;
            
            if (!currentQuery) {
                resultsDiv.innerHTML = '<div class="col-span-full text-center opacity-50 py-10">Escribe arriba para buscar videos nuevos.</div>';
                scrollSentinel.style.display = 'none';
            } else if (resultsDiv.childElementCount === 0) {
                 searchVideos(false); 
            }
            
        } else if (viewName === 'home') {
            searchBar.classList.add('hidden');
            headerMobile.classList.remove('hidden');
            sectionTitle.innerHTML = `<i data-lucide="clock" class="w-5 h-5"></i> Tu Historial`;
            loadHistoryBatch(true);
        }
    }
    
    if (viewName !== 'config' && fixedPlayerContainer.classList.contains('fixed-player-active')) {
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
// 2. SCROLL INFINITO
// =================================================================

function setupScrollObserver() {
    const options = { root: null, rootMargin: '150px', threshold: 0.1 };

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
// 3. HISTORIAL
// =================================================================

function loadHistoryBatch(isReset = false) {
    if (isReset) {
        historyOffset = 0;
        resultsDiv.innerHTML = '';
        scrollSentinel.style.display = 'block';
    }

    const fullHistory = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    
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

    const batch = fullHistory.slice(historyOffset, historyOffset + HISTORY_BATCH_SIZE);
    
    if (batch.length > 0) {
        renderVideosEfficiently(batch);
        historyOffset += HISTORY_BATCH_SIZE;
    }

    if (historyOffset >= fullHistory.length) {
        scrollSentinel.style.display = 'none';
    }
}

function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    history = history.filter(v => v.id.videoId !== video.id.videoId);
    history.unshift(video);
    if (history.length > MAX_HISTORY_ITEMS) history = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
}

// =================================================================
// 4. BÚSQUEDA (API)
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
// 5. REPRODUCTOR & AUTOPLAY (ANTI-LOOP)
// =================================================================

function playVideo(videoId, title, videoObj = null) {
    // 🆕 Agregamos el ID actual a la lista de "vistos en esta sesión"
    sessionWatchedIds.add(videoId);
    
    currentPlayerTitle = title;
    if (videoObj) addToHistory(videoObj);

    fixedPlayerContainer.innerHTML = `
        <div class="video-player-wrapper">
            <div id="yt-player"></div>
            <button id="close-player-btn" class="absolute top-2 right-2 btn btn-circle btn-xs btn-error z-20 text-white opacity-70 hover:opacity-100">✕</button>
        </div>
    `;
    
    document.getElementById('close-player-btn').addEventListener('click', closePlayer);
    
    fixedPlayerContainer.classList.remove('fixed-player-hidden');
    fixedPlayerContainer.classList.add('fixed-player-active');
    body.classList.add('body-push-down');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (isPlayerReady) {
        if (player && typeof player.destroy === 'function') {
            try { player.destroy(); } catch(e) {}
        }

        player = new YT.Player('yt-player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                'autoplay': 1,
                'playsinline': 1,
                'rel': 0,
                'modestbranding': 1,
                'controls': 1
            },
            events: {
                'onStateChange': onPlayerStateChange,
                'onError': onPlayerError
            }
        });
    } else {
        fixedPlayerContainer.innerHTML = `<div class="video-player-wrapper"><iframe class="video-player" src="https://www.youtube.com/embed/${videoId}?autoplay=1" allowfullscreen></iframe></div>`;
    }
}

function onPlayerError(event) {
    console.error("Error Player:", event.data);
    showToast("Saltando video no disponible...", "warning");
    // Si falla, buscamos otro (la función ya filtra los repetidos)
    if(player) fetchAndPlayRelated(player.getVideoData().video_id, currentPlayerTitle);
}

function onPlayerStateChange(event) {
    // 0 = ENDED
    if (event.data === 0) {
        console.log("🎬 Terminado. Buscando siguiente video NUEVO...");
        const currentId = player.getVideoData().video_id;
        fetchAndPlayRelated(currentId, currentPlayerTitle);
    }
}

async function fetchAndPlayRelated(currentVideoId, queryTitle) {
    if (!API_KEY) return;
    showToast('⏳ Buscando siguiente...', 'info');

    const cleanQuery = queryTitle.replace(/["']/g, ""); 

    const params = new URLSearchParams({
        part: 'snippet',
        q: cleanQuery, 
        type: 'video',
        key: API_KEY,
        maxResults: 15, // Pedimos unos cuantos para tener variedad
        safeSearch: 'strict',
        videoEmbeddable: 'true'
    });

    try {
        const response = await fetch(`${BASE_URL}?${params.toString()}`);
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            // 🆕 FILTRADO INTELIGENTE:
            // 1. Que no sea el actual.
            // 2. Que no sea prohibido.
            // 3. Que NO esté en sessionWatchedIds (videos ya vistos en esta sentada).
            const nextSafeVideo = data.items.find(video => 
                video.id.videoId !== currentVideoId && 
                !filterVideo(video.snippet) &&
                !sessionWatchedIds.has(video.id.videoId)
            );

            if (nextSafeVideo) {
                console.log(`▶️ Siguiente (Nuevo): ${nextSafeVideo.snippet.title}`);
                
                currentPlayerTitle = nextSafeVideo.snippet.title;
                // Lo marcamos como visto ANTES de darle play para que no salga de nuevo
                sessionWatchedIds.add(nextSafeVideo.id.videoId);
                
                addToHistory(nextSafeVideo);
                player.loadVideoById(nextSafeVideo.id.videoId);
            } else {
                // Si ya vimos TODOS los relacionados directos, limpiamos la memoria
                // para permitir repetir en vez de cortar la reproducción.
                console.log("⚠️ Ya viste todos los relacionados. Reiniciando ciclo...");
                sessionWatchedIds.clear();
                // Intentamos de nuevo (recursivo, una sola vez)
                sessionWatchedIds.add(currentVideoId); // Protegemos el actual
                showToast('Ciclo de videos reiniciado', 'info');
                
                // Buscamos cualquier otro seguro de la lista original
                const resetVideo = data.items.find(video => 
                    video.id.videoId !== currentVideoId && !filterVideo(video.snippet)
                );
                
                if(resetVideo) {
                     player.loadVideoById(resetVideo.id.videoId);
                     currentPlayerTitle = resetVideo.snippet.title;
                }
            }
        }
    } catch (error) {
        console.error("Error AutoPlay:", error);
    }
}

function closePlayer() {
    fixedPlayerContainer.classList.add('fixed-player-hidden');
    fixedPlayerContainer.classList.remove('fixed-player-active');
    
    // Al cerrar, limpiamos la sesión para que si vuelve a abrir
    // pueda ver los mismos videos si quiere.
    sessionWatchedIds.clear();
    
    if(player && typeof player.destroy === 'function') {
        player.destroy();
        player = null;
    } else {
        fixedPlayerContainer.innerHTML = '';
    }
    body.classList.remove('body-push-down');
}

// =================================================================
// 6. UTILIDADES
// =================================================================

function renderVideosEfficiently(videos) {
    const fragment = document.createDocumentFragment();
    videos.forEach(video => {
        if (!video.id.videoId) return;
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
        playVideo(video.id.videoId, titleSafe, video);
    });
    
    return div;
}

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

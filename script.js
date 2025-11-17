// Constantes de localStorage y Límite
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';
const LS_THEME = 'youtube_filter_theme'; 
const MAX_HISTORY_ITEMS = 100; 

// Variables globales
let API_KEY = '';
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// Elementos del contenedor fijo
const fixedPlayerContainer = document.getElementById('fixed-player-container');
const body = document.body;
// Referencia a los botones de navegación inferior
const btmNavButtons = document.querySelectorAll('.btm-nav button');

// =================================================================
// 0. INICIALIZACIÓN Y CONFIGURACIÓN
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderHistory();
    setupTheme();
    hideSections("default");
    // Renderizar los iconos de Lucide
    lucide.createIcons();
});

// Función para actualizar la barra inferior (subrayado/activo)
function updateBtmNav(activeId) {
    btmNavButtons.forEach(button => {
        // Remueve la clase 'active' de todos
        button.classList.remove('active');
        // Si el data-target coincide con el ID, lo activa
        if (button.getAttribute('data-target') === activeId) {
            button.classList.add('active');
        }
    });
}

// Función para navegar entre secciones (usada por el btm-nav)
function hideSections(id) {

    // LÓGICA DE VISIBILIDAD DE PESTAÑA ACTIVA
    updateBtmNav(id);

    // LÓGICA DE OCULTAR REPRODUCTOR FIJO (MANTENIENDO EL AUDIO)
    const isPlayerActive = fixedPlayerContainer.classList.contains('fixed-player-active');

    // 🆕 SI NO ES LA PESTAÑA DE BÚSQUEDA: OCULTAMOS
    if (id !== 'search-bar') {
        // Solo agregamos la clase de OCULTAR (transform: translateY(-100%))
        fixedPlayerContainer.classList.add('fixed-player-hidden');
        // Quitamos el padding del body
        body.classList.remove('body-push-down'); 
    } else {
        // 🆕 SI ES LA PESTAÑA DE BÚSQUEDA: MOSTRAMOS si está ACTIVO
        if (isPlayerActive) {
            fixedPlayerContainer.classList.remove('fixed-player-hidden');
            body.classList.add('body-push-down');
        }
    }

    switch (id) {
        case 'top':
            document.getElementById('toogle').style.display = 'flex';
            document.getElementById('search-bar').style.display = 'flex';
            document.getElementById('results').style.display = 'none'; 
            document.getElementById('history-section').style.display = 'block';
            document.getElementById('config-container').style.display = 'none';
            console.log('Navegando a Inicio');
            break;
        case 'search-bar':
            document.getElementById('toogle').style.display = 'none';
            document.getElementById('search-bar').style.display = 'flex';
            document.getElementById('results').style.display = 'block';
            document.getElementById('history-section').style.display = 'none';
            document.getElementById('config-container').style.display = 'none';
            console.log('Navegando a Búsqueda');
            break;
        case 'config-container':
            document.getElementById('config-toggle-cb').checked = true;
            document.getElementById('toogle').style.display = 'none';
            document.getElementById('search-bar').style.display = 'none';
            document.getElementById('results').style.display = 'none';
            document.getElementById('history-section').style.display = 'none';
            document.getElementById('config-container').style.display = 'block';
            console.log('Navegando a Configuración');
            break;
        case 'history-section':
            document.getElementById('toogle').style.display = 'none';
            document.getElementById('search-bar').style.display = 'none';
            document.getElementById('results').style.display = 'none';
            document.getElementById('history-section').style.display = 'block';
            document.getElementById('config-container').style.display = 'none';
            console.log('Navegando a Historial');
            break;
        default:
            // Comportamiento por defecto (Al cargar)
            document.getElementById('toogle').style.display = 'flex';
            document.getElementById('search-bar').style.display = 'flex';
            document.getElementById('results').style.display = 'flex';
            document.getElementById('history-section').style.display = 'block';
            document.getElementById('config-container').style.display = 'none';

            // Aseguramos ocultamiento y limpieza al inicio
            fixedPlayerContainer.classList.add('fixed-player-hidden');
            body.classList.remove('body-push-down');
            fixedPlayerContainer.classList.remove('fixed-player-active'); 
            fixedPlayerContainer.innerHTML = ''; 
            updateBtmNav('top');
            console.log(id);
            break;
    };
}


// =================================================================
// 1. GESTIÓN DE LA API KEY Y CONFIGURACIÓN
// =================================================================

function loadConfig() {
    const savedApiKey = localStorage.getItem(LS_API_KEY);
    if (savedApiKey) {
        API_KEY = savedApiKey;
        document.getElementById('api-key-input').value = savedApiKey;
    } else {
        document.getElementById('config-toggle-cb').checked = true;
    }
    const savedKeywords = localStorage.getItem(LS_KEYWORDS);
    if (savedKeywords) {
        document.getElementById('filter-keywords-input').value = savedKeywords;
    }
}

function showConfigMessage(message, type = 'success') {
    const container = document.getElementById('config-message-container');
    const alertType = type === 'success' ? 'alert-success' : 'alert-error';
    container.innerHTML = `<div class="alert ${alertType} shadow-sm"><span>${message}</span></div>`;
    setTimeout(() => {container.innerHTML = '';}, 3000);
}

function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input').value.trim();
    if (apiKeyInput) {
        localStorage.setItem(LS_API_KEY, apiKeyInput);
        API_KEY = apiKeyInput;
        showConfigMessage('✅ Clave de API guardada exitosamente.', 'success');
    } else {
        showConfigMessage('❌ Por favor, ingresa una clave válida.', 'error');
    }
}

function saveKeywords() {
    const keywordsInput = document.getElementById('filter-keywords-input').value.trim();
    localStorage.setItem(LS_KEYWORDS, keywordsInput);
    showConfigMessage('✅ Palabras clave de filtro guardadas exitosamente.', 'success');
    renderHistory();
}

// =================================================================
// 2. FILTRADO DE CONTENIDO
// =================================================================

function getFilterKeywords() {
    const keywordsString = localStorage.getItem(LS_KEYWORDS) || '';
    return keywordsString.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
}

function filterVideo(snippet) {
    const keywords = getFilterKeywords();
    if (keywords.length === 0) return false; 

    const title = (snippet.title || '').toLowerCase();
    const description = (snippet.description || '').toLowerCase();

    for (const keyword of keywords) {
        if (title.includes(keyword) || description.includes(keyword)) {
            return true; 
        }
    }
    return false;
}

// =================================================================
// 3. GESTIÓN DEL HISTORIAL
// =================================================================

function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    const videoId = video.id.videoId;
    history = history.filter(v => v.id.videoId !== videoId);
    history.unshift(video);
    history = history.slice(0, MAX_HISTORY_ITEMS); 
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const historyDiv = document.getElementById('viewed-history');
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    historyDiv.innerHTML = ''; 

    if (history.length === 0) {
        historyDiv.innerHTML = `<div class="alert alert-info shadow-sm">
            <span>Tu historial aparecerá aquí después de ver un video.</span>
        </div>`;
        return;
    }

    let renderedCount = 0;
    history.forEach(video => {
        if (!filterVideo(video.snippet)) {
            historyDiv.appendChild(createVideoElement(video, 'history'));
            renderedCount++;
        }
    });

    if (renderedCount === 0) {
        historyDiv.innerHTML = `<div class="alert alert-warning shadow-sm">
            <span>Tu historial está vacío o todos los videos fueron filtrados.</span>
        </div>`;
    }
}

// =================================================================
// 4. BÚSQUEDA Y RENDERIZADO (CON REPRODUCTOR FIJO)
// =================================================================

function playVideoInFixedPlayer(video) {
    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1`;

    const existingIframe = fixedPlayerContainer.querySelector(`[data-video-id="${videoId}"]`);

    // Solo inyectamos el HTML si es un video nuevo o el contenedor estaba vacío
    if (!existingIframe) {
        const newPlayerHTML = `
            <div class="video-player-wrapper">
                <iframe class="video-player"
                    src="${embedUrl}"
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen 
                    title="Reproductor Fijo: ${videoTitle}"
                    data-video-id="${videoId}">
                </iframe>
            </div>
        `;
        fixedPlayerContainer.innerHTML = newPlayerHTML;
    } else {
        // Si el video ya está cargado, nos aseguramos de que el iframe no se haya recargado
        // y solo le mandamos un postMessage si el API estuviera disponible (aunque no es necesario para autoplay)
        // Por simplicidad en vanilla JS, nos conformamos con que el iframe persista.
    }

    // Marcamos el contenedor como activo y mostramos
    fixedPlayerContainer.classList.remove('fixed-player-hidden');
    fixedPlayerContainer.classList.add('fixed-player-active');

    // Y aseguramos el padding para empujar el contenido
    body.classList.add('body-push-down'); 
    fixedPlayerContainer.classList.add('fixed-player-active'); // Aseguramos que está activo

    window.scrollTo({ top: 0, behavior: 'smooth' });
}


function createVideoElement(video, type = 'result') {
    const videoElement = document.createElement('div');
    videoElement.className = `card card-compact bg-base-100 shadow-md ${type}`;

    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;

    videoElement.innerHTML = `
        <div class="video-player-wrapper">
            <div class="video-overlay" aria-label="Reproducir video ${videoTitle}">
                <i data-lucide="play-circle" class="w-12 h-12 text-white/90 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80 hover:opacity-100 transition duration-200"></i>
            </div>
            <img src="https://img.youtube.com/vi/${videoId}/mqdefault.jpg" 
                 alt="Miniatura de ${videoTitle}" 
                 class="w-full h-full object-cover"/>
        </div>
        <div class="card-body">
            <h3 class="card-title text-base">${videoTitle}</h3>
            <p class="text-sm">Canal: ${video.snippet.channelTitle}</p>
            <p class="id-text">ID: ${videoId}</p>
        </div>
    `;

    lucide.createIcons();

    const overlay = videoElement.querySelector('.video-overlay');

    overlay.addEventListener('click', () => {
        if (type === 'result') {
            addToHistory(video);
        }
        // Cuando hacemos clic, navegamos a la sección de búsqueda y reproducimos
        hideSections('search-bar');
        playVideoInFixedPlayer(video);
    });

    return videoElement;
}

function showResultMessage(message, type = 'info') {
    const resultsDiv = document.getElementById('results');
    let alertType = 'alert-info';
    if (type === 'error') alertType = 'alert-error';
    if (type === 'warning') alertType = 'alert-warning';

    resultsDiv.innerHTML = `<div class="alert ${alertType} shadow-sm"><span>${message}</span></div>`;
}

async function searchVideos() {
    // Aseguramos que la navegación a búsqueda active la pestaña correcta
    hideSections('search-bar'); 
    const resultsDiv = document.getElementById('results');

    if (!API_KEY) {
        showResultMessage('❌ La Clave de API no está configurada. Por favor, guárdala en Configuración.', 'error');
        document.getElementById('config-toggle-cb').checked = true;
        return;
    }

    const query = document.getElementById('query').value;
    if (!query) {
        showResultMessage('Por favor, escribe una consulta.', 'warning');
        return;
    }

    resultsDiv.innerHTML = `<div class="skeleton w-full h-32"></div>`; 

    const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        key: API_KEY,
        type: 'video', 
        maxResults: 30,
        videoEmbeddable: 'true' 
    });

    const url = `${BASE_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            showResultMessage(`Error de API: ${data.error.message}. Verifica tu clave y la cuota.`, 'error');
            return;
        }

        if (data.items && data.items.length > 0) {
            renderSearchResults(data.items);
        } else {
            showResultMessage('No se encontraron videos para esa búsqueda.', 'info');
        }

    } catch (error) {
        showResultMessage(`Error de red: ${error.message}.`, 'error');
        console.error('Fetch Error:', error);
    }
}

function renderSearchResults(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; 
    let filteredCount = 0;
    let renderedCount = 0;

    resultsDiv.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4'); 

    videos.forEach(video => {
        if (!video.id || !video.id.videoId) return;

        if (filterVideo(video.snippet)) {
            filteredCount++;
            return; 
        }

        resultsDiv.appendChild(createVideoElement(video, 'result'));
        renderedCount++;
    });

    if (renderedCount === 0 && filteredCount > 0) {
        showResultMessage(`Se filtraron ${filteredCount} videos de los resultados. Intenta otra búsqueda.`, 'warning');
    } else if (renderedCount === 0 && filteredCount === 0) {
        showResultMessage('No se encontraron videos que coincidieran con la búsqueda.', 'info');
    } else if (filteredCount > 0) {
        resultsDiv.insertAdjacentHTML('afterbegin', `
            <div class="alert alert-success shadow-sm mb-4 col-span-full">
                <span>ℹ️ Se han filtrado ${filteredCount} videos por tus palabras clave.</span>
            </div>
        `);
    }
}


// =================================================================
// 5. GESTIÓN DEL TEMA (MODO OSCURO)
// =================================================================

function setupTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement; 

    const savedTheme = localStorage.getItem(LS_THEME);

    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
        themeToggle.checked = (savedTheme === 'night');
    } else {
        htmlElement.setAttribute('data-theme', 'cupcake');
        themeToggle.checked = false;
    }

    themeToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            htmlElement.setAttribute('data-theme', 'night');
            localStorage.setItem(LS_THEME, 'night');
        } else {
            htmlElement.setAttribute('data-theme', 'cupcake');
            localStorage.setItem(LS_THEME, 'cupcake');
        }
    });
}
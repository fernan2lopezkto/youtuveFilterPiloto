// Constantes de localStorage y Límite
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';
const LS_THEME = 'youtube_filter_theme'; 
const MAX_HISTORY_ITEMS = 20; 

// Variables globales
let API_KEY = '';
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// =================================================================
// 0. INICIALIZACIÓN Y CONFIGURACIÓN
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderHistory();
    setupTheme();
    
    // Renderizar los iconos de Lucide
    lucide.createIcons();
});


// Función para navegar entre secciones (usada por el btm-nav)
function scrollToSection(id) {
    let element;
    
    if (id === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    element = document.getElementById(id);

    if (element) {
        // Obtenemos la posición del elemento. Restamos para compensar el navbar fijo.
        const headerOffset = 64; // Altura aproximada del navbar fijo en escritorio (lg:pt-16)
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
}


// =================================================================
// 1. GESTIÓN DE LA API KEY Y CONFIGURACIÓN
// =================================================================
// ... (Funciones loadConfig, showConfigMessage, saveApiKey, saveKeywords sin cambios) ...

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
// ... (Funciones getFilterKeywords, filterVideo sin cambios) ...

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
// ... (Funciones addToHistory, renderHistory sin cambios) ...

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
// 4. BÚSQUEDA Y RENDERIZADO (CON LA SOLUCIÓN DEL OVERLAY)
// =================================================================

function createVideoElement(video, type = 'result') {
    const videoElement = document.createElement('div');
    videoElement.className = `card card-compact bg-base-100 shadow-md ${type}`;
    
    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;
    
    // CORRECCIÓN: Simplificamos la URL para evitar el Error 153.
    // Quitamos &enablejsapi=1 y &rel=0 que son fuente de problemas.
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&modestbranding=1`;
    
    videoElement.innerHTML = `
        <div class="video-player-wrapper">
            <iframe class="video-player"
                src="${embedUrl}"
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen 
                title="Reproductor: ${videoTitle}"
                data-video-id="${videoId}">
            </iframe>
            <div class="video-overlay" aria-label="Reproducir video ${videoTitle}"></div>
        </div>
        <div class="card-body">
            <h3 class="card-title text-base">${videoTitle}</h3>
            <p class="text-sm">Canal: ${video.snippet.channelTitle}</p>
            <p class="id-text">ID: ${videoId}</p>
        </div>
    `;

    const overlay = videoElement.querySelector('.video-overlay');
    
    overlay.addEventListener('click', () => {
        if (type === 'result') {
            addToHistory(video);
        }
        overlay.style.display = 'none';
    }, { once: true });

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
        maxResults: 20,
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
            <div class="alert alert-success shadow-sm mb-4">
                <span>ℹ️ Se han filtrado ${filteredCount} videos por tus palabras clave.</span>
            </div>
        `);
    }
}


// =================================================================
// 5. GESTIÓN DEL TEMA (MODO OSCURO)
// =================================================================
// ... (Función setupTheme sin cambios) ...

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

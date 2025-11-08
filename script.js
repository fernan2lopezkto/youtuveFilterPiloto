// Constantes de localStorage y Límite
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';
const MAX_HISTORY_ITEMS = 20; // Límite de videos en el historial

// Variables globales
let API_KEY = '';
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// =================================================================
// 0. INICIALIZACIÓN
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderHistory();
    // Revisa si la config está abierta o cerrada
    document.getElementById('config-toggle-cb').addEventListener('change', (e) => {
        // Esto es solo para que el texto del botón no sea necesario
    });
});


// =================================================================
// 1. GESTIÓN DE LA API KEY Y CONFIGURACIÓN
// =================================================================

function loadConfig() {
    // Cargar API Key
    const savedApiKey = localStorage.getItem(LS_API_KEY);
    if (savedApiKey) {
        API_KEY = savedApiKey;
        document.getElementById('api-key-input').value = savedApiKey;
    } else {
        // Mostrar config si no hay clave forzando la visualización
        document.getElementById('config-toggle-cb').checked = true;
    }

    // Cargar Palabras Clave
    const savedKeywords = localStorage.getItem(LS_KEYWORDS);
    if (savedKeywords) {
        document.getElementById('filter-keywords-input').value = savedKeywords;
    }
}

// Ya no es necesario, usamos el checkbox de DaisyUI
function toggleConfig() { }

// Función para mostrar mensajes de config
function showConfigMessage(message, type = 'success') {
    const container = document.getElementById('config-message-container');
    const alertType = type === 'success' ? 'alert-success' : 'alert-error';
    
    container.innerHTML = `
        <div class="alert ${alertType} shadow-sm">
            <span>${message}</span>
        </div>
    `;
    // Borrar el mensaje después de 3 segundos
    setTimeout(() => {
        container.innerHTML = '';
    }, 3000);
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
    
    // IMPORTANTE: Refrescar el historial al guardar nuevas palabras clave
    renderHistory();
    // Podríamos también refrescar los resultados si los hay
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
    
    // Sanitizar un poco los inputs
    const title = (snippet.title || '').toLowerCase();
    const description = (snippet.description || '').toLowerCase();

    for (const keyword of keywords) {
        if (title.includes(keyword) || description.includes(keyword)) {
            return true; // Filtrar (Ocultar) este video
        }
    }
    return false; // Mostrar este video
}

// =================================================================
// 3. GESTIÓN DEL HISTORIAL
// =================================================================

function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    const videoId = video.id.videoId;
    
    history = history.filter(v => v.id.videoId !== videoId); // Eliminar duplicados
    history.unshift(video); // Añadir al inicio
    history = history.slice(0, MAX_HISTORY_ITEMS); // Limitar a 20
    
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    
    // No llamamos a renderHistory() para optimizar, 
    // en su lugar, actualizamos el DOM directamente (aunque tu método original es más simple)
    // Dejamos tu lógica original: renderHistory() asegura que los filtros se apliquen
    renderHistory();
}

function renderHistory() {
    const historyDiv = document.getElementById('viewed-history');
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    historyDiv.innerHTML = ''; // Limpiar

    if (history.length === 0) {
        historyDiv.innerHTML = `<div class="alert alert-info shadow-sm">
            <span>Tu historial aparecerá aquí después de ver un video.</span>
        </div>`;
        return;
    }

    let renderedCount = 0;
    history.forEach(video => {
        // Aseguramos que el video no se muestre si es filtrado por la configuración actual
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
    // Usamos clases de DaisyUI: card
    const videoElement = document.createElement('div');
    videoElement.className = `card card-compact bg-base-100 shadow-md ${type}`;
    
    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1&modestbranding=1`;
    
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

    // ========== INICIO DE LA CORRECCIÓN (MÓVIL) ==========
    const overlay = videoElement.querySelector('.video-overlay');
    
    // Usamos 'once: true' para que el listener se ejecute una sola vez
    overlay.addEventListener('click', () => {
        if (type === 'result') {
            addToHistory(video);
        }
        // Ocultamos el overlay para permitir futuros clics (pausa, etc.)
        overlay.style.display = 'none';
        
        // (Opcional) Podríamos intentar auto-enfocar el iframe
        // videoElement.querySelector('iframe').focus();
    }, { once: true });
    // ========== FIN DE LA CORRECCIÓN ==========

    return videoElement;
}

// Función para mostrar mensajes en el div de resultados
function showResultMessage(message, type = 'info') {
    const resultsDiv = document.getElementById('results');
    let alertType = 'alert-info';
    if (type === 'error') alertType = 'alert-error';
    if (type === 'warning') alertType = 'alert-warning';

    resultsDiv.innerHTML = `
        <div class="alert ${alertType} shadow-sm">
            <span>${message}</span>
        </div>
    `;
}

async function searchVideos() {
    const resultsDiv = document.getElementById('results');
    
    if (!API_KEY) {
        showResultMessage('❌ La Clave de API no está configurada. Por favor, guárdala en Configuración.', 'error');
        document.getElementById('config-toggle-cb').checked = true; // Abrir config
        return;
    }
    
    const query = document.getElementById('query').value;
    if (!query) {
        showResultMessage('Por favor, escribe una consulta.', 'warning');
        return;
    }

    resultsDiv.innerHTML = `<div class="skeleton w-full h-32"></div>`; // Esqueleto de carga

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
        // Añadir mensaje de videos filtrados al inicio
        resultsDiv.insertAdjacentHTML('afterbegin', `
            <div class="alert alert-success shadow-sm mb-4">
                <span>ℹ️ Se han filtrado ${filteredCount} videos por tus palabras clave.</span>
            </div>
        `);
    }
}

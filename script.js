// Constantes para las claves de localStorage
const LS_API_KEY = 'youtube_api_key';
const LS_KEYWORDS = 'filter_keywords';
const LS_HISTORY = 'video_history';

// Variables globales
let API_KEY = '';
const BASE_URL = 'https://www.googleapis.com/youtube/v3/search';

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    renderHistory();
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
        // Forzar la visualización de la configuración si no hay clave
        document.getElementById('config-section').style.display = 'block';
        document.getElementById('toggle-config-btn').textContent = 'Ocultar Configuración';
    }

    // Cargar Palabras Clave
    const savedKeywords = localStorage.getItem(LS_KEYWORDS);
    if (savedKeywords) {
        document.getElementById('filter-keywords-input').value = savedKeywords;
    }
}

function toggleConfig() {
    const configDiv = document.getElementById('config-section');
    const btn = document.getElementById('toggle-config-btn');
    if (configDiv.style.display === 'none') {
        configDiv.style.display = 'block';
        btn.textContent = 'Ocultar Configuración';
    } else {
        configDiv.style.display = 'none';
        btn.textContent = 'Mostrar Configuración';
    }
}

function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input').value.trim();
    if (apiKeyInput) {
        localStorage.setItem(LS_API_KEY, apiKeyInput);
        API_KEY = apiKeyInput;
        document.getElementById('config-message').textContent = '✅ Clave de API guardada exitosamente.';
    } else {
        document.getElementById('config-message').textContent = '❌ Por favor, ingresa una clave válida.';
    }
}

function saveKeywords() {
    const keywordsInput = document.getElementById('filter-keywords-input').value.trim();
    localStorage.setItem(LS_KEYWORDS, keywordsInput);
    document.getElementById('config-message').textContent = '✅ Palabras clave de filtro guardadas exitosamente.';
}

// =================================================================
// 2. FILTRADO DE CONTENIDO
// =================================================================

function getFilterKeywords() {
    const keywordsString = localStorage.getItem(LS_KEYWORDS) || '';
    // Separar por coma y limpiar espacios, filtrar vacíos y convertir a minúsculas
    return keywordsString.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
}

/**
 * Filtra el video basado en el título y la descripción.
 */
function filterVideo(snippet) {
    const keywords = getFilterKeywords();
    if (keywords.length === 0) return false; // No hay filtros activos
    
    const title = snippet.title.toLowerCase();
    const description = snippet.description.toLowerCase();

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
    
    // Eliminar si ya existe para moverlo al principio
    history = history.filter(v => v.id.videoId !== video.id.videoId);
    
    // Añadir el nuevo video al inicio
    history.unshift(video);
    
    // Limitar el historial a 5 videos para mantenerlo manejable
    history = history.slice(0, 5); 
    
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const historyDiv = document.getElementById('viewed-history');
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    historyDiv.innerHTML = '';
    
    if (history.length === 0) {
        historyDiv.innerHTML = '<p class="placeholder-history">Tu historial aparecerá aquí después de ver un video.</p>';
        return;
    }

    history.forEach(video => {
        historyDiv.appendChild(createVideoElement(video, 'history'));
    });
}


// =================================================================
// 4. BÚSQUEDA Y RENDERIZADO
// =================================================================

function createVideoElement(video, type = 'result') {
    const videoElement = document.createElement('div');
    videoElement.className = `video-item ${type}`;
    
    const videoId = video.id.videoId;
    // Añadimos 'enablejsapi=1' para futura interacción si la necesitamos
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1`;
    
    videoElement.innerHTML = `
        <iframe class="video-player"
            src="${embedUrl}"
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen 
            data-video-id="${videoId}"
            onload="setupIframeListener(this, ${JSON.stringify(video).replace(/'/g, "\\'")})"> 
        </iframe>
        <h3>${video.snippet.title}</h3>
        <p>Canal: ${video.snippet.channelTitle}</p>
        <p class="id-text">ID: ${videoId}</p>
    `;
    return videoElement;
}

// Escucha el evento 'click' del iframe para registrar la vista en el historial
function setupIframeListener(iframe, videoData) {
    // Usamos el evento 'onload' del iframe para saber cuándo está listo para la interacción
    // En un proyecto real con el API de YouTube JS, se usaría player.addEventListener('onStateChange').
    // Para esta prueba simple, solo detectaremos el clic en el elemento padre o un enfoque.
    iframe.contentWindow.addEventListener('focus', () => {
        addToHistory(videoData);
    });
}


async function searchVideos() {
    const resultsDiv = document.getElementById('results');
    
    if (!API_KEY) {
        resultsDiv.innerHTML = '<p class="error">❌ La Clave de API no está configurada. Por favor, guárdala en Configuración.</p>';
        document.getElementById('config-section').style.display = 'block';
        return;
    }
    
    const query = document.getElementById('query').value;
    if (!query) {
        resultsDiv.innerHTML = '<p class="error">Por favor, escribe una consulta.</p>';
        return;
    }

    resultsDiv.innerHTML = '<p>Buscando videos...</p>';

    const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        key: API_KEY,
        type: 'video', 
        maxResults: 20, // Aumentar a 20 resultados
        videoEmbeddable: 'true' // Asegurar que los videos se puedan incrustar
    });

    const url = `${BASE_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            resultsDiv.innerHTML = `<p class="error">Error de API: ${data.error.message}. Verifica tu clave y la cuota.</p>`;
            return;
        }

        if (data.items && data.items.length > 0) {
            renderSearchResults(data.items);
        } else {
            resultsDiv.innerHTML = '<p>No se encontraron videos para esa búsqueda.</p>';
        }

    } catch (error) {
        resultsDiv.innerHTML = `<p class="error">Error de red: ${error.message}.</p>`;
        console.error('Fetch Error:', error);
    }
}

function renderSearchResults(videos) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; 
    let filteredCount = 0;
    let renderedCount = 0;

    videos.forEach(video => {
        // Ignorar si el video no tiene ID (a veces pasa con canales o listas)
        if (!video.id || !video.id.videoId) return;

        // --- APLICACIÓN DEL FILTRO ---
        if (filterVideo(video.snippet)) {
            filteredCount++;
            console.log(`[FILTRADO] Video "${video.snippet.title}" contiene palabra clave prohibida.`);
            return; 
        }
        // -----------------------------

        resultsDiv.appendChild(createVideoElement(video, 'result'));
        renderedCount++;
    });
    
    if (renderedCount === 0 && filteredCount > 0) {
        resultsDiv.innerHTML = `<p class="placeholder">Se filtraron ${filteredCount} videos de los resultados. Intenta otra búsqueda.</p>`;
    } else if (renderedCount === 0 && filteredCount === 0) {
        resultsDiv.innerHTML = '<p class="placeholder">No se encontraron videos que coincidieran con la búsqueda.</p>';
    } else if (filteredCount > 0) {
        resultsDiv.insertAdjacentHTML('afterbegin', `<p class="info">ℹ️ Se han filtrado ${filteredCount} videos por tus palabras clave definidas.</p>`);
    }
}

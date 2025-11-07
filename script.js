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
    const isVisible = configDiv.style.display === 'block';

    if (isVisible) {
        configDiv.style.display = 'none';
        btn.textContent = 'Mostrar Configuración';
    } else {
        configDiv.style.display = 'block';
        btn.textContent = 'Ocultar Configuración';
    }
}

function saveApiKey() {
    const apiKeyInput = document.getElementById('api-key-input').value.trim();
    const configMessage = document.getElementById('config-message');
    if (apiKeyInput) {
        localStorage.setItem(LS_API_KEY, apiKeyInput);
        API_KEY = apiKeyInput;
        configMessage.textContent = '✅ Clave de API guardada exitosamente.';
    } else {
        configMessage.textContent = '❌ Por favor, ingresa una clave válida.';
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
    return keywordsString.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
}

function filterVideo(snippet) {
    const keywords = getFilterKeywords();
    if (keywords.length === 0) return false; 
    
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
// 3. GESTIÓN DEL HISTORIAL (Corregido y límite a 20)
// =================================================================

function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    
    // Usamos el id.videoId para el identificador único
    const videoId = video.id.videoId;

    // Eliminar si ya existe para moverlo al principio (evita duplicados)
    history = history.filter(v => v.id.videoId !== videoId);
    
    // Añadir el nuevo video al inicio
    history.unshift(video);
    
    // Limitar el historial a 20 videos
    history = history.slice(0, MAX_HISTORY_ITEMS); 
    
    localStorage.setItem(LS_HISTORY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const historyDiv = document.getElementById('viewed-history');
    const history = JSON.parse(localStorage.getItem(LS_HISTORY) || '[]');
    historyDiv.innerHTML = ''; // Limpiar

    if (history.length === 0) {
        historyDiv.innerHTML = '<p class="placeholder-history">Tu historial aparecerá aquí después de ver un video.</p>';
        return;
    }

    history.forEach(video => {
        // Aseguramos que el video no se muestre si es filtrado por la configuración actual
        if (!filterVideo(video.snippet)) {
            historyDiv.appendChild(createVideoElement(video, 'history'));
        }
    });

    if (historyDiv.innerHTML === '') {
        historyDiv.innerHTML = `<p class="placeholder-history">Tu historial está vacío o todos los videos fueron filtrados por las palabras clave.</p>`;
    }
}


// =================================================================
// 4. BÚSQUEDA Y RENDERIZADO
// =================================================================

function createVideoElement(video, type = 'result') {
    const videoElement = document.createElement('div');
    videoElement.className = `video-item ${type}`;
    
    const videoId = video.id.videoId;
    
    // URL de EMBED con rel=0 (sugerencias del mismo canal) y modestbranding=1 (elimina el logo/botón "Ver en YT")
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&enablejsapi=1&modestbranding=1`;
    
    // Usamos 'data-' atributos para pasar los datos al listener
    videoElement.innerHTML = `
        <iframe class="video-player"
            src="${embedUrl}"
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen 
            data-video-id="${videoId}">
        </iframe>
        <h3>${video.snippet.title}</h3>
        <p>Canal: ${video.snippet.channelTitle}</p>
        <p class="id-text">ID: ${videoId}</p>
    `;

    // ========== INICIO DE LA CORRECCIÓN ==========
    // Antes intentabas escuchar 'iframe.contentWindow.addEventListener'
    // lo cual falla por permisos (Same-Origin Policy) en GitHub Pages.
    
    const iframe = videoElement.querySelector('iframe');
    
    // Solución: Escuchamos el 'focus' directamente sobre el elemento <iframe>.
    // Esto se dispara cuando el usuario hace clic en el reproductor para verlo.
    iframe.addEventListener('focus', () => {
        // Solo agregamos al historial si es un video de resultados (no del historial mismo)
        // Opcional: Podrías quitar este 'if' si querés que se re-agregue al tope
        // cada vez que se ve desde el historial.
        if (type === 'result') {
            addToHistory(video);
        }
    });
    // ========== FIN DE LA CORRECCIÓN ==========

    return videoElement;
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
        maxResults: 20, // 20 resultados
        videoEmbeddable: 'true' 
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
        resultsDiv.innerHTML = `<p class="error">Error de red: ${error.message}.</Ttipo_de_datosp>`;
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

        // --- APLICACIÓN DEL FILTRO ---
        if (filterVideo(video.snippet)) {
            filteredCount++;
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

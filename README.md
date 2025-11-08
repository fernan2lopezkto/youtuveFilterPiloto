# 📺 Filtro de Contenido de YouTube (Piloto)

¡Un proyecto (SPA) hecho con el objetivo de proteger a los más chicos!

> **[⚡ ACCEDER A LA APLICACIÓN ⚡](https://fernan2lopezkto.github.io/youtuveFilterPiloto/)**

---

## 📖 Idea General

Este es un proyecto piloto (SPA - Single Page Application) creado con la intención de proveer un entorno de visualización de YouTube más seguro para los niños. 

La aplicación permite a los padres o tutores realizar dos acciones principales:
1.  **Buscar videos** usando la API oficial de YouTube.
2.  **Filtrar resultados** automáticamente basándose en una lista de "palabras clave prohibidas" (ej: "halloween", "miedo", "bruja") que se guardan localmente en el navegador.

Si un video (en su título o descripción) contiene alguna de esas palabras, no se mostrará en los resultados ni en el historial.

## 🚀 Puesta en Marcha (Setup Obligatorio)

Para que la aplicación funcione, **es obligatorio** conseguir y configurar una Clave de API de "YouTube Data API v3".

### ¿Cómo obtener la Clave de API?

1.  Necesitás tener una cuenta de Google (Gmail).
2.  Tenés que ir a la [Google Cloud Console](https://console.cloud.google.com/) y crear un nuevo proyecto.
3.  Dentro de tu proyecto, ir a la sección "APIs y Servicios" -> "Biblioteca".
4.  Buscar y habilitar la API llamada **"YouTube Data API v3"**.
5.  Una vez habilitada, andá a "Credenciales", hacé clic en "Crear Credenciales" y seleccioná "Clave de API".
6.  ¡Copiá esa clave!

> **Video Tutorial:**
> Para una guía paso a paso, podés mirar este video que lo explica clarito: [Cómo crear la API Key de YouTube (Tutorial)](https://www.youtube.com/watch?v=zVJKcbjE52w)

### Configuración en la App

Una vez que tenés la clave:
1.  Abrí la aplicación en tu navegador.
2.  Hacé clic en "⚙️ Configuración".
3.  Pegá tu Clave de API en el primer campo y dale a "Guardar".
4.  En el segundo campo, escribí las palabras clave que querés filtrar, separadas por comas (ej: `terror,miedo,payaso`).
5.  ¡Listo! Ya podés usar el buscador.

## 🛠️ Recursos Utilizados (¡Vanilla First!)

Creemos firmemente en las bases sólidas, por eso este proyecto usa:

* **HTML5 Semántico:** Para la estructura.
* **CSS3 Puro:** Para los estilos base (aunque ahora usamos DaisyUI).
* **JavaScript (ES6+):** ¡Puro Vanilla! Se usa `Fetch API` para las llamadas a la API y `LocalStorage` para guardar la configuración y el historial.
* **DaisyUI (sobre Tailwind CSS)**: Se utiliza vía CDN para tener componentes de UI listos (como los `cards`, `inputs` y el modo oscuro) sin necesidad de `npm`.
* **GitHub Pages**: Para el despliegue gratuito.
* 

// frontend/renderer.js

const API_URL = 'http://localhost:8000';

function showSection(section) {
    // Ocultar todas las secciones
    document.getElementById('registro-section').style.display = 'none';
    document.getElementById('inventario-section').style.display = 'none';

    // Quitar 'active' de todas las pestañas
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    // Mostrar la sección seleccionada
    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    } else {
        console.warn(`Sección #${section}-section no encontrada.`);
        return;
    }

    // Marcar la pestaña como activa
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        if (tab.textContent.trim().toLowerCase().includes(section === 'registro' ? 'registrar' : 'inventario')) {
            tab.classList.add('active');
        }
    });

    // Si es inventario, cargar datos
    if (section === 'inventario') {
        cargarInventario();
    }
}

let inventarioCompleto = [];

// Función para cargar el inventario
async function cargarInventario() {
    const loadingDiv = document.getElementById('inventario-cargando');
    const contenidoDiv = document.getElementById('inventario-contenido');
    const tbody = document.getElementById('inventario-body');
    const filtroProducto = document.getElementById('filtro-producto');

    if (!loadingDiv || !contenidoDiv || !tbody) return;

    loadingDiv.style.display = 'block';
    contenidoDiv.style.display = 'none';
    tbody.innerHTML = '';

    try {
        const response = await axios.get('http://localhost:8000/inventario');
        inventarioCompleto = response.data;

        // Llenar filtro de productos (sin duplicados)
        if (filtroProducto) {
            filtroProducto.innerHTML = '<option value="">Todos los productos</option>';
            const productosUnicos = [...new Set(inventarioCompleto.map(p => p.nombre_producto))];
            productosUnicos.forEach(producto => {
                const option = document.createElement('option');
                option.value = producto;
                option.textContent = producto;
                filtroProducto.appendChild(option);
            });
        }

        // Aplicar filtros iniciales (vacíos)
        aplicarFiltros();

        loadingDiv.style.display = 'none';
        contenidoDiv.style.display = 'block';

    } catch (error) {
        console.error("Error al cargar inventario:", error);
        loadingDiv.innerHTML = `
            <p style="color: #ef4444;">❌ Error al cargar el inventario. Verifica que el servidor esté activo.</p>
            <button onclick="cargarInventario()" style="margin-top: 16px; padding: 10px 20px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Reintentar
            </button>
        `;
        loadingDiv.style.display = 'block';
        contenidoDiv.style.display = 'none';
    }
}

// Función para aplicar filtros
function aplicarFiltros() {
    const filtroSerie = document.getElementById('filtro-serie')?.value.toLowerCase() || '';
    const filtroEstado = document.getElementById('filtro-estado')?.value || '';
    const filtroProducto = document.getElementById('filtro-producto')?.value || '';
    const tbody = document.getElementById('inventario-body');

    if (!tbody) return;

    tbody.innerHTML = '';

    const piezasFiltradas = inventarioCompleto.filter(pieza => {
        const coincideSerie = pieza.numero_serie.toLowerCase().includes(filtroSerie);
        const coincideEstado = filtroEstado === '' || pieza.estado === filtroEstado;
        const coincideProducto = filtroProducto === '' || pieza.nombre_producto === filtroProducto;
        return coincideSerie && coincideEstado && coincideProducto;
    });

    if (piezasFiltradas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px; color: #9ca3af;">
                    No se encontraron piezas con los filtros aplicados.
                </td>
            </tr>
        `;
    } else {
        piezasFiltradas.forEach(pieza => {
            const estadoClass = `estado-${pieza.estado}`;
            const fecha = new Date(pieza.fecha_registro).toLocaleString();

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pieza.id_pieza}</td>
                <td><strong>${pieza.codigo_barras}</strong></td>
                <td>${pieza.numero_serie}</td>
                <td>${pieza.nombre_producto}</td>
                <td><span class="${estadoClass}">${pieza.estado}</span></td>
                <td>${fecha}</td>
                <td>${pieza.usuario_nombre || 'N/A'}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

async function registrarPieza() {
    const codigoOriginal = document.getElementById('codigoOriginal').value;
    const numeroSerie = document.getElementById('numeroSerie').value;

    if (!codigoOriginal || !numeroSerie) {
        mostrarResultado("Por favor, ingresa ambos códigos", "error");
        return;
    }

    mostrarResultado("Registrando... por favor espera.", "loading", true);

    try {
        const response = await axios.post(`${API_URL}/registrar_pieza`, {
            codigo_original: codigoOriginal,
            numero_serie: numeroSerie,
            nombre_producto: document.getElementById('nombreProducto')?.value || null,
            descripcion_producto: document.getElementById('descripcionProducto')?.value || null,
            categoria_producto: document.getElementById('categoriaProducto')?.value || null,
            id_usuario: 1 // temporal
        });

        const data = response.data;
        mostrarResultado(`
            <h3>✅ Éxito</h3>
            <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
            <div class="barcode-container">
                <img src="${data.ruta_etiqueta}" alt="Código de barras">
            </div>
            <p>Guarda esta etiqueta e imprímela.</p>
        `, "success");

        // Limpiar campos
        document.getElementById('codigoOriginal').value = '';
        document.getElementById('numeroSerie').value = '';
        document.getElementById('camposProducto').style.display = 'none';

    } catch (error) {
        let mensaje = "Ocurrió un error inesperado.";
        let tipo = "error";

        if (error.response?.data?.detail === "Nombre del producto requerido para nuevo producto") {
            document.getElementById('camposProducto').style.display = 'block';
            mensaje = "⚠️ Este producto no existe. Completa los datos abajo y vuelve a intentar.";
        } else if (error.response?.data?.detail === "Número de serie ya registrado") {
            mensaje = "⚠️ ¡Error! Este número de serie ya está registrado.";
        } else {
            mensaje = `❌ Error: ${error.message}`;
        }

        mostrarResultado(mensaje, tipo);
    }
}

function mostrarResultado(mensaje, tipo, loading = false) {
    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.innerHTML = mensaje;
    resultadoDiv.className = `result ${tipo}`;
    resultadoDiv.style.display = 'block';

    if (loading) {
        window.scrollTo({
            top: resultadoDiv.offsetTop - 100,
            behavior: 'smooth'
        });
    }
}

// Detectar si el producto existe al salir del campo
document.getElementById('codigoOriginal').addEventListener('blur', async () => {
    const codigo = document.getElementById('codigoOriginal').value;
    if (!codigo) return;

    try {
        const response = await axios.get(`${API_URL}/health`);
        // Opcional: verificar si producto existe con un endpoint dedicado
    } catch (err) {
        alert("Backend no disponible. Asegúrate de que FastAPI esté corriendo.");
    }
});

// Soporte para escaneo con Enter
document.getElementById('codigoOriginal').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('numeroSerie').focus();
    }
});

document.getElementById('numeroSerie').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        registrarPieza();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        showSection('registro');
    }, 100);
    document.addEventListener('input', function(e) {
        if (e.target.id === 'filtro-serie') {
            aplicarFiltros();
        }
    });

    document.addEventListener('change', function(e) {
        if (e.target.id === 'filtro-estado' || e.target.id === 'filtro-producto') {
            aplicarFiltros();
        }
    });
});
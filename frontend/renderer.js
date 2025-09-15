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
        const response = await axios.get(`${API_URL}/inventario`);
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
            <p style="color: #ef4444;">Error al cargar el inventario. Verifica que el servidor esté activo.</p>
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
        // En la función aplicarFiltros(), dentro del forEach:
        piezasFiltradas.forEach(pieza => {
            const estadoClass = `estado-${pieza.estado}`;
            const fecha = new Date(pieza.fecha_registro).toLocaleString();

            // Obtener rol del usuario actual
            const usuario = JSON.parse(localStorage.getItem('usuario'));
            const tienePermisoSalida = usuario && (usuario.rol === 'admin' || usuario.rol === 'salida');

            const botonSalida = pieza.estado === 'almacenado' && tienePermisoSalida
                ? `<button onclick="registrarSalida(${pieza.id_pieza})" style="padding: 5px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Registrar Salida</button>`
                : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pieza.id_pieza}</td>
                <td><strong>${pieza.codigo_barras}</strong></td>
                <td>${pieza.numero_serie}</td>
                <td>${pieza.nombre_producto}</td>
                <td><span class="${estadoClass}">${pieza.estado}</span></td>
                <td>${fecha}</td>
                <td>${pieza.usuario_nombre || 'N/A'}</td>
                <td>${botonSalida}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

// Nueva función: Cargar y mostrar alertas de stock bajo
async function cargarAlertasStock() {
    try {
        const response = await axios.get(`${API_URL}/alertas/stock_bajo`);
        const alertas = response.data;
        const alertasDiv = document.getElementById('alertas-stock');
        const listaDiv = document.getElementById('lista-alertas');

        if (!alertasDiv || !listaDiv) return;

        if (alertas.length > 0) {
            alertasDiv.style.display = 'block';
            listaDiv.innerHTML = alertas.map(a => 
                `<p style="margin: 8px 0; padding: 8px; background: #fef3c7; border-left: 4px solid #d97706; border-radius: 4px;">
                    <strong>${a.nombre}:</strong> Stock actual: <strong>${a.stock_actual}</strong>, Mínimo requerido: <strong>${a.stock_minimo}</strong>
                </p>`
            ).join('');
        } else {
            alertasDiv.style.display = 'none';
        }
    } catch (error) {
        console.error("Error al cargar alertas de stock:", error);
        const alertasDiv = document.getElementById('alertas-stock');
        if (alertasDiv) {
            alertasDiv.style.display = 'none';
        }
    }
}

async function registrarPieza() {
    const codigoOriginal = document.getElementById('codigoOriginal').value;
    const numeroSerie = document.getElementById('numeroSerie').value;
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = 'login.html';
        return;
    }

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
            id_usuario: usuario.id_usuario
        });

        const data = response.data;

        // Generar contenido HTML para impresión
        const fechaActual = new Date().toLocaleDateString('es-ES');
        const contenidoEtiqueta = `
            <div style="width: 300px; padding: 15px; font-family: Arial, sans-serif; font-size: 12px; text-align: center;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #2563eb;">OTech</h2>
                <img src="${data.ruta_etiqueta}" style="width: 100%; max-width: 250px; margin: 10px 0;" alt="Código de barras">
                <div style="margin: 10px 0; padding: 8px; background: #f0f7ff; border-radius: 4px;">
                    <strong style="font-size: 14px;">${data.codigo_otech}</strong>
                </div>
                <p style="margin: 5px 0; font-size: 11px;"><strong>Número de Serie:</strong> ${numeroSerie}</p>
                <p style="margin: 5px 0; font-size: 11px;"><strong>Fecha:</strong> ${fechaActual}</p>
                <p style="margin: 5px 0; font-size: 11px;"><strong>Origen:</strong> ${codigoOriginal}</p>
            </div>
        `;

        //Mostrar resultado en pantalla
        mostrarResultado(`
            <h3>Éxito</h3>
            <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
            <div class="barcode-container">
                <img src="${data.ruta_etiqueta}" alt="Código de barras">
            </div>
            <p>Etiqueta generada e impresa automáticamente.</p>
            <button onclick="window.electronAPI.imprimirContenido(\`${contenidoEtiqueta.replace(/`/g, '\\`')}\`)" 
                    style="margin-top: 15px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                🖨️ Reimprimir Etiqueta
            </button>
        `, "success");

        // IMPRESIÓN AUTOMÁTICA (RF-02)
        if (window.electronAPI && window.electronAPI.imprimirContenido) {
            setTimeout(() => {
                window.electronAPI.imprimirContenido(contenidoEtiqueta);
            }, 500); // Pequeño delay para asegurar que la etiqueta esté lista
        }

        // Limpiar campos
        document.getElementById('codigoOriginal').value = '';
        document.getElementById('numeroSerie').value = '';
        document.getElementById('camposProducto').style.display = 'none';

        // Cargar alertas después de registrar pieza
        cargarAlertasStock();

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
    const codigoOriginal = document.getElementById('codigoOriginal').value;
    const numeroSerie = document.getElementById('numeroSerie').value;
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        window.location.href = 'login.html';
        return;
    }

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
            id_usuario: usuario.id_usuario
        });

        const data = response.data;
        mostrarResultado(`
            <h3>Éxito</h3>
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

        // ✅ Cargar alertas después de registrar pieza
        cargarAlertasStock();

    } catch (error) {
        let mensaje = "Ocurrió un error inesperado.";
        let tipo = "error";

        if (error.response?.data?.detail === "Nombre del producto requerido para nuevo producto") {
            document.getElementById('camposProducto').style.display = 'block';
            mensaje = "Este producto no existe. Completa los datos abajo y vuelve a intentar.";
        } else if (error.response?.data?.detail === "Número de serie ya registrado") {
            mensaje = "¡Error! Este número de serie ya está registrado.";
        } else {
            mensaje = `Error: ${error.message}`;
        }

        mostrarResultado(mensaje, tipo);
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
        // ✅ Cargar alertas al iniciar la aplicación
        cargarAlertasStock();
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

// Función para registrar salida de una pieza
async function registrarSalida(idPieza) {
    if (!confirm("¿Está seguro de registrar la salida de esta pieza?")) return;

    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        alert("Sesión expirada. Por favor, inicie sesión nuevamente.");
        window.location.href = 'login.html';
        return;
    }

    try {
        await axios.post(`${API_URL}/registrar_salida`, {
            id_pieza: idPieza,
            id_usuario: usuario.id_usuario,
            observaciones: prompt("Observaciones (opcional):", "")
        });

        alert("Salida registrada correctamente.");
        cargarInventario(); // Recargar tabla
    } catch (error) {
        alert("Error al registrar salida: " + error.message);
    }
}

function exportarInventario() {
    window.open('http://localhost:8000/exportar/inventario', '_blank');
}
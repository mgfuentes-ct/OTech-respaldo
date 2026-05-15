const API_URL = 'http://localhost:8000';

/* =========================================================
   OTech + MXD Inventario - renderer.js
   Archivo completo adaptado para inventario unificado:
   - Marcas OTech / MXD
   - Modelos, categorías, productos e inventario
   - Filtros, paginación, historial, exportación y modo oscuro
   ========================================================= */

/* =========================
   VARIABLES GLOBALES
========================= */
let inventarioCompleto = [];
let piezasFiltradasGlobal = [];
let paginaActual = 1;
const filasPorPagina = 10;

let timeoutInactividad;
let modoOperacion = null; // 'registro' | 'actualizar'
let productoActual = null;
let miGrafica = null;

/* =========================
   HELPERS
========================= */
function $(id) {
    return document.getElementById(id);
}

function existe(id) {
    return !!$(id);
}

function safeText(value, fallback = '—') {
    return value === null || value === undefined || value === '' ? fallback : value;
}

function normalizarTexto(value) {
    return (value ?? '').toString().trim().toLowerCase();
}

function obtenerUsuarioSesion() {
    try {
        return JSON.parse(localStorage.getItem('usuario'));
    } catch {
        return null;
    }
}

function usuarioEsAdmin() {
    const usuario = obtenerUsuarioSesion();
    return usuario && usuario.rol === 'Admin';
}

function setDisplay(id, display) {
    const el = $(id);
    if (el) el.style.display = display;
}

function ocultarElemento(id) {
    setDisplay(id, 'none');
}

function mostrarElemento(id, display = 'block') {
    setDisplay(id, display);
}

function setValue(id, value = '') {
    const el = $(id);
    if (el) el.value = value ?? '';
}

function getValue(id) {
    return $(id)?.value?.trim() || '';
}

function formatearFecha(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;

    return d.toLocaleString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatearFechaCorta(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;

    return d.toLocaleDateString('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function normalizarBooleano(value) {
    if (value === true || value === 1 || value === '1') return true;

    const texto = normalizarTexto(value);
    return texto === 'si' || texto === 'sí' || texto === 'true' || texto === 'vendido';
}

function valorSiNo(value) {
    if (normalizarBooleano(value)) {
        return '<span class="badge badge-si">Sí</span>';
    }

    if (
        value === false ||
        value === 0 ||
        value === '0' ||
        normalizarTexto(value) === 'no' ||
        normalizarTexto(value) === 'false'
    ) {
        return '<span class="badge badge-no">No</span>';
    }

    return '<span class="badge badge-vacio">—</span>';
}

function obtenerIdInventario(item) {
    return item.id_inventario || item.id_pieza || item.id || '';
}

function obtenerMarca(item) {
    return item.marca || item.nombre_marca || item.nombre_brand || item.brand || '—';
}

function obtenerCategoria(item) {
    return item.categoria || item.tipo_producto || item.nombre_tipo_producto || item.nombre_tipo || item.tipo || '—';
}

function obtenerModelo(item) {
    return item.modelo || item.nombre_modelo || item.nombre_dron || item.dron || '—';
}

function obtenerProducto(item) {
    return item.nombre_producto || item.producto || item.nombre || '—';
}

function obtenerEstado(item) {
    return item.estado || item.nombre_estado || '—';
}

function obtenerUbicacion(item) {
    return item.ubicacion || item.nombre_ubicacion || item.caja || item.anaquel || '—';
}

function obtenerFechaEntrada(item) {
    return item.fecha_entrada || item.fecha_registro || item.created_at || null;
}

function obtenerFechaSalida(item) {
    return item.fecha_salida || null;
}

function obtenerClaseEstado(estado) {
    const limpio = (estado || '').toString().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    return `estado-${limpio}`;
}

function mostrarErrorSweet(error, titulo = 'Error') {
    let mensaje = 'Ocurrió un error inesperado.';

    if (error?.response?.data?.detail) {
        if (Array.isArray(error.response.data.detail)) {
            mensaje = error.response.data.detail.map(d => d.msg || JSON.stringify(d)).join('<br>');
        } else {
            mensaje = error.response.data.detail;
        }
    } else if (error?.message) {
        mensaje = error.message;
    }

    Swal.fire({
        icon: 'error',
        title: titulo,
        html: mensaje,
        confirmButtonColor: '#ef4444'
    });
}

/* =========================
   SESIÓN
========================= */
function cerrarSesion(forzado = false) {
    if (forzado) {
        Swal.fire({
            title: 'Sesión expirada',
            html: 'Tu sesión se cerró por inactividad.',
            icon: 'info',
            allowOutsideClick: false,
            allowEscapeKey: false,
            timer: 1800,
            timerProgressBar: true,
            didOpen: () => Swal.showLoading()
        }).then(() => {
            localStorage.removeItem('usuario');
            window.location.href = 'login.html';
        });
        return;
    }

    Swal.fire({
        title: '¿Cerrar sesión?',
        text: 'Tu sesión se cerrará y tendrás que iniciar sesión nuevamente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, cerrar sesión',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#9ca3af',
        reverseButtons: true
    }).then((result) => {
        if (!result.isConfirmed) return;

        Swal.fire({
            title: 'Finalizando sesión',
            html: 'Estamos cerrando tu sesión de forma segura…',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        setTimeout(() => {
            localStorage.removeItem('usuario');
            window.location.href = 'login.html';
        }, 900);
    });
}

function forzarCierreSesion() {
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
}

function reiniciarTemporizadorInactividad() {
    if (timeoutInactividad) clearTimeout(timeoutInactividad);

    timeoutInactividad = setTimeout(() => {
        cerrarSesion(true);
    }, 600000);
}

function iniciarMonitoreoInactividad() {
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizadorInactividad, true);
    });
    reiniciarTemporizadorInactividad();
}

function mostrarNombreUsuario() {
    const usuario = obtenerUsuarioSesion();

    if (!usuario) {
        forzarCierreSesion();
        return;
    }

    const nombreSpan = $('usuario-nombre');
    if (nombreSpan) nombreSpan.textContent = `Hola, ${usuario.nombre_usuario}`;

    const btnAdmin = $('btn-admin');
    if (btnAdmin) btnAdmin.style.display = usuario.rol === 'Admin' ? 'block' : 'none';
}

/* =========================
   MODO OSCURO
========================= */
function aplicarTema(theme) {
    const tema = theme || localStorage.getItem('theme') || localStorage.getItem('modoOscuro') === '1' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', tema);
    document.body.classList.toggle('dark', tema === 'dark');

    localStorage.setItem('theme', tema);
    localStorage.setItem('modoOscuro', tema === 'dark' ? '1' : '0');

    const btn = $('toggle-theme') || document.querySelector('.toggle-theme');
    if (btn) btn.textContent = tema === 'dark' ? '☀️' : '🌙';

    if (inventarioCompleto.length > 0) {
        dibujarGraficaInventario();
    }
}

function toggleDarkMode() {
    const actual = document.documentElement.getAttribute('data-theme') || 'light';
    aplicarTema(actual === 'dark' ? 'light' : 'dark');
}

/* =========================
   NAVEGACIÓN
========================= */
function showSection(section) {
    ['registro-section', 'inventario-section', 'administracion-section'].forEach(ocultarElemento);

    const sectionElement = $(`${section}-section`);
    if (!sectionElement) {
        console.warn(`Sección #${section}-section no encontrada.`);
        return;
    }

    sectionElement.style.display = 'block';

    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(tab => {
        const texto = normalizarTexto(tab.textContent);

        if (
            (section === 'registro' && texto.includes('registrar')) ||
            (section === 'inventario' && texto.includes('inventario')) ||
            (section === 'administracion' && texto.includes('administración'))
        ) {
            tab.classList.add('active');
        }
    });

    if (section === 'inventario') cargarInventario();

    if (section === 'administracion') {
        cargarListaUsuarios();
        controlarExportacionHistorialAdmin();
    }

    reiniciarTemporizadorInactividad();
}

/* =========================
   RESULTADOS Y FLUJO
========================= */
function mostrarResultado(mensaje, tipo = 'loading', loading = false) {
    const resultadoDiv = $('resultado');
    if (!resultadoDiv) return;

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

function activarPaso(paso) {
    [1, 2, 3].forEach(n => {
        const el = $(`paso-${n}`);
        if (el) el.classList.toggle('activo', n === paso);
    });
}

function ocultarTodo() {
    [
        'datos-pieza-encontrada',
        'datos-nueva-pieza',
        'camposProducto',
        'opcionesNumeroParte',
        'selector-piezas',
        'acciones',
        'scan-serie'
    ].forEach(ocultarElemento);

    const btnActualizar = $('btnActualizarEstado');
    if (btnActualizar) btnActualizar.style.display = 'none';

    const btnRegistrar = $('btnRegistrarPieza');
    if (btnRegistrar) btnRegistrar.style.display = 'none';
}

function resetearFormulario() {
    ocultarTodo();
    ocultarElemento('resultado');

    [
        'codigoEscaneado',
        'serieEscaneada',
        'nombre-producto-encontrado',
        'numero-serie-encontrado',
        'estado-actual-encontrado',
        'caja-pieza-encontrada',
        'id-pieza-oculto',
        'observaciones-estado',
        'codigo-original-nueva',
        'numero-serie-nueva',
        'nombre-producto-nueva',
        'descripcion-producto-nueva',
        'caja-nueva',
        'nombreProducto',
        'descripcionProducto',
        'categoriaProducto'
    ].forEach(id => setValue(id, ''));

    if ($('nuevo-estado')) $('nuevo-estado').value = 'Disponible';

    activarPaso(1);
}

/* =========================
   ESCANEO / REGISTRO / ACTUALIZACIÓN
========================= */
async function buscarCodigo() {
    const codigo = getValue('codigoEscaneado');

    if (!codigo) {
        Swal.fire({
            icon: 'warning',
            title: 'Código requerido',
            text: 'Escanea o escribe un número de parte o número de serie.',
            confirmButtonColor: '#163f97'
        });
        return;
    }

    resetearFormulario();
    activarPaso(1);

    try {
        const res = await axios.post(`${API_URL}/buscar_codigo`, { codigo });
        const data = res.data;

        if (data.tipo === 'numero_serie') {
            modoOperacion = 'actualizar';
            cargarFormularioActualizar(data.pieza || data.inventario);
            activarPaso(3);
            return;
        }

        if (data.tipo === 'numero_parte') {
            productoActual = data.producto;
            mostrarElemento('acciones', 'grid');
            activarPaso(2);
            return;
        }

        Swal.fire({
            icon: 'warning',
            title: 'Código no encontrado',
            html: `
                <p>No existe ningún producto o pieza registrada con este código:</p>
                <p style="font-weight:700; margin-top:8px;">${codigo}</p>
                <p style="font-size:13px; color:#6b7280; margin-top:10px;">
                    Si es un producto nuevo, regístralo desde <strong>Administración → Nuevo producto</strong>.
                </p>
            `,
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#163f97'
        });

        setValue('codigoEscaneado', '');
        $('codigoEscaneado')?.focus();
        activarPaso(1);

    } catch (error) {
        console.error('Error al procesar el código:', error);
        mostrarErrorSweet(error, 'Error al procesar el código');
    }
}

function seleccionarAccion(tipo) {
    modoOperacion = tipo;

    ocultarElemento('acciones');
    activarPaso(3);

    if (tipo === 'registro') {
        mostrarElemento('datos-nueva-pieza');
        mostrarElemento('btnRegistrarPieza');

        if (productoActual) {
            setValue('codigo-original-nueva', productoActual.codigo_original || productoActual.numero_parte || '');
            setValue('nombre-producto-nueva', productoActual.nombre || productoActual.nombre_producto || '');
            setValue('descripcion-producto-nueva', productoActual.descripcion || '');
        }

        $('numero-serie-nueva')?.focus();
        return;
    }

    mostrarElemento('scan-serie');
    $('serieEscaneada')?.focus();
}

function cargarFormularioActualizar(pieza) {
    if (!pieza) {
        Swal.fire('Error', 'No se recibieron datos de la pieza.', 'error');
        return;
    }

    ocultarTodo();

    mostrarElemento('datos-pieza-encontrada');
    mostrarElemento('btnActualizarEstado');

    setValue('nombre-producto-encontrado', obtenerProducto(pieza));
    setValue('numero-serie-encontrado', pieza.numero_serie || '');
    setValue('estado-actual-encontrado', obtenerEstado(pieza));
    setValue('caja-pieza-encontrada', pieza.caja || pieza.anaquel || pieza.ubicacion || pieza.nombre_ubicacion || '');
    setValue('id-pieza-oculto', obtenerIdInventario(pieza));

    if ($('nuevo-estado') && pieza.id_estado) {
        $('nuevo-estado').value = pieza.id_estado;
    }
}

async function actualizarEstadoPieza() {
    const idPieza = getValue('id-pieza-oculto');
    const nuevoEstado = getValue('nuevo-estado');
    const caja = getValue('caja-pieza-encontrada') || null;
    const observaciones = getValue('observaciones-estado');
    const usuario = obtenerUsuarioSesion();

    if (!idPieza || !nuevoEstado || !usuario) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Faltan datos para actualizar el estado.',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    const payloadLegacy = {
        id_pieza: parseInt(idPieza, 10),
        nuevo_estado: nuevoEstado,
        id_usuario: usuario.id_usuario,
        caja,
        observaciones
    };

    const payloadNuevo = {
        id_inventario: parseInt(idPieza, 10),
        id_estado: Number.isNaN(parseInt(nuevoEstado, 10)) ? undefined : parseInt(nuevoEstado, 10),
        id_ubicacion: null,
        observaciones,
        id_usuario: usuario.id_usuario
    };

    try {
        let response;

        try {
            response = await axios.post(`${API_URL}/actualizar_estado_pieza`, payloadLegacy);
        } catch (legacyError) {
            if (legacyError.response?.status === 404) {
                response = await axios.post(`${API_URL}/actualizar_inventario`, payloadNuevo);
            } else {
                throw legacyError;
            }
        }

        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: response.data.mensaje || 'Inventario actualizado correctamente.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#6366f1'
        }).then(() => {
            resetearFormulario();
            $('codigoEscaneado')?.focus();
            cargarInventario();
        });

    } catch (error) {
        console.error('Error al actualizar estado:', error);
        mostrarErrorSweet(error, 'Error al actualizar');
    }
}

async function registrarPiezaNueva() {
    const codigoOriginal = getValue('codigo-original-nueva');
    const numeroSerie = getValue('numero-serie-nueva');
    const caja = getValue('caja-nueva');
    const usuario = obtenerUsuarioSesion();

    const nombreProducto = getValue('nombre-producto-nueva') || null;
    const descripcionProducto = getValue('descripcion-producto-nueva') || null;

    let idDron = null;
    const dronField = $('dron-nueva');
    if (dronField && dronField.value) idDron = parseInt(dronField.value, 10);

    if (!numeroSerie || !caja || !usuario) {
        mostrarResultado('Faltan datos obligatorios.', 'error');
        return;
    }

    if (!codigoOriginal) {
        mostrarResultado('Código original no encontrado.', 'error');
        return;
    }

    mostrarResultado('Registrando nueva pieza...', 'loading', true);

    try {
        const response = await axios.post(`${API_URL}/registrar_pieza`, {
            codigo_original: codigoOriginal,
            numero_serie: numeroSerie,
            nombre_producto: nombreProducto,
            descripcion_producto: descripcionProducto,
            id_dron: idDron,
            caja,
            id_usuario: usuario.id_usuario
        });

        const data = response.data;

        mostrarResultado(`
            <h3>Éxito</h3>
            <p><strong>Código:</strong> ${data.codigo_barras || data.codigo_otech || codigoOriginal}</p>
            <p>La pieza fue registrada correctamente.</p>
        `, 'success');

        if (window.electronAPI && window.electronAPI.imprimirTSPL) {
            setTimeout(() => {
                imprimirEtiquetaTSPL(data.codigo_barras || data.codigo_otech || codigoOriginal, data.nombre_producto || nombreProducto || 'PRODUCTO');
            }, 300);
        }

        resetearFormulario();
        $('codigoEscaneado')?.focus();
        cargarAlertasStock();

    } catch (error) {
        console.error('Error al registrar pieza:', error);
        let mensaje = 'Error al registrar la pieza.';

        if (error.response?.data?.detail === 'Número de serie ya registrado') {
            mensaje = '¡Error! Este número de serie ya está registrado.';
        } else if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }

        mostrarResultado(mensaje, 'error');
    }
}

function imprimirEtiquetaTSPL(codigo, nombreProducto = '') {
    const nombre = (nombreProducto || '').toUpperCase();
    const linea1 = nombre.substring(0, 30);
    const linea2 = nombre.length > 30 ? nombre.substring(30, 60) : '';

    const tspl = `
SIZE 50 mm,25 mm
GAP 3 mm,0
DIRECTION 1
REFERENCE 0,0
CLS

BARCODE 30,25,"128",70,0,0,2,2,"${codigo}"

TEXT 50,126,"1",0,1,1,"${linea1}"
${linea2 ? `TEXT 50,154,"1",0,1,1,"${linea2}"` : ''}

PRINT 1
`;

    if (window.electronAPI && window.electronAPI.imprimirTSPL) {
        window.electronAPI.imprimirTSPL(tspl);
    }
}

/* =========================
   INVENTARIO
========================= */
async function cargarInventario() {
    const loadingDiv = $('inventario-cargando');
    const contenidoDiv = $('inventario-contenido');
    const tbody = $('inventario-body');

    if (!loadingDiv || !contenidoDiv || !tbody) return;

    loadingDiv.style.display = 'block';
    contenidoDiv.style.display = 'none';
    tbody.innerHTML = '';

    try {
        const response = await axios.get(`${API_URL}/inventario`);
        inventarioCompleto = Array.isArray(response.data) ? response.data : [];

        console.log('Datos del inventario:', inventarioCompleto);

        cargarOpcionesFiltrosInventario();
        aplicarFiltros();
        dibujarGraficaInventario();

        loadingDiv.style.display = 'none';
        contenidoDiv.style.display = 'block';

    } catch (error) {
        console.error('Error al cargar inventario:', error);

        loadingDiv.innerHTML = `
            <p style="color:#ef4444;">Error al cargar el inventario. Verifica que el servidor esté activo.</p>
            <button onclick="cargarInventario()" style="margin-top:16px; padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:6px; cursor:pointer;">
                Reintentar
            </button>
        `;

        loadingDiv.style.display = 'block';
        contenidoDiv.style.display = 'none';
    }
}

function cargarOpcionesFiltrosInventario() {
    const filtros = [
        { id: 'filtro-producto', label: 'Todos los productos', extractor: obtenerProducto },
        { id: 'filtro-marca', label: 'Todas las marcas', extractor: obtenerMarca },
        { id: 'filtro-categoria', label: 'Todas las categorías', extractor: obtenerCategoria },
        { id: 'filtro-modelo', label: 'Todos los modelos', extractor: obtenerModelo }
    ];

    filtros.forEach(filtro => {
        const select = $(filtro.id);
        if (!select) return;

        const valorActual = select.value;
        select.innerHTML = `<option value="">${filtro.label}</option>`;

        const valores = [...new Set(
            inventarioCompleto
                .map(item => filtro.extractor(item))
                .filter(valor => valor && valor !== '—')
        )].sort((a, b) => a.localeCompare(b));

        valores.forEach(valor => {
            const option = document.createElement('option');
            option.value = valor;
            option.textContent = valor;
            select.appendChild(option);
        });

        if ([...select.options].some(opt => opt.value === valorActual)) {
            select.value = valorActual;
        }
    });
}

function aplicarFiltros() {
    const filtroSerie = normalizarTexto(getValue('filtro-serie'));
    const filtroEstado = getValue('filtro-estado');
    const filtroProducto = getValue('filtro-producto');
    const filtroMarca = getValue('filtro-marca');
    const filtroCategoria = getValue('filtro-categoria');
    const filtroModelo = getValue('filtro-modelo');
    const filtroVenta = getValue('filtro-venta');
    const filtroPrestamo = getValue('filtro-prestamo');
    const filtroParaVenta = getValue('filtro-para-venta');

    piezasFiltradasGlobal = inventarioCompleto.filter(pieza => {
        const serie = normalizarTexto(pieza.numero_serie);
        const estado = obtenerEstado(pieza);
        const producto = obtenerProducto(pieza);
        const marca = obtenerMarca(pieza);
        const categoria = obtenerCategoria(pieza);
        const modelo = obtenerModelo(pieza);

        return (
            (!filtroSerie || serie.includes(filtroSerie)) &&
            (!filtroEstado || estado === filtroEstado) &&
            (!filtroProducto || producto === filtroProducto) &&
            (!filtroMarca || marca === filtroMarca) &&
            (!filtroCategoria || categoria === filtroCategoria) &&
            (!filtroModelo || modelo === filtroModelo) &&
            (!filtroVenta || String(normalizarBooleano(pieza.vendido)) === String(filtroVenta === 'true' || filtroVenta === '1' || normalizarTexto(filtroVenta) === 'si')) &&
            (!filtroPrestamo || String(normalizarBooleano(pieza.prestamo)) === String(filtroPrestamo === 'true' || filtroPrestamo === '1' || normalizarTexto(filtroPrestamo) === 'si')) &&
            (!filtroParaVenta || String(normalizarBooleano(pieza.para_venta)) === String(filtroParaVenta === 'true' || filtroParaVenta === '1' || normalizarTexto(filtroParaVenta) === 'si'))
        );
    });

    paginaActual = 1;
    renderizarTabla();
    renderizarPaginacion();
    dibujarGraficaInventario(piezasFiltradasGlobal);
}

function renderizarTabla() {
    const tbody = $('inventario-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    const inicio = (paginaActual - 1) * filasPorPagina;
    const fin = inicio + filasPorPagina;
    const paginaDatos = piezasFiltradasGlobal.slice(inicio, fin);

    if (paginaDatos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay resultados con los filtros seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    paginaDatos.forEach(pieza => {
        const id = obtenerIdInventario(pieza);
        const estado = obtenerEstado(pieza);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${safeText(id)}</td>
            <td>${safeText(obtenerMarca(pieza))}</td>
            <td>${safeText(obtenerCategoria(pieza))}</td>
            <td>${safeText(obtenerModelo(pieza))}</td>
            <td>${safeText(obtenerProducto(pieza))}</td>
            <td>${safeText(pieza.numero_serie)}</td>
            <td><span class="${obtenerClaseEstado(estado)}">${safeText(estado)}</span></td>
            <td>${safeText(obtenerUbicacion(pieza))}</td>
            <td>${valorSiNo(pieza.vendido)}</td>
            <td>${valorSiNo(pieza.prestamo)}</td>
            <td>${safeText(pieza.destinatario)}</td>
            <td>${valorSiNo(pieza.para_venta)}</td>
            <td>${formatearFechaCorta(obtenerFechaEntrada(pieza))}</td>
            <td>${formatearFechaCorta(obtenerFechaSalida(pieza))}</td>
            <td>
                <button class="btn-historial" onclick="verHistorial(${id})" title="Ver historial">
                    Ver
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function renderizarPaginacion() {
    const totalPaginas = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina) || 1;
    const contenedor = $('paginas');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    const maxVisible = 5;
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, inicio + maxVisible - 1);

    if (fin - inicio < maxVisible - 1) {
        inicio = Math.max(1, fin - maxVisible + 1);
    }

    for (let i = inicio; i <= fin; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        span.className = `page-number ${i === paginaActual ? 'active' : ''}`;

        span.onclick = () => {
            paginaActual = i;
            renderizarTabla();
            renderizarPaginacion();
        };

        contenedor.appendChild(span);
    }

    const btnFirst = $('btn-first');
    const btnPrev = $('btn-prev');
    const btnNext = $('btn-next');
    const btnLast = $('btn-last');

    if (btnFirst) btnFirst.disabled = paginaActual === 1;
    if (btnPrev) btnPrev.disabled = paginaActual === 1;
    if (btnNext) btnNext.disabled = paginaActual === totalPaginas;
    if (btnLast) btnLast.disabled = paginaActual === totalPaginas;
}

/* =========================
   GRÁFICA
========================= */
function dibujarGraficaInventario(datos = inventarioCompleto) {
    const ctx = $('inventarioChartCanvas');
    if (!ctx) return;

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js no está cargado. Gráfica desactivada.');
        return;
    }

    const conteo = {};
    datos.forEach(pieza => {
        const estado = obtenerEstado(pieza);
        conteo[estado] = (conteo[estado] || 0) + 1;
    });

    const labels = Object.keys(conteo);
    const valores = Object.values(conteo);

    const stats = $('stats-numeros');
    if (stats) {
        stats.innerHTML = labels.length
            ? labels.map((estado, index) => `
                <div style="background:rgba(99,102,241,0.10); border:1px solid rgba(99,102,241,0.25); padding:10px; border-radius:8px;">
                    <div style="font-size:12px; color:var(--text-muted, #6b7280); font-weight:600;">${estado.toUpperCase()}</div>
                    <div style="font-size:20px; font-weight:700; color:#6366f1;">${valores[index]}</div>
                </div>
            `).join('')
            : '<p style="color:#9ca3af;">Sin datos para graficar.</p>';
    }

    if (miGrafica) miGrafica.destroy();

    miGrafica = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6',
                    '#14b8a6',
                    '#64748b'
                ],
                borderColor: 'transparent',
                borderWidth: 2,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.92)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    cornerRadius: 8
                }
            }
        }
    });
}

/* =========================
   HISTORIAL
========================= */
async function verHistorial(idInventario) {
    if (!idInventario) {
        Swal.fire('Error', 'No se encontró el ID del registro.', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'Cargando historial...',
            html: '<div class="loading-spinner"></div>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        let historial = [];

        try {
            const res = await axios.get(`${API_URL}/historial/inventario/${idInventario}`);
            historial = res.data || [];
        } catch (e1) {
            try {
                const res = await axios.get(`${API_URL}/historial/pieza/${idInventario}`);
                historial = res.data || [];
            } catch (e2) {
                const res = await axios.get(`${API_URL}/historial_pieza/${idInventario}`);
                historial = res.data || [];
            }
        }

        if (!historial.length) {
            Swal.fire('Sin historial', 'Este registro todavía no tiene movimientos.', 'info');
            return;
        }

        const timeline = historial.map(m => {
            const tipo = m.tipo_movimiento || m.tipo || 'Movimiento';
            const fecha = formatearFecha(m.fecha_movimiento || m.fecha || m.created_at);
            const usuario = m.nombre_usuario || m.usuario || 'Usuario eliminado';

            let color = '#64748b';
            if (normalizarTexto(tipo).includes('registro')) color = '#10b981';
            if (normalizarTexto(tipo).includes('estado')) color = '#6366f1';
            if (normalizarTexto(tipo).includes('salida')) color = '#ef4444';
            if (normalizarTexto(tipo).includes('ubicacion') || normalizarTexto(tipo).includes('caja')) color = '#f59e0b';

            const cambioEstado = (m.estado_anterior || m.estado_nuevo)
                ? `<div style="font-size:13px; color:#374151; margin-top:4px;">
                    ${safeText(m.estado_anterior)} → ${safeText(m.estado_nuevo)}
                   </div>`
                : '';

            return `
                <div style="border-left:4px solid ${color}; padding-left:14px; margin-bottom:18px;">
                    <div style="font-weight:700; color:${color};">
                        ${tipo.replaceAll('_', ' ').toUpperCase()}
                    </div>
                    ${cambioEstado}
                    <div style="font-size:12px; color:#6b7280; margin-top:4px;">
                        ${fecha} · ${usuario}
                    </div>
                    ${m.observaciones ? `<div style="margin-top:6px; font-size:13px; color:#111827;">${m.observaciones}</div>` : ''}
                </div>
            `;
        }).join('');

        Swal.fire({
            title: `Historial #${idInventario}`,
            html: `<div style="max-height:440px; overflow-y:auto; text-align:left; padding-right:8px;">${timeline}</div>`,
            width: 760,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#6366f1'
        });

    } catch (error) {
        console.error('Error al cargar historial:', error);
        mostrarErrorSweet(error, 'No se pudo cargar el historial');
    }
}

// Alias por si tu HTML antiguo llama esta función
function verHistorialPieza(idPieza) {
    return verHistorial(idPieza);
}

function cerrarModalHistorial() {
    const modal = $('modal-historial');
    if (modal) modal.style.display = 'none';
}

function controlarExportacionHistorialAdmin() {
    const contenedor = $('exportar-historial-admin') || $('historial-export-admin');
    if (contenedor) contenedor.style.display = usuarioEsAdmin() ? 'block' : 'none';
}

async function exportarHistorialPorFechas() {
    const usuario = obtenerUsuarioSesion();

    if (!usuario || usuario.rol !== 'Admin') {
        Swal.fire('Acceso denegado', 'Solo administradores pueden exportar el historial.', 'error');
        return;
    }

    const inicio = getValue('historial-fecha-inicio');
    const fin = getValue('historial-fecha-fin');

    if (!inicio || !fin) {
        Swal.fire('Error', 'Selecciona un rango de fechas.', 'error');
        return;
    }

    if (inicio > fin) {
        Swal.fire('Error', 'La fecha de inicio no puede ser mayor que la fecha final.', 'error');
        return;
    }

    try {
        Swal.fire({
            title: 'Exportando historial...',
            html: '<div class="loading-spinner"></div>',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => Swal.showLoading()
        });

        const url = `${API_URL}/exportar/historial?fecha_inicio=${inicio}&fecha_fin=${fin}&id_usuario=${usuario.id_usuario}`;
        const response = await fetch(url);

        if (!response.ok) {
            let mensaje = 'No se pudo exportar el historial.';
            try {
                const errorData = await response.json();
                mensaje = errorData.detail || mensaje;
            } catch { }
            throw new Error(mensaje);
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `historial_movimientos_${inicio}_${fin}.xlsx`;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        Swal.fire('Listo', 'El historial se exportó correctamente.', 'success');

    } catch (error) {
        console.error('Error al exportar historial:', error);
        Swal.fire('Error', error.message || 'No se pudo exportar el historial.', 'error');
    }
}

/* =========================
   EXPORTAR INVENTARIO
========================= */
async function exportarInventario() {
    const boton = $('btn-exportar');

    if (boton) {
        boton.disabled = true;
        boton.textContent = 'Exportando...';
    }

    try {
        const response = await fetch(`${API_URL}/exportar/inventario`);

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `inventario_otech_mxd_${new Date().toISOString().slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        Swal.fire({
            icon: 'success',
            title: '¡Listo!',
            text: 'El inventario se exportó correctamente.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
        });

    } catch (error) {
        console.error('Error al exportar inventario:', error);

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo exportar el inventario.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#ef4444'
        });

    } finally {
        if (boton) {
            boton.disabled = false;
            boton.textContent = 'Exportar a Excel';
        }
    }
}

/* =========================
   ALERTAS STOCK
========================= */
async function cargarAlertasStock() {
    try {
        const response = await axios.get(`${API_URL}/alertas/stock_bajo`);
        const alertas = response.data || [];

        const alertasDiv = $('alertas-stock');
        const listaDiv = $('lista-alertas');

        if (!alertasDiv || !listaDiv) return;

        if (!alertas.length) {
            alertasDiv.style.display = 'none';
            return;
        }

        alertasDiv.style.display = 'block';

        listaDiv.innerHTML = alertas.map(a => `
            <div class="alerta-stock-item">
                <span class="alerta-icon">⚠️</span>
                <div class="alerta-contenido">
                    <strong>${safeText(a.nombre || a.producto)}</strong>
                    <div class="alerta-detalles">
                        <span>Stock actual: ${safeText(a.stock_actual, 0)}</span>
                        <span>Mínimo: ${safeText(a.stock_minimo, 0)}</span>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error al cargar alertas de stock:', error);
        ocultarElemento('alertas-stock');
    }
}

/* =========================
   ADMIN / USUARIOS
========================= */
async function cargarListaUsuarios() {
    const loadingDiv = $('cargando-usuarios');
    const tablaDiv = $('tabla-usuarios');
    const tbody = $('tbody-usuarios');

    if (!loadingDiv || !tablaDiv || !tbody) return;

    loadingDiv.style.display = 'inline-block';
    tablaDiv.style.display = 'none';

    try {
        const response = await axios.get(`${API_URL}/admin/listar_usuarios`);
        const usuarios = response.data || [];

        tbody.innerHTML = '';

        if (!usuarios.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:20px; color:#96a6c3ff;">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;
        } else {
            usuarios.forEach(u => {
                const ultimoLogin = u.ultimo_login ? formatearFecha(u.ultimo_login) : 'Nunca';
                const activo = u.activo ? 'Sí' : 'No';
                const nombreMostrar = u.nombre_completo || u.nombre_usuario || 'Sin nombre';
                const nombreParaJS = nombreMostrar.replace(/'/g, "\\'");

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${u.id_usuario}</td>
                    <td>${safeText(u.nombre_completo)}</td>
                    <td>${safeText(u.nombre_usuario)}</td>
                    <td><span style="font-weight:600; color:${getRolColor(u.rol)};">${safeText(u.rol)}</span></td>
                    <td>${ultimoLogin}</td>
                    <td>${activo}</td>
                    <td>
                        <a href="editar-usuario.html?id=${u.id_usuario}" 
                           style="display:inline-block; padding:5px 10px; background:#3b82f6; color:white; text-decoration:none; border-radius:4px; margin-right:5px; width:100%; text-align:center; font-weight:650;">
                            Editar
                        </a>
                        <button onclick="eliminarUsuario(${u.id_usuario}, '${nombreParaJS}')"
                                style="padding:5px 10px; background:${u.activo ? '#ef4444' : '#10b981'}; color:white; border:none; border-radius:6px; cursor:pointer;">
                            ${u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        loadingDiv.style.display = 'none';
        tablaDiv.style.display = 'table';

    } catch (error) {
        console.error('Error al cargar lista de usuarios:', error);
        loadingDiv.style.display = 'none';
        tablaDiv.style.display = 'none';
        Swal.fire('Error', 'Error al cargar lista de usuarios.', 'error');
    }
}

function getRolColor(rol) {
    const colores = {
        Admin: '#ef4444',
        Operario: '#10275d'
    };

    return colores[rol] || '#10275d';
}

async function eliminarUsuario(idUsuario, nombreCompleto) {
    const result = await Swal.fire({
        title: '¿Confirmar cambio?',
        text: `Se cambiará el estado del usuario ${nombreCompleto}.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    try {
        const response = await axios.put(`${API_URL}/admin/eliminar_usuario/${idUsuario}`);
        Swal.fire('Listo', response.data.mensaje || 'Usuario actualizado.', 'success');
        cargarListaUsuarios();
    } catch (error) {
        mostrarErrorSweet(error, 'Error al actualizar usuario');
    }
}

async function registrarNuevoUsuario() {
    const nombreCompleto = getValue('admin-nombre');
    const nombreUsuario = getValue('admin-usuario');
    const email = getValue('admin-email');
    const password = getValue('admin-password');

    const resultadoDiv = $('resultado-admin');
    if (resultadoDiv) resultadoDiv.style.display = 'block';

    if (!nombreCompleto || !nombreUsuario || !email || !password) {
        if (resultadoDiv) {
            resultadoDiv.innerHTML = '<p style="color:#ef4444;">Por favor, completa todos los campos.</p>';
            resultadoDiv.className = 'result error';
        }
        return;
    }

    if (password.length < 6) {
        if (resultadoDiv) {
            resultadoDiv.innerHTML = '<p style="color:#ef4444;">La contraseña debe tener al menos 6 caracteres.</p>';
            resultadoDiv.className = 'result error';
        }
        return;
    }

    if (resultadoDiv) {
        resultadoDiv.innerHTML = '<p style="color:#6b7280;">Registrando usuario...</p>';
        resultadoDiv.className = 'result loading';
    }

    try {
        const response = await axios.post(`${API_URL}/admin/crear_usuario`, null, {
            params: {
                nombre_completo: nombreCompleto,
                nombre_usuario: nombreUsuario,
                email,
                password
            }
        });

        if (resultadoDiv) {
            resultadoDiv.innerHTML = `<p style="color:#10b981;">${response.data.mensaje}</p>`;
            resultadoDiv.className = 'result success';
        }

        ['admin-nombre', 'admin-usuario', 'admin-email', 'admin-password'].forEach(id => setValue(id, ''));

        cargarListaUsuarios();

    } catch (error) {
        if (resultadoDiv) {
            let mensaje = 'Error al registrar usuario.';
            if (error.response?.data?.detail) mensaje = error.response.data.detail;
            resultadoDiv.innerHTML = `<p style="color:#ef4444;">${mensaje}</p>`;
            resultadoDiv.className = 'result error';
        }
    }
}

/* =========================
   DRONES / CATÁLOGOS PARA FORMULARIOS ANTIGUOS
========================= */
async function cargarDronesCheckbox() {
    const contenedor = $('drones-checkbox');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    try {
        const res = await axios.get(`${API_URL}/admin/listar_drones`);
        const drones = res.data || [];

        drones.forEach(dron => {
            const label = document.createElement('label');
            label.className = 'checkbox-card';

            label.innerHTML = `
                <input type="checkbox" value="${dron.id}">
                <span>${dron.nombre}</span>
            `;

            const checkbox = label.querySelector('input');

            label.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    checkbox.checked = !checkbox.checked;
                }
                label.classList.toggle('checked', checkbox.checked);
            });

            contenedor.appendChild(label);
        });

    } catch (error) {
        console.error('Error al cargar drones:', error);
    }
}

async function registrarNuevoProducto() {
    const codigo = getValue('codigo-producto');
    const nombre = getValue('nombre-producto');
    const descripcion = getValue('descripcion-producto');
    const stockMinimo = getValue('stock-minimo');

    const dronesSeleccionados = Array.from(
        document.querySelectorAll('#drones-checkbox input:checked')
    ).map(cb => parseInt(cb.value, 10));

    const resultadoDiv = $('resultado-admin');
    if (resultadoDiv) resultadoDiv.style.display = 'block';

    if (!codigo || !nombre || !stockMinimo) {
        Swal.fire('Error', 'Completa los campos obligatorios.', 'error');
        return;
    }

    if (existe('drones-checkbox') && dronesSeleccionados.length === 0) {
        Swal.fire('Error', 'Selecciona al menos un dron/modelo compatible.', 'error');
        return;
    }

    try {
        let payloadNuevo = {
            codigo_original: codigo,
            nombre,
            descripcion,
            stock_minimo: parseInt(stockMinimo, 10),
            drones: dronesSeleccionados
        };

        const idMarca = getValue('producto-marca') || getValue('id-marca');
        const idTipo = getValue('producto-tipo') || getValue('id-tipo-producto');
        const idModelo = getValue('producto-modelo') || getValue('id-modelo');

        if (idMarca && idTipo) {
            payloadNuevo = {
                codigo_original: codigo,
                nombre,
                descripcion,
                stock_minimo: parseInt(stockMinimo, 10),
                id_marca: parseInt(idMarca, 10),
                id_tipo_producto: parseInt(idTipo, 10),
                id_modelo: idModelo ? parseInt(idModelo, 10) : null,
                modelos_compatibles: dronesSeleccionados
            };
        }

        const response = await axios.post(`${API_URL}/admin/crear_producto`, payloadNuevo);

        if (resultadoDiv) {
            resultadoDiv.innerHTML = `<p style="color:#10b981;">${response.data.mensaje}</p>`;
            resultadoDiv.className = 'result success';
        } else {
            Swal.fire('Éxito', response.data.mensaje || 'Producto creado correctamente.', 'success');
        }

        ['codigo-producto', 'nombre-producto', 'descripcion-producto', 'stock-minimo'].forEach(id => setValue(id, ''));

    } catch (error) {
        console.error('Error al registrar producto:', error);

        if (resultadoDiv) {
            let mensaje = 'Error al registrar el producto.';
            if (error.response?.data?.detail) mensaje = error.response.data.detail;
            resultadoDiv.innerHTML = `<p style="color:#ef4444;">${mensaje}</p>`;
            resultadoDiv.className = 'result error';
        } else {
            mostrarErrorSweet(error, 'Error al registrar producto');
        }
    }
}

/* =========================
   SALIDAS
========================= */
async function registrarSalida(idPieza) {
    const result = await Swal.fire({
        title: '¿Registrar salida?',
        text: 'Se marcará la pieza como salida.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, registrar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ef4444'
    });

    if (!result.isConfirmed) return;

    const usuario = obtenerUsuarioSesion();
    if (!usuario) {
        Swal.fire('Sesión expirada', 'Por favor inicia sesión nuevamente.', 'error');
        window.location.href = 'login.html';
        return;
    }

    const { value: observaciones } = await Swal.fire({
        title: 'Observaciones',
        input: 'text',
        inputPlaceholder: 'Opcional',
        showCancelButton: true,
        confirmButtonText: 'Continuar',
        cancelButtonText: 'Cancelar'
    });

    try {
        await axios.post(`${API_URL}/registrar_salida`, {
            id_pieza: idPieza,
            id_usuario: usuario.id_usuario,
            observaciones: observaciones || ''
        });

        Swal.fire('Listo', 'Salida registrada correctamente.', 'success');
        cargarInventario();

    } catch (error) {
        mostrarErrorSweet(error, 'Error al registrar salida');
    }
}

/* =========================
   NOTIFICACIÓN SIMPLE
========================= */
function mostrarNotificacion(mensaje, tipo) {
    const notif = document.createElement('div');
    notif.textContent = mensaje;
    notif.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${tipo === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 6px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;

    document.body.appendChild(notif);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

/* =========================
   LISTENERS
========================= */
document.addEventListener('DOMContentLoaded', function () {
    const temaGuardado = localStorage.getItem('theme') || (localStorage.getItem('modoOscuro') === '1' ? 'dark' : 'light');
    aplicarTema(temaGuardado);

    mostrarNombreUsuario();
    iniciarMonitoreoInactividad();

    if ($('registro-section')) {
        showSection('registro');
    }

    cargarAlertasStock();
    cargarDronesCheckbox();

    const btnTheme = $('toggle-theme') || document.querySelector('.toggle-theme');
    if (btnTheme) {
        btnTheme.addEventListener('click', toggleDarkMode);
    }

    document.addEventListener('input', function (e) {
        const ids = [
            'filtro-serie',
            'filtro-producto',
            'filtro-marca',
            'filtro-categoria',
            'filtro-modelo',
            'filtro-estado',
            'filtro-venta',
            'filtro-prestamo',
            'filtro-para-venta'
        ];

        if (ids.includes(e.target.id)) aplicarFiltros();
    });

    document.addEventListener('change', function (e) {
        const ids = [
            'filtro-producto',
            'filtro-marca',
            'filtro-categoria',
            'filtro-modelo',
            'filtro-estado',
            'filtro-venta',
            'filtro-prestamo',
            'filtro-para-venta'
        ];

        if (ids.includes(e.target.id)) aplicarFiltros();
    });

    $('codigoEscaneado')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') buscarCodigo();
    });

    $('serieEscaneada')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            setValue('codigoEscaneado', this.value);
            this.value = '';
            buscarCodigo();
        }
    });

    $('codigoOriginal')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') $('numeroSerie')?.focus();
    });

    $('numeroSerie')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && typeof registrarPieza === 'function') registrarPieza();
    });

    $('btn-first')?.addEventListener('click', () => {
        paginaActual = 1;
        renderizarTabla();
        renderizarPaginacion();
    });

    $('btn-prev')?.addEventListener('click', () => {
        if (paginaActual > 1) paginaActual--;
        renderizarTabla();
        renderizarPaginacion();
    });

    $('btn-next')?.addEventListener('click', () => {
        const totalPaginas = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina) || 1;
        if (paginaActual < totalPaginas) paginaActual++;
        renderizarTabla();
        renderizarPaginacion();
    });

    $('btn-last')?.addEventListener('click', () => {
        paginaActual = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina) || 1;
        renderizarTabla();
        renderizarPaginacion();
    });
});

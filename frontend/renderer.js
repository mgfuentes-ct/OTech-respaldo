const API_URL = 'http://localhost:8000';

// Variables globales
let inventarioCompleto = [];
let timeoutInactividad;
let modoOperacion = null; // 'registro' | 'actualizar'
let productoActual = null;
let paginaActual = 1;
const filasPorPagina = 10;
let piezasFiltradasGlobal = [];



// Función para cerrar sesión
function cerrarSesion() {
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
        if (result.isConfirmed) {

            // Mostrar spinner de cerrando sesión
            Swal.fire({
                title: 'Finalizando sesión',
                html: 'Estamos cerrando tu sesión de forma segura…',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // ⏳ Simulación corta para UX (opcional pero recomendado)
            setTimeout(() => {
                localStorage.removeItem('usuario');
                window.location.href = 'login.html';
            }, 1200);
        }
    });
}



// Función para reiniciar el temporizador de inactividad
function reiniciarTemporizadorInactividad() {
    if (timeoutInactividad) {
        clearTimeout(timeoutInactividad);
    }
    timeoutInactividad = setTimeout(() => {
        //alert("Sesión cerrada por inactividad.");  //se quito ya que inactiva los imput una vez que se cierra sesion por inactividad
        cerrarSesion();
    }, 600000); // 10 minutos
}

// Detectar actividad del usuario
function iniciarMonitoreoInactividad() {
    const eventos = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventos.forEach(evento => {
        document.addEventListener(evento, reiniciarTemporizadorInactividad, true);
    });
    reiniciarTemporizadorInactividad();
}

// Mostrar nombre del usuario en la navbar
function mostrarNombreUsuario() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    if (!usuario) {
        cerrarSesion();
        return;
    }
    document.getElementById('usuario-nombre').textContent = `Hola, ${usuario.nombre_usuario}`;

    const btnAdmin = document.getElementById('btn-admin');
    if (usuario.rol === 'Admin') {
        btnAdmin.style.display = 'block';
    } else {
        btnAdmin.style.display = 'none';
    }
}

// Función para cambiar de sección
function showSection(section) {
    document.getElementById('registro-section').style.display = 'none';
    document.getElementById('inventario-section').style.display = 'none';
    document.getElementById('administracion-section').style.display = 'none';

    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));

    const sectionElement = document.getElementById(`${section}-section`);
    if (sectionElement) {
        sectionElement.style.display = 'block';
    } else {
        console.warn(`Sección #${section}-section no encontrada.`);
        return;
    }

    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
            if (tab.textContent.trim().toLowerCase().includes(section === 'registro' ? 'registrar' : section === 'inventario' ? 'inventario' : 'administración')) {
            tab.classList.add('active');
        }
    });

    if (section === 'inventario') {
        cargarInventario();
    } else if (section === 'administracion') {
        cargarListaUsuarios();
    }

    reiniciarTemporizadorInactividad();
}

// Función para mostrar resultados
function mostrarResultado(mensaje, tipo, loading = false) {
    const resultadoDiv = document.getElementById('resultado');
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

// -- Logica de escaneo y acciones -- 

async function buscarCodigo() {
    const codigo = document.getElementById('codigoEscaneado').value.trim();
    if (!codigo) return;

    resetearFormulario();
    activarPaso(1);

    try {
        const res = await axios.post(`${API_URL}/buscar_codigo`, { codigo });
        const data = res.data;

        // 1️ SI ES NÚMERO DE SERIE → ACTUALIZAR SIEMPRE
        if (data.tipo === "numero_serie") {
            modoOperacion = "actualizar"; // 🔥 CLAVE
            cargarFormularioActualizar(data.pieza);
            activarPaso(3);
            return;
        }

        // 2️ SI ES NÚMERO DE PARTE → MOSTRAR OPCIONES
        if (data.tipo === "numero_parte") {
            productoActual = data.producto;
            document.getElementById("acciones").style.display = "grid";
            activarPaso(2);
            return;
        }

        // 3️ NO EXISTE NI NÚMERO DE SERIE NI NÚMERO DE PARTE
        if (data.tipo === "nuevo_producto") {
            Swal.fire({
                icon: 'warning',
                title: 'Código no encontrado',
                html: `
                    <p>No existe ningún producto registrado con este:</p>
                    <ul style="text-align:left; margin-top:10px;">
                        <li><strong>Número de parte</strong></li>
                        <li><strong>Número de serie</strong></li>
                    </ul>
                    <p style="margin-top:12px;">
                        Si este es un producto nuevo, debes registrarlo desde el
                        <strong>panel de administración</strong>.
                    </p>
                `,
                confirmButtonText: 'Entendido',
                confirmButtonColor: '#163f97'
            });

            // Reiniciar flujo visual
            activarPaso(1);
            return;
        }


    } catch (error) {
        mostrarResultado("Error al procesar el código", "error");
    }
}





function seleccionarAccion(tipo) {
    modoOperacion = tipo;

    document.getElementById("acciones").style.display = "none";
    activarPaso(3);

    if (tipo === "registro") {
        document.getElementById("datos-nueva-pieza").style.display = "block";

        //ESTO FALTABA
        document.getElementById("btnRegistrarPieza").style.display = "block";

        document.getElementById("codigo-original-nueva").value = productoActual.codigo_original;
        document.getElementById("nombre-producto-nueva").value = productoActual.nombre;
        document.getElementById("descripcion-producto-nueva").value = productoActual.descripcion || "";

        // UX
        document.getElementById("numero-serie-nueva").focus();
    } 
    else {
        document.getElementById("scan-serie").style.display = "block";
        document.getElementById("serieEscaneada").focus();
    }
}


function activarPaso(paso) {
    [1,2,3].forEach(n => {
        document.getElementById(`paso-${n}`).classList.toggle("activo", n === paso);
    });
}



async function actualizarEstadoPieza() {
    const idPieza = document.getElementById('id-pieza-oculto').value;
    const nuevoEstado = document.getElementById('nuevo-estado').value;
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const observaciones = document.getElementById('observaciones-estado').value.trim();
    const caja = document.getElementById('caja-pieza-encontrada')?.value.trim() || null;


    if (!idPieza || !nuevoEstado || !usuario) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Faltan datos para actualizar el estado',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    try {
        const nuevaCaja = document.getElementById('caja-pieza-encontrada').value.trim();

        const response = await axios.post(`${API_URL}/actualizar_estado_pieza`, {
            id_pieza: idPieza,
            nuevo_estado: nuevoEstado,
            id_usuario: usuario.id_usuario,
            caja: caja,
            observaciones: observaciones
        });


        
        Swal.fire({
            icon: 'success',
            title: '¡Éxito!',
            text: response.data.mensaje,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#6366f1'
        }).then(() => {
            resetearFormulario();
            document.getElementById('codigoEscaneado').focus();
        });

    } catch (error) {
        console.error("Error al actualizar estado:", error);

        let mensaje = 'Error al actualizar el estado';
        if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje,
            confirmButtonColor: '#ef4444'
        });
    }
}



async function registrarPiezaNueva() {
    const codigoOriginal = document.getElementById('codigo-original-nueva').value.trim();
    const numeroSerie = document.getElementById('numero-serie-nueva').value.trim();
    const caja = document.getElementById('caja-nueva').value.trim();
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    const nombreProducto = document.getElementById('nombre-producto-nueva')?.value.trim() || null;
    const descripcionProducto = document.getElementById('descripcion-producto-nueva')?.value.trim() || null;

    // Manejo de id_dron: si existe en el DOM, conviértelo a número; si no, null
    let idDron = null;
    const dronField = document.getElementById('dron-nueva');
    if (dronField && dronField.value) {
        idDron = parseInt(dronField.value, 10);
    }

    if (!numeroSerie || !caja || !usuario) {
        mostrarResultado("Faltan datos obligatorios.", "error");
        return;
    }
    if (!codigoOriginal) {
        mostrarResultado("Código original no encontrado.", "error");
        return;
    }

    mostrarResultado("Registrando nueva pieza...", "loading", true);
    try {
        // Aquí se envía EXACTAMENTE lo que espera RegistroPiezaRequest
        const response = await axios.post(`${API_URL}/registrar_pieza`, {
            codigo_original: codigoOriginal,
            numero_serie: numeroSerie,
            nombre_producto: nombreProducto,
            descripcion_producto: descripcionProducto,
            id_dron: idDron, // null o número
            caja: caja,
            id_usuario: usuario.id_usuario
        });

        const data = response.data;
        const fechaActual = new Date().toLocaleDateString('es-ES');
        const imgSrc = `${API_URL}${data.ruta_etiqueta}`;
        const contenidoEtiqueta = `
            <div style="width: 180px; padding: 4px; font-family: Arial, sans-serif; font-size: 11px; text-align: center; line-height: 1.2;">
                <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; letter-spacing: 0.5px;">
                    ${data.codigo_otech}
                </div>
                <img src="${imgSrc}" style="width: 100%; height: auto; max-height: 18px; image-rendering: pixelated;" alt="Código de barras">
            </div>
        `;

        mostrarResultado(`
            <h3>Éxito</h3>
            <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
            <div class="barcode-container">
                <img src="${data.ruta_etiqueta}" alt="Código de barras">
            </div>
            <p>Etiqueta generada e impresa automáticamente.</p>
            <button onclick="window.electronAPI.imprimirContenido(\`${contenidoEtiqueta.replace(/`/g, '\\\\`')}\`)" 
                    style="margin-top: 15px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Reimprimir Etiqueta
            </button>
        `, "success");

        if (window.electronAPI && window.electronAPI.imprimirContenido) {
            setTimeout(() => {
                window.electronAPI.imprimirContenido(contenidoEtiqueta);
            }, 500);
        }

        resetearFormulario();
        document.getElementById('codigoEscaneado').focus();
        cargarAlertasStock();

    } catch (error) {
        console.error("Error al registrar pieza:", error);
        let mensaje = "Error al registrar la pieza.";
        if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }
        mostrarResultado(mensaje, "error");
    }
}



function resetearFormulario() {
    // Ocultar todas las secciones dinámicas
    document.getElementById('datos-pieza-encontrada').style.display = 'none';
    document.getElementById('datos-nueva-pieza').style.display = 'none';
    document.getElementById('camposProducto').style.display = 'none';
    document.getElementById('btnActualizarEstado').style.display = 'none';
    document.getElementById('btnRegistrarPieza').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';

    // Limpiar campos de búsqueda y de resultados
    document.getElementById('codigoEscaneado').value = '';
    document.getElementById('nombre-producto-encontrado').value = '';
    document.getElementById('numero-serie-encontrado').value = '';
    document.getElementById('estado-actual-encontrado').value = '';
    document.getElementById('caja-pieza-encontrada').value = '';
    document.getElementById('id-pieza-oculto').value = '';
    document.getElementById('nuevo-estado').value = 'disponible';
    document.getElementById('observaciones-estado').value = '';

    // Limpiar campos de nueva pieza
    document.getElementById('codigo-original-nueva').value = '';
    document.getElementById('numero-serie-nueva').value = '';
    document.getElementById('nombre-producto-nueva').value = '';
    document.getElementById('descripcion-producto-nueva').value = '';
    document.getElementById('caja-nueva').value = '';


    // Limpiar campos de nuevo producto
    document.getElementById('nombreProducto').value = '';
    document.getElementById('descripcionProducto').value = '';
    document.getElementById('categoriaProducto').value = '';

    document.getElementById("acciones").style.display = "none";
    document.getElementById("scan-serie").style.display = "none";
    activarPaso(1);


    const btnActualizar = document.getElementById("btnActualizarEstado");
    if (btnActualizar) btnActualizar.style.display = "none";


}



// Función para cargar lista de usuarios (solo admin)
async function cargarListaUsuarios() {
    const loadingDiv = document.getElementById('cargando-usuarios');
    const tablaDiv = document.getElementById('tabla-usuarios');
    const tbody = document.getElementById('tbody-usuarios');

    loadingDiv.style.display = 'inline-block';
    tablaDiv.style.display = 'none';

    try {
        const response = await axios.get(`${API_URL}/admin/listar_usuarios`);
        const usuarios = response.data;

        tbody.innerHTML = '';

        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 20px; color: #96a6c3ff;">
                        No hay usuarios registrados.
                    </td>
                </tr>
            `;
        } else {
            usuarios.forEach(u => {
                const ultimoLogin = u.ultimo_login ? new Date(u.ultimo_login).toLocaleString() : 'Nunca';
                const activo = u.activo ? 'Sí' : 'No';
                const estadoClass = u.activo ? 'success' : 'danger';

                // Manejo seguro de nombre_completo
                const nombreMostrar = u.nombre_completo || u.nombre_usuario || 'Sin nombre';
                const nombreParaJS = nombreMostrar.replace(/'/g, "\\'");

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${u.id_usuario}</td>
                    <td>${u.nombre_completo || '—'}</td>
                    <td>${u.nombre_usuario}</td>
                    <td><span style="font-weight: 600; color: ${getRolColor(u.rol)};">${u.rol}</span></td>
                    <td>${ultimoLogin}</td>
                    <td><span class="${estadoClass}">${activo}</span></td>
                    <td>
                        <a href="editar-usuario.html?id=${u.id_usuario}" 
                        style="display: inline-block; padding: 5px 10px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px; margin-right: 5px;  width: 100%; text-align: center; font-weight: 650;">
                            Editar
                        </a>
                        <button onclick="eliminarUsuario(${u.id_usuario}, '${nombreParaJS}')"
                                style="padding: 5px 10px; background: ${u.activo ? '#ef4444' : '#10b981'}; color: white; border: none; border-radius: 6px; cursor: pointer;">
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
        console.error("Error al cargar lista de usuarios:", error);
        loadingDiv.style.display = 'none';
        tablaDiv.style.display = 'none';
        alert("Error al cargar lista de usuarios. Verifica la consola.");
    }
}


// Función para crear un nuevo producto (solo admin)
async function registrarNuevoProducto() {
    const codigo = document.getElementById('codigo-producto').value.trim();
    const nombre = document.getElementById('nombre-producto').value.trim();
    const descripcion = document.getElementById('descripcion-producto').value.trim();
    const categoria = document.getElementById('categoria-producto').value.trim();
    const stockMinimo = document.getElementById('stock-minimo').value.trim();


    const dronesSeleccionados = Array.from(
        document.querySelectorAll('#drones-checkbox input:checked')
    ).map(cb => parseInt(cb.value));

    if (dronesSeleccionados.length === 0) {
        Swal.fire('Error', 'Selecciona al menos un dron.', 'error');
        return;
    }



    const resultadoDiv = document.getElementById('resultado-admin');
    resultadoDiv.style.display = 'block';

    // Validaciones
    

    resultadoDiv.innerHTML = '<p style="color: #6b7280;"> Registrando Producto...</p>';
    resultadoDiv.className = 'result loading';

    try {
        const response = await axios.post(`${API_URL}/admin/crear_producto`, null, {
            params: {
                codigo_original: codigo,
                nombre: nombre,
                descripcion: descripcion,
                stock_minimo: stockMinimo,
                drones: dronesSeleccionados
            }
        });


        resultadoDiv.innerHTML = `<p style="color: #10b981;">${response.data.mensaje}</p>`;
        resultadoDiv.className = 'result success';

        // Limpiar campos
        document.getElementById('codigo-producto').value = '';
        document.getElementById('nombre-producto').value = '';
        document.getElementById('descripcion-producto').value = '';
        document.getElementById('categoria-producto').value = '';
        document.getElementById('stock-minimo').value = '';

        // Recargar lista
        cargarListaUsuarios();

    } catch (error) {
        let mensaje = "Error al registrar el producto.";
        if (error.response?.data?.detail) {
            mensaje = `${error.response.data.detail}`;
        }
        resultadoDiv.innerHTML = `<p style="color: #ef4444;">${mensaje}</p>`;
        resultadoDiv.className = 'result error';
    }
}


// Función auxiliar para colores de roles
function getRolColor(rol) {
    const colores = {
        'Admin': '#ef4444'
    };
    return colores[rol] || '#10275d';
}



// Función para registrar nuevo usuario (solo admin)
async function registrarNuevoUsuario() {
    const nombreCompleto = document.getElementById('admin-nombre').value.trim();
    const nombreUsuario = document.getElementById('admin-usuario').value.trim();
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    const resultadoDiv = document.getElementById('resultado-admin');
    resultadoDiv.style.display = 'block';

    // Validaciones
    if (!nombreCompleto || !nombreUsuario || !email || !password) {
        resultadoDiv.innerHTML = '<p style="color: #ef4444;">Por favor, completa todos los campos.</p>';
        resultadoDiv.className = 'result error';
        return;
    }

    if (password.length < 6) {
        resultadoDiv.innerHTML = '<p style="color: #ef4444;">La contraseña debe tener al menos 6 caracteres.</p>';
        resultadoDiv.className = 'result error';
        return;
    }

    resultadoDiv.innerHTML = '<p style="color: #6b7280;"> Registrando usuario...</p>';
    resultadoDiv.className = 'result loading';

    try {
        const response = await axios.post(`${API_URL}/admin/crear_usuario`, null, {
            params: {
                nombre_completo: nombreCompleto,
                nombre_usuario: nombreUsuario,
                email: email,
                password: password
            }
        });


        resultadoDiv.innerHTML = `<p style="color: #10b981;">${response.data.mensaje}</p>`;
        resultadoDiv.className = 'result success';

        // Limpiar campos
        document.getElementById('admin-nombre').value = '';
        document.getElementById('admin-usuario').value = '';
        document.getElementById('admin-email').value = '';
        document.getElementById('admin-password').value = '';

        // Recargar lista
        cargarListaUsuarios();

    } catch (error) {
        let mensaje = "Error al registrar usuario.";
        if (error.response?.data?.detail) {
            mensaje = `${error.response.data.detail}`;
        }
        resultadoDiv.innerHTML = `<p style="color: #ef4444;">${mensaje}</p>`;
        resultadoDiv.className = 'result error';
    }
}


// Función mejorada para editar usuario
async function editarUsuario(idUsuario) {
    try {
        // Obtener datos actuales del usuario
        const response = await axios.get(`${API_URL}/admin/obtener_usuario/${idUsuario}`);
        const usuarioActual = response.data;

        // Verificar si el usuario está intentando editarse a sí mismo
        const usuarioSesion = JSON.parse(localStorage.getItem('usuario'));
        const esMismoUsuario = usuarioSesion && usuarioSesion.id_usuario === idUsuario;

        // Crear el contenido del modal
        const { value: formValues } = await Swal.fire({
            title: 'Editar Usuario',
            html: `
                <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 18px;">Nombre completo</label>
                        <input id="swal-nombre-completo" class="swal2-input" value="${usuarioActual.nombre_completo || ''}" placeholder="Nombre completo" style="width: 90%; height: 40px">
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 18px;">Nombre de usuario</label>
                        <input id="swal-usuario" class="swal2-input" value="${usuarioActual.nombre_usuario || ''}" placeholder="Nombre de usuario" style="width: 90%; height: 40px">
                        <div id="swal-usuario-feedback" style="font-size: 12px; margin-top: 4px; min-height: 20px;"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 18px;">Correo electrónico</label>
                        <input id="swal-email" class="swal2-input" type="email" value="${usuarioActual.email || ''}" placeholder="correo@ejemplo.com" style="width: 90%; height: 40px">
                        <div id="swal-email-feedback" style="font-size: 12px; margin-top: 4px; min-height: 20px;"></div>
                    </div>
                    <div class="form-group" style="margin-bottom: 16px;">
                        <label style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 18px;">Rol</label>
                        <select id="swal-rol" class="swal2-select" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; height: 44px; width: 90%;">
                            <option value="Operario" ${usuarioActual.rol === 'Operario' ? 'selected' : ''}>Operario</option>
                            <option value="Admin" ${usuarioActual.rol === 'Admin' ? 'selected' : ''}>Administrador</option>
                        </select>
                        ${esMismoUsuario ? '<p style="font-size: 10px; color: #f59e0b; margin-top: 8px;">⚠️ No puedes cambiar tu propio rol.</p>' : ''}
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Guardar Cambios',
            cancelButtonText: 'Cancelar',
            preConfirm: () => {
                const nombreCompleto = document.getElementById('swal-nombre-completo').value.trim();
                const nombreUsuario = document.getElementById('swal-usuario').value.trim();
                const email = document.getElementById('swal-email').value.trim();
                const rol = document.getElementById('swal-rol').value;

                // Validaciones
                if (!nombreCompleto) {
                    Swal.showValidationMessage('El nombre completo es obligatorio');
                    return;
                }
                if (!nombreUsuario) {
                    Swal.showValidationMessage('El nombre de usuario es obligatorio');
                    return;
                }
                if (!email) {
                    Swal.showValidationMessage('El correo electrónico es obligatorio');
                    return;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    Swal.showValidationMessage('Formato de correo inválido');
                    return;
                }

                // Si es el mismo usuario, no permitir cambiar el rol
                if (esMismoUsuario && rol !== usuarioActual.rol) {
                    Swal.showValidationMessage('No puedes cambiar tu propio rol');
                    return;
                }

                return { nombreCompleto, nombreUsuario, email, rol };
            }
        });

        if (formValues) {
            // Verificar unicidad de nombre de usuario y email (solo si cambiaron)
            const cambios = {};
            if (formValues.nombreCompleto !== usuarioActual.nombre_completo) 
                cambios.nombre_completo = formValues.nombreCompleto;
            if (formValues.nombreUsuario !== usuarioActual.nombre_usuario) 
                cambios.nombre_usuario = formValues.nombreUsuario;
            if (formValues.email !== usuarioActual.email) 
                cambios.email = formValues.email;
            if (formValues.rol !== usuarioActual.rol) 
                cambios.rol = formValues.rol;

            if (Object.keys(cambios).length === 0) {
                Swal.fire('Sin cambios', 'No se realizaron modificaciones.', 'info');
                return;
            }

            // Enviar actualización
            await axios.put(`${API_URL}/admin/editar_usuario/${idUsuario}`, null, {
                params: cambios
            });

            Swal.fire('¡Éxito!', 'Usuario actualizado correctamente.', 'success');
            cargarListaUsuarios(); // Recargar la tabla
        }
    } catch (error) {
        console.error("Error al editar usuario:", error);
        Swal.fire('Error', error.response?.data?.detail || 'No se pudo editar el usuario.', 'error');
    }
}



// Función para eliminar lógicamente usuario
async function eliminarUsuario(idUsuario, nombreCompleto) {
    if (!confirm(`¿Está seguro de ${nombreCompleto} (ID: ${idUsuario})?`)) {
        return;
    }

    try {
        const response = await axios.put(`${API_URL}/admin/eliminar_usuario/${idUsuario}`);
        alert(response.data.mensaje);
        cargarListaUsuarios(); // Recargar la tabla
    } catch (error) {
        let mensaje = "Error al eliminar usuario.";
        if (error.response?.data?.detail) {
            mensaje = `${error.response.data.detail}`;
        }
        alert(mensaje);
    }
}


// Función para imprimir etiqueta TSPL
function imprimirEtiquetaTSPL(codigo, nombreProducto) {
  const nombre = nombreProducto.toUpperCase();

  const linea1 = nombre.substring(0, 30);
  const linea2 = nombre.length > 30 ? nombre.substring(30, 60) : "";

  const tspl = `
SIZE 50 mm,25 mm
GAP 3 mm,0
DIRECTION 1
REFERENCE 0,0
CLS

BARCODE 30,25,"128",70,0,0,2,2,"${codigo}"



TEXT 50,126,"1",0,1,1,"${linea1}"
${linea2 ? `TEXT 50,154,"1",0,1,1,"${linea2}"` : ""}

PRINT 1
`;

  window.electronAPI.imprimirTSPL(tspl);
}







// Función para registrar pieza ESTE ES EL BUENO 
async function registrarPiezaNueva() {
  const codigoOriginal = document.getElementById('codigo-original-nueva').value.trim();
  const numeroSerie = document.getElementById('numero-serie-nueva').value.trim();
  const caja = document.getElementById('caja-nueva').value.trim();
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  const nombreProducto = document.getElementById('nombre-producto-nueva')?.value.trim() || null;
  const descripcionProducto = document.getElementById('descripcion-producto-nueva')?.value.trim() || null;

  let idDron = null;
  const dronField = document.getElementById('dron-nueva');
  if (dronField && dronField.value) {
    idDron = parseInt(dronField.value, 10);
  }

  if (!numeroSerie || !caja || !usuario) {
    mostrarResultado("Faltan datos obligatorios.", "error");
    return;
  }

  if (!codigoOriginal) {
    mostrarResultado("Código original no encontrado.", "error");
    return;
  }

  mostrarResultado("Registrando nueva pieza...", "loading", true);

  try {
    const response = await axios.post(`${API_URL}/registrar_pieza`, {
      codigo_original: codigoOriginal,
      numero_serie: numeroSerie,
      nombre_producto: nombreProducto,
      descripcion_producto: descripcionProducto,
      id_dron: idDron,
      caja: caja,
      id_usuario: usuario.id_usuario
    });

    const data = response.data;

    // Mostrar resultado
    mostrarResultado(`
      <h3>Éxito</h3>
      <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
      <p>Etiqueta impresa correctamente.</p>
    `, "success");

    // IMPRIMIR ETIQUETA EN TSPL (SIN HTML)
    setTimeout(() => {
      imprimirEtiquetaTSPL(data.codigo_otech,data.nombre_producto);
    }, 300);

    resetearFormulario();
    document.getElementById('codigoEscaneado').focus();
    cargarAlertasStock();

  } catch (error) {
    console.error("Error al registrar pieza:", error);
    let mensaje = "Error al registrar la pieza.";
    if (error.response?.data?.detail === "Número de serie ya registrado") {
      mensaje = "¡Error! Este número de serie ya está registrado.";
    } else if (error.response?.data?.detail) {
      mensaje = error.response.data.detail;
    }
    mostrarResultado(mensaje, "error");
  }
}

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
        console.log("Datos del inventario:", inventarioCompleto);

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

async function cargarDronesCheckbox() {
    const contenedor = document.getElementById('drones-checkbox');
    contenedor.innerHTML = '';

    const res = await axios.get(`${API_URL}/admin/listar_drones`);
    const drones = res.data;

    drones.forEach(dron => {
        const label = document.createElement('label');
        label.className = 'checkbox-card';

        label.innerHTML = `
            <input type="checkbox" value="${dron.id}">
            <span>${dron.nombre}</span>
        `;

        const checkbox = label.querySelector('input');

        checkbox.addEventListener('change', () => {
            label.classList.toggle('checked', checkbox.checked);
        });

        contenedor.appendChild(label);
    });
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
                <td colspan="8" style="text-align: center; padding: 40px; color: #9ca3af;">
                    No se encontraron piezas con los filtros aplicados.
                </td>
            </tr>
        `;
    } else {
        piezasFiltradas.forEach(pieza => {
            const estadoClass = `estado-${pieza.estado}`;
            const fecha = new Date(pieza.fecha_registro).toLocaleString();

            const usuario = JSON.parse(localStorage.getItem('usuario'));
            const tienePermisoSalida = usuario && (usuario.rol === 'admin' || usuario.rol === 'salida');

            const botonSalida = pieza.estado === 'almacenado' && tienePermisoSalida
                ? `<button onclick="registrarSalida(${pieza.id_pieza})" style="padding: 5px 10px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer;">Registrar Salida</button>`
                : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${pieza.id_pieza}</td>
                <td>${pieza.nombre_producto}</td>
                <td>${pieza.nombre_dron}</td>
                <td>${pieza.numero_serie}</td>
                <td><span class="${estadoClass}">${pieza.estado}</span></td>
                <td>${fecha}</td>
                <td>${pieza.nombre_usuario || 'N/A'}</td>
                <td>${pieza.caja}</td>

            `;
            tbody.appendChild(row);
        });
    }

    piezasFiltradasGlobal = inventarioCompleto.filter(pieza => {
        return (
            pieza.numero_serie.toLowerCase().includes(filtroSerie) &&
            (filtroEstado === '' || pieza.estado === filtroEstado) &&
            (filtroProducto === '' || pieza.nombre_producto === filtroProducto)
        );
    });

    paginaActual = 1;
    renderizarTabla();
    renderizarPaginacion();

}

// renderizar tabla con paginación
function renderizarTabla() {
    const tbody = document.getElementById('inventario-body');
    tbody.innerHTML = '';

    const inicio = (paginaActual - 1) * filasPorPagina;
    const fin = inicio + filasPorPagina;
    const paginaDatos = piezasFiltradasGlobal.slice(inicio, fin);

    if (paginaDatos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center; padding:30px; color:#9ca3af;">
                    No hay resultados
                </td>
            </tr>
        `;
        return;
    }

    paginaDatos.forEach(pieza => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${pieza.id_pieza}</td>
            <td>${pieza.nombre_producto}</td>
            <td>${pieza.nombre_dron}</td>
            <td>${pieza.numero_serie}</td>
            <td><span class="estado-${pieza.estado}">${pieza.estado}</span></td>
            <td>${new Date(pieza.fecha_registro).toLocaleString()}</td>
            <td>${pieza.nombre_usuario || 'N/A'}</td>
            <td>${pieza.caja}</td>
            <td>
                <button 
                    onclick="verHistorial(${pieza.id_pieza})"
                    style="padding:6px 10px; background:#6366f1; color:white; border:none; border-radius:6px; cursor:pointer;">
                    +
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

//redenrizar paginación
function renderizarPaginacion() {
    const totalPaginas = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina);
    const contenedor = document.getElementById('paginas');
    contenedor.innerHTML = '';

    const maxVisible = 5;
    let inicio = Math.max(1, paginaActual - 2);
    let fin = Math.min(totalPaginas, inicio + maxVisible - 1);

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

    document.getElementById('btn-first').disabled = paginaActual === 1;
    document.getElementById('btn-prev').disabled = paginaActual === 1;
    document.getElementById('btn-next').disabled = paginaActual === totalPaginas;
    document.getElementById('btn-last').disabled = paginaActual === totalPaginas;
}


async function verHistorial(idPieza) {
    try {
        const res = await axios.get(`${API_URL}/historial/pieza/${idPieza}`);
        const historial = res.data;

        if (historial.length === 0) {
            Swal.fire('Sin historial', 'Esta pieza no tiene movimientos registrados.', 'info');
            return;
        }

        const timeline = historial.map(m => {
            const fecha = new Date(m.fecha_movimiento).toLocaleString();

            let color = '#64748b';
            if (m.tipo_movimiento === 'registro_inicial') color = '#10b981';
            if (m.tipo_movimiento === 'cambio_estado') color = '#6366f1';

            return `
                <div style="border-left:4px solid ${color}; padding-left:12px; margin-bottom:16px;">
                    <div style="font-weight:600; color:${color};">
                        ${m.tipo_movimiento.replace('_', ' ').toUpperCase()}
                    </div>
                    <div style="font-size:13px; color:#374151;">
                        ${m.estado_anterior ? `${m.estado_anterior} → ` : ''}${m.estado_nuevo || ''}
                    </div>
                    <div style="font-size:12px; color:#6b7280;">
                        ${fecha} · ${m.nombre_usuario || 'Usuario eliminado'}
                    </div>
                    ${m.observaciones ? `<div style="margin-top:4px; font-size:12px;">${m.observaciones}</div>` : ''}
                </div>
            `;
        }).join('');

        Swal.fire({
            title: `Historial de la pieza #${idPieza}`,
            html: `<div style="max-height:400px; overflow-y:auto; text-align:left;">${timeline}</div>`,
            width: 700,
            confirmButtonText: 'Cerrar',
            confirmButtonColor: '#6366f1'
        });

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'No se pudo cargar el historial.', 'error');
    }
}



function exportarHistorialPorFechas() {
    const usuario = JSON.parse(localStorage.getItem('usuario'));

    if (!usuario || usuario.rol !== 'Admin') {
        Swal.fire('Acceso denegado', 'Solo administradores pueden exportar.', 'error');
        return;
    }

    const inicio = document.getElementById('historial-fecha-inicio').value;
    const fin = document.getElementById('historial-fecha-fin').value;

    if (!inicio || !fin) {
        Swal.fire('Error', 'Selecciona un rango de fechas.', 'error');
        return;
    }

    const url = `${API_URL}/exportar/historial?fecha_inicio=${inicio}&fecha_fin=${fin}&id_usuario=${usuario.id_usuario}`;
    window.open(url, '_blank');
}




// Función para cargar alertas de stock
async function cargarAlertasStock() {
    try {
        const response = await axios.get(`${API_URL}/alertas/stock_bajo`);
        const alertas = response.data;

        const alertasDiv = document.getElementById('alertas-stock');
        const listaDiv = document.getElementById('lista-alertas');

        if (!alertasDiv || !listaDiv) return;

        if (alertas.length > 0) {
            // Mostrar en la página
            alertasDiv.style.display = 'block';

            // Generar lista para el HTML interno
            

            // Mostrar SweetAlert MODAL
            const listaTexto = alertas.map(a => 
                `${a.nombre} quedan: ${a.stock_actual}`
            ).join('\n');

            Swal.fire({
                title: 'Alerta de Stock Bajo',
                text: 'Los siguientes productos están por debajo del stock mínimo:',
                html: `<p>Los siguientes productos están por debajo del stock mínimo:</p><pre style="text-align: left; background: #f8fafc; padding: 12px; border-radius: 6px; margin-top: 10px;">${listaTexto}</pre>`,
                icon: 'warning',
                confirmButtonText: 'Aceptar',
                confirmButtonColor: '#f59e0b',
                
            });

        } else {
            alertasDiv.style.display = 'none';
        }
    } catch (error) {
        console.error("Error al cargar alertas de stock:", error);
        const alertasDiv = document.getElementById('alertas-stock');
        if (alertasDiv) {
            alertasDiv.style.display = 'none';
        }

        // Manejo de error con SweetAlert (igual que en tu estilo)
        let mensaje = "No se pudieron cargar las alertas de stock.";
        if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }
        Swal.fire('Error', mensaje, 'error');
    }
}

// Función para registrar salida
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
        cargarInventario();
    } catch (error) {
        alert("Error al registrar salida: " + error.message);
    }
}

// Función para exportar inventario
async function exportarInventario() {
    const boton = document.getElementById('btn-exportar');
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
        a.download = 'inventario_otech.xlsx';
        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Éxito con Swal
        Swal.fire({
            icon: 'success',
            title: '¡Listo!',
            text: 'El inventario se ha exportado correctamente.',
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            customClass: {
                popup: 'swal2-toast'
            }
        });

    } catch (error) {
        console.error('Error al exportar inventario:', error);

        // Error con Swal
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo exportar el inventario. Por favor, inténtalo de nuevo.',
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

function mostrarRegistroPieza() {
    modoOperacion = "registro";

    ocultarTodo();

    document.getElementById("datos-nueva-pieza").style.display = "block";

    document.getElementById("codigo-original-nueva").value = productoActual.codigo_original;
    document.getElementById("nombre-producto-nueva").value = productoActual.nombre;
    document.getElementById("descripcion-producto-nueva").value = productoActual.descripcion || "";
}


function mostrarActualizarPieza() {
    modoOperacion = "actualizar";

    ocultarTodo();

    Swal.fire({
        title: "Escanea el número de serie",
        text: "Escanea ahora el número de serie de la pieza",
        icon: "info"
    });

    document.getElementById("codigoEscaneado").value = "";
    document.getElementById("codigoEscaneado").focus();
}


function cargarFormularioActualizar(pieza) {
    ocultarTodo();

    document.getElementById("datos-pieza-encontrada").style.display = "block";
    document.getElementById("btnActualizarEstado").style.display = "block";

    document.getElementById("nombre-producto-encontrado").value = pieza.nombre_producto;
    document.getElementById("numero-serie-encontrado").value = pieza.numero_serie;
    document.getElementById("estado-actual-encontrado").value = pieza.estado;
    document.getElementById("caja-pieza-encontrada").value = pieza.caja || "";
    document.getElementById("id-pieza-oculto").value = pieza.id_pieza;
}




function ocultarTodo() {
    const secciones = [
        'datos-pieza-encontrada',
        'datos-nueva-pieza',
        'camposProducto',
        'opcionesNumeroParte',
        'selector-piezas'
    ];

    secciones.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}



async function verHistorialPieza(idPieza) {
    try {
        const res = await axios.get(`http://localhost:8000/historial_pieza/${idPieza}`);
        const tbody = document.getElementById("historial-body");
        tbody.innerHTML = "";

        res.data.forEach(m => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${new Date(m.fecha_movimiento).toLocaleString()}</td>
                <td>${m.tipo_movimiento}</td>
                <td>${m.usuario || '—'}</td>
                <td>${m.observaciones || ''}</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById("modal-historial").style.display = "flex";
    } catch (err) {
        Swal.fire("Error", "No se pudo cargar el historial", "error");
    }
}

function cerrarModalHistorial() {
    document.getElementById("modal-historial").style.display = "none";
}



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

    // Eliminar después de 3 segundos
    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transition = 'opacity 0.3s';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}



// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    mostrarNombreUsuario();
    iniciarMonitoreoInactividad();
    showSection('registro');
    cargarAlertasStock();
    cargarDronesCheckbox();

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


function aplicarTema(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const btn = document.getElementById('toggle-theme');
    if (btn) {
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Cargar tema guardado
document.addEventListener('DOMContentLoaded', () => {
    const temaGuardado = localStorage.getItem('theme') || 'light';
    aplicarTema(temaGuardado);

    const btn = document.getElementById('toggle-theme');
    if (btn) {
        btn.addEventListener('click', () => {
            const temaActual = document.documentElement.getAttribute('data-theme');
            aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
        });
    }
});

function toggleDarkMode() {
    document.body.classList.toggle("dark");

    // Guardar preferencia
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("modoOscuro", isDark ? "1" : "0");
}

// Cargar preferencia al iniciar
document.addEventListener("DOMContentLoaded", () => {
    const modoOscuro = localStorage.getItem("modoOscuro");
    if (modoOscuro === "1") {
        document.body.classList.add("dark");
    }
});



// Eventos para escaneo con Enter
document.getElementById('codigoOriginal')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('numeroSerie')?.focus();
    }
});

document.getElementById('numeroSerie')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        registrarPieza();
    }
});


document.getElementById('serieEscaneada')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('codigoEscaneado').value = this.value;
        this.value = '';
        buscarCodigo();
    }
});


document.getElementById('btn-first').onclick = () => {
    paginaActual = 1;
    renderizarTabla();
    renderizarPaginacion();
};

document.getElementById('btn-prev').onclick = () => {
    if (paginaActual > 1) paginaActual--;
    renderizarTabla();
    renderizarPaginacion();
};

document.getElementById('btn-next').onclick = () => {
    const totalPaginas = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina);
    if (paginaActual < totalPaginas) paginaActual++;
    renderizarTabla();
    renderizarPaginacion();
};

document.getElementById('btn-last').onclick = () => {
    paginaActual = Math.ceil(piezasFiltradasGlobal.length / filasPorPagina);
    renderizarTabla();
    renderizarPaginacion();
};

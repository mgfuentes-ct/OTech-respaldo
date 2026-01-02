const API_URL = 'http://localhost:8000';

// Variables globales
let inventarioCompleto = [];
let timeoutInactividad;


// Función para cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('usuario');
    window.location.href = 'login.html';
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
    const codigoEscaneado = document.getElementById('codigoEscaneado').value.trim();
    if (!codigoEscaneado) {
        mostrarResultado("Por favor, ingresa o escanea un código.", "error");
        return;
    }
    mostrarResultado("Buscando...", "loading", true);

    try {
        // Endpoint que determina qué tipo de código es y devuelve los datos correspondientes
        const response = await axios.post(`${API_URL}/buscar_codigo`, { codigo: codigoEscaneado });
        const resultado = response.data;

        // Limpiar campos y secciones
        resetearFormulario();

        if (resultado.tipo === 'pieza') {
            // Mostrar interfaz de actualización de estado
            document.getElementById('datos-pieza-encontrada').style.display = 'block';
            document.getElementById('btnActualizarEstado').style.display = 'block';

            document.getElementById('nombre-producto-encontrado').value = resultado.pieza.nombre_producto || 'N/A';
            document.getElementById('numero-serie-encontrado').value = resultado.pieza.numero_serie;
            document.getElementById('estado-actual-encontrado').value = resultado.pieza.estado;
            document.getElementById('id-pieza-oculto').value = resultado.pieza.id_pieza;
            document.getElementById('caja-pieza-encontrada').value = resultado.pieza.caja || 'N/A';

        } else if (resultado.tipo === 'producto') {
            // Mostrar interfaz de registro de nueva pieza con datos pre-rellenados
            document.getElementById('datos-nueva-pieza').style.display = 'block';
            document.getElementById('btnRegistrarPieza').style.display = 'block';

            document.getElementById('codigo-original-nueva').value = resultado.producto.codigo_original;
            document.getElementById('nombre-producto-nueva').value = resultado.producto.nombre;
            document.getElementById('descripcion-producto-nueva').value = resultado.producto.descripcion || '';
            // Asignar id_dron si es necesario
            if (resultado.producto.id_dron) {
                // Suponiendo que tienes un select para drones en la sección de nueva pieza
                // document.getElementById('dron-nueva').value = resultado.producto.id_dron;
            }

        } else {
            // Mostrar interfaz para crear nuevo producto y luego registrar pieza
            document.getElementById('camposProducto').style.display = 'block';
            document.getElementById('btnRegistrarPieza').style.display = 'block';
            document.getElementById('codigo-original-nueva').value = codigoEscaneado; // Prellenar con el código escaneado
        }

        document.getElementById('resultado').style.display = 'none'; // Ocultar mensaje de búsqueda

    } catch (error) {
        console.error("Error al buscar código:", error);
        let mensaje = "Error al buscar el código.";
        if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }
        mostrarResultado(mensaje, "error");
    }
}


async function actualizarEstadoPieza() {
    const idPieza = document.getElementById('id-pieza-oculto').value;
    const nuevoEstado = document.getElementById('nuevo-estado').value;
    const usuario = JSON.parse(localStorage.getItem('usuario'));
    const observaciones = document.getElementById('observaciones-estado').value.trim();

    if (!idPieza || !nuevoEstado || !usuario) {
        mostrarResultado("Faltan datos para actualizar el estado.", "error");
        return;
    }

    mostrarResultado("Actualizando estado...", "loading", true);

    try {
        await axios.post(`${API_URL}/actualizar_estado_pieza`, {
            id_pieza: idPieza,
            nuevo_estado: nuevoEstado,
            id_usuario: usuario.id_usuario,
            observaciones: observaciones
        });

        // Mostrar éxito y limpiar
        mostrarResultado(`Estado actualizado a: ${nuevoEstado}`, "success");
        setTimeout(() => {
            resetearFormulario();
            document.getElementById('codigoEscaneado').focus(); // Volver a enfocar escaneo
        }, 2000);

    } catch (error) {
        console.error("Error al actualizar estado:", error);
        let mensaje = "Error al actualizar el estado.";
        if (error.response?.data?.detail) {
            mensaje = error.response.data.detail;
        }
        mostrarResultado(mensaje, "error");
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
                categoria: categoria,
                stock_minimo: stockMinimo
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
        resultadoDiv.innerHTML = '<p style="color: #ef4444;">❌ Por favor, completa todos los campos.</p>';
        resultadoDiv.className = 'result error';
        return;
    }

    if (password.length < 6) {
        resultadoDiv.innerHTML = '<p style="color: #ef4444;">❌ La contraseña debe tener al menos 6 caracteres.</p>';
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


// Función para registrar pieza
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
        const fechaActual = new Date().toLocaleDateString('es-ES');

        // ✅ Convertir imagen a base64 (clave para que se imprima)
        let imgBase64 = "";
        try {
            const imgSrc = data.ruta_etiqueta;
            const responseImg = await fetch(imgSrc);
            const blob = await responseImg.blob();
            imgBase64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.error("Error al cargar imagen como base64:", err);
            // Fallback: imagen vacía (solo texto)
            imgBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwADegcLQK+OJjIAAAAASUVORK5CYII=";
        }

        // ✅ HTML de etiqueta — ajustado a 50mm x 25mm
        const contenidoEtiqueta = `
            <div style="
                width: 50mm;
                height: 25mm;
                padding: 0;
                margin: 0;
                font-family: 'Courier New', monospace;
                font-size: 9pt;
                text-align: center;
                line-height: 1.1;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: relative;">
                
                <img 
                    src="${imgBase64}" 
                    style="
                        width: 100mm;
                        height: auto;
                        image-rendering: pixelated;
                        object-fit: contain;
                    " 
                    alt="Código de barras"
                />
                <div style="font-size: 7pt; opacity: 0.7;">${fechaActual}</div>
            </div>
        `;

        mostrarResultado(`
            <h3>Éxito</h3>
            <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
            <div class="barcode-container">
                <img src="${imgBase64}" alt="Código de barras" style="max-width: 200px; height: auto;">
            </div>
            <p>Etiqueta generada e impresa automáticamente.</p>
            <button onclick="window.electronAPI.imprimirContenido(\`${contenidoEtiqueta.replace(/`/g, '\\`')}\`)"
                    style="margin-top: 15px; padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer;">
                Reimprimir Etiqueta
            </button>
        `, "success");

        // ✅ Imprimir automáticamente
        if (window.electronAPI?.imprimirContenido) {
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
                <td><strong>${pieza.codigo_barras}</strong></td>
                <td>${pieza.numero_serie}</td>
                <td><span class="${estadoClass}">${pieza.estado}</span></td>
                <td>${fecha}</td>
                <td>${pieza.nombre_usuario || 'N/A'}</td>
                <td>${pieza.caja}</td>

            `;
            tbody.appendChild(row);
        });
    }
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





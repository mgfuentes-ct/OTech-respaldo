// frontend/renderer.js
const axios = require('axios');

async function registrarPieza() {
    const codigoOriginal = document.getElementById('codigoOriginal').value;
    const numeroSerie = document.getElementById('numeroSerie').value;

    if (!codigoOriginal || !numeroSerie) {
        alert("Por favor, ingresa ambos códigos");
        return;
    }

    const resultadoDiv = document.getElementById('resultado');
    resultadoDiv.style.display = 'block';
    resultadoDiv.innerHTML = '<p>Registrando... por favor espera.</p>';

    try {
        const response = await axios.post('http://localhost:8000/registrar_pieza', {
            codigo_original: codigoOriginal,
            numero_serie: numeroSerie,
            nombre_producto: document.getElementById('nombreProducto')?.value || null,
            descripcion_producto: document.getElementById('descripcionProducto')?.value || null,
            categoria_producto: document.getElementById('categoriaProducto')?.value || null,
            id_usuario: 1 // temporal
        });

        const data = response.data;
        resultadoDiv.innerHTML = `
            <h3>Éxito</h3>
            <p><strong>Código OTech:</strong> ${data.codigo_otech}</p>
            <img src="${data.ruta_etiqueta}" alt="Código de barras">
            <p>Guarda esta etiqueta e imprímela.</p>
        `;

        // Limpiar campos
        document.getElementById('codigoOriginal').value = '';
        document.getElementById('numeroSerie').value = '';

    } catch (error) {
        if (error.response?.data?.detail === "Nombre del producto requerido para nuevo producto") {
            document.getElementById('camposProducto').style.display = 'block';
            resultadoDiv.innerHTML = '<p style="color:red;">⚠️ Este producto no existe. Completa los datos abajo y vuelve a intentar.</p>';
        } else if (error.response?.data?.detail === "Número de serie ya registrado") {
            resultadoDiv.innerHTML = '<p style="color:red;">⚠️ ¡Error! Este número de serie ya está registrado.</p>';
        } else {
            resultadoDiv.innerHTML = `<p style="color:red;">❌ Error: ${error.message}</p>`;
        }
    }
}

// Detectar si el producto existe al salir del campo
document.getElementById('codigoOriginal').addEventListener('blur', async () => {
    const codigo = document.getElementById('codigoOriginal').value;
    if (!codigo) return;

    try {
        const response = await axios.get(`http://localhost:8000/health`); // Solo verificamos conexión
        // Opcional: hacer un endpoint /producto?codigo=XXX para verificar existencia
        // Por ahora, mostramos campos si el usuario quiere forzar nuevo registro
    } catch (err) {
        alert("Backend no disponible. Asegúrate de que FastAPI esté corriendo.");
    }
});
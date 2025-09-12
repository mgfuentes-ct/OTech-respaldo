# backend/main.py
from fastapi import FastAPI, HTTPException
from models import producto_existe, crear_producto, pieza_existe_por_serie, crear_pieza, registrar_movimiento
from schemas import RegistroPiezaRequest
import barcode
from barcode.writer import ImageWriter
import os

from database import get_db_connection #importar la conexion a la base de datos

app = FastAPI(title="OTech Inventory API")

# Crear carpeta para códigos si no existe
if not os.path.exists("codigos"):
    os.makedirs("codigos")

@app.post("/registrar_pieza")
async def registrar_pieza_endpoint(data: RegistroPiezaRequest):
    # 1. Verificar si producto existe
    producto = producto_existe(data.codigo_original)
    if not producto:
        # Crear producto
        if not data.nombre_producto:
            raise HTTPException(status_code=400, detail="Nombre del producto requerido para nuevo producto")
        id_producto = crear_producto(
            data.codigo_original,
            data.nombre_producto,
            data.descripcion_producto,
            data.categoria_producto
        )
    else:
        id_producto = producto["id_producto"]

    # 2. Verificar si pieza ya existe por número de serie
    if pieza_existe_por_serie(data.numero_serie):
        raise HTTPException(status_code=400, detail="Número de serie ya registrado")

    # 3. Crear pieza
    resultado = crear_pieza(id_producto, data.numero_serie, data.id_usuario)

    # 4. Generar código de barras
    codigo = resultado["codigo_otech"]
    ean = barcode.get('code128', codigo, writer=ImageWriter())
    filename = f"codigos/{codigo}"
    ean.save(filename)  # Guarda como PNG

    # 5. Registrar movimiento de entrada
    registrar_movimiento(resultado["id_pieza"], "entrada", data.id_usuario, "Pieza registrada e ingresada al sistema")

    return {
        "mensaje": "Pieza registrada exitosamente",
        "codigo_otech": codigo,
        "ruta_etiqueta": f"{filename}.png",
        "id_pieza": resultado["id_pieza"]
    }

@app.get("/health")
def health_check():
    return {"status": "OK"}


# endpoint para obtener todas las piezas en inventario

@app.get("/inventario")
async def obtener_inventario():
    print("📥 Solicitando /inventario...")
    conn = get_db_connection()
    
    if conn is None:
        print("❌ ¡Falló la conexión en el endpoint! Devolviendo error 500.")
        raise HTTPException(status_code=500, detail="Error: No se pudo conectar a la base de datos")

    try:
        print("📊 Creando cursor...")
        cursor = conn.cursor(dictionary=True)
        
        print("📈 Ejecutando consulta SQL...")
        cursor.execute("""
            SELECT 
                p.id_pieza,
                p.codigo_barras,
                p.numero_serie,
                p.estado,
                p.fecha_registro,
                pr.nombre AS nombre_producto,
                COALESCE(u.nombre, 'Usuario eliminado') AS usuario_nombre
            FROM pieza p
            LEFT JOIN producto pr ON p.id_producto = pr.id_producto
            LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
            ORDER BY p.fecha_registro DESC
        """)
        
        print("✅ Consulta ejecutada. Obteniendo resultados...")
        piezas = cursor.fetchall()
        print(f"📋 Se encontraron {len(piezas)} piezas.")
        
        cursor.close()
        conn.close()
        print("🔌 Conexión cerrada.")
        
        return piezas
    except Exception as e:
        print(f"💥 ERROR al ejecutar la consulta: {e}")
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()
        raise HTTPException(status_code=500, detail=f"Error en consulta SQL: {str(e)}")
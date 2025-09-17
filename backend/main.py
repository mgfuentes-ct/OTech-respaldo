
from fastapi import FastAPI, HTTPException, Form
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
    print("Solicitando /inventario...")
    conn = get_db_connection()
    
    if conn is None:
        print("¡Falló la conexión en el endpoint! Devolviendo error 500.")
        raise HTTPException(status_code=500, detail="Error: No se pudo conectar a la base de datos")

    try:
        print("Creando cursor...")
        cursor = conn.cursor(dictionary=True)
        
        print("Ejecutando consulta SQL...")
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
        
        print("Consulta ejecutada. Obteniendo resultados...")
        piezas = cursor.fetchall()
        print(f"Se encontraron {len(piezas)} piezas.")
        
        cursor.close()
        conn.close()
        print("Conexión cerrada.")
        
        return piezas
    except Exception as e:
        print(f"ERROR al ejecutar la consulta: {e}")
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()
        raise HTTPException(status_code=500, detail=f"Error en consulta SQL: {str(e)}")
    

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM usuario WHERE nombre = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    # ✅ Validar si el usuario existe, está activo y la contraseña es correcta
    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    if not user['activo']:
        raise HTTPException(status_code=401, detail="Usuario inactivo. Contacte al administrador.")
        print(f"Hash almacenado para {username}: {user['password_hash']}")

    if not pwd_context.verify(password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    if not user:
        print(f"❌ Usuario '{username}' no encontrado.")
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not user['activo']:
        print(f"❌ Usuario '{username}' está inactivo.")
        raise HTTPException(status_code=401, detail="Usuario inactivo. Contacte al administrador.")

    if not pwd_context.verify(password, user['password_hash']):
        print(f"❌ Contraseña incorrecta para usuario '{username}'.")
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    # Actualizar último login
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE usuario SET ultimo_login = NOW() WHERE id_usuario = %s", (user['id_usuario'],))
    conn.commit()
    cursor.close()
    conn.close()

    return {
        "id_usuario": user['id_usuario'],
        "nombre": user['nombre'],
        "rol": user['rol'],
        "token": "mock-token-" + str(user['id_usuario'])
    }


# Endpoint para registrar salida de una pieza

@app.post("/registrar_salida")
async def registrar_salida(id_pieza: int, id_usuario: int, observaciones: str = ""):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Verificar que la pieza existe y está almacenada
    cursor.execute("SELECT estado FROM pieza WHERE id_pieza = %s", (id_pieza,))
    pieza = cursor.fetchone()
    if not pieza:
        raise HTTPException(status_code=404, detail="Pieza no encontrada")
    if pieza[0] != 'almacenado':
        raise HTTPException(status_code=400, detail="La pieza no está en almacén")

    # 2. ✅ VALIDAR ROL DEL USUARIO
    cursor.execute("SELECT rol FROM usuario WHERE id_usuario = %s", (id_usuario,))
    usuario = cursor.fetchone()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    rol = usuario[0]
    if rol not in ['admin', 'salida']:  # Solo admin y salida pueden registrar salidas
        raise HTTPException(status_code=403, detail="Acceso denegado: no tienes permiso para registrar salidas")

    # 3. Actualizar estado
    cursor.execute("UPDATE pieza SET estado = 'salida' WHERE id_pieza = %s", (id_pieza,))

    # 4. Registrar movimiento
    cursor.execute("""
        INSERT INTO movimiento (id_pieza, tipo_movimiento, id_usuario, observaciones)
        VALUES (%s, 'salida', %s, %s)
    """, (id_pieza, id_usuario, observaciones))

    conn.commit()
    cursor.close()
    conn.close()
    return {"mensaje": "Salida registrada exitosamente"}

# Endpoint para alertas de stock bajo
@app.get("/alertas/stock_bajo")
async def obtener_alertas_stock_bajo():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT 
            p.id_producto,
            p.nombre,
            p.stock_minimo,
            COUNT(pi.id_pieza) as stock_actual
        FROM producto p
        LEFT JOIN pieza pi ON p.id_producto = pi.id_producto AND pi.estado = 'almacenado'
        WHERE p.stock_minimo > 0
        GROUP BY p.id_producto, p.nombre, p.stock_minimo
        HAVING stock_actual < p.stock_minimo
    """)
    alertas = cursor.fetchall()
    cursor.close()
    conn.close()
    return alertas


# Endpoint para exportar inventario a Excel
from fastapi.responses import FileResponse
import pandas as pd
import tempfile

@app.get("/exportar/inventario")
async def exportar_inventario():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT 
            p.id_pieza,
            p.codigo_barras,
            p.numero_serie,
            p.estado,
            p.fecha_registro,
            pr.nombre AS nombre_producto,
            u.nombre AS usuario_nombre
        FROM pieza p
        LEFT JOIN producto pr ON p.id_producto = pr.id_producto
        LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
        ORDER BY p.fecha_registro DESC
    """)
    piezas = cursor.fetchall()
    cursor.close()
    conn.close()

    # Crear DataFrame
    df = pd.DataFrame(piezas)
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
        df.to_excel(tmp.name, index=False, engine='openpyxl')
        tmp_path = tmp.name

    return FileResponse(tmp_path, filename="inventario_otech.xlsx", media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
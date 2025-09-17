
from database import get_db_connection
import uuid

def producto_existe(codigo_original):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM producto WHERE codigo_original = %s", (codigo_original,))
    producto = cursor.fetchone()
    cursor.close()
    conn.close()
    return producto

def crear_producto(codigo_original, nombre, descripcion, categoria):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO producto (codigo_original, nombre, descripcion, categoria)
        VALUES (%s, %s, %s, %s)
    """, (codigo_original, nombre, descripcion, categoria))
    conn.commit()
    id_producto = cursor.lastrowid
    cursor.close()
    conn.close()
    return id_producto

def pieza_existe_por_serie(numero_serie):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM pieza WHERE numero_serie = %s", (numero_serie,))
    pieza = cursor.fetchone()
    cursor.close()
    conn.close()
    return pieza

def crear_pieza(id_producto, numero_serie, id_usuario):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Generar código OTech único
    codigo_otech = f"OTech-{uuid.uuid4().hex[:8].upper()}-{numero_serie[:8]}"
    
    cursor.execute("""
        INSERT INTO pieza (id_producto, numero_serie, codigo_barras, estado, id_usuario)
        VALUES (%s, %s, %s, 'nuevo', %s)
    """, (id_producto, numero_serie, codigo_otech, id_usuario))
    
    conn.commit()
    id_pieza = cursor.lastrowid
    cursor.close()
    conn.close()
    
    return {"id_pieza": id_pieza, "codigo_otech": codigo_otech}

def registrar_movimiento(id_pieza, tipo_movimiento, id_usuario, observaciones=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO movimiento (id_pieza, tipo_movimiento, id_usuario, observaciones)
        VALUES (%s, %s, %s, %s)
    """, (id_pieza, tipo_movimiento, id_usuario, observaciones))
    conn.commit()
    cursor.close()
    conn.close()
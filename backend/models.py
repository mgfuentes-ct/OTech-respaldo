
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

def crear_producto(codigo_original, nombre, descripcion, id_dron):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO producto (codigo_original, nombre, descripcion, id_dron)
        VALUES (%s, %s, %s, %s)
    """, (codigo_original, nombre, descripcion, id_dron))
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


# Nuevas funciones
def pieza_existe_por_codigo_barras(codigo_barras):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id_pieza FROM pieza WHERE codigo_barras = %s", (codigo_barras,))
    pieza = cursor.fetchone()
    cursor.close()
    conn.close()
    return pieza is not None

def obtener_pieza_por_codigo(codigo_barras):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT p.id_pieza, p.numero_serie, p.estado, p.caja, pr.nombre AS nombre_producto
        FROM pieza p
        JOIN producto pr ON p.id_producto = pr.id_producto
        WHERE p.codigo_barras = %s
    """, (codigo_barras,))
    pieza = cursor.fetchone()
    cursor.close()
    conn.close()
    return pieza

def obtener_pieza_por_serie(numero_serie):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT p.id_pieza, p.numero_serie, p.estado, p.caja, pr.nombre AS nombre_producto
        FROM pieza p
        JOIN producto pr ON p.id_producto = pr.id_producto
        WHERE p.numero_serie = %s
    """, (numero_serie,))
    pieza = cursor.fetchone()
    cursor.close()
    conn.close()
    return pieza


def crear_pieza(id_producto, numero_serie, id_usuario, caja):

    conn = get_db_connection()
    cursor = conn.cursor()
    codigo_otech = f"OTech-{uuid.uuid4().hex[:8].upper()}-{numero_serie[:8]}"
    
    cursor.execute("""
        INSERT INTO pieza (id_producto, numero_serie, codigo_barras, estado, id_usuario, caja)
        VALUES (%s, %s, %s, 'disponible', %s, %s)  -- ← 'disponible', no 'nuevo'
    """, (id_producto, numero_serie, codigo_otech, id_usuario, caja))
    
    conn.commit()
    id_pieza = cursor.lastrowid
    cursor.close()
    conn.close()
    
    return {"id_pieza": id_pieza, "codigo_otech": codigo_otech}

def registrar_movimiento(id_pieza, tipo_movimiento, id_usuario, observaciones=""):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO movimiento (id_pieza, tipo_movimiento, estado_anterior, estado_nuevo, id_usuario, observaciones)
        VALUES (%s, %s, NULL, NULL, %s, %s)
    """, (id_pieza, tipo_movimiento, id_usuario, observaciones))
    conn.commit()
    cursor.close()
    conn.close()



# Nueva función para actualizar estado
def actualizar_estado_pieza_db(id_pieza, nuevo_estado):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE pieza SET estado = %s WHERE id_pieza = %s", (nuevo_estado, id_pieza))
    conn.commit()
    cursor.close()
    conn.close()
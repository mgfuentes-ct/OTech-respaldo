from fastapi import FastAPI, HTTPException, Form
from models import producto_existe, crear_producto, pieza_existe_por_serie, crear_pieza, registrar_movimiento
from schemas import RegistroPiezaRequest
import barcode
from barcode.writer import ImageWriter
import os
from database import get_db_connection
from passlib.context import CryptContext
import re 
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

app = FastAPI(title="OTech Inventory API")

# Crear carpeta para códigos si no existe
if not os.path.exists("codigos"):
    os.makedirs("codigos")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Endpoints Principales ---

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM usuario WHERE nombre_usuario = %s", (username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")
    
    if not user['activo']:
        raise HTTPException(status_code=401, detail="Usuario inactivo. Contacte al administrador.")

    if not pwd_context.verify(password, user['password_hash']):
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
        "nombre_usuario": user['nombre_usuario'],
        "rol": user['rol'],
        "token": "mock-token-" + str(user['id_usuario'])
    }


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
                COALESCE(u.nombre_usuario, 'Usuario eliminado') AS nombre_usuario
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

    # 2. VALIDAR ROL DEL USUARIO
    cursor.execute("SELECT rol FROM usuario WHERE id_usuario = %s", (id_usuario,))
    usuario = cursor.fetchone()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    rol = usuario[0]
    if rol not in ['admin', 'salida']:
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

# --- Exportación de Inventario ---

from fastapi.responses import FileResponse
import pandas as pd
import tempfile
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import pandas as pd
from io import BytesIO
from datetime import datetime
from openpyxl import Workbook
from openpyxl.utils.dataframe import dataframe_to_rows
from openpyxl.styles import Font

@app.get("/exportar/inventario")
async def exportar_inventario():
    try:
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
                u.nombre_usuario AS usuario_nombre
            FROM pieza p
            LEFT JOIN producto pr ON p.id_producto = pr.id_producto
            LEFT JOIN usuario u ON p.id_usuario = u.id_usuario
            ORDER BY p.fecha_registro DESC;
        """)
        piezas = cursor.fetchall()
        cursor.close()
        conn.close()

        # Definir columnas explícitamente
        columnas = ['id_pieza', 'codigo_barras', 'numero_serie', 'estado', 'fecha_registro', 'nombre_producto', 'usuario_nombre']
        if not piezas:
            df = pd.DataFrame(columns=columnas)
        else:
            df = pd.DataFrame(piezas, columns=columnas)

        # Reemplazar NaN/None por cadenas vacías
        df = df.fillna("")

        # Formatear fecha de forma segura
        if 'fecha_registro' in df.columns:
            df['fecha_registro'] = pd.to_datetime(df['fecha_registro'], errors='coerce')
            df['fecha_registro'] = df['fecha_registro'].apply(
                lambda x: x.strftime('%d/%m/%Y %H:%M') if pd.notna(x) else ""
            )

        # Renombrar columnas
        df.rename(columns={
            'id_pieza': 'ID Pieza',
            'codigo_barras': 'Código de Barras',
            'numero_serie': 'N° Serie',
            'estado': 'Estado',
            'fecha_registro': 'Fecha Registro',
            'nombre_producto': 'Producto',
            'usuario_nombre': 'Registrado por'
        }, inplace=True)

        # Crear Excel con formato profesional
        output = BytesIO()
        wb = Workbook()
        ws = wb.active
        ws.title = "Inventario"

        # Estilos
        header_font = Font(name='Calibri', bold=True, size=12, color="FFFFFF")
        header_fill = PatternFill(start_color="2C3E50", end_color="2C3E50", fill_type="solid")
        body_font = Font(name='Calibri', size=11)
        alignment_center = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )

        # Escribir encabezados
        headers = list(df.columns)
        for col_idx, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_idx, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = alignment_center
            cell.border = thin_border

        # Escribir filas
        for row_idx, row in enumerate(df.itertuples(index=False), 2):
            for col_idx, value in enumerate(row, 1):
                cell = ws.cell(row=row_idx, column=col_idx, value=str(value))  # ← Conversión segura a str
                cell.font = body_font
                cell.alignment = Alignment(horizontal="left", vertical="center")
                cell.border = thin_border

        # Ajustar ancho
        for col in ws.columns:
            max_length = 0
            column = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 40)
            ws.column_dimensions[column].width = adjusted_width

        ws.sheet_view.showGridLines = False
        wb.save(output)
        output.seek(0)

        filename = f"inventario_otech_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        # ¡IMPORTANTE! Esto te ayudará a depurar
        print("Error en /exportar/inventario:", str(e))
        raise


# --- Endpoints de Administración ---
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")



@app.get("/admin/listar_usuarios")
async def listar_usuarios():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id_usuario, nombre_usuario, nombre_completo, email, rol, activo, ultimo_login 
        FROM usuario WHERE activo = 1
        ORDER BY id_usuario DESC
    """)
    usuarios = cursor.fetchall()
    cursor.close()
    conn.close()
    return usuarios




# --- Endpoint para crear nuevo usuario (solo admin) ---
@app.post("/admin/crear_usuario")
async def crear_usuario_admin(
    nombre_completo: str,
    nombre_usuario: str,
    email: str,
    password: str
):
    # Validar formato de correo electrónico
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_regex, email):
        raise HTTPException(status_code=400, detail="Formato de correo electrónico inválido")

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Verificar duplicados: nombre_usuario, email, nombre_completo
    cursor.execute("""
        SELECT * FROM usuario 
        WHERE nombre_usuario = %s OR email = %s OR nombre_completo = %s
    """, (nombre_usuario, email, nombre_completo))
    
    if cursor.fetchone():
        raise HTTPException(status_code=400, detail="El nombre de usuario, correo o nombre completo ya están registrados")
    
    # Hashear contraseña
    password_hash = pwd_context.hash(password)
    
    # Insertar con rol fijo 'Operario'
    cursor.execute("""
        INSERT INTO usuario (nombre_usuario, nombre_completo, email, rol, activo, password_hash)
        VALUES (%s, %s, %s, 'Operario', %s, %s)
    """, (nombre_usuario, nombre_completo, email, True, password_hash))
    
    conn.commit()
    user_id = cursor.lastrowid
    cursor.close()
    conn.close()
    
    return {
        "mensaje": f"Usuario '{nombre_completo}' creado exitosamente con rol 'Operario' (ID {user_id})"
    }


# --- Endpoint para editar usuario (solo admin) ---
@app.put("/admin/editar_usuario/{id_usuario}")
async def editar_usuario(
    id_usuario: int,
    nombre_completo: str = None,
    nombre_usuario: str = None,
    email: str = None,
    rol: str = None
):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Verificar que el usuario a editar exista
    cursor.execute("SELECT * FROM usuario WHERE id_usuario = %s", (id_usuario,))
    usuario_existente = cursor.fetchone()
    if not usuario_existente:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # Validar rol (solo 'Admin' o 'Operario')
    if rol and rol not in ['Admin', 'Operario']:
        raise HTTPException(status_code=400, detail="Rol no válido. Solo 'Admin' o 'Operario'")
    
    # Verificar duplicados si se actualiza nombre_usuario o email
    if nombre_usuario or email:
        query = "SELECT id_usuario FROM usuario WHERE "
        params = []
        conditions = []
        
        if nombre_usuario and nombre_usuario != usuario_existente['nombre_usuario']:
            conditions.append("nombre_usuario = %s")
            params.append(nombre_usuario)
        
        if email and email != usuario_existente['email']:
            conditions.append("email = %s")
            params.append(email)
        
        if conditions:
            query += " OR ".join(conditions)
            query += " AND id_usuario != %s"
            params.append(id_usuario)
            
            cursor.execute(query, params)
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="El nombre de usuario o correo ya están en uso")
    
    # Construir consulta de actualización
    updates = []
    valores = []
    
    if nombre_completo is not None:
        updates.append("nombre_completo = %s")
        valores.append(nombre_completo)
    
    if nombre_usuario is not None:
        updates.append("nombre_usuario = %s")
        valores.append(nombre_usuario)
    
    if email is not None:
        updates.append("email = %s")
        valores.append(email)
    
    if rol is not None:
        updates.append("rol = %s")
        valores.append(rol)
    
    if not updates:
        raise HTTPException(status_code=400, detail="No se proporcionaron campos para actualizar")
    
    valores.append(id_usuario)
    query = f"UPDATE usuario SET {', '.join(updates)} WHERE id_usuario = %s"
    cursor.execute(query, valores)
    conn.commit()
    cursor.close()
    conn.close()
    
    return {"mensaje": f"Usuario ID {id_usuario} actualizado exitosamente"}

# --- Endpoint para eliminar lógicamente usuario (solo admin) ---
@app.put("/admin/eliminar_usuario/{id_usuario}")
async def eliminar_usuario(id_usuario: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Verificar que el usuario exista
    cursor.execute("SELECT * FROM usuario WHERE id_usuario = %s", (id_usuario,))
    usuario = cursor.fetchone()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    # No permitir eliminar al propio admin que está realizando la acción
    # (esto se validaría mejor con autenticación JWT, pero por ahora asumimos que el frontend ya valida esto)
    
    # Alternar estado 'activo'
    nuevo_estado = not usuario['activo']
    cursor.execute("UPDATE usuario SET activo = %s WHERE id_usuario = %s", (nuevo_estado, id_usuario))
    conn.commit()
    cursor.close()
    conn.close()
    
    estado_texto = "activado" if nuevo_estado else "desactivado"
    return {"mensaje": f"Usuario ID {id_usuario} {estado_texto} exitosamente"}




@app.get("/admin/obtener_usuario/{id_usuario}")
async def obtener_usuario(id_usuario: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM usuario WHERE id_usuario = %s", (id_usuario,))
    usuario = cursor.fetchone()
    cursor.close()
    conn.close()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    return usuario
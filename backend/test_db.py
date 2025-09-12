# backend/test_db.py
from database import get_db_connection

conn = get_db_connection()
if conn:
    print("✅ Conexión exitosa a MySQL")
    conn.close()
else:
    print("❌ Fallo al conectar a MySQL")
    
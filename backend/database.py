
import mysql.connector
from mysql.connector import Error
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    try:
        print("Intentando conectar a MySQL...")
        connection = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "prueba_otech_inventory"),
            autocommit=True,
            connection_timeout=10  #tiempo de espera de 10 segundos
        )
        if connection.is_connected():
            print("¡Conexión a MySQL ESTABLECIDA!")
            return connection
        else:
            print("Conexión fallida: no está conectado.")
            return None
    except Error as e:
        print(f"ERROR FATAL al conectar a MySQL: {e}")
        return None
    except Exception as e:
        print(f"ERROR INESPERADO: {e}")
        return None
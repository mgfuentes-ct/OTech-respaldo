# backend/generar_hashes.py
from passlib.context import CryptContext

# ¡Usa bcrypt, igual que en main.py!
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Contraseñas que quieres usar
contrasenas = {
    "Admin User": "admin1",
    "Usuario normal": "contraseña123"  #aqui se cambia para generar nuevos hashes de otros usuarios
}

# Generar y mostrar hashes
for nombre, password in contrasenas.items():
    hash_generado = pwd_context.hash(password)
    print(f"Nombre: {nombre}")
    print(f"Contraseña: {password}")
    print(f"Hash bcrypt: {hash_generado}")
    print("-" * 50)
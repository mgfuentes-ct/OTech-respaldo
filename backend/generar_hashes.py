# backend/generar_hashes.py
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Contraseñas que quieres usar
contrasenas = {
    "Admin User": "admin1",
    "Usuario normal": "contraseña123"
}

# Generar y mostrar hashes
for nombre, password in contrasenas.items():
    hash = pwd_context.hash(password)
    print(f"Nombre: {nombre}")
    print(f"Contraseña: {password}")
    print(f"Hash bcrypt: {hash}")
    print("-" * 50)
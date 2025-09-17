
from pydantic import BaseModel

class RegistroPiezaRequest(BaseModel):
    codigo_original: str
    numero_serie: str
    nombre_producto: str = None
    descripcion_producto: str = None
    categoria_producto: str = None
    id_usuario: int = 1  # temporal, luego se autentica
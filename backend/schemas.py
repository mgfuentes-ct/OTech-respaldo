from typing import Optional
from pydantic import BaseModel

class RegistroPiezaRequest(BaseModel):
    codigo_original: str
    numero_serie: str
    nombre_producto: str = None
    descripcion_producto: str = None
    id_dron: Optional[int] = None
    caja: str
    id_usuario: int = 1  # temporal, luego se autentica



class BuscarCodigoRequest(BaseModel):
    codigo: str



class ActualizarEstadoRequest(BaseModel):
    id_pieza: int
    nuevo_estado: str
    id_usuario: int
    observaciones: str = ""
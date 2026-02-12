from pydantic import BaseModel
from typing import Optional
from typing import List

class RegistroPiezaRequest(BaseModel):
    codigo_original: str
    numero_serie: str
    caja: str
    id_usuario: int

    # SOLO cuando el producto es nuevo
    nombre_producto: Optional[str] = None
    descripcion_producto: Optional[str] = None
    id_dron: Optional[int] = None



class BuscarCodigoRequest(BaseModel):
    codigo: str



class ActualizarEstadoRequest(BaseModel):
    id_pieza: int
    nuevo_estado: str
    id_usuario: int
    caja: Optional[str] = None
    observaciones: str = ""



class CrearProductoRequest(BaseModel):
    codigo_original: str
    nombre: str
    descripcion: str
    stock_minimo: int
    drones: List[int]
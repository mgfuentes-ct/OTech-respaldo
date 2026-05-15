from pydantic import BaseModel
from typing import Optional, List
from datetime import date

class BuscarCodigoRequest(BaseModel):
    codigo: str


class CrearProductoRequest(BaseModel):
    codigo_original: str
    nombre: str
    descripcion: Optional[str] = None
    stock_minimo: int = 0
    id_marca: int
    id_tipo_producto: int
    id_modelo: Optional[int] = None
    modelos_compatibles: Optional[List[int]] = []


class RegistrarInventarioRequest(BaseModel):
    id_producto: int
    numero_serie: str
    fecha_entrada: Optional[date] = None
    id_estado: int
    id_ubicacion: Optional[int] = None
    id_usuario_registro: int
    vendido: bool = False
    prestamo: bool = False
    para_venta: bool = False
    destinatario: Optional[str] = None
    observaciones: Optional[str] = None


class ActualizarInventarioRequest(BaseModel):
    id_inventario: int
    id_estado: int
    id_ubicacion: Optional[int] = None
    fecha_salida: Optional[date] = None
    vendido: bool = False
    prestamo: bool = False
    para_venta: bool = False
    destinatario: Optional[str] = None
    observaciones: Optional[str] = None
    id_usuario: int


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
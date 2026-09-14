from fastapi import FastAPI
from pydantic import BaseModel
from database.connection import conectar

app = FastAPI()

@app.get("/")
def inicio():
    return {"mensagem": "COGEM Api funcionando"}

class Ocorrencia(BaseModel):
    bloco: str
    andar: int
    lado: str
    descricao: str

@app.post("/Ocorrencia")
def registrar_ocorrencia(ocorrencia: Ocorrencia):
    print(f"Ocorrência registrada no bloco: {ocorrencia.bloco}, Andar {ocorrencia.andar}, Lado {ocorrencia.lado}.")
    print(f"Descrição: {ocorrencia.descricao}")
    return ocorrencia

conexao = conectar()
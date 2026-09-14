from fastapi import FastAPI, Depends
from pydantic import BaseModel
from database.connection import conectar
from database.tables import criar_tabelas
from datetime import datetime

conexao = conectar()
criar_tabelas(conexao)

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
def registrar_ocorrencia(ocorrencia: Ocorrencia, conexao = Depends(conectar)):
    # print(f"Ocorrência registrada no bloco: {ocorrencia.bloco}, Andar {ocorrencia.andar}, Lado {ocorrencia.lado}.")
    # print(f"Descrição: {ocorrencia.descricao}")
    # return ocorrencia
    agora = datetime.now()
    criado_em = agora.strftime("%Y-%m-%d %H:%M:%S")
    cursor = conexao.cursor()
    cursor.execute("""
        INSERT INTO ocorrencias(bloco, andar, lado, descricao, criado_em) 
        VALUES (?, ?, ?, ?, ?)
""", (ocorrencia.bloco, ocorrencia.andar, ocorrencia.lado, ocorrencia.descricao, criado_em))
    conexao.commit()

    id_ocorrencia = cursor.lastrowid
    return {"mensagem": "Ocorrência gerada com sucesso!", "Id da ocorrência": id_ocorrencia}

@app.get("/Ocorrencias")
def buscar_ocorrencias(conexao = Depends(conectar)):
    cursor = conexao.cursor()
    cursor.execute("""
    SELECT * FROM ocorrencias
        """)
    ocorrencias = cursor.fetchall()
    resultado_busca = []
    for ocorrencia in ocorrencias:
        id, bloco, andar, lado, descricao, criado_em, status = ocorrencia
        dicionario_busca = {"ID": id, "bloco": bloco, "andar": andar, "lado": lado, "descrição": descricao, "criado em": criado_em, "Status": status}
        resultado_busca.append(dicionario_busca)
    return resultado_busca
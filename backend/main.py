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
    tipo: str = "comum"

@app.post("/Ocorrencia")
def registrar_ocorrencia(ocorrencia: Ocorrencia, conexao = Depends(conectar)):
    agora = datetime.now()
    criado_em = agora.strftime("%Y-%m-%d %H:%M:%S")
    cursor = conexao.cursor()
    tipos_validos = ["comum", "urgente"]
    tipo = ocorrencia.tipo.lower()
    if tipo not in tipos_validos:
        return {"mensagem": "Tipo inválido!"}
    else:
        cursor.execute("""
            INSERT INTO ocorrencias(bloco, andar, lado, descricao, criado_em, tipo) 
            VALUES (?, ?, ?, ?, ?, ?)
    """, (ocorrencia.bloco, ocorrencia.andar, ocorrencia.lado, ocorrencia.descricao, criado_em, tipo))
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
        id, bloco, andar, lado, descricao, criado_em, status, tipo = ocorrencia
        dicionario_busca = {"ID": id, "bloco": bloco, "andar": andar, "lado": lado, "descrição": descricao, "criado em": criado_em, "Status": status, "Tipo": tipo}
        resultado_busca.append(dicionario_busca)
    return resultado_busca

class Status(BaseModel):
    status: str

@app.put("/Ocorrencia/{id}")
def alterar_status(id: int, status: Status, conexao = Depends(conectar)):
    status_validos = ["em aberto", "em andamento", "concluída", "incompleta", "resolvida"]
    cursor = conexao.cursor()
    cursor.execute("""SELECT * FROM ocorrencias WHERE id = ?""", (id,))
    ocorrencia = cursor.fetchone()
    if ocorrencia is None:
        return {"mensagem": "Ocorrência não encontrada!"}
    elif status.status not in status_validos:
        return {"mensagem": "O Status não é válido"}
    else:
        cursor.execute("""
            UPDATE ocorrencias
            SET status = ?
            WHERE id = ?
        """, (status.status, id))
        conexao.commit()
        return {"mensagem": "Status alterado com sucesso"}
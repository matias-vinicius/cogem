import sqlite3
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel
from database.connection import conectar
from database.tables import criar_tabelas
from datetime import datetime

conexao = sqlite3.connect(Path(__file__).resolve().parents[1] / "database" / "cogem.db")
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
        raise HTTPException(
            status_code=400,
            detail="Tipo inválido!"
        )
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

@app.put("/Ocorrencia/{id}/iniciar")
def iniciar_tarefa(id: int, conexao = Depends(conectar)):
    cursor = conexao.cursor()

    cursor.execute("""SELECT * FROM ocorrencias WHERE id = ?""", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(
            status_code=404,
            detail="Ocorrência não encontrada!"
        )
    elif ocorrencia[6] == "em aberto":
        cursor.execute("""
                UPDATE ocorrencias
                SET status = "em andamento"
                WHERE id = ?
                """, (id,))
        conexao.commit()
        return {"mensagem": "Ocorrência iniciada!"}
    else:
        raise HTTPException(
            status_code=400,
            detail="Tarefa já iniciada!"
        )

@app.put("/Ocorrencia/{id}/finalizar")
def finalizar_tarefa(id: int, conexao = Depends(conectar)):
    cursor = conexao.cursor()

    cursor.execute("""SELECT * FROM ocorrencias WHERE id = ?""", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
            raise HTTPException(
                status_code=404,
                detail="Ocorrência não encontrada!"
            )
    
    elif ocorrencia[6] == "em andamento" or ocorrencia[6] == "em análise":
        cursor.execute("""
                UPDATE ocorrencias
                SET status = "concluída"
                WHERE id = ?
                """, (id,))
        conexao.commit()
        return {"mensagem": "Ocorrência finalizada!"}
    
    elif ocorrencia[6] == "em aberto":
        raise HTTPException(
            status_code=400,
            detail="A tarefa não foi iniciada!"
        )
    
    else:
        return {"mensagem": "Tarefa já finalizada"}
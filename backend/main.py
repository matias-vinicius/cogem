import sqlite3
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from database.connection import DB_PATH, get_db
from database.tables import criar_tabelas

app = FastAPI()


@app.on_event("startup")
def startup_event():
    conexao = sqlite3.connect(DB_PATH)
    try:
        criar_tabelas(conexao)
        conexao.commit()
    finally:
        conexao.close()


@app.get("/")
def inicio():
    return {"mensagem": "COGEM API funcionando"}


class Ocorrencia(BaseModel):
    bloco: str
    andar: int
    lado: str
    descricao: str
    tipo: str = "comum"


@app.post("/ocorrencia")
@app.post("/Ocorrencia")
def registrar_ocorrencia(ocorrencia: Ocorrencia, conexao=Depends(get_db)):
    agora = datetime.now()
    criado_em = agora.strftime("%Y-%m-%d %H:%M:%S")
    cursor = conexao.cursor()
    tipos_validos = ["comum", "urgente"]
    tipo = ocorrencia.tipo.lower()

    if tipo not in tipos_validos:
        raise HTTPException(status_code=400, detail="Tipo inválido!")

    cursor.execute(
        """
        INSERT INTO ocorrencias(bloco, andar, lado, descricao, criado_em, tipo)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            ocorrencia.bloco,
            ocorrencia.andar,
            ocorrencia.lado,
            ocorrencia.descricao,
            criado_em,
            tipo,
        ),
    )
    conexao.commit()

    id_ocorrencia = cursor.lastrowid
    return {"mensagem": "Ocorrência gerada com sucesso!", "id": id_ocorrencia}


@app.get("/ocorrencias")
@app.get("/Ocorrencias")
def buscar_ocorrencias(conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias")
    ocorrencias = cursor.fetchall()

    resultado_busca = []
    for ocorrencia in ocorrencias:
        dicionario_busca = {
            "id": ocorrencia["id"],
            "bloco": ocorrencia["bloco"],
            "andar": ocorrencia["andar"],
            "lado": ocorrencia["lado"],
            "descricao": ocorrencia["descricao"],
            "criado_em": ocorrencia["criado_em"],
            "status": ocorrencia["status"],
            "tipo": ocorrencia["tipo"],
        }
        resultado_busca.append(dicionario_busca)

    return resultado_busca


class Status(BaseModel):
    status: str


@app.put("/ocorrencia/{id}/iniciar")
@app.put("/Ocorrencia/{id}/iniciar")
def iniciar_tarefa(id: int, conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    if ocorrencia["status"] == "em aberto":
        cursor.execute(
            """
            UPDATE ocorrencias
            SET status = "em andamento"
            WHERE id = ?
            """,
            (id,),
        )
        conexao.commit()
        return {"mensagem": "Ocorrência iniciada!"}

    raise HTTPException(status_code=400, detail="Tarefa já iniciada!")


@app.put("/ocorrencia/{id}/finalizar")
@app.put("/Ocorrencia/{id}/finalizar")
def finalizar_tarefa(id: int, conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    if ocorrencia["status"] in {"em andamento", "em análise"}:
        cursor.execute(
            """
            UPDATE ocorrencias
            SET status = "concluída"
            WHERE id = ?
            """,
            (id,),
        )
        conexao.commit()
        return {"mensagem": "Ocorrência finalizada!"}

    if ocorrencia["status"] == "em aberto":
        raise HTTPException(status_code=400, detail="A tarefa não foi iniciada!")

    return {"mensagem": "Tarefa já finalizada"}
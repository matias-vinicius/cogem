import sqlite3
from datetime import datetime
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel

from database.connection import DB_PATH, get_db
from database.tables import criar_tabelas

app = FastAPI()


def ocorrencia_para_dict(ocorrencia):
    criado_em = ocorrencia["criado_em"]
    return {
        "id": ocorrencia["id"],
        "title": ocorrencia["titulo"] or ocorrencia["descricao"],
        "description": ocorrencia["descricao"],
        "block": ocorrencia["bloco"],
        "floor": ocorrencia["andar"],
        "side": ocorrencia["lado"],
        "type": ocorrencia["tipo"],
        "status": ocorrencia["status"],
        "reporter": ocorrencia["responsavel"],
        "createdAt": criado_em,
        "updatedAt": ocorrencia["atualizado_em"] or criado_em,
    }


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
    title: str
    description: str
    block: str
    floor: int
    side: str
    type: str = "comum"


class OcorrenciaResposta(BaseModel):
    id: int
    title: str
    description: str
    block: str
    floor: int
    side: str
    type: str
    status: str
    reporter: str
    createdAt: str
    updatedAt: str


class AtualizacaoStatus(BaseModel):
    status: str


class HistoricoResposta(BaseModel):
    id: int
    occurrenceId: int
    previousStatus: Optional[str] = None
    newStatus: str
    changedAt: str
    reporter: str


TRANSICOES_STATUS = {
    "comum": {
        "em aberto": ["em andamento"],
        "em andamento": ["concluída", "incompleta"],
        "incompleta": ["em andamento"],
        "concluída": [],
    },
    "urgente": {
        "em aberto": ["em andamento"],
        "em andamento": ["resolvida"],
        "resolvida": [],
    },
}


def registrar_historico(conexao, ocorrencia_id, status_anterior, status_novo, alterado_em):
    conexao.execute(
        """
        INSERT INTO historico_ocorrencias(
            ocorrencia_id, status_anterior, status_novo, alterado_em
        )
        VALUES (?, ?, ?, ?)
        """,
        (ocorrencia_id, status_anterior, status_novo, alterado_em),
    )


@app.post("/ocorrencia")
@app.post("/Ocorrencia")
def registrar_ocorrencia(ocorrencia: Ocorrencia, conexao=Depends(get_db)):
    agora = datetime.now().isoformat(timespec="seconds")
    cursor = conexao.cursor()
    tipos_validos = ["comum", "urgente"]
    tipo = ocorrencia.type.lower()

    if tipo not in tipos_validos:
        raise HTTPException(status_code=400, detail="Tipo inválido!")

    cursor.execute(
        """
        INSERT INTO ocorrencias(
            bloco, andar, lado, descricao, criado_em, atualizado_em,
            titulo, tipo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ocorrencia.block,
            ocorrencia.floor,
            ocorrencia.side,
            ocorrencia.description,
            agora,
            agora,
            ocorrencia.title,
            tipo,
        ),
    )
    registrar_historico(conexao, cursor.lastrowid, None, "em aberto", agora)
    conexao.commit()

    id_ocorrencia = cursor.lastrowid
    return {"mensagem": "Ocorrência gerada com sucesso!", "id": id_ocorrencia}


@app.get("/ocorrencias", response_model=list[OcorrenciaResposta])
@app.get("/Ocorrencias", response_model=list[OcorrenciaResposta])
def buscar_ocorrencias(
    status: Optional[str] = None,
    type: Optional[str] = None,
    conexao=Depends(get_db),
):
    cursor = conexao.cursor()
    consulta = "SELECT * FROM ocorrencias"
    filtros = []
    valores = []

    if status is not None:
        filtros.append("status = ?")
        valores.append(status.lower())

    if type is not None:
        filtros.append("tipo = ?")
        valores.append(type.lower())

    if filtros:
        consulta += " WHERE " + " AND ".join(filtros)

    cursor.execute(consulta, valores)
    ocorrencias = cursor.fetchall()

    return [ocorrencia_para_dict(ocorrencia) for ocorrencia in ocorrencias]


@app.get("/ocorrencia/{id}", response_model=OcorrenciaResposta)
@app.get("/Ocorrencia/{id}", response_model=OcorrenciaResposta)
def buscar_ocorrencia(id: int, conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    return ocorrencia_para_dict(ocorrencia)


@app.put("/ocorrencia/{id}/status", response_model=OcorrenciaResposta)
@app.put("/Ocorrencia/{id}/status", response_model=OcorrenciaResposta)
def atualizar_status(
    id: int,
    atualizacao: AtualizacaoStatus,
    conexao=Depends(get_db),
):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    status_atual = ocorrencia["status"]
    proximo_status = atualizacao.status.lower()
    status_permitidos = TRANSICOES_STATUS.get(ocorrencia["tipo"], {}).get(status_atual, [])

    if proximo_status not in status_permitidos:
        raise HTTPException(
            status_code=400,
            detail=f"Transição inválida: {status_atual} para {proximo_status}.",
        )

    atualizado_em = datetime.now().isoformat(timespec="seconds")
    cursor.execute(
        """
        UPDATE ocorrencias
        SET status = ?, atualizado_em = ?
        WHERE id = ?
        """,
        (proximo_status, atualizado_em, id),
    )
    registrar_historico(
        conexao,
        id,
        status_atual,
        proximo_status,
        atualizado_em,
    )
    conexao.commit()

    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    return ocorrencia_para_dict(cursor.fetchone())


@app.get("/ocorrencia/{id}/historico", response_model=list[HistoricoResposta])
@app.get("/Ocorrencia/{id}/historico", response_model=list[HistoricoResposta])
def buscar_historico(id: int, conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT id FROM ocorrencias WHERE id = ?", (id,))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    cursor.execute(
        """
        SELECT id, ocorrencia_id, status_anterior, status_novo,
               alterado_em, responsavel
        FROM historico_ocorrencias
        WHERE ocorrencia_id = ?
        ORDER BY id ASC
        """,
        (id,),
    )
    return [
        {
            "id": item["id"],
            "occurrenceId": item["ocorrencia_id"],
            "previousStatus": item["status_anterior"],
            "newStatus": item["status_novo"],
            "changedAt": item["alterado_em"],
            "reporter": item["responsavel"],
        }
        for item in cursor.fetchall()
    ]


@app.put("/ocorrencia/{id}/iniciar")
@app.put("/Ocorrencia/{id}/iniciar")
def iniciar_tarefa(id: int, conexao=Depends(get_db)):
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ?", (id,))
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    if ocorrencia["status"] == "em aberto":
        atualizado_em = datetime.now().isoformat(timespec="seconds")
        cursor.execute(
            """
            UPDATE ocorrencias
            SET status = "em andamento", atualizado_em = ?
            WHERE id = ?
            """,
            (atualizado_em, id),
        )
        registrar_historico(conexao, id, ocorrencia["status"], "em andamento", atualizado_em)
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
        atualizado_em = datetime.now().isoformat(timespec="seconds")
        status_final = "resolvida" if ocorrencia["tipo"] == "urgente" else "concluída"
        cursor.execute(
            """
            UPDATE ocorrencias
            SET status = ?, atualizado_em = ?
            WHERE id = ?
            """,
            (status_final, atualizado_em, id),
        )
        registrar_historico(conexao, id, ocorrencia["status"], status_final, atualizado_em)
        conexao.commit()
        return {"mensagem": "Ocorrência finalizada!"}

    if ocorrencia["status"] == "em aberto":
        raise HTTPException(status_code=400, detail="A tarefa não foi iniciada!")

    return {"mensagem": "Tarefa já finalizada"}
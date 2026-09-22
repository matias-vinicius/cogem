import sqlite3
import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import datetime
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from database.connection import DB_PATH, get_db
from database.tables import criar_tabelas

app = FastAPI()
TOKEN_SECRET = os.getenv("COGEM_TOKEN_SECRET", "cogem-alpha-change-me")
PERFIS_ADMINISTRATIVOS = {"admin", "manager"}


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
        criar_usuarios_demo(conexao)
        conexao.commit()
    finally:
        conexao.close()


@app.get("/")
def inicio():
    return {"mensagem": "COGEM API funcionando"}


class Ocorrencia(BaseModel):
    title: str = Field(min_length=5)
    description: str = Field(min_length=5)
    block: str = Field(min_length=1)
    floor: int = Field(ge=0, le=99)
    side: str = Field(min_length=1)
    type: Literal["comum", "urgente"] = "comum"


class LoginEntrada(BaseModel):
    email: str
    password: str


class UsuarioEntrada(BaseModel):
    name: str = Field(min_length=2)
    email: str
    password: str = Field(min_length=6)
    role: Literal["admin", "manager", "concierge", "maintenance", "resident"]
    unit: str = Field(min_length=1)


class UsuarioResposta(BaseModel):
    id: int
    name: str
    email: str
    role: str
    unit: str
    active: bool


class UsuarioStatus(BaseModel):
    active: bool


def senha_hash(senha):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, 120000)
    return f"{base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verificar_senha(senha, armazenada):
    try:
        salt_texto, digest_texto = armazenada.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_texto.encode())
        esperado = base64.urlsafe_b64decode(digest_texto.encode())
        atual = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, 120000)
        return hmac.compare_digest(atual, esperado)
    except (ValueError, TypeError):
        return False


def usuario_para_dict(usuario):
    return {
        "id": usuario["id"],
        "name": usuario["nome"],
        "email": usuario["email"],
        "role": usuario["perfil"],
        "unit": usuario["unidade"],
        "active": bool(usuario["ativo"]),
    }


def criar_usuarios_demo(conexao):
    usuarios = [
        ("Administrador COGEM", "admin@cogem.com", "123456", "admin", "Administração"),
        ("Marcos Oliveira", "portaria@cogem.com", "123456", "concierge", "Portaria"),
        ("Carlos Mendes", "manutencao@cogem.com", "123456", "maintenance", "Manutenção"),
        ("Ana Souza", "morador@cogem.com", "123456", "resident", "Bloco A · 101"),
        ("Patrícia Lima", "sindico@cogem.com", "123456", "manager", "Administração"),
    ]
    agora = datetime.now().isoformat(timespec="seconds")
    for nome, email, senha, perfil, unidade in usuarios:
        conexao.execute(
            """
            INSERT OR IGNORE INTO usuarios(nome, email, senha_hash, perfil, unidade, criado_em)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (nome, email, senha_hash(senha), perfil, unidade, agora),
        )


def criar_token(usuario_id):
    payload = base64.urlsafe_b64encode(json.dumps({"id": usuario_id}).encode()).decode()
    assinatura = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{assinatura}"


def usuario_atual(authorization: Optional[str] = Header(default=None), conexao=Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    token = authorization.split(" ", 1)[1]
    try:
        payload, assinatura = token.split(".", 1)
        esperada = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(assinatura, esperada):
            raise ValueError
        usuario_id = json.loads(base64.urlsafe_b64decode(payload.encode()))["id"]
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Token inválido.")

    usuario = conexao.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if usuario is None or not usuario["ativo"]:
        raise HTTPException(status_code=401, detail="Usuário inválido ou desativado.")
    return usuario


def exigir_administrador(usuario=Depends(usuario_atual)):
    if usuario["perfil"] not in PERFIS_ADMINISTRATIVOS:
        raise HTTPException(status_code=403, detail="Permissão insuficiente.")
    return usuario


@app.post("/auth/login")
def login(dados: LoginEntrada, conexao=Depends(get_db)):
    usuario = conexao.execute(
        "SELECT * FROM usuarios WHERE lower(email) = lower(?)",
        (dados.email.strip(),),
    ).fetchone()
    if usuario is None or not verificar_senha(dados.password, usuario["senha_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")
    if not usuario["ativo"]:
        raise HTTPException(status_code=403, detail="Este usuário está desativado.")
    return {"token": criar_token(usuario["id"]), "user": usuario_para_dict(usuario)}


@app.get("/auth/me", response_model=UsuarioResposta)
def auth_me(usuario=Depends(usuario_atual)):
    return usuario_para_dict(usuario)


@app.get("/usuarios", response_model=list[UsuarioResposta])
def listar_usuarios(_usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    usuarios = conexao.execute("SELECT * FROM usuarios ORDER BY nome").fetchall()
    return [usuario_para_dict(usuario) for usuario in usuarios]


@app.post("/usuarios", response_model=UsuarioResposta, status_code=201)
def criar_usuario(dados: UsuarioEntrada, _usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    try:
        cursor = conexao.execute(
            """
            INSERT INTO usuarios(nome, email, senha_hash, perfil, unidade, criado_em)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                dados.name,
                dados.email.strip().lower(),
                senha_hash(dados.password),
                dados.role,
                dados.unit,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        conexao.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")
    usuario = conexao.execute("SELECT * FROM usuarios WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return usuario_para_dict(usuario)


@app.patch("/usuarios/{id}/status", response_model=UsuarioResposta)
def alterar_status_usuario(id: int, dados: UsuarioStatus, _usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    usuario = conexao.execute("SELECT * FROM usuarios WHERE id = ?", (id,)).fetchone()
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    conexao.execute("UPDATE usuarios SET ativo = ? WHERE id = ?", (int(dados.active), id))
    conexao.commit()
    usuario = conexao.execute("SELECT * FROM usuarios WHERE id = ?", (id,)).fetchone()
    return usuario_para_dict(usuario)


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


# Operações persistentes usadas pelos módulos do painel.
class EncomendaEntrada(BaseModel):
    recipient: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    carrier: str = Field(min_length=2)
    tracking: Optional[str] = None
    description: Optional[str] = None


class EntregaEntrada(BaseModel):
    deliveredTo: str = Field(min_length=2)


class LivroEntrada(BaseModel):
    category: str = Field(min_length=2)
    title: str = Field(min_length=2)
    description: str = Field(min_length=2)
    priority: Literal["normal", "atenção", "urgente"] = "normal"


class ChaveEntrada(BaseModel):
    name: str = Field(min_length=2)
    code: str = Field(min_length=2)
    location: str = Field(min_length=2)


class RetiradaChaveEntrada(BaseModel):
    holder: str = Field(min_length=2)
    purpose: str = Field(min_length=2)
    expectedReturn: Optional[str] = None


def agora():
    return datetime.now().isoformat(timespec="seconds")


def registrar_atividade(conexao, icone, titulo, descricao):
    conexao.execute(
        "INSERT INTO atividades(icone, titulo, descricao, criado_em) VALUES (?, ?, ?, ?)",
        (icone, titulo, descricao, agora()),
    )


def encomenda_para_dict(item):
    return {
        "id": item["id"], "recipient": item["destinatario"], "unit": item["unidade"],
        "carrier": item["transportadora"], "tracking": item["rastreio"],
        "description": item["descricao"], "status": item["status"],
        "receivedBy": item["recebido_por"], "receivedAt": item["recebido_em"],
        "deliveredAt": item["entregue_em"], "deliveredTo": item["entregue_para"] or "",
    }


@app.get("/encomendas")
def listar_encomendas(status: Optional[str] = None, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if status:
        itens = conexao.execute("SELECT * FROM encomendas WHERE status = ? ORDER BY id DESC", (status,)).fetchall()
    else:
        itens = conexao.execute("SELECT * FROM encomendas ORDER BY id DESC").fetchall()
    return [encomenda_para_dict(item) for item in itens]


@app.post("/encomendas", status_code=201)
def receber_encomenda(dados: EncomendaEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    cursor = conexao.execute(
        """
        INSERT INTO encomendas(destinatario, unidade, transportadora, rastreio, descricao, recebido_por, recebido_em)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (dados.recipient, dados.unit, dados.carrier, dados.tracking, dados.description, usuario["id"], agora()),
    )
    registrar_atividade(conexao, "package", "Encomenda recebida", f"{dados.carrier} para {dados.unit}")
    conexao.commit()
    return encomenda_para_dict(conexao.execute("SELECT * FROM encomendas WHERE id = ?", (cursor.lastrowid,)).fetchone())


@app.patch("/encomendas/{id}/entrega")
def entregar_encomenda(id: int, dados: EntregaEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    item = conexao.execute("SELECT * FROM encomendas WHERE id = ?", (id,)).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail="Encomenda não encontrada.")
    if item["status"] != "aguardando retirada":
        raise HTTPException(status_code=400, detail="Encomenda já foi entregue.")
    entregue_em = agora()
    conexao.execute("UPDATE encomendas SET status = 'entregue', entregue_em = ?, entregue_para = ? WHERE id = ?", (entregue_em, dados.deliveredTo, id))
    registrar_atividade(conexao, "package", "Encomenda entregue", f"{item['unidade']} · retirada por {dados.deliveredTo}")
    conexao.commit()
    return encomenda_para_dict(conexao.execute("SELECT * FROM encomendas WHERE id = ?", (id,)).fetchone())


def livro_para_dict(item):
    return {
        "id": item["id"], "category": item["categoria"], "title": item["titulo"],
        "description": item["descricao"], "priority": item["prioridade"],
        "author": item["autor_id"], "createdAt": item["criado_em"],
    }


@app.get("/livro-portaria")
def listar_livro(priority: Optional[str] = None, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    consulta = "SELECT * FROM livro_portaria"
    valores = []
    if priority:
        consulta += " WHERE prioridade = ?"
        valores.append(priority)
    consulta += " ORDER BY id DESC"
    return [livro_para_dict(item) for item in conexao.execute(consulta, valores).fetchall()]


@app.post("/livro-portaria", status_code=201)
def criar_registro_livro(dados: LivroEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    cursor = conexao.execute(
        "INSERT INTO livro_portaria(categoria, titulo, descricao, prioridade, autor_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
        (dados.category, dados.title, dados.description, dados.priority, usuario["id"], agora()),
    )
    registrar_atividade(conexao, "log", "Registro adicionado ao livro", dados.title)
    conexao.commit()
    return livro_para_dict(conexao.execute("SELECT * FROM livro_portaria WHERE id = ?", (cursor.lastrowid,)).fetchone())


def chave_para_dict(item):
    return {
        "id": item["id"], "name": item["nome"], "code": item["codigo"], "location": item["localizacao"],
        "status": item["status"], "holder": item["responsavel"] or "", "purpose": item["finalidade"] or "",
        "checkedOutAt": item["retirada_em"], "expectedReturn": item["devolucao_prevista"],
    }


@app.get("/chaves")
def listar_chaves(status: Optional[str] = None, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if status:
        itens = conexao.execute("SELECT * FROM chaves WHERE status = ? ORDER BY id DESC", (status,)).fetchall()
    else:
        itens = conexao.execute("SELECT * FROM chaves ORDER BY id DESC").fetchall()
    return [chave_para_dict(item) for item in itens]


@app.post("/chaves", status_code=201)
def criar_chave(dados: ChaveEntrada, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    try:
        cursor = conexao.execute("INSERT INTO chaves(nome, codigo, localizacao) VALUES (?, ?, ?)", (dados.name, dados.code, dados.location))
        conexao.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Código de chave já cadastrado.")
    return chave_para_dict(conexao.execute("SELECT * FROM chaves WHERE id = ?", (cursor.lastrowid,)).fetchone())


@app.put("/chaves/{id}/retirada")
def retirar_chave(id: int, dados: RetiradaChaveEntrada, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    chave = conexao.execute("SELECT * FROM chaves WHERE id = ?", (id,)).fetchone()
    if chave is None:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")
    if chave["status"] != "disponível":
        raise HTTPException(status_code=400, detail="Chave já está retirada.")
    conexao.execute("UPDATE chaves SET status = 'retirada', responsavel = ?, finalidade = ?, retirada_em = ?, devolucao_prevista = ? WHERE id = ?", (dados.holder, dados.purpose, agora(), dados.expectedReturn, id))
    registrar_atividade(conexao, "key", "Chave retirada", f"{chave['nome']} · {dados.holder}")
    conexao.commit()
    return chave_para_dict(conexao.execute("SELECT * FROM chaves WHERE id = ?", (id,)).fetchone())


@app.put("/chaves/{id}/devolucao")
def devolver_chave(id: int, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    chave = conexao.execute("SELECT * FROM chaves WHERE id = ?", (id,)).fetchone()
    if chave is None:
        raise HTTPException(status_code=404, detail="Chave não encontrada.")
    if chave["status"] != "retirada":
        raise HTTPException(status_code=400, detail="Chave já está disponível.")
    conexao.execute("UPDATE chaves SET status = 'disponível', responsavel = NULL, finalidade = NULL, retirada_em = NULL, devolucao_prevista = NULL WHERE id = ?", (id,))
    registrar_atividade(conexao, "key", "Chave devolvida", chave["nome"])
    conexao.commit()
    return chave_para_dict(conexao.execute("SELECT * FROM chaves WHERE id = ?", (id,)).fetchone())


class VisitanteEntrada(BaseModel):
    name: str = Field(min_length=2)
    document: str = Field(min_length=3)
    phone: Optional[str] = None
    type: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    resident: str = Field(min_length=2)
    validFrom: str
    validUntil: str
    vehicle: Optional[str] = None


class AcessoEntrada(BaseModel):
    person: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    kind: str = Field(min_length=2)
    direction: Literal["entrada", "saída"]
    authorizedBy: Optional[str] = None


def visitante_para_dict(item):
    return {
        "id": item["id"], "name": item["nome"], "document": item["documento"], "phone": item["telefone"],
        "type": item["tipo"], "unit": item["unidade"], "resident": item["morador"],
        "validFrom": item["valido_de"], "validUntil": item["valido_ate"], "vehicle": item["placa"] or "",
        "status": item["status"], "enteredAt": item["entrada_em"], "exitedAt": item["saida_em"],
    }


def acesso_para_dict(item):
    return {
        "id": item["id"], "person": item["pessoa"], "unit": item["unidade"], "kind": item["tipo"],
        "direction": item["direcao"], "authorizedBy": item["autorizado_por"] or "",
        "registeredBy": item["registrado_por"], "createdAt": item["criado_em"],
    }


@app.get("/visitantes")
def listar_visitantes(status: Optional[str] = None, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if status:
        itens = conexao.execute("SELECT * FROM visitantes WHERE status = ? ORDER BY id DESC", (status,)).fetchall()
    else:
        itens = conexao.execute("SELECT * FROM visitantes ORDER BY id DESC").fetchall()
    return [visitante_para_dict(item) for item in itens]


@app.post("/visitantes", status_code=201)
def autorizar_visitante(dados: VisitanteEntrada, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if dados.validUntil <= dados.validFrom:
        raise HTTPException(status_code=400, detail="A validade final deve ser posterior à inicial.")
    cursor = conexao.execute(
        """
        INSERT INTO visitantes(nome, documento, telefone, tipo, unidade, morador, valido_de, valido_ate, placa, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (dados.name, dados.document, dados.phone, dados.type, dados.unit, dados.resident, dados.validFrom, dados.validUntil, dados.vehicle, agora()),
    )
    registrar_atividade(conexao, "visitor", "Visitante autorizado", f"{dados.name} · unidade {dados.unit}")
    conexao.commit()
    return visitante_para_dict(conexao.execute("SELECT * FROM visitantes WHERE id = ?", (cursor.lastrowid,)).fetchone())


def registrar_acesso(conexao, pessoa, unidade, tipo, direcao, autorizado_por, registrado_por):
    cursor = conexao.execute(
        "INSERT INTO acessos(pessoa, unidade, tipo, direcao, autorizado_por, registrado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (pessoa, unidade, tipo, direcao, autorizado_por, registrado_por, agora()),
    )
    return cursor.lastrowid


@app.put("/visitantes/{id}/entrada")
def registrar_entrada_visitante(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    visitante = conexao.execute("SELECT * FROM visitantes WHERE id = ?", (id,)).fetchone()
    if visitante is None:
        raise HTTPException(status_code=404, detail="Visitante não encontrado.")
    if visitante["status"] != "autorizado":
        raise HTTPException(status_code=400, detail="Visitante não está autorizado para entrada.")
    momento = agora()
    if momento < visitante["valido_de"] or momento > visitante["valido_ate"]:
        raise HTTPException(status_code=400, detail="A autorização está fora do período de validade.")
    registrar_acesso(conexao, visitante["nome"], visitante["unidade"], visitante["tipo"], "entrada", visitante["morador"], usuario["id"])
    conexao.execute("UPDATE visitantes SET status = 'dentro', entrada_em = ?, saida_em = NULL WHERE id = ?", (momento, id))
    registrar_atividade(conexao, "access", "Entrada registrada", f"{visitante['nome']} · {visitante['unidade']}")
    conexao.commit()
    return visitante_para_dict(conexao.execute("SELECT * FROM visitantes WHERE id = ?", (id,)).fetchone())


@app.put("/visitantes/{id}/saida")
def registrar_saida_visitante(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    visitante = conexao.execute("SELECT * FROM visitantes WHERE id = ?", (id,)).fetchone()
    if visitante is None:
        raise HTTPException(status_code=404, detail="Visitante não encontrado.")
    if visitante["status"] != "dentro":
        raise HTTPException(status_code=400, detail="Visitante não está registrado dentro do condomínio.")
    momento = agora()
    registrar_acesso(conexao, visitante["nome"], visitante["unidade"], visitante["tipo"], "saída", visitante["morador"], usuario["id"])
    conexao.execute("UPDATE visitantes SET status = 'finalizado', saida_em = ? WHERE id = ?", (momento, id))
    registrar_atividade(conexao, "access", "Saída registrada", f"{visitante['nome']} · {visitante['unidade']}")
    conexao.commit()
    return visitante_para_dict(conexao.execute("SELECT * FROM visitantes WHERE id = ?", (id,)).fetchone())


@app.get("/acessos")
def listar_acessos(direction: Optional[str] = None, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if direction:
        itens = conexao.execute("SELECT * FROM acessos WHERE direcao = ? ORDER BY id DESC", (direction,)).fetchall()
    else:
        itens = conexao.execute("SELECT * FROM acessos ORDER BY id DESC").fetchall()
    return [acesso_para_dict(item) for item in itens]


@app.post("/acessos", status_code=201)
def registrar_acesso_manual(dados: AcessoEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    acesso_id = registrar_acesso(conexao, dados.person, dados.unit, dados.kind, dados.direction, dados.authorizedBy, usuario["id"])
    registrar_atividade(conexao, "access", f"{'Entrada' if dados.direction == 'entrada' else 'Saída'} registrada", f"{dados.person} · {dados.unit}")
    conexao.commit()
    return acesso_para_dict(conexao.execute("SELECT * FROM acessos WHERE id = ?", (acesso_id,)).fetchone())
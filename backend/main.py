import sqlite3
import base64
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import JSONResponse

from database.connection import DB_PATH, get_db
from database.tables import criar_tabelas

app = FastAPI()
cors_origins = [origin.strip() for origin in os.getenv(
    "COGEM_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-File-Name", "X-Cogem-Webhook-Secret"],
)
rate_limit_buckets = defaultdict(deque)
rate_limit_lock = threading.Lock()


@app.middleware("http")
async def rate_limit_api(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        client_ip = request.client.host if request.client else "unknown"
        key = (client_ip, request.url.path.split("/", 3)[2])
        limit = 10 if request.url.path == "/api/auth/login" else 300
        current = time.monotonic()
        with rate_limit_lock:
            bucket = rate_limit_buckets[key]
            while bucket and current - bucket[0] >= 60:
                bucket.popleft()
            if len(bucket) >= limit:
                return JSONResponse(status_code=429, content={"message": "Limite de requisições excedido."})
            bucket.append(current)
    return await call_next(request)


@app.exception_handler(HTTPException)
async def api_http_error(_request: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Requisição não autorizada."
    return JSONResponse(status_code=exc.status_code, content={"message": message, "detail": exc.detail}, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def api_validation_error(_request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=422, content={"message": "Payload inválido.", "detail": exc.errors()})


TOKEN_SECRET = os.getenv("COGEM_TOKEN_SECRET") or secrets.token_urlsafe(48)
os.environ.setdefault("COGEM_TOKEN_SECRET", TOKEN_SECRET)
PERFIS_ADMINISTRATIVOS = {"admin", "manager"}
LEGACY_ROUTE_MODULES = {
    "/usuarios": "users", "/encomendas": "packages", "/ocorrencia": "occurrences",
    "/ocorrencias": "occurrences", "/Ocorrencia": "occurrences", "/Ocorrencias": "occurrences",
    "/livro-portaria": "logbook", "/chaves": "keys", "/visitantes": "visitors",
    "/acessos": "access-logs", "/estoque": "inventory", "/reservas": "events",
    "/configuracoes": "settings", "/dashboard": "dashboard", "/atividades": "dashboard",
    "/perfil": "profile", "/auth/password": "profile",
}


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
    conexao.execute("PRAGMA foreign_keys = ON")
    try:
        criar_tabelas(conexao)
        if os.getenv("COGEM_SEED_DEMO_USERS", "").lower() == "true":
            criar_usuarios_demo(conexao)
        bootstrap_email = os.getenv("COGEM_BOOTSTRAP_ADMIN_EMAIL", "").strip().lower()
        bootstrap_password = os.getenv("COGEM_BOOTSTRAP_ADMIN_PASSWORD", "")
        if bootstrap_email and len(bootstrap_password) >= 12:
            conexao.execute(
                """INSERT OR IGNORE INTO usuarios(nome,email,senha_hash,perfil,unidade,criado_em)
                   VALUES(?,?,?,?,?,?)""",
                (os.getenv("COGEM_BOOTSTRAP_ADMIN_NAME", "Gestor inicial"), bootstrap_email,
                 senha_hash(bootstrap_password), "manager", "Administração", datetime.now().isoformat(timespec="seconds")),
            )
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
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, 240000)
    return f"v2$240000${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verificar_senha(senha, armazenada):
    try:
        partes = armazenada.split("$")
        if len(partes) == 4 and partes[0] == "v2":
            iteracoes = int(partes[1])
            salt_texto, digest_texto = partes[2:]
        else:
            salt_texto, digest_texto = armazenada.split("$", 1)
            iteracoes = 120000
        salt = base64.urlsafe_b64decode(salt_texto.encode())
        esperado = base64.urlsafe_b64decode(digest_texto.encode())
        atual = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt, iteracoes)
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
    claims = {
        "id": usuario_id,
        "jti": secrets.token_urlsafe(18),
        "exp": int(datetime.now().timestamp()) + 43200,
    }
    payload = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    assinatura = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{assinatura}"


def usuario_atual(request: Request, authorization: Optional[str] = Header(default=None), conexao=Depends(get_db)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Autenticação necessária.")
    token = authorization.split(" ", 1)[1]
    try:
        payload, assinatura = token.split(".", 1)
        esperada = hmac.new(TOKEN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(assinatura, esperada):
            raise ValueError
        claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        usuario_id = claims["id"]
        token_id = claims["jti"]
        if int(claims["exp"]) <= int(datetime.now().timestamp()):
            raise ValueError
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=401, detail="Token inválido.")

    token_revogado = conexao.execute("SELECT 1 FROM api_tokens_revoked WHERE token_id = ?", (token_id,)).fetchone()
    if token_revogado:
        raise HTTPException(status_code=401, detail="Sessão encerrada.")

    usuario = conexao.execute("SELECT * FROM usuarios WHERE id = ?", (usuario_id,)).fetchone()
    if usuario is None or not usuario["ativo"]:
        raise HTTPException(status_code=401, detail="Usuário inválido ou desativado.")
    for prefix, module in LEGACY_ROUTE_MODULES.items():
        if request.url.path == prefix or request.url.path.startswith(prefix + "/"):
            if module == "dashboard":
                api_require_module(usuario, module)
            elif module == "profile":
                continue
            else:
                api_require_module(usuario, module)
            if usuario["condominium_id"] != "cogem":
                raise HTTPException(status_code=403, detail="Use as rotas /api com isolamento por condomínio.")
            break
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
    if not usuario["senha_hash"].startswith("v2$"):
        conexao.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", (senha_hash(dados.password), usuario["id"]))
        conexao.commit()
    token = criar_token(usuario["id"])
    return {"token": token, "accessToken": token, "user": usuario_para_dict(usuario)}


@app.post("/auth/logout", status_code=204)
def logout(authorization: Optional[str] = Header(default=None), usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    token = authorization.split(" ", 1)[1]
    payload = token.split(".", 1)[0]
    claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
    expiracao = datetime.fromtimestamp(claims["exp"]).isoformat(timespec="seconds")
    conexao.execute("INSERT OR IGNORE INTO api_tokens_revoked(token_id,expires_at) VALUES(?,?)", (claims["jti"], expiracao))
    conexao.commit()
    return None


@app.get("/auth/me", response_model=UsuarioResposta)
def auth_me(usuario=Depends(usuario_atual)):
    return usuario_para_dict(usuario)


@app.get("/usuarios", response_model=list[UsuarioResposta])
def listar_usuarios(_usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    usuarios = conexao.execute("SELECT * FROM usuarios ORDER BY nome").fetchall()
    return [usuario_para_dict(usuario) for usuario in usuarios]


@app.post("/usuarios", response_model=UsuarioResposta, status_code=201)
def criar_usuario(dados: UsuarioEntrada, _usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    if len(dados.password) < 8:
        raise HTTPException(status_code=422, detail="A senha deve ter ao menos 8 caracteres.")
    if _usuario["perfil"] == "admin" and dados.role in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Não é permitido administrar contas de administrador da plataforma.")
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
    if _usuario["perfil"] == "admin" and usuario["perfil"] in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Não é permitido administrar contas de administrador da plataforma.")
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
def registrar_ocorrencia(ocorrencia: Ocorrencia, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
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
            titulo, tipo, condominium_id, unit_key, owner_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            usuario["condominium_id"],
            usuario["unidade"] if usuario["perfil"] == "resident" else None,
            usuario["id"],
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
    usuario=Depends(usuario_atual),
    conexao=Depends(get_db),
):
    cursor = conexao.cursor()
    consulta = "SELECT * FROM ocorrencias WHERE condominium_id = ?"
    filtros = []
    valores = [usuario["condominium_id"]]

    if usuario["perfil"] == "resident":
        filtros.append("(owner_id = ? OR unit_key = ?)")
        valores.extend([usuario["id"], usuario["unidade"]])

    if status is not None:
        filtros.append("status = ?")
        valores.append(status.lower())

    if type is not None:
        filtros.append("tipo = ?")
        valores.append(type.lower())

    if filtros:
        consulta += " AND " + " AND ".join(filtros)

    cursor.execute(consulta, valores)
    ocorrencias = cursor.fetchall()

    return [ocorrencia_para_dict(ocorrencia) for ocorrencia in ocorrencias]


@app.get("/ocorrencia/{id}", response_model=OcorrenciaResposta)
@app.get("/Ocorrencia/{id}", response_model=OcorrenciaResposta)
def buscar_ocorrencia(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    cursor = conexao.cursor()
    consulta = "SELECT * FROM ocorrencias WHERE id = ? AND condominium_id = ?"
    valores = [id, usuario["condominium_id"]]
    if usuario["perfil"] == "resident":
        consulta += " AND (owner_id = ? OR unit_key = ?)"
        valores.extend([usuario["id"], usuario["unidade"]])
    cursor.execute(consulta, valores)
    ocorrencia = cursor.fetchone()

    if ocorrencia is None:
        raise HTTPException(status_code=404, detail="Ocorrência não encontrada!")

    return ocorrencia_para_dict(ocorrencia)


@app.put("/ocorrencia/{id}/status", response_model=OcorrenciaResposta)
@app.put("/Ocorrencia/{id}/status", response_model=OcorrenciaResposta)
def atualizar_status(
    id: int,
    atualizacao: AtualizacaoStatus,
    usuario=Depends(usuario_atual),
    conexao=Depends(get_db),
):
    if usuario["perfil"] == "resident":
        raise HTTPException(status_code=403, detail="Moradores não podem alterar o status da ocorrência.")
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ? AND condominium_id = ?", (id, usuario["condominium_id"]))
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
def buscar_historico(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    cursor = conexao.cursor()
    consulta = "SELECT id FROM ocorrencias WHERE id = ? AND condominium_id = ?"
    valores = [id, usuario["condominium_id"]]
    if usuario["perfil"] == "resident":
        consulta += " AND (owner_id = ? OR unit_key = ?)"
        valores.extend([usuario["id"], usuario["unidade"]])
    cursor.execute(consulta, valores)
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
def iniciar_tarefa(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if usuario["perfil"] == "resident":
        raise HTTPException(status_code=403, detail="Moradores não podem alterar o status da ocorrência.")
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ? AND condominium_id = ?", (id, usuario["condominium_id"]))
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
def finalizar_tarefa(id: int, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if usuario["perfil"] == "resident":
        raise HTTPException(status_code=403, detail="Moradores não podem alterar o status da ocorrência.")
    cursor = conexao.cursor()
    cursor.execute("SELECT * FROM ocorrencias WHERE id = ? AND condominium_id = ?", (id, usuario["condominium_id"]))
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
def listar_encomendas(status: Optional[str] = None, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    filtros = []
    valores = []
    if status:
        filtros.append("status = ?")
        valores.append(status)
    if usuario["perfil"] == "resident":
        filtros.append("unidade = ?")
        valores.append(usuario["unidade"])
    consulta = "SELECT * FROM encomendas"
    if filtros:
        consulta += " WHERE " + " AND ".join(filtros)
    consulta += " ORDER BY id DESC"
    itens = conexao.execute(consulta, valores).fetchall()
    return [encomenda_para_dict(item) for item in itens]


@app.post("/encomendas", status_code=201)
def receber_encomenda(dados: EncomendaEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if usuario["perfil"] == "resident":
        raise HTTPException(status_code=403, detail="Moradores não podem registrar encomendas.")
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
    if usuario["perfil"] == "resident":
        raise HTTPException(status_code=403, detail="Moradores não podem registrar retiradas.")
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
    if dados.kind.strip().casefold() in {"vehicle", "veiculo", "veículo", "carro", "car"}:
        plate = dados.person.replace("-", "").replace(" ", "").upper()
        conexao.execute("BEGIN IMMEDIATE")
        veiculos = conexao.execute(
            "SELECT * FROM api_records WHERE condominium_id = ? AND entity = 'vehicles'",
            (usuario["condominium_id"],),
        ).fetchall()
        veiculo = next(
            (item for item in veiculos if json.loads(item["payload"]).get("plate", "").replace("-", "").replace(" ", "").upper() == plate),
            None,
        )
        if veiculo is None:
            conexao.rollback()
            raise HTTPException(status_code=404, detail="Veículo não cadastrado.")
        payload = json.loads(veiculo["payload"])
        entrando = dados.direction == "entrada"
        dentro = payload.get("inside", payload.get("status") == "dentro")
        if entrando == dentro:
            conexao.rollback()
            raise HTTPException(status_code=409, detail="Veículo já está dentro." if entrando else "Veículo não está dentro.")
        payload.update({"inside": entrando, "status": "dentro" if entrando else "fora", "lastMovementAt": agora()})
        api_save_record(conexao, usuario, "vehicles", payload, veiculo["id"])
        api_save_record(conexao, usuario, "vehicle-movements", {"vehicleId": veiculo["id"], "direction": dados.direction, "createdAt": agora(), "registeredBy": usuario["id"]})
    acesso_id = registrar_acesso(conexao, dados.person, dados.unit, dados.kind, dados.direction, dados.authorizedBy, usuario["id"])
    registrar_atividade(conexao, "access", f"{'Entrada' if dados.direction == 'entrada' else 'Saída'} registrada", f"{dados.person} · {dados.unit}")
    conexao.commit()
    return acesso_para_dict(conexao.execute("SELECT * FROM acessos WHERE id = ?", (acesso_id,)).fetchone())


class EstoqueEntrada(BaseModel):
    name: str = Field(min_length=2)
    sku: str = Field(min_length=2)
    category: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    quantity: int = Field(ge=0)
    minimum: int = Field(ge=0)
    location: str = Field(min_length=2)


class MovimentacaoEntrada(BaseModel):
    movement: Literal["entrada", "saída"]
    amount: int = Field(gt=0)
    reason: str = Field(min_length=2)


class ReservaEntrada(BaseModel):
    space: str = Field(min_length=2)
    title: str = Field(min_length=2)
    resident: str = Field(min_length=2)
    unit: str = Field(min_length=1)
    startsAt: str
    endsAt: str
    guests: int = Field(gt=0, le=300)


def estoque_para_dict(item):
    return {
        "id": item["id"], "name": item["nome"], "sku": item["sku"], "category": item["categoria"],
        "unit": item["unidade"], "quantity": item["quantidade"], "minimum": item["minimo"],
        "location": item["localizacao"], "updatedAt": item["atualizado_em"],
    }


@app.get("/estoque")
def listar_estoque(_usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    itens = conexao.execute("SELECT * FROM estoque ORDER BY nome").fetchall()
    return [estoque_para_dict(item) for item in itens]


@app.post("/estoque", status_code=201)
def criar_item_estoque(dados: EstoqueEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    try:
        cursor = conexao.execute(
            """
            INSERT INTO estoque(nome, sku, categoria, unidade, quantidade, minimo, localizacao, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (dados.name, dados.sku, dados.category, dados.unit, dados.quantity, dados.minimum, dados.location, agora()),
        )
        if dados.quantity:
            conexao.execute(
                "INSERT INTO movimentacoes_estoque(estoque_id, movimento, quantidade, motivo, operador_id, criado_em) VALUES (?, 'entrada', ?, ?, ?, ?)",
                (cursor.lastrowid, dados.quantity, "Saldo inicial", usuario["id"], agora()),
            )
        conexao.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="SKU já cadastrado.")
    return estoque_para_dict(conexao.execute("SELECT * FROM estoque WHERE id = ?", (cursor.lastrowid,)).fetchone())


@app.post("/estoque/{id}/movimentacoes")
def movimentar_estoque(id: int, dados: MovimentacaoEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    item = conexao.execute("SELECT * FROM estoque WHERE id = ?", (id,)).fetchone()
    if item is None:
        raise HTTPException(status_code=404, detail="Item de estoque não encontrado.")
    delta = dados.amount if dados.movement == "entrada" else -dados.amount
    quantidade_final = item["quantidade"] + delta
    if quantidade_final < 0:
        raise HTTPException(status_code=400, detail="Movimentação deixaria o estoque negativo.")
    momento = agora()
    conexao.execute("UPDATE estoque SET quantidade = ?, atualizado_em = ? WHERE id = ?", (quantidade_final, momento, id))
    conexao.execute(
        "INSERT INTO movimentacoes_estoque(estoque_id, movimento, quantidade, motivo, operador_id, criado_em) VALUES (?, ?, ?, ?, ?, ?)",
        (id, dados.movement, dados.amount, dados.reason, usuario["id"], momento),
    )
    registrar_atividade(conexao, "inventory", "Estoque movimentado", f"{item['nome']}: {dados.movement} {dados.amount}")
    conexao.commit()
    return estoque_para_dict(conexao.execute("SELECT * FROM estoque WHERE id = ?", (id,)).fetchone())


def reserva_para_dict(item):
    return {
        "id": item["id"], "space": item["espaco"], "title": item["titulo"], "resident": item["responsavel"],
        "unit": item["unidade"], "startsAt": item["inicio"], "endsAt": item["fim"], "guests": item["convidados"],
        "status": item["status"],
    }


@app.get("/reservas")
def listar_reservas(_usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    itens = conexao.execute("SELECT * FROM reservas ORDER BY inicio").fetchall()
    return [reserva_para_dict(item) for item in itens]


@app.post("/reservas", status_code=201)
def criar_reserva(dados: ReservaEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if dados.endsAt <= dados.startsAt:
        raise HTTPException(status_code=400, detail="O término deve ser posterior ao início.")
    conflito = conexao.execute(
        """
        SELECT id FROM reservas
        WHERE espaco = ? AND status = 'confirmada'
          AND inicio < ? AND fim > ?
        """,
        (dados.space, dados.endsAt, dados.startsAt),
    ).fetchone()
    if conflito is not None:
        raise HTTPException(status_code=400, detail="Já existe uma reserva nesse horário.")
    cursor = conexao.execute(
        """
        INSERT INTO reservas(espaco, titulo, responsavel, unidade, inicio, fim, convidados, criado_em)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (dados.space, dados.title, dados.resident, dados.unit, dados.startsAt, dados.endsAt, dados.guests, agora()),
    )
    registrar_atividade(conexao, "event", "Reserva confirmada", f"{dados.space} · {dados.unit}")
    conexao.commit()
    return reserva_para_dict(conexao.execute("SELECT * FROM reservas WHERE id = ?", (cursor.lastrowid,)).fetchone())


@app.patch("/reservas/{id}/cancelar")
def cancelar_reserva(id: int, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    reserva = conexao.execute("SELECT * FROM reservas WHERE id = ?", (id,)).fetchone()
    if reserva is None:
        raise HTTPException(status_code=404, detail="Reserva não encontrada.")
    if reserva["status"] != "confirmada":
        raise HTTPException(status_code=400, detail="Reserva já está cancelada.")
    conexao.execute("UPDATE reservas SET status = 'cancelada' WHERE id = ?", (id,))
    conexao.commit()
    return reserva_para_dict(conexao.execute("SELECT * FROM reservas WHERE id = ?", (id,)).fetchone())


class ConfiguracoesEntrada(BaseModel):
    condominiumName: str = Field(min_length=2)
    document: str = Field(min_length=2)
    address: str = Field(min_length=2)
    packageNotifications: bool = True
    visitorNotifications: bool = True
    occurrenceNotifications: bool = True


class PreferenciasEntrada(BaseModel):
    email: bool = True
    push: bool = True
    digest: bool = False


class SenhaEntrada(BaseModel):
    currentPassword: str = Field(min_length=6)
    newPassword: str = Field(min_length=6)


def ler_configuracoes(conexao):
    valores = {item["chave"]: item["valor"] for item in conexao.execute("SELECT chave, valor FROM configuracoes").fetchall()}
    padrao = {
        "condominiumName": "Residencial COGEM",
        "document": "",
        "address": "",
        "packageNotifications": True,
        "visitorNotifications": True,
        "occurrenceNotifications": True,
    }
    for chave, valor in valores.items():
        if chave in padrao and isinstance(padrao[chave], bool):
            padrao[chave] = valor == "true"
        elif chave in padrao:
            padrao[chave] = valor
    return padrao


@app.get("/configuracoes")
def buscar_configuracoes(_usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    return ler_configuracoes(conexao)


@app.put("/configuracoes")
def salvar_configuracoes(dados: ConfiguracoesEntrada, _usuario=Depends(exigir_administrador), conexao=Depends(get_db)):
    valores = dados.model_dump()
    for chave, valor in valores.items():
        conexao.execute(
            "INSERT INTO configuracoes(chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor",
            (chave, str(valor).lower() if isinstance(valor, bool) else str(valor)),
        )
    conexao.commit()
    return ler_configuracoes(conexao)


@app.get("/perfil/preferencias")
def buscar_preferencias(usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    item = conexao.execute("SELECT * FROM preferencias_usuarios WHERE usuario_id = ?", (usuario["id"],)).fetchone()
    if item is None:
        return {"email": True, "push": True, "digest": False}
    return {"email": bool(item["email"]), "push": bool(item["push"]), "digest": bool(item["digest"])}


@app.put("/perfil/preferencias")
def salvar_preferencias(dados: PreferenciasEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    conexao.execute(
        """
        INSERT INTO preferencias_usuarios(usuario_id, email, push, digest)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(usuario_id) DO UPDATE SET email = excluded.email, push = excluded.push, digest = excluded.digest
        """,
        (usuario["id"], int(dados.email), int(dados.push), int(dados.digest)),
    )
    conexao.commit()
    return dados.model_dump()


@app.put("/auth/password")
def alterar_senha(dados: SenhaEntrada, usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    if not verificar_senha(dados.currentPassword, usuario["senha_hash"]):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    conexao.execute("UPDATE usuarios SET senha_hash = ? WHERE id = ?", (senha_hash(dados.newPassword), usuario["id"]))
    conexao.commit()
    return {"mensagem": "Senha alterada com sucesso."}


@app.get("/atividades")
def listar_atividades(limit: int = 100, _usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    limit = max(1, min(limit, 100))
    itens = conexao.execute("SELECT * FROM atividades ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [{"id": item["id"], "icon": item["icone"], "title": item["titulo"], "description": item["descricao"], "createdAt": item["criado_em"]} for item in itens]


@app.get("/dashboard")
def dashboard(_usuario=Depends(usuario_atual), conexao=Depends(get_db)):
    def count(query, params=()):
        return conexao.execute(query, params).fetchone()[0]

    return {
        "occurrencesActive": count("SELECT count(*) FROM ocorrencias WHERE status NOT IN ('concluída', 'resolvida')"),
        "urgentOccurrences": count("SELECT count(*) FROM ocorrencias WHERE tipo = 'urgente' AND status NOT IN ('concluída', 'resolvida')"),
        "pendingPackages": count("SELECT count(*) FROM encomendas WHERE status = 'aguardando retirada'"),
        "visitorsInside": count("SELECT count(*) FROM visitantes WHERE status = 'dentro'"),
        "lowStock": count("SELECT count(*) FROM estoque WHERE quantidade <= minimo"),
        "keysCheckedOut": count("SELECT count(*) FROM chaves WHERE status = 'retirada'"),
        "upcomingReservations": count("SELECT count(*) FROM reservas WHERE status = 'confirmada' AND inicio >= ?", (agora(),)),
        "activities": listar_atividades(7, _usuario, conexao),
    }


from backend.api_v1 import require_module as api_require_module
from backend.api_v1 import save_record as api_save_record
from backend.api_v1 import router as api_v1_router

app.include_router(api_v1_router)
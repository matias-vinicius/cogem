import base64
import hashlib
import hmac
import json
import math
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from database.connection import get_db, raiz

router = APIRouter(prefix="/api")
TOKEN_SECRET = os.getenv("COGEM_TOKEN_SECRET") or secrets.token_urlsafe(48)
STORAGE_DIR = raiz / "uploads" / "private"
TOKEN_TTL_SECONDS = 60 * 60 * 12
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_JSON_BYTES = 1024 * 1024

ROLE_MODULES = {
    "admin": {"occurrences", "packages", "logbook", "keys", "visitors", "access-logs", "access", "vehicles", "inventory", "events", "announcements", "work-orders", "maintenance-schedules", "documents", "users", "settings", "help", "profile", "audit", "dashboard"},
    "manager": {"*"},
    "concierge": {"occurrences", "packages", "logbook", "keys", "visitors", "vehicles", "access-logs", "access", "events", "announcements", "help", "profile", "dashboard"},
    "maintenance": {"occurrences", "logbook", "inventory", "work-orders", "maintenance-schedules", "documents", "help", "profile", "dashboard"},
    "resident": {"packages", "occurrences", "help", "profile", "announcements", "polls", "assemblies"},
}

ENTITY_MODULES = {
    "occurrences": "occurrences", "packages": "packages", "logbook": "logbook", "keys": "keys",
    "visitors": "visitors", "access-logs": "access-logs", "vehicles": "vehicles",
    "vehicle-movements": "vehicles", "inventory": "inventory", "events": "events",
    "announcements": "announcements", "polls": "polls", "work-orders": "work-orders",
    "maintenance-schedules": "maintenance-schedules", "documents": "documents", "charges": "financial",
    "financial": "financial", "assemblies": "assemblies", "pets": "pets", "moves": "moves",
    "meter-readings": "meter-readings", "users": "users", "settings": "settings",
    "help": "help", "profile": "profile", "audit": "audit",
    "audit-logs": "audit", "dashboard": "dashboard",
}

REQUIRED_FIELDS = {
    "occurrences": ("title", "description", "block", "floor", "side"), "packages": ("recipient", "unit", "carrier"),
    "logbook": ("category", "title", "description"), "keys": ("name", "code", "location"),
    "visitors": ("name", "document", "unit", "resident", "validFrom", "validUntil"),
    "access-logs": ("person", "unit", "kind", "direction"), "vehicles": ("plate",),
    "inventory": ("name", "sku", "quantity"), "events": ("space", "title", "startsAt", "endsAt"),
    "announcements": ("title", "body"), "polls": ("title", "options"),
    "work-orders": ("title", "description"), "maintenance-schedules": ("title", "scheduledAt"),
    "documents": ("title",), "charges": ("description", "amount"), "assemblies": ("title",),
    "pets": ("name", "type"), "moves": ("unit", "scheduledAt", "direction"),
    "meter-readings": ("meterId", "value", "readAt"),
}


class LoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=256)


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_iso(value):
    if not isinstance(value, str):
        fail(422, "Data deve estar no formato ISO 8601.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        fail(422, "Data deve estar no formato ISO 8601.")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def json_payload(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def fail(status: int, message: str):
    raise HTTPException(status_code=status, detail=message)


def password_hash(password: str):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240000)
    return f"v2$240000${base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored: str):
    try:
        parts = stored.split("$")
        if len(parts) == 4 and parts[0] == "v2":
            iterations = int(parts[1])
            salt_text, digest_text = parts[2:]
        else:
            salt_text, digest_text = stored.split("$", 1)
            iterations = 120000
        salt = base64.urlsafe_b64decode(salt_text.encode())
        digest = base64.urlsafe_b64decode(digest_text.encode())
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False


def issue_token(user_id: int):
    token_id = secrets.token_urlsafe(18)
    expires = int(datetime.now(timezone.utc).timestamp()) + TOKEN_TTL_SECONDS
    encoded = base64.urlsafe_b64encode(json_payload({"id": user_id, "jti": token_id, "exp": expires}).encode()).decode().rstrip("=")
    signature = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def decode_token(token: str):
    try:
        encoded, signature = token.split(".", 1)
        expected = hmac.new(TOKEN_SECRET.encode(), encoded.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError
        decoded = base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4))
        claims = json.loads(decoded)
        if int(claims["exp"]) <= int(datetime.now(timezone.utc).timestamp()):
            raise ValueError
        return claims
    except (ValueError, KeyError, TypeError, json.JSONDecodeError):
        fail(401, "Token inválido ou expirado.")


def user_dict(row):
    return {"id": row["id"], "name": row["nome"], "email": row["email"], "role": row["perfil"], "unit": row["unidade"], "active": bool(row["ativo"])}


def current_user(request: Request, connection=Depends(get_db)):
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        fail(401, "Autenticação necessária.")
    claims = decode_token(authorization.split(" ", 1)[1])
    if connection.execute("SELECT 1 FROM api_tokens_revoked WHERE token_id = ?", (claims["jti"],)).fetchone():
        fail(401, "Sessão encerrada.")
    user = connection.execute("SELECT * FROM usuarios WHERE id = ?", (claims["id"],)).fetchone()
    if user is None or not user["ativo"]:
        fail(401, "Usuário inválido ou desativado.")
    return user


def require_module(user, module: str):
    baseline = ROLE_MODULES.get(user["perfil"], set())
    allowed = baseline
    if user["permissions_json"]:
        try:
            custom = set(json.loads(user["permissions_json"]))
        except (TypeError, json.JSONDecodeError):
            fail(403, "Permissões do usuário inválidas.")
        allowed = custom if "*" in baseline else baseline.intersection(custom)
    if "*" not in allowed and module not in allowed:
        fail(403, "Permissão insuficiente.")


def audit(connection, request, user, action, module, record_id=None, result="success", details=None):
    connection.execute(
        """INSERT INTO audit_logs(condominium_id,user_id,action,module,record_id,occurred_at,ip,result,details)
           VALUES(?,?,?,?,?,?,?,?,?)""",
        (user["condominium_id"], user["id"], action, module, str(record_id) if record_id is not None else None,
         now_iso(), request.client.host if request.client else None, result,
         json_payload(details) if details is not None else None),
    )


async def body_object(request: Request, required=True):
    if not request.headers.get("content-type", "").startswith("application/json"):
        if required:
            fail(415, "Envie um corpo JSON.")
        return {}
    try:
        raw = await read_limited_body(request, MAX_JSON_BYTES, "Corpo JSON maior que 1 MB.")
        value = json.loads(raw, parse_constant=lambda _value: fail(400, "JSON inválido."))
    except (ValueError, json.JSONDecodeError):
        fail(400, "JSON inválido.")
    if not isinstance(value, dict):
        fail(422, "O corpo deve ser um objeto JSON.")
    return value


async def read_limited_body(request: Request, maximum: int, error: str):
    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > maximum:
            fail(413, error)
    return bytes(body)


def validate_payload(entity: str, payload: dict):
    missing = [field for field in REQUIRED_FIELDS.get(entity, ()) if payload.get(field) in (None, "")]
    if missing:
        fail(422, f"Campos obrigatórios: {', '.join(missing)}.")
    if entity == "inventory" and (not isinstance(payload.get("quantity"), (int, float)) or payload["quantity"] < 0):
        fail(422, "A quantidade deve ser um número não negativo.")
    if entity == "inventory" and (isinstance(payload["quantity"], bool) or not math.isfinite(float(payload["quantity"]))):
        fail(422, "A quantidade precisa ser finita.")
    if entity == "occurrences" and (not isinstance(payload.get("floor"), int) or not 0 <= payload["floor"] <= 99):
        fail(422, "floor deve ser um inteiro entre 0 e 99.")
    if entity == "occurrences" and payload.get("type", "comum") not in {"comum", "urgente"}:
        fail(422, "Tipo de ocorrência inválido.")
    if entity == "events" and parse_iso(payload["endsAt"]) <= parse_iso(payload["startsAt"]):
        fail(422, "O término precisa ser posterior ao início.")
    if entity == "visitors" and parse_iso(payload["validUntil"]) <= parse_iso(payload["validFrom"]):
        fail(422, "A validade final precisa ser posterior à inicial.")
    if entity == "polls" and (not isinstance(payload["options"], list) or len(payload["options"]) < 2):
        fail(422, "A enquete precisa ter ao menos duas opções.")
    if entity == "assemblies" and "agenda" in payload and (not isinstance(payload["agenda"], list) or any(not isinstance(item, dict) for item in payload["agenda"])):
        fail(422, "agenda deve ser uma lista de itens.")
    if entity == "charges" and (not isinstance(payload["amount"], (int, float)) or not math.isfinite(float(payload["amount"])) or payload["amount"] <= 0):
        fail(422, "O valor da cobrança precisa ser positivo.")


def record_row(connection, user, entity, record_id, include_resident=True):
    row = connection.execute("SELECT * FROM api_records WHERE id = ? AND condominium_id = ? AND entity = ?", (record_id, user["condominium_id"], entity)).fetchone()
    if row is None:
        fail(404, "Registro não encontrado.")
    if user["perfil"] == "maintenance" and entity == "documents":
        payload = json.loads(row["payload"])
        if payload.get("visibility") not in {"technical", "maintenance"} and payload.get("category") not in {"technical", "maintenance"}:
            fail(404, "Registro não encontrado.")
    shared_entities = {"announcements", "polls", "assemblies"}
    if include_resident and user["perfil"] == "resident" and entity not in shared_entities and row["owner_id"] != user["id"] and row["unit_key"] != user["unidade"]:
        fail(404, "Registro não encontrado.")
    return row


def record_dict(row):
    payload = json.loads(row["payload"])
    payload.update({"id": row["id"], "createdAt": row["created_at"], "updatedAt": row["updated_at"]})
    return payload


def save_record(connection, user, entity, payload, record_id=None):
    moment = now_iso()
    unit_key = payload.get("unit")
    if user["perfil"] == "resident":
        unit_key = user["unidade"]
        payload["unit"] = user["unidade"]
        payload["residentId"] = user["id"]
        for identity_field in ("unitId", "unit_id", "resident_id", "residentID", "condominiumId", "condominium_id"):
            payload.pop(identity_field, None)
    if record_id is None:
        cursor = connection.execute(
            """INSERT INTO api_records(condominium_id,entity,unit_key,owner_id,payload,created_at,updated_at)
               VALUES(?,?,?,?,?,?,?)""",
            (user["condominium_id"], entity, unit_key, user["id"], json_payload(payload), moment, moment),
        )
        return cursor.lastrowid
    connection.execute("UPDATE api_records SET unit_key=?,payload=?,updated_at=? WHERE id=? AND condominium_id=? AND entity=?",
                       (unit_key, json_payload(payload), moment, record_id, user["condominium_id"], entity))
    return record_id


def list_records(connection, user, entity, filters=None):
    query = "SELECT * FROM api_records WHERE condominium_id=? AND entity=?"
    params = [user["condominium_id"], entity]
    if user["perfil"] == "resident" and entity not in {"announcements", "polls", "assemblies"}:
        query += " AND (owner_id=? OR unit_key=?)"
        params.extend([user["id"], user["unidade"]])
    result = [record_dict(row) for row in connection.execute(query + " ORDER BY id DESC", params).fetchall()]
    filters = filters or {}
    for key in ("status", "unit", "search"):
        value = filters.get(key)
        if value in (None, ""):
            continue
        if key == "search":
            result = [item for item in result if str(value).casefold() in json_payload(item).casefold()]
        else:
            result = [item for item in result if str(item.get(key, "")) == str(value)]
    if user["perfil"] == "maintenance" and entity == "documents":
        result = [item for item in result if item.get("visibility") in {"technical", "maintenance"} or item.get("category") in {"technical", "maintenance"}]
    try:
        page = max(1, int(filters.get("page", 1)))
        limit = max(1, min(500, int(filters.get("limit", 100))))
    except (TypeError, ValueError):
        fail(422, "page e limit devem ser inteiros.")
    return result[(page - 1) * limit:page * limit]


def queue_notification(connection, condominium_id, channel, recipient, payload):
    moment = now_iso()
    cursor = connection.execute("""INSERT INTO notification_jobs(condominium_id,channel,recipient,payload,status,created_at,updated_at)
                                  VALUES(?,?,?,?, 'queued', ?, ?)""",
                                (condominium_id, channel, str(recipient), json_payload(payload), moment, moment))
    return cursor.lastrowid


def storage_cipher():
    key_material = os.getenv("COGEM_STORAGE_ENCRYPTION_KEY")
    if not key_material:
        fail(503, "Configure COGEM_STORAGE_ENCRYPTION_KEY para habilitar storage privado.")
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        fail(503, "Instale as dependências do backend para habilitar storage criptografado.")
    key = base64.urlsafe_b64encode(hashlib.sha256(key_material.encode()).digest())
    return Fernet(key)


def issue_pickup_token(connection, condominium_id, package_id):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(timespec="seconds")
    connection.execute("INSERT INTO pickup_tokens(token_hash,condominium_id,package_id,expires_at) VALUES(?,?,?,?)",
                       (token_hash, condominium_id, package_id, expires))
    return token, expires


def require_private_image(connection, user, file_id, allowed_modules):
    if not isinstance(file_id, int):
        fail(422, "Informe imageFileId de uma imagem privada previamente enviada.")
    row = connection.execute("SELECT * FROM storage_files WHERE id=? AND condominium_id=?", (file_id, user["condominium_id"])).fetchone()
    if row is None or row["module"] not in allowed_modules or not row["content_type"].startswith("image/"):
        fail(404, "Imagem privada não encontrada.")
    return row


@router.post("/auth/login")
async def login(data: LoginBody, request: Request, connection=Depends(get_db)):
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", data.email.strip()):
        fail(422, "E-mail inválido.")
    row = connection.execute("SELECT * FROM usuarios WHERE lower(email)=lower(?)", (data.email.strip(),)).fetchone()
    if row is None or not verify_password(data.password, row["senha_hash"]):
        fail(401, "E-mail ou senha incorretos.")
    if not row["ativo"]:
        fail(403, "Este usuário está desativado.")
    if not row["senha_hash"].startswith("v2$"):
        connection.execute("UPDATE usuarios SET senha_hash=? WHERE id=?", (password_hash(data.password), row["id"]))
    token = issue_token(row["id"])
    audit(connection, request, row, "login", "auth", row["id"])
    connection.commit()
    return {"accessToken": token, "token": token, "user": user_dict(row), "expiresIn": TOKEN_TTL_SECONDS}


@router.post("/auth/logout", status_code=204)
def logout(request: Request, user=Depends(current_user), connection=Depends(get_db)):
    claims = decode_token(request.headers["authorization"].split(" ", 1)[1])
    expiry = datetime.fromtimestamp(claims["exp"], timezone.utc).isoformat(timespec="seconds")
    connection.execute("INSERT OR IGNORE INTO api_tokens_revoked(token_id,expires_at) VALUES(?,?)", (claims["jti"], expiry))
    audit(connection, request, user, "logout", "auth", user["id"])
    connection.commit()
    return Response(status_code=204)


@router.get("/auth/me")
def me(user=Depends(current_user)):
    return user_dict(user)


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def dispatch(path: str, request: Request, connection=Depends(get_db)):
    parts = [part for part in path.strip("/").split("/") if part]
    method = request.method
    if not parts:
        fail(404, "Endpoint não encontrado.")
    if parts[:2] == ["access", "facial"] and len(parts) == 3 and method == "POST":
        user = current_user(request, connection)
        require_module(user, "access")
        data = await body_object(request)
        if parts[2] == "identify":
            image = require_private_image(connection, user, data.get("imageFileId"), {"users", "access-logs"})
            job_id = queue_notification(connection, user["condominium_id"], "biometric-identify", str(user["id"]), {"requestedBy": user["id"], "imageFileId": image["id"]})
            audit(connection, request, user, "facial_identify_queued", "access", job_id)
            connection.commit()
            return {"status": "queued", "jobId": job_id, "providerStatus": "not_configured"}
        if parts[2] == "confirm":
            resident_id = data.get("residentId")
            direction = data.get("direction", "entrada")
            if not isinstance(resident_id, int) or direction not in {"entrada", "saída"}:
                fail(422, "Informe residentId e direction válidos.")
            target = connection.execute("SELECT * FROM usuarios WHERE id=? AND condominium_id=? AND perfil='resident' AND ativo=1", (resident_id, user["condominium_id"])).fetchone()
            if target is None:
                fail(404, "Morador não encontrado.")
            access_id = save_record(connection, user, "access-logs", {"person": target["nome"], "unit": target["unidade"], "kind": "morador", "direction": direction, "registeredBy": user["nome"], "createdAt": now_iso()})
            audit(connection, request, user, "facial_confirm", "access", access_id)
            connection.commit()
            return {"confirmed": True, "accessLogId": access_id}
        fail(404, "Endpoint não encontrado.")

    if parts == ["notifications", "webhooks"] or (len(parts) == 3 and parts[:2] == ["notifications", "webhooks"]):
        if method != "POST" or len(parts) != 3:
            fail(404, "Endpoint não encontrado.")
        secret = os.getenv("COGEM_NOTIFICATION_WEBHOOK_SECRET")
        if not secret:
            fail(503, "Webhook de notificações não configurado.")
        if not hmac.compare_digest(request.headers.get("x-cogem-webhook-secret", ""), secret):
            fail(401, "Assinatura de webhook inválida.")
        data = await body_object(request)
        status = data.get("status")
        if status not in {"sent", "delivered", "read", "failed"} or not isinstance(data.get("jobId"), int):
            fail(422, "Informe jobId e um status válido.")
        cursor = connection.execute("UPDATE notification_jobs SET status=?,updated_at=? WHERE id=? AND channel LIKE ?", (status, now_iso(), data["jobId"], f"%{parts[2]}%"))
        if not cursor.rowcount:
            fail(404, "Notificação não encontrada.")
        connection.commit()
        return {"updated": True, "status": status}

    if parts == ["packages", "notifications", "bulk"] and method == "POST":
        user = current_user(request, connection)
        require_module(user, "packages")
        if user["perfil"] == "resident":
            fail(403, "Moradores não podem disparar notificações em massa.")
        data = await body_object(request)
        ids = data.get("packageIds")
        channels = data.get("channels", ["email", "whatsapp"])
        if not isinstance(ids, list) or not ids or not isinstance(channels, list) or any(item not in {"email", "whatsapp"} for item in channels):
            fail(422, "Informe packageIds e channels válidos.")
        queued = 0
        for package_id in ids:
            row = record_row(connection, user, "packages", package_id)
            package = record_dict(row)
            for channel in channels:
                queue_notification(connection, user["condominium_id"], channel, package.get("unit", ""), {"type": "package", "packageId": package_id})
                queued += 1
        audit(connection, request, user, "bulk_notify", "packages", details={"packageIds": ids, "jobs": queued})
        connection.commit()
        return {"status": "queued", "jobs": queued}

    if parts == ["vehicles", "plate-recognition"] and method == "POST":
        user = current_user(request, connection)
        require_module(user, "vehicles")
        image = require_private_image(connection, user, (await body_object(request)).get("imageFileId"), {"vehicles"})
        job_id = queue_notification(connection, user["condominium_id"], "plate-recognition", str(user["id"]), {"requestedBy": user["id"], "imageFileId": image["id"]})
        audit(connection, request, user, "plate_recognition_queued", "vehicles", job_id)
        connection.commit()
        return {"status": "queued", "jobId": job_id, "providerStatus": "not_configured"}

    if parts == ["vehicles", "tag", "validate"] and method == "POST":
        user = current_user(request, connection)
        require_module(user, "vehicles")
        tag = (await body_object(request)).get("tag")
        if not isinstance(tag, str) or not tag.strip():
            fail(422, "Informe uma tag válida.")
        vehicles = list_records(connection, user, "vehicles", {"limit": 500})
        vehicle = next((item for item in vehicles if str(item.get("tag", "")).casefold() == tag.casefold()), None)
        return {"valid": vehicle is not None, "vehicle": vehicle}

    if len(parts) == 3 and parts[0] == "storage" and parts[2] == "download" and parts[1].isdigit() and method == "GET":
        user = current_user(request, connection)
        file_id = int(parts[1])
        file_row = connection.execute("SELECT * FROM storage_files WHERE id=? AND condominium_id=?", (file_id, user["condominium_id"])).fetchone()
        if file_row is None:
            fail(404, "Arquivo não encontrado.")
        module = ENTITY_MODULES.get(file_row["module"], file_row["module"])
        require_module(user, module)
        if user["perfil"] == "resident":
            related = record_row(connection, user, file_row["module"], int(file_row["record_id"]))
            if related["owner_id"] != user["id"] and related["unit_key"] != user["unidade"]:
                fail(404, "Arquivo não encontrado.")
        file_content = (STORAGE_DIR / file_row["stored_name"]).read_bytes()
        if file_row["is_encrypted"]:
            file_content = storage_cipher().decrypt(file_content)
        audit(connection, request, user, "download", module, file_row["record_id"])
        connection.commit()
        safe_name = file_row["original_name"].replace('"', "_").replace("\r", "_").replace("\n", "_")
        return Response(content=file_content, media_type=file_row["content_type"], headers={"Content-Disposition": f'attachment; filename="{safe_name}"'})

    if parts[0] == "packages" and len(parts) >= 2 and parts[1] == "pickup":
        token = parts[2] if len(parts) > 2 else None
        if not token:
            fail(422, "Token de retirada obrigatório.")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        pickup = connection.execute("SELECT * FROM pickup_tokens WHERE token_hash=?", (token_hash,)).fetchone()
        if pickup is None or pickup["expires_at"] <= now_iso():
            fail(404, "Token inválido, expirado ou já utilizado.")
        if pickup["used_at"]:
            fail(409, "Token de retirada já utilizado.")
        row = connection.execute("SELECT * FROM api_records WHERE id=? AND condominium_id=? AND entity='packages'", (pickup["package_id"], pickup["condominium_id"])).fetchone()
        if row is None:
            fail(404, "Encomenda não encontrada.")
        item = record_dict(row)
        if len(parts) == 3 and method == "GET":
            return {key: item.get(key) for key in ("id", "recipient", "unit", "carrier", "description", "status", "receivedAt")}
        if len(parts) == 4 and parts[3] == "confirm" and method == "POST":
            connection.execute("BEGIN IMMEDIATE")
            fresh = connection.execute("SELECT * FROM pickup_tokens WHERE token_hash=?", (token_hash,)).fetchone()
            payload = json.loads(row["payload"])
            if fresh is None or fresh["used_at"] or fresh["expires_at"] <= now_iso() or payload.get("status", "aguardando retirada") != "aguardando retirada":
                connection.rollback()
                fail(409, "Token utilizado, expirado ou encomenda já retirada.")
            moment = now_iso()
            payload.update({"status": "entregue", "deliveredAt": moment, "deliveredTo": payload.get("recipient", "Retirada via QR")})
            connection.execute("UPDATE api_records SET payload=?,updated_at=? WHERE id=?", (json_payload(payload), moment, row["id"]))
            connection.execute("UPDATE pickup_tokens SET used_at=? WHERE token_hash=? AND used_at IS NULL", (moment, token_hash))
            connection.commit()
            return {"status": "entregue", "deliveredAt": moment}
        fail(404, "Endpoint não encontrado.")

    if parts[:2] == ["financial", "webhooks"] and len(parts) == 3 and method == "POST":
        secret = os.getenv("COGEM_WEBHOOK_SECRET")
        if not secret:
            fail(503, "Webhook financeiro não configurado.")
        if not hmac.compare_digest(request.headers.get("x-cogem-webhook-secret", ""), secret):
            fail(401, "Assinatura de webhook inválida.")
        payload = await body_object(request)
        moment = now_iso()
        connection.execute("INSERT INTO notification_jobs(condominium_id,channel,recipient,payload,status,created_at,updated_at) VALUES('cogem',?,?,?,?,?,?)",
                           (f"financial-webhook:{parts[2]}", "internal", json_payload(payload), "queued", moment, moment))
        connection.commit()
        return {"received": True, "status": "queued"}

    if parts[:2] == ["access", "qr"] and len(parts) == 3 and parts[2] == "validate" and method == "POST":
        user = current_user(request, connection)
        require_module(user, "access")
        data = await body_object(request)
        token = data.get("token")
        if not isinstance(token, str) or not token:
            fail(422, "QR inválido.")
        rows = connection.execute("SELECT * FROM api_records WHERE condominium_id=? AND entity='visitors' ORDER BY id DESC", (user["condominium_id"],)).fetchall()
        visitor = next((record_dict(row) for row in rows if json.loads(row["payload"]).get("qrToken") == token), None)
        if visitor is None or visitor.get("status") != "autorizado" or parse_iso(visitor.get("validFrom")) > datetime.now(timezone.utc) or parse_iso(visitor.get("validUntil")) < datetime.now(timezone.utc):
            return {"valid": False, "authorized": False}
        return {"valid": True, "authorized": True, "visitor": visitor}

    if parts == ["access", "dashboard"] and method == "GET":
        user = current_user(request, connection)
        require_module(user, "access")
        logs = list_records(connection, user, "access-logs", {"limit": 500})
        visitors = list_records(connection, user, "visitors", {"limit": 500})
        return {"entriesToday": sum(1 for row in logs if row.get("direction") == "entrada" and row.get("createdAt", "")[:10] == now_iso()[:10]),
                "inside": sum(1 for row in visitors if row.get("status") == "dentro"), "recent": logs[:20]}

    module_name = parts[0]
    if module_name == "access":
        entity, module = "access-logs", "access"
    elif module_name in ENTITY_MODULES:
        entity, module = module_name, ENTITY_MODULES[module_name]
    else:
        fail(404, "Endpoint não encontrado.")
    subpath = parts[1:]
    user = current_user(request, connection)
    require_module(user, module)

    if user["perfil"] == "resident" and entity == "packages" and method != "GET":
        fail(403, "Moradores não podem alterar operações de encomendas.")

    if user["perfil"] == "resident" and entity in {"announcements", "polls", "assemblies"}:
        resident_actions = {
            "announcements": method == "GET" or (method == "POST" and len(subpath) == 2 and subpath[1] == "read"),
            "polls": method == "GET" or (method == "POST" and len(subpath) == 2 and subpath[1] == "vote"),
            "assemblies": method == "GET" or (method == "POST" and len(subpath) >= 2 and (subpath[1] == "presence" or (len(subpath) == 4 and subpath[1] == "agenda" and subpath[3] == "vote"))),
        }
        if not resident_actions[entity]:
            fail(403, "Moradores podem apenas consultar e participar destas atividades.")

    if entity == "profile" and not subpath:
        if method == "GET":
            return user_dict(user)
        if method == "PATCH":
            data = await body_object(request)
            updates, values = [], []
            if "name" in data:
                updates.append("nome=?")
                values.append(data["name"])
            if "email" in data:
                updates.append("email=?")
                values.append(data["email"].strip().lower())
            if updates:
                try:
                    connection.execute(f"UPDATE usuarios SET {','.join(updates)} WHERE id=?", (*values, user["id"]))
                except sqlite3.IntegrityError:
                    fail(409, "E-mail já cadastrado.")
            audit(connection, request, user, "update_profile", module, user["id"])
            connection.commit()
            return user_dict(connection.execute("SELECT * FROM usuarios WHERE id=?", (user["id"],)).fetchone())

    if entity == "audit" and not subpath and method == "GET":
        rows = connection.execute("SELECT * FROM audit_logs WHERE condominium_id=? ORDER BY id DESC LIMIT 500", (user["condominium_id"],)).fetchall()
        return [dict(row) for row in rows]

    if entity == "users":
        if not subpath and method == "GET":
            users = connection.execute("SELECT * FROM usuarios WHERE condominium_id=? ORDER BY nome", (user["condominium_id"],)).fetchall()
            return [user_dict(item) for item in users]
        if not subpath and method == "POST":
            data = await body_object(request)
            if any(not isinstance(data.get(key), str) or not data[key].strip() for key in ("name", "email", "password", "role", "unit")) or len(data.get("password", "")) < 8:
                fail(422, "Informe nome, e-mail, senha com 8 caracteres, perfil e unidade.")
            if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", data["email"].strip()):
                fail(422, "E-mail inválido.")
            if data["role"] not in ROLE_MODULES or (user["perfil"] == "admin" and data["role"] in {"admin", "manager"}):
                fail(403, "Não é permitido administrar contas de administrador da plataforma.")
            try:
                cursor = connection.execute("INSERT INTO usuarios(nome,email,senha_hash,perfil,unidade,ativo,criado_em,condominium_id) VALUES(?,?,?,?,?,1,?,?)",
                                            (data["name"], data["email"].strip().lower(), password_hash(data["password"]), data["role"], data["unit"], now_iso(), user["condominium_id"]))
            except sqlite3.IntegrityError:
                fail(409, "E-mail já cadastrado.")
            audit(connection, request, user, "create", module, cursor.lastrowid)
            connection.commit()
            return user_dict(connection.execute("SELECT * FROM usuarios WHERE id=?", (cursor.lastrowid,)).fetchone())
        if subpath and subpath[0].isdigit():
            user_id = int(subpath[0])
            target = connection.execute("SELECT * FROM usuarios WHERE id=? AND condominium_id=?", (user_id, user["condominium_id"])).fetchone()
            if target is None:
                fail(404, "Usuário não encontrado.")
            if user["perfil"] == "admin" and target["perfil"] in {"admin", "manager"}:
                fail(403, "Não é permitido administrar contas de administrador da plataforma.")
            tail = subpath[1:]
            if tail == ["status"] and method == "PATCH":
                data = await body_object(request)
                if not isinstance(data.get("active"), bool):
                    fail(422, "Informe active como booleano.")
                connection.execute("UPDATE usuarios SET ativo=? WHERE id=?", (int(data["active"]), user_id))
                audit(connection, request, user, "status", module, user_id)
                connection.commit()
                return user_dict(connection.execute("SELECT * FROM usuarios WHERE id=?", (user_id,)).fetchone())
            if not tail and method == "PATCH":
                data = await body_object(request)
                columns = {"name": "nome", "email": "email", "role": "perfil", "unit": "unidade"}
                updates, values = [], []
                for api_key, column in columns.items():
                    if api_key in data:
                        if api_key == "role" and (data[api_key] not in ROLE_MODULES or (user["perfil"] == "admin" and data[api_key] in {"admin", "manager"})):
                            fail(403, "Perfil inválido ou sem permissão para administrar esse perfil.")
                        updates.append(f"{column}=?")
                        values.append(data[api_key])
                if updates:
                    connection.execute(f"UPDATE usuarios SET {','.join(updates)} WHERE id=?", (*values, user_id))
                audit(connection, request, user, "update", module, user_id)
                connection.commit()
                return user_dict(connection.execute("SELECT * FROM usuarios WHERE id=?", (user_id,)).fetchone())
            if tail == ["permissions"] and method in {"GET", "PUT"}:
                if method == "GET":
                    permissions = json.loads(target["permissions_json"]) if target["permissions_json"] else sorted(ROLE_MODULES[target["perfil"]])
                    return {"userId": user_id, "permissions": permissions}
                data = await body_object(request)
                if not isinstance(data.get("permissions"), list) or any(not isinstance(value, str) for value in data["permissions"]):
                    fail(422, "permissions deve ser uma lista de módulos.")
                baseline = ROLE_MODULES[target["perfil"]]
                permitted = set(ENTITY_MODULES.values())
                if any(value not in permitted for value in data["permissions"]) or ("*" not in baseline and not set(data["permissions"]).issubset(baseline)):
                    fail(422, "Permissões não podem exceder os módulos do perfil.")
                connection.execute("UPDATE usuarios SET permissions_json=? WHERE id=?", (json_payload(data["permissions"]), user_id))
                audit(connection, request, user, "permissions", module, user_id)
                connection.commit()
                return {"userId": user_id, "permissions": data["permissions"]}
            if tail == ["face"] and method == "DELETE":
                files = connection.execute("SELECT stored_name FROM storage_files WHERE condominium_id=? AND module='users' AND record_id=?", (user["condominium_id"], str(user_id))).fetchall()
                for file in files:
                    (STORAGE_DIR / file["stored_name"]).unlink(missing_ok=True)
                connection.execute("DELETE FROM storage_files WHERE condominium_id=? AND module='users' AND record_id=?", (user["condominium_id"], str(user_id)))
                audit(connection, request, user, "delete_face", module, user_id)
                connection.commit()
                return {"deleted": True}
            if tail == ["face"] and method == "POST":
                return await save_upload(request, connection, user, "users", user_id, biometric=True)

    if entity == "settings" and not subpath:
        if method == "GET":
            row = connection.execute("SELECT payload FROM api_records WHERE condominium_id=? AND entity='settings' ORDER BY id DESC LIMIT 1", (user["condominium_id"],)).fetchone()
            return json.loads(row["payload"]) if row else {}
        if method == "PUT":
            data = await body_object(request)
            existing = connection.execute("SELECT id FROM api_records WHERE condominium_id=? AND entity='settings' ORDER BY id DESC LIMIT 1", (user["condominium_id"],)).fetchone()
            record_id = save_record(connection, user, "settings", data, existing["id"] if existing else None)
            audit(connection, request, user, "update", module, record_id)
            connection.commit()
            return data

    if entity == "packages" and subpath and subpath[0].isdigit():
        package_id = int(subpath[0])
        row = record_row(connection, user, "packages", package_id)
        package = record_dict(row)
        tail = subpath[1:]
        if tail == ["deliver"] and method == "PATCH":
            data = await body_object(request)
            if not data.get("deliveredTo"):
                fail(422, "Informe deliveredTo.")
            connection.execute("BEGIN IMMEDIATE")
            payload = json.loads(record_row(connection, user, "packages", package_id)["payload"])
            if payload.get("status", "aguardando retirada") != "aguardando retirada":
                connection.rollback()
                fail(409, "Encomenda já retirada.")
            payload.update({"status": "entregue", "deliveredAt": now_iso(), "deliveredTo": data["deliveredTo"]})
            save_record(connection, user, "packages", payload, package_id)
            audit(connection, request, user, "deliver", module, package_id)
            connection.commit()
            return record_dict(record_row(connection, user, "packages", package_id))
        if tail == ["notifications"] and method == "POST":
            data = await body_object(request, required=False)
            channels = data.get("channels", ["email", "whatsapp"])
            if not isinstance(channels, list) or any(channel not in {"email", "whatsapp"} for channel in channels):
                fail(422, "Canais aceitos: email e whatsapp.")
            for channel in channels:
                queue_notification(connection, user["condominium_id"], channel, package.get("unit", ""), {"type": "package", "packageId": package_id})
            audit(connection, request, user, "notify", module, package_id)
            connection.commit()
            return {"status": "queued", "channels": channels}
        if tail == ["comments"] and method == "POST":
            data = await body_object(request)
            if not data.get("body"):
                fail(422, "Informe body do comentário.")
            package.setdefault("comments", []).append({"userId": user["id"], "author": user["nome"], "body": data["body"], "createdAt": now_iso()})
            save_record(connection, user, "packages", package, package_id)
            audit(connection, request, user, "comment", module, package_id)
            connection.commit()
            return package["comments"][-1]
        if tail == ["label"] and method == "GET":
            return {key: package.get(key) for key in ("id", "recipient", "unit", "carrier", "tracking", "receivedAt", "status")}
        if tail == ["audit"] and method == "GET":
            if user["perfil"] == "resident":
                fail(403, "Permissão insuficiente.")
            rows = connection.execute("SELECT * FROM audit_logs WHERE condominium_id=? AND module='packages' AND record_id=? ORDER BY id", (user["condominium_id"], str(package_id))).fetchall()
            return [dict(item) for item in rows]
        if not tail and method == "GET":
            return package

    if entity == "inventory" and subpath and subpath[0].isdigit() and subpath[1:] == ["movements"] and method == "POST":
        item_id = int(subpath[0])
        data = await body_object(request)
        delta = data.get("delta")
        if delta is None:
            amount, movement = data.get("amount"), data.get("movement")
            delta = amount if movement == "entrada" else -amount if movement == "saída" else None
        if not isinstance(delta, (int, float)) or delta == 0 or not data.get("reason"):
            fail(422, "Informe delta diferente de zero e reason.")
        if isinstance(delta, bool) or not math.isfinite(float(delta)):
            fail(422, "delta precisa ser um número finito.")
        connection.execute("BEGIN IMMEDIATE")
        row = record_row(connection, user, "inventory", item_id)
        payload = json.loads(row["payload"])
        quantity = payload.get("quantity", 0) + delta
        if quantity < 0:
            connection.rollback()
            fail(409, "Movimentação deixaria o estoque negativo.")
        payload.update({"quantity": quantity, "updatedAt": now_iso()})
        save_record(connection, user, "inventory", payload, item_id)
        movement = {"itemId": item_id, "delta": delta, "reason": data["reason"], "operatorId": user["id"], "createdAt": now_iso()}
        save_record(connection, user, "inventory_movements", movement)
        audit(connection, request, user, "movement", module, item_id, details=movement)
        connection.commit()
        return record_dict(record_row(connection, user, "inventory", item_id))

    if entity == "events" and subpath and subpath[0].isdigit() and subpath[1:] == ["cancel"] and method == "PATCH":
        event_id = int(subpath[0])
        row = record_row(connection, user, entity, event_id)
        payload = json.loads(row["payload"])
        payload["status"] = "cancelada"
        save_record(connection, user, entity, payload, event_id)
        audit(connection, request, user, "cancel", module, event_id)
        connection.commit()
        return record_dict(record_row(connection, user, entity, event_id))

    if entity in {"polls", "assemblies"} and subpath and subpath[0].isdigit():
        record_id = int(subpath[0])
        row = record_row(connection, user, entity, record_id)
        payload = json.loads(row["payload"])
        tail = subpath[1:]
        poll_vote = entity == "polls" and tail == ["vote"] and method == "POST"
        assembly_vote = entity == "assemblies" and len(tail) == 3 and tail[0] == "agenda" and tail[2] == "vote" and method == "POST"
        if poll_vote or assembly_vote:
            data = await body_object(request)
            choice = data.get("choice", data.get("option"))
            if assembly_vote and not tail[1].isdigit():
                fail(422, "agendaIndex deve ser numérico.")
            if payload.get("status", "open") in {"closed", "encerrada", "fechada"}:
                fail(409, "Votação encerrada.")
            if entity == "polls" and choice not in payload.get("options", []):
                fail(422, "Opção de voto inválida.")
            agenda_index = int(tail[1]) if assembly_vote and tail[1].isdigit() else 0
            if assembly_vote:
                agenda = payload.get("agenda", [])
                if agenda_index >= len(agenda):
                    fail(404, "Item de pauta não encontrado.")
                choices = agenda[agenda_index].get("options", agenda[agenda_index].get("choices", []))
                if choices and choice not in choices:
                    fail(422, "Opção de voto inválida.")
            try:
                connection.execute("INSERT INTO api_votes(condominium_id,vote_type,poll_id,voter_id,choice,created_at) VALUES(?,?,?,?,?,?)",
                                   (user["condominium_id"], entity, record_id * 10000 + agenda_index, user["id"], str(choice), now_iso()))
            except sqlite3.IntegrityError:
                fail(409, "Voto duplicado.")
            audit(connection, request, user, "vote", module, record_id, details={"choice": choice})
            connection.commit()
            return {"accepted": True}
        if (entity == "polls" and tail == ["close"] and method == "PATCH") or (entity == "assemblies" and tail == ["close"] and method == "POST"):
            payload["status"] = "closed"
            payload["closedAt"] = now_iso()
            save_record(connection, user, entity, payload, record_id)
            audit(connection, request, user, "close", module, record_id)
            connection.commit()
            return record_dict(record_row(connection, user, entity, record_id))
        if entity == "assemblies" and tail == ["presence"] and method == "POST":
            data = await body_object(request, required=False)
            presence = {"userId": user["id"], "unit": user["unidade"], "present": data.get("present", True), "createdAt": now_iso()}
            payload.setdefault("presence", {})[str(user["id"])] = presence
            save_record(connection, user, entity, payload, record_id)
            connection.commit()
            return presence
        if entity == "assemblies" and tail == ["quorum"] and method == "GET":
            attendees = list(payload.get("presence", {}).values())
            present = sum(1 for item in attendees if item.get("present"))
            total = connection.execute("SELECT count(*) FROM usuarios WHERE condominium_id=? AND perfil='resident' AND ativo=1", (user["condominium_id"],)).fetchone()[0]
            return {"present": present, "total": total, "percentage": round(present / total * 100, 2) if total else 0}
        if entity == "assemblies" and tail == ["minutes"] and method == "GET":
            return payload.get("minutes", {"assemblyId": record_id, "status": payload.get("status"), "votes": []})

    if entity == "vehicles" and subpath and subpath[0].isdigit() and subpath[1:] == ["movements"] and method == "POST":
        vehicle_id = int(subpath[0])
        data = await body_object(request)
        direction = str(data.get("direction", "")).strip().casefold()
        direction_aliases = {"entrada": "entrada", "entry": "entrada", "in": "entrada", "saída": "saída", "saida": "saída", "exit": "saída", "out": "saída"}
        if direction not in direction_aliases:
            fail(422, "direction inválida.")
        direction = direction_aliases[direction]
        connection.execute("BEGIN IMMEDIATE")
        row = record_row(connection, user, "vehicles", vehicle_id)
        payload = json.loads(row["payload"])
        inside = payload.get("inside", payload.get("status") == "dentro")
        entering = direction == "entrada"
        if inside == entering:
            connection.rollback()
            fail(409, "Veículo já está dentro." if entering else "Veículo não está dentro.")
        payload.update({"inside": entering, "status": "dentro" if entering else "fora", "lastMovementAt": now_iso()})
        movement = {"vehicleId": vehicle_id, "direction": direction, "createdAt": now_iso(), "registeredBy": user["id"]}
        save_record(connection, user, "vehicles", payload, vehicle_id)
        save_record(connection, user, "vehicle-movements", movement)
        audit(connection, request, user, "movement", module, vehicle_id, details=movement)
        connection.commit()
        return record_dict(record_row(connection, user, "vehicles", vehicle_id))

    if entity == "work-orders" and subpath and subpath[0].isdigit():
        work_id = int(subpath[0])
        row = record_row(connection, user, entity, work_id)
        payload = json.loads(row["payload"])
        if subpath[1:] == ["status"] and method == "PATCH":
            data = await body_object(request)
            if not data.get("status"):
                fail(422, "Informe status.")
            payload["status"] = data["status"]
            save_record(connection, user, entity, payload, work_id)
            audit(connection, request, user, "status", module, work_id)
            connection.commit()
            return record_dict(record_row(connection, user, entity, work_id))
        if subpath[1:] == ["checklist"] and method == "POST":
            data = await body_object(request)
            payload.setdefault("checklist", []).append({**data, "completedBy": user["id"], "createdAt": now_iso()})
            save_record(connection, user, entity, payload, work_id)
            connection.commit()
            return payload["checklist"][-1]

    if entity == "announcements" and subpath and subpath[0].isdigit():
        record_id = int(subpath[0])
        row = record_row(connection, user, entity, record_id)
        payload = json.loads(row["payload"])
        if subpath[1:] == ["read"] and method == "POST":
            payload.setdefault("readBy", {})[str(user["id"])] = now_iso()
            save_record(connection, user, entity, payload, record_id)
            connection.commit()
            return {"read": True}
        if subpath[1:] == ["audience-status"] and method == "GET":
            if user["perfil"] == "resident":
                fail(403, "Permissão insuficiente.")
            return {"read": len(payload.get("readBy", {})), "audience": payload.get("audience", "all"), "readBy": payload.get("readBy", {})}

    if entity == "documents" and subpath and subpath[0].isdigit() and subpath[1:] == ["download"] and method == "GET":
        document = record_dict(record_row(connection, user, entity, int(subpath[0])))
        if not document.get("fileId"):
            fail(404, "Arquivo não encontrado.")
        file_row = connection.execute("SELECT * FROM storage_files WHERE id=? AND condominium_id=? AND module='documents' AND record_id=?", (document["fileId"], user["condominium_id"], str(subpath[0]))).fetchone()
        if file_row is None:
            fail(404, "Arquivo não encontrado.")
        file_path = STORAGE_DIR / file_row["stored_name"]
        content = file_path.read_bytes()
        if file_row["is_encrypted"]:
            content = storage_cipher().decrypt(content)
        return Response(content=content, media_type=file_row["content_type"], headers={"Content-Disposition": f'attachment; filename="{file_row["original_name"]}"'})

    if entity == "charges" and subpath and subpath[0].isdigit() and subpath[1:] in (["pix"], ["boleto"]) and method == "POST":
        charge_id = int(subpath[0])
        record_row(connection, user, entity, charge_id)
        data = await body_object(request, required=False)
        channel = subpath[1]
        queue_notification(connection, user["condominium_id"], f"payment:{channel}", str(charge_id), {"chargeId": charge_id, "provider": data.get("provider"), "requestedAt": now_iso()})
        audit(connection, request, user, f"create_{channel}", module, charge_id)
        connection.commit()
        return {"status": "queued", "providerStatus": "not_configured", "chargeId": charge_id}

    if entity == "financial" and subpath in (["summary"], ["reconciliation"]) and method == "GET":
        records = list_records(connection, user, "charges", {"limit": 500})
        if subpath == ["summary"]:
            return {"count": len(records), "total": sum(float(item.get("amount", 0)) for item in records), "pending": sum(float(item.get("amount", 0)) for item in records if item.get("status", "pending") == "pending")}
        return {"items": records, "status": "provider_not_configured"}

    if entity == "meter-readings" and subpath == ["consumption"] and method == "GET":
        records = list_records(connection, user, entity, {"limit": 500})
        consumption = {}
        for item in records:
            meter = item.get("meterId")
            consumption[meter] = consumption.get(meter, 0) + float(item.get("consumption", 0))
        return {"consumption": consumption, "readings": len(records)}

    if entity == "access-logs" and not subpath and method == "POST":
        data = await body_object(request)
        kind = str(data.get("kind", "")).strip().casefold()
        if kind in {"vehicle", "veiculo", "veículo", "carro", "car"}:
            direction = data.get("direction")
            if direction not in {"entrada", "saída", "entry", "exit", "saida"}:
                fail(422, "Direção de movimentação de veículo inválida.")
            entering = direction in {"entrada", "entry"}
            plate = str(data.get("plate", data.get("person", ""))).replace("-", "").replace(" ", "").upper()
            connection.execute("BEGIN IMMEDIATE")
            vehicles = connection.execute("SELECT * FROM api_records WHERE condominium_id=? AND entity='vehicles'", (user["condominium_id"],)).fetchall()
            vehicle_row = next((item for item in vehicles if str(json.loads(item["payload"]).get("plate", "")).replace("-", "").replace(" ", "").upper() == plate), None)
            if vehicle_row is None:
                connection.rollback()
                fail(404, "Veículo não cadastrado.")
            vehicle = record_dict(vehicle_row)
            inside = vehicle.get("inside", vehicle.get("status") == "dentro")
            if inside == entering:
                connection.rollback()
                fail(409, "Veículo já está dentro." if entering else "Veículo não está dentro.")
            vehicle.update({"inside": entering, "status": "dentro" if entering else "fora", "lastMovementAt": now_iso()})
            save_record(connection, user, "vehicles", vehicle, vehicle_row["id"])
            save_record(connection, user, "vehicle-movements", {"vehicleId": vehicle_row["id"], "direction": "entrada" if entering else "saída", "createdAt": now_iso(), "registeredBy": user["id"]})
        record_id = save_record(connection, user, entity, data)
        audit(connection, request, user, "create", module, record_id)
        connection.commit()
        return {**data, "id": record_id, "createdAt": now_iso()}

    if not subpath and method == "GET":
        return list_records(connection, user, entity, dict(request.query_params))
    if not subpath and method == "POST":
        data = await body_object(request)
        validate_payload(entity, data)
        if entity == "packages":
            data["status"] = "aguardando retirada"
            data["receivedAt"] = now_iso()
            data["receivedBy"] = user["nome"]
        if entity == "occurrences":
            data["status"] = "em aberto"
            data.setdefault("type", "comum")
            data["reporter"] = user["nome"]
        if entity == "visitors":
            data["status"] = "autorizado"
            data["qrToken"] = secrets.token_urlsafe(24)
        if entity == "events":
            data["status"] = "confirmada"
            connection.execute("BEGIN IMMEDIATE")
            existing = list_records(connection, user, entity, {"limit": 500})
            conflict = any(item.get("space") == data["space"] and item.get("status", "confirmada") == "confirmada" and parse_iso(item["startsAt"]) < parse_iso(data["endsAt"]) and parse_iso(item["endsAt"]) > parse_iso(data["startsAt"]) for item in existing)
            if conflict:
                connection.rollback()
                fail(409, "Já existe uma reserva nesse espaço e horário.")
        if entity == "polls":
            data["status"] = "open"
            data["votes"] = {}
        if entity == "vehicles":
            connection.execute("BEGIN IMMEDIATE")
            vehicles = list_records(connection, user, "vehicles", {"limit": 500})
            if any(str(item.get("plate", "")).replace("-", "").upper() == str(data["plate"]).replace("-", "").upper() for item in vehicles):
                connection.rollback()
                fail(409, "Placa já cadastrada.")
            data["inside"] = False
            data["status"] = "fora"
        if entity == "inventory":
            connection.execute("BEGIN IMMEDIATE")
            items = list_records(connection, user, "inventory", {"limit": 500})
            if any(str(item.get("sku", "")).casefold() == str(data["sku"]).casefold() for item in items):
                connection.rollback()
                fail(409, "SKU já cadastrado.")
            data.setdefault("minimum", 0)
        if entity == "keys":
            connection.execute("BEGIN IMMEDIATE")
            keys = list_records(connection, user, "keys", {"limit": 500})
            if any(str(item.get("code", "")).casefold() == str(data["code"]).casefold() for item in keys):
                connection.rollback()
                fail(409, "Código de chave já cadastrado.")
            data["status"] = "disponível"
        if entity == "charges":
            data["status"] = "pending"
        if entity == "work-orders":
            data["status"] = "open"
        if entity == "documents" and user["perfil"] == "maintenance":
            data["visibility"] = "technical"
            data["category"] = "technical"
        record_id = save_record(connection, user, entity, data)
        pickup_token = None
        if entity == "packages":
            pickup_token, pickup_expires = issue_pickup_token(connection, user["condominium_id"], record_id)
        audit(connection, request, user, "create", module, record_id)
        connection.commit()
        response = record_dict(record_row(connection, user, entity, record_id))
        if pickup_token:
            response.update({"pickupToken": pickup_token, "pickupTokenExpiresAt": pickup_expires})
        return response

    if subpath and subpath[0].isdigit():
        record_id = int(subpath[0])
        row = record_row(connection, user, entity, record_id)
        tail = subpath[1:]
        if tail == ["attachments"] and method == "POST":
            return await save_upload(request, connection, user, entity, record_id)
        if tail == ["versions"] and entity == "documents" and method == "POST":
            data = await body_object(request)
            current = record_dict(row)
            current.setdefault("versions", []).append({**data, "version": len(current.get("versions", [])) + 1, "createdAt": now_iso(), "createdBy": user["id"]})
            save_record(connection, user, entity, current, record_id)
            connection.commit()
            return current["versions"][-1]
        if tail == ["visibility"] and entity == "documents" and method == "PATCH":
            if user["perfil"] == "maintenance":
                fail(403, "Somente gestores podem alterar a visibilidade de documentos.")
            data = await body_object(request)
            if "visibility" not in data:
                fail(422, "Informe visibility.")
            current = record_dict(row)
            current["visibility"] = data["visibility"]
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "visibility", module, record_id)
            connection.commit()
            return current
        if (tail == ["entry"] and entity == "visitors" and method == "PATCH") or (tail == ["exit"] and entity == "visitors" and method == "PATCH"):
            connection.execute("BEGIN IMMEDIATE")
            current = record_row(connection, user, entity, record_id)
            visitor = record_dict(current)
            entering = tail == ["entry"]
            if entering and visitor.get("status") != "autorizado":
                connection.rollback()
                fail(409, "Visitante não está autorizado para entrada.")
            if not entering and visitor.get("status") != "dentro":
                connection.rollback()
                fail(409, "Visitante não está registrado dentro.")
            moment = now_iso()
            if entering and (parse_iso(visitor["validFrom"]) > datetime.now(timezone.utc) or parse_iso(visitor["validUntil"]) < datetime.now(timezone.utc)):
                connection.rollback()
                fail(409, "A autorização está fora do período de validade.")
            visitor.update({"status": "dentro" if entering else "finalizado", "enteredAt": moment if entering else visitor.get("enteredAt"), "exitedAt": None if entering else moment})
            save_record(connection, user, entity, visitor, record_id)
            save_record(connection, user, "access-logs", {"person": visitor.get("name"), "unit": visitor.get("unit"), "kind": visitor.get("type"), "direction": "entrada" if entering else "saída", "authorizedBy": visitor.get("resident"), "registeredBy": user["nome"]})
            audit(connection, request, user, "entry" if entering else "exit", module, record_id)
            connection.commit()
            return visitor
        if (tail == ["checkout"] and entity == "keys" and method == "PATCH") or (tail == ["return"] and entity == "keys" and method == "PATCH"):
            connection.execute("BEGIN IMMEDIATE")
            current = record_dict(record_row(connection, user, entity, record_id))
            checkout = tail == ["checkout"]
            invalid_state = current.get("status", "disponível") != "disponível" if checkout else current.get("status") != "retirada"
            if invalid_state:
                connection.rollback()
                fail(409, "Estado da chave não permite essa operação.")
            data = await body_object(request, required=checkout)
            current.update({"status": "retirada" if checkout else "disponível", "holder": data.get("holder", "") if checkout else "", "purpose": data.get("purpose", "") if checkout else "", "checkedOutAt": now_iso() if checkout else None, "expectedReturn": data.get("expectedReturn") if checkout else None})
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "checkout" if checkout else "return", module, record_id)
            connection.commit()
            return current
        if tail == ["status"] and method == "PATCH" and entity in {"occurrences", "moves"}:
            if user["perfil"] == "resident":
                fail(403, "Moradores não podem alterar o status.")
            data = await body_object(request)
            current = record_dict(row)
            if not data.get("status"):
                fail(422, "Informe status.")
            if entity == "occurrences":
                transitions = {
                    "comum": {"em aberto": {"em andamento"}, "em andamento": {"concluída", "incompleta"}, "incompleta": {"em andamento"}, "concluída": set()},
                    "urgente": {"em aberto": {"em andamento"}, "em andamento": {"resolvida"}, "resolvida": set()},
                }
                if data["status"] not in transitions.get(current.get("type", "comum"), {}).get(current.get("status", "em aberto"), set()):
                    fail(409, "Transição de status inválida.")
            current.update({"status": data["status"], "updatedAt": now_iso()})
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "status", module, record_id)
            connection.commit()
            return current
        if not tail and method == "GET":
            return record_dict(row)
        if not tail and method == "PATCH":
            data = await body_object(request)
            if user["perfil"] == "resident" and "status" in data:
                fail(403, "Moradores não podem alterar o status da ocorrência.")
            protected_fields = {
                "occurrences": {"status"}, "packages": {"status", "deliveredAt", "deliveredTo"},
                "inventory": {"quantity"}, "keys": {"status", "holder", "checkedOutAt"},
                "visitors": {"status", "enteredAt", "exitedAt"}, "vehicles": {"status", "inside"},
                "polls": {"status", "votes"}, "assemblies": {"status", "votes", "presence"},
                "work-orders": {"status"}, "charges": {"status", "paidAt"}, "events": {"status"},
            }
            if protected_fields.get(entity, set()).intersection(data):
                fail(422, "Use o endpoint de operação dedicado para alterar o estado deste registro.")
            current = record_dict(row)
            current.update(data)
            validate_payload(entity, current)
            if entity == "events":
                connection.execute("BEGIN IMMEDIATE")
                events = list_records(connection, user, "events", {"limit": 500})
                conflict = any(item["id"] != record_id and item.get("space") == current["space"] and item.get("status", "confirmada") == "confirmada" and parse_iso(item["startsAt"]) < parse_iso(current["endsAt"]) and parse_iso(item["endsAt"]) > parse_iso(current["startsAt"]) for item in events)
                if conflict:
                    connection.rollback()
                    fail(409, "Já existe uma reserva nesse espaço e horário.")
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "update", module, record_id)
            connection.commit()
            return record_dict(record_row(connection, user, entity, record_id))

    fail(404, "Endpoint não encontrado.")


async def save_upload(request, connection, user, module, record_id, biometric=False):
    cipher = storage_cipher()
    request_type = request.headers.get("content-type", "application/octet-stream")
    if request_type.startswith("multipart/form-data"):
        form = await request.form()
        uploaded = form.get("file")
        if uploaded is None or not hasattr(uploaded, "read"):
            fail(422, "Envie o arquivo no campo 'file'.")
        body = await uploaded.read(MAX_UPLOAD_BYTES + 1)
        content_type = uploaded.content_type or "application/octet-stream"
        name = uploaded.filename or "upload"
    else:
        body = await read_limited_body(request, MAX_UPLOAD_BYTES, "Arquivo maior que 10 MB.")
        content_type = request_type.split(";", 1)[0]
        name = request.headers.get("x-file-name", "upload")
    if not body or len(body) > MAX_UPLOAD_BYTES:
        fail(413, "Arquivo vazio ou maior que 10 MB.")
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        fail(415, "Tipo de arquivo não permitido.")
    if biometric and not content_type.startswith("image/"):
        fail(415, "Biometria deve ser enviada como imagem.")
    suffix = Path(name).suffix[:12]
    stored_name = f"{secrets.token_urlsafe(24)}{suffix}"
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    encrypted_body = cipher.encrypt(body)
    (STORAGE_DIR / stored_name).write_bytes(encrypted_body)
    cursor = connection.execute("""INSERT INTO storage_files(condominium_id,owner_id,module,record_id,original_name,stored_name,content_type,size_bytes,created_at)
                                  VALUES(?,?,?,?,?,?,?,?,?)""",
                               (user["condominium_id"], user["id"], module, str(record_id), Path(name).name, stored_name, content_type, len(body), now_iso()))
    if module in {"documents", "work-orders", "packages", "occurrences", "vehicles", "access-logs"}:
        row = record_row(connection, user, module, record_id)
        payload = record_dict(row)
        payload.setdefault("attachments", []).append({"fileId": cursor.lastrowid, "name": Path(name).name, "contentType": content_type, "size": len(body)})
        if module == "documents" and not payload.get("fileId"):
            payload["fileId"] = cursor.lastrowid
        save_record(connection, user, module, payload, record_id)
    if content_type.startswith("image/"):
        channel = "biometric-processing" if biometric else "image-processing"
        queue_notification(connection, user["condominium_id"], channel, str(cursor.lastrowid), {"fileId": cursor.lastrowid, "module": module, "recordId": record_id})
    audit(connection, request, user, "upload", module, record_id, details={"fileId": cursor.lastrowid, "bytes": len(body), "encrypted": True})
    connection.commit()
    return {"id": cursor.lastrowid, "name": Path(name).name, "status": "stored"}
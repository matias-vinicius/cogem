import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from database.connection import get_db, raiz

router = APIRouter(prefix="/api")
TOKEN_SECRET = os.getenv("COGEM_TOKEN_SECRET", "cogem-alpha-change-me")
STORAGE_DIR = raiz / "uploads" / "private"
TOKEN_TTL_SECONDS = 60 * 60 * 12
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

ROLE_MODULES = {
    "admin": {"occurrences", "packages", "logbook", "keys", "visitors", "access-logs", "access", "vehicles", "inventory", "events", "announcements", "work-orders", "maintenance-schedules", "documents", "users", "settings", "help", "profile"},
    "manager": {"*"},
    "concierge": {"occurrences", "packages", "logbook", "keys", "visitors", "vehicles", "access-logs", "access", "events", "announcements", "help", "profile"},
    "maintenance": {"occurrences", "logbook", "inventory", "work-orders", "maintenance-schedules", "documents", "help", "profile"},
    "resident": {"packages", "occurrences", "help", "profile", "announcements", "polls", "events", "pets", "moves"},
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
}

REQUIRED_FIELDS = {
    "occurrences": ("title", "description"), "packages": ("recipient", "unit", "carrier"),
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


def json_payload(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def fail(status: int, message: str):
    raise HTTPException(status_code=status, detail=message)


def password_hash(password: str):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240000)
    return f"{base64.urlsafe_b64encode(salt).decode()}${base64.urlsafe_b64encode(digest).decode()}"


def verify_password(password: str, stored: str):
    try:
        salt_text, digest_text = stored.split("$", 1)
        salt = base64.urlsafe_b64decode(salt_text.encode())
        digest = base64.urlsafe_b64decode(digest_text.encode())
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240000)
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
    allowed = ROLE_MODULES.get(user["perfil"], set())
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
        value = await request.json()
    except (ValueError, json.JSONDecodeError):
        fail(400, "JSON inválido.")
    if not isinstance(value, dict):
        fail(422, "O corpo deve ser um objeto JSON.")
    return value


def validate_payload(entity: str, payload: dict):
    missing = [field for field in REQUIRED_FIELDS.get(entity, ()) if payload.get(field) in (None, "")]
    if missing:
        fail(422, f"Campos obrigatórios: {', '.join(missing)}.")
    if entity == "inventory" and (not isinstance(payload.get("quantity"), (int, float)) or payload["quantity"] < 0):
        fail(422, "A quantidade deve ser um número não negativo.")
    if entity == "events" and (not isinstance(payload.get("startsAt"), str) or not isinstance(payload.get("endsAt"), str) or payload["endsAt"] <= payload["startsAt"]):
        fail(422, "O término precisa ser posterior ao início.")
    if entity == "visitors" and payload["validUntil"] <= payload["validFrom"]:
        fail(422, "A validade final precisa ser posterior à inicial.")
    if entity == "polls" and (not isinstance(payload["options"], list) or len(payload["options"]) < 2):
        fail(422, "A enquete precisa ter ao menos duas opções.")
    if entity == "charges" and (not isinstance(payload["amount"], (int, float)) or payload["amount"] <= 0):
        fail(422, "O valor da cobrança precisa ser positivo.")


def record_row(connection, user, entity, record_id, include_resident=True):
    row = connection.execute("SELECT * FROM api_records WHERE id = ? AND condominium_id = ? AND entity = ?", (record_id, user["condominium_id"], entity)).fetchone()
    if row is None:
        fail(404, "Registro não encontrado.")
    if include_resident and user["perfil"] == "resident" and row["owner_id"] != user["id"] and row["unit_key"] != user["unidade"]:
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
    if user["perfil"] == "resident":
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
    page = max(1, int(filters.get("page", 1)))
    limit = max(1, min(500, int(filters.get("limit", 100))))
    return result[(page - 1) * limit:page * limit]


def queue_notification(connection, condominium_id, channel, recipient, payload):
    moment = now_iso()
    connection.execute("""INSERT INTO notification_jobs(condominium_id,channel,recipient,payload,status,created_at,updated_at)
                          VALUES(?,?,?,?, 'queued', ?, ?)""",
                       (condominium_id, channel, str(recipient), json_payload(payload), moment, moment))


def issue_pickup_token(connection, condominium_id, package_id):
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(timespec="seconds")
    connection.execute("INSERT INTO pickup_tokens(token_hash,condominium_id,package_id,expires_at) VALUES(?,?,?,?)",
                       (token_hash, condominium_id, package_id, expires))
    return token, expires


@router.post("/auth/login")
async def login(data: LoginBody, request: Request, connection=Depends(get_db)):
    row = connection.execute("SELECT * FROM usuarios WHERE lower(email)=lower(?)", (data.email.strip(),)).fetchone()
    if row is None or not verify_password(data.password, row["senha_hash"]):
        fail(401, "E-mail ou senha incorretos.")
    if not row["ativo"]:
        fail(403, "Este usuário está desativado.")
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
    if parts[:2] == ["access", "facial"]:
        fail(503, "Provedor de biometria não configurado.")

    if parts[0] == "packages" and len(parts) >= 2 and parts[1] == "pickup":
        token = parts[2] if len(parts) > 2 else None
        if not token:
            fail(422, "Token de retirada obrigatório.")
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        pickup = connection.execute("SELECT * FROM pickup_tokens WHERE token_hash=?", (token_hash,)).fetchone()
        if pickup is None or pickup["used_at"] or pickup["expires_at"] <= now_iso():
            fail(404, "Token inválido, expirado ou já utilizado.")
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
        if visitor is None or visitor.get("status") != "autorizado" or visitor.get("validUntil", "") < now_iso():
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

    if entity == "users":
        if not subpath and method == "GET":
            users = connection.execute("SELECT * FROM usuarios WHERE condominium_id=? ORDER BY nome", (user["condominium_id"],)).fetchall()
            return [user_dict(item) for item in users]
        if not subpath and method == "POST":
            data = await body_object(request)
            if any(not data.get(key) for key in ("name", "email", "password", "role", "unit")) or len(data["password"]) < 8:
                fail(422, "Informe nome, e-mail, senha com 8 caracteres, perfil e unidade.")
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
                    row = connection.execute("SELECT payload FROM api_records WHERE condominium_id=? AND entity='user_permissions' AND unit_key=? ORDER BY id DESC LIMIT 1", (user["condominium_id"], str(user_id))).fetchone()
                    return json.loads(row["payload"]) if row else {"userId": user_id, "permissions": sorted(ROLE_MODULES[target["perfil"]])}
                data = await body_object(request)
                if not isinstance(data.get("permissions"), list) or any(not isinstance(value, str) for value in data["permissions"]):
                    fail(422, "permissions deve ser uma lista de módulos.")
                data["userId"] = user_id
                existing = connection.execute("SELECT id FROM api_records WHERE condominium_id=? AND entity='user_permissions' AND unit_key=? ORDER BY id DESC LIMIT 1", (user["condominium_id"], str(user_id))).fetchone()
                save_record(connection, user, "user_permissions", data, existing["id"] if existing else None)
                audit(connection, request, user, "permissions", module, user_id)
                connection.commit()
                return data
            if tail == ["face"] and method == "DELETE":
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
            if payload.get("status", "open") in {"closed", "encerrada", "fechada"}:
                fail(409, "Votação encerrada.")
            if entity == "polls" and choice not in payload.get("options", []):
                fail(422, "Opção de voto inválida.")
            agenda_index = int(tail[1]) if assembly_vote else 0
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
            return {"present": sum(1 for item in attendees if item.get("present")), "total": len(attendees)}
        if entity == "assemblies" and tail == ["minutes"] and method == "GET":
            return payload.get("minutes", {"assemblyId": record_id, "status": payload.get("status"), "votes": []})

    if entity == "vehicles" and subpath and subpath[0].isdigit() and subpath[1:] == ["movements"] and method == "POST":
        vehicle_id = int(subpath[0])
        data = await body_object(request)
        direction = data.get("direction")
        if direction not in {"entrada", "saída", "entry", "exit"}:
            fail(422, "direction inválida.")
        row = record_row(connection, user, "vehicles", vehicle_id)
        payload = json.loads(row["payload"])
        inside = payload.get("inside", payload.get("status") == "dentro")
        entering = direction in {"entrada", "entry"}
        if inside == entering:
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
        file_row = connection.execute("SELECT * FROM storage_files WHERE id=? AND condominium_id=?", (document["fileId"], user["condominium_id"])).fetchone()
        if file_row is None:
            fail(404, "Arquivo não encontrado.")
        return FileResponse(STORAGE_DIR / file_row["stored_name"], filename=file_row["original_name"], media_type=file_row["content_type"])

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
            data.setdefault("status", "aguardando retirada")
            data["receivedAt"] = now_iso()
            data["receivedBy"] = user["nome"]
        if entity == "occurrences":
            data.setdefault("status", "em aberto")
            data.setdefault("type", "comum")
            data["reporter"] = user["nome"]
        if entity == "visitors":
            data.setdefault("status", "autorizado")
            data["qrToken"] = secrets.token_urlsafe(24)
        if entity == "events":
            data.setdefault("status", "confirmada")
            connection.execute("BEGIN IMMEDIATE")
            existing = list_records(connection, user, entity, {"limit": 500})
            conflict = any(item.get("space") == data["space"] and item.get("status", "confirmada") == "confirmada" and item.get("startsAt", "") < data["endsAt"] and item.get("endsAt", "") > data["startsAt"] for item in existing)
            if conflict:
                connection.rollback()
                fail(409, "Já existe uma reserva nesse espaço e horário.")
        if entity == "polls":
            data.setdefault("status", "open")
            data.setdefault("votes", {})
        if entity == "vehicles":
            data.setdefault("inside", False)
            data.setdefault("status", "fora")
        if entity == "inventory":
            data.setdefault("minimum", 0)
        if entity == "charges":
            data.setdefault("status", "pending")
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
            visitor = record_dict(row)
            entering = tail == ["entry"]
            if entering and visitor.get("status") != "autorizado":
                fail(409, "Visitante não está autorizado para entrada.")
            if not entering and visitor.get("status") != "dentro":
                fail(409, "Visitante não está registrado dentro.")
            moment = now_iso()
            visitor.update({"status": "dentro" if entering else "finalizado", "enteredAt": moment if entering else visitor.get("enteredAt"), "exitedAt": None if entering else moment})
            save_record(connection, user, entity, visitor, record_id)
            save_record(connection, user, "access-logs", {"person": visitor.get("name"), "unit": visitor.get("unit"), "kind": visitor.get("type"), "direction": "entrada" if entering else "saída", "authorizedBy": visitor.get("resident"), "registeredBy": user["nome"]})
            audit(connection, request, user, "entry" if entering else "exit", module, record_id)
            connection.commit()
            return visitor
        if (tail == ["checkout"] and entity == "keys" and method == "PATCH") or (tail == ["return"] and entity == "keys" and method == "PATCH"):
            current = record_dict(row)
            checkout = tail == ["checkout"]
            invalid_state = current.get("status", "disponível") != "disponível" if checkout else current.get("status") != "retirada"
            if invalid_state:
                fail(409, "Estado da chave não permite essa operação.")
            data = await body_object(request, required=checkout)
            current.update({"status": "retirada" if checkout else "disponível", "holder": data.get("holder", "") if checkout else "", "purpose": data.get("purpose", "") if checkout else "", "checkedOutAt": now_iso() if checkout else None, "expectedReturn": data.get("expectedReturn") if checkout else None})
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "checkout" if checkout else "return", module, record_id)
            connection.commit()
            return current
        if tail == ["status"] and method == "PATCH" and entity in {"occurrences", "moves"}:
            data = await body_object(request)
            current = record_dict(row)
            if not data.get("status"):
                fail(422, "Informe status.")
            current.update({"status": data["status"], "updatedAt": now_iso()})
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "status", module, record_id)
            connection.commit()
            return current
        if not tail and method == "GET":
            return record_dict(row)
        if not tail and method == "PATCH":
            data = await body_object(request)
            current = record_dict(row)
            current.update(data)
            validate_payload(entity, current)
            save_record(connection, user, entity, current, record_id)
            audit(connection, request, user, "update", module, record_id)
            connection.commit()
            return record_dict(record_row(connection, user, entity, record_id))

    fail(404, "Endpoint não encontrado.")


async def save_upload(request, connection, user, module, record_id, biometric=False):
    if biometric and not os.getenv("COGEM_BIOMETRIC_STORAGE_KEY"):
        fail(503, "Armazenamento biométrico criptografado não configurado.")
    content_type = request.headers.get("content-type", "application/octet-stream").split(";", 1)[0]
    body = await request.body()
    if not body or len(body) > MAX_UPLOAD_BYTES:
        fail(413, "Arquivo vazio ou maior que 10 MB.")
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        fail(415, "Tipo de arquivo não permitido.")
    name = request.headers.get("x-file-name", "upload")
    suffix = Path(name).suffix[:12]
    stored_name = f"{secrets.token_urlsafe(24)}{suffix}"
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    (STORAGE_DIR / stored_name).write_bytes(body)
    cursor = connection.execute("""INSERT INTO storage_files(condominium_id,owner_id,module,record_id,original_name,stored_name,content_type,size_bytes,created_at)
                                  VALUES(?,?,?,?,?,?,?,?,?)""",
                               (user["condominium_id"], user["id"], module, str(record_id), Path(name).name, stored_name, content_type, len(body), now_iso()))
    if module in {"documents", "work-orders"}:
        row = record_row(connection, user, module, record_id)
        payload = record_dict(row)
        payload.setdefault("attachments", []).append({"fileId": cursor.lastrowid, "name": Path(name).name, "contentType": content_type, "size": len(body)})
        save_record(connection, user, module, payload, record_id)
    connection.commit()
    return {"id": cursor.lastrowid, "name": Path(name).name, "status": "stored"}
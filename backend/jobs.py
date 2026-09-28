import inspect
import json
import sqlite3
from datetime import datetime, timedelta, timezone


DELIVERY_STATES = {"queued", "sent", "delivered", "read", "failed"}


def utc_now():
    return datetime.now(timezone.utc)


def claim_jobs(connection: sqlite3.Connection, worker_id: str, limit: int = 10, lease_seconds: int = 60, channels=None):
    now = utc_now()
    now_text = now.isoformat(timespec="seconds")
    lease_text = (now + timedelta(seconds=lease_seconds)).isoformat(timespec="seconds")
    connection.execute("BEGIN IMMEDIATE")
    query = "SELECT * FROM notification_jobs WHERE status='queued' AND (locked_until IS NULL OR locked_until < ?)"
    params = [now_text]
    if channels is not None:
        channels = tuple(channels)
        if not channels:
            connection.commit()
            return []
        query += f" AND channel IN ({','.join('?' for _ in channels)})"
        params.extend(channels)
    query += " ORDER BY id LIMIT ?"
    params.append(max(1, min(100, limit)))
    rows = connection.execute(query, params).fetchall()
    claimed = []
    for row in rows:
        cursor = connection.execute(
            """UPDATE notification_jobs SET locked_by=?,locked_until=?,attempts=attempts+1,updated_at=?
               WHERE id=? AND status='queued' AND (locked_until IS NULL OR locked_until < ?)""",
            (worker_id, lease_text, now_text, row["id"], now_text),
        )
        if cursor.rowcount:
            job = dict(row)
            job["attempts"] += 1
            job["locked_by"] = worker_id
            job["locked_until"] = lease_text
            job["payload"] = json.loads(job["payload"])
            claimed.append(job)
    connection.commit()
    return claimed


def complete_job(connection: sqlite3.Connection, job_id: int, worker_id: str, status: str, error: str = ""):
    if status not in DELIVERY_STATES:
        raise ValueError("Unsupported job status")
    now = utc_now().isoformat(timespec="seconds")
    cursor = connection.execute(
        """UPDATE notification_jobs SET status=?,locked_by=NULL,locked_until=NULL,
           last_error=?,updated_at=? WHERE id=? AND locked_by=?""",
        (status, error[:1000] or None, now, job_id, worker_id),
    )
    if not cursor.rowcount:
        raise RuntimeError("Job lease is missing or belongs to another worker")
    connection.commit()


async def process_job_batch(connection: sqlite3.Connection, worker_id: str, handlers: dict, limit: int = 10):
    processed = []
    for job in claim_jobs(connection, worker_id, limit, channels=handlers.keys()):
        handler = handlers.get(job["channel"])
        if handler is None:
            complete_job(connection, job["id"], worker_id, "queued", "No handler configured")
            continue
        try:
            result = handler(job)
            if inspect.isawaitable(result):
                result = await result
            status = result.get("status", "sent") if isinstance(result, dict) else "sent"
            complete_job(connection, job["id"], worker_id, status)
            processed.append({"id": job["id"], "status": status})
        except Exception as error:
            status = "failed" if job["attempts"] >= 5 else "queued"
            complete_job(connection, job["id"], worker_id, status, str(error))
            processed.append({"id": job["id"], "status": status})
    return processed
import sqlite3
from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
database_dir = raiz / "database"
DB_PATH = database_dir / "cogem.db"


def get_db():
    conexao = sqlite3.connect(DB_PATH)
    conexao.row_factory = sqlite3.Row

    try:
        yield conexao
    finally:
        conexao.close()


def conectar():
    yield from get_db()
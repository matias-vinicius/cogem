import sqlite3
from pathlib import Path

raiz = Path(__file__).resolve().parents[1]
database = raiz / "database"

def conectar():
    conexao = sqlite3.connect(database / "cogem.db")

    try:
        yield conexao
    finally:
        conexao.close()
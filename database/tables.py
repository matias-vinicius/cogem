def criar_tabelas(conexao):
    cursor = conexao.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ocorrencias(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bloco TEXT NOT NULL,
    andar INTEGER NOT NULL,
    lado TEXT NOT NULL,
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT "em aberto"
    )""")

    conexao.commit()
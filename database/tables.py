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
    atualizado_em TEXT,
    titulo TEXT NOT NULL DEFAULT '',
    responsavel TEXT NOT NULL DEFAULT 'Não atribuído',
    status TEXT NOT NULL DEFAULT "em aberto",
    tipo TEXT NOT NULL DEFAULT "comum"
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS historico_ocorrencias(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ocorrencia_id INTEGER NOT NULL,
    status_anterior TEXT,
    status_novo TEXT NOT NULL,
    alterado_em TEXT NOT NULL,
    responsavel TEXT NOT NULL DEFAULT 'Não atribuído',
    FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id)
    )""")

    colunas = {coluna[1] for coluna in cursor.execute("PRAGMA table_info(ocorrencias)")}
    novas_colunas = {
        "atualizado_em": "TEXT",
        "titulo": "TEXT NOT NULL DEFAULT ''",
        "responsavel": "TEXT NOT NULL DEFAULT 'Não atribuído'",
    }

    for coluna, definicao in novas_colunas.items():
        if coluna not in colunas:
            cursor.execute(f"ALTER TABLE ocorrencias ADD COLUMN {coluna} {definicao}")

    cursor.execute(
        """
        UPDATE ocorrencias
        SET titulo = descricao
        WHERE titulo = ''
        """
    )
    cursor.execute(
        """
        UPDATE ocorrencias
        SET atualizado_em = criado_em
        WHERE atualizado_em IS NULL
        """
    )
    cursor.execute(
        """
        UPDATE ocorrencias
        SET status = CASE
            WHEN tipo = 'urgente' THEN 'resolvida'
            ELSE 'concluída'
        END
        WHERE status = 'finalizada'
        """
    )
    cursor.execute(
        """
        UPDATE ocorrencias
        SET status = 'em andamento'
        WHERE status = 'em análise'
        """
    )
    cursor.execute(
        """
        INSERT INTO historico_ocorrencias(
            ocorrencia_id, status_anterior, status_novo, alterado_em
        )
        SELECT ocorrencias.id, NULL, ocorrencias.status, ocorrencias.criado_em
        FROM ocorrencias
        WHERE NOT EXISTS (
            SELECT 1
            FROM historico_ocorrencias
            WHERE historico_ocorrencias.ocorrencia_id = ocorrencias.id
        )
        """
    )

    conexao.commit()
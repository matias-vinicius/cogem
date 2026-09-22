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

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL,
    unidade TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS encomendas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    destinatario TEXT NOT NULL,
    unidade TEXT NOT NULL,
    transportadora TEXT NOT NULL,
    rastreio TEXT,
    descricao TEXT,
    status TEXT NOT NULL DEFAULT 'aguardando retirada',
    recebido_por INTEGER,
    recebido_em TEXT NOT NULL,
    entregue_em TEXT,
    entregue_para TEXT,
    FOREIGN KEY (recebido_por) REFERENCES usuarios(id)
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS livro_portaria(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    prioridade TEXT NOT NULL DEFAULT 'normal',
    autor_id INTEGER,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (autor_id) REFERENCES usuarios(id)
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chaves(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    localizacao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disponível',
    responsavel TEXT,
    finalidade TEXT,
    retirada_em TEXT,
    devolucao_prevista TEXT
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS visitantes(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    documento TEXT NOT NULL,
    telefone TEXT,
    tipo TEXT NOT NULL,
    unidade TEXT NOT NULL,
    morador TEXT NOT NULL,
    valido_de TEXT NOT NULL,
    valido_ate TEXT NOT NULL,
    placa TEXT,
    status TEXT NOT NULL DEFAULT 'autorizado',
    entrada_em TEXT,
    saida_em TEXT,
    criado_em TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS acessos(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pessoa TEXT NOT NULL,
    unidade TEXT NOT NULL,
    tipo TEXT NOT NULL,
    direcao TEXT NOT NULL,
    autorizado_por TEXT,
    registrado_por INTEGER,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (registrado_por) REFERENCES usuarios(id)
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS estoque(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    categoria TEXT NOT NULL,
    unidade TEXT NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 0,
    minimo INTEGER NOT NULL DEFAULT 0,
    localizacao TEXT NOT NULL,
    atualizado_em TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS movimentacoes_estoque(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estoque_id INTEGER NOT NULL,
    movimento TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    operador_id INTEGER,
    criado_em TEXT NOT NULL,
    FOREIGN KEY (estoque_id) REFERENCES estoque(id),
    FOREIGN KEY (operador_id) REFERENCES usuarios(id)
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reservas(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    espaco TEXT NOT NULL,
    titulo TEXT NOT NULL,
    responsavel TEXT NOT NULL,
    unidade TEXT NOT NULL,
    inicio TEXT NOT NULL,
    fim TEXT NOT NULL,
    convidados INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmada',
    criado_em TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS configuracoes(
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS atividades(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    icone TEXT NOT NULL,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    criado_em TEXT NOT NULL
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS preferencias_usuarios(
    usuario_id INTEGER PRIMARY KEY,
    email INTEGER NOT NULL DEFAULT 1,
    push INTEGER NOT NULL DEFAULT 1,
    digest INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
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
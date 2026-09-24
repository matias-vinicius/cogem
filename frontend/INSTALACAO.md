# Instalação do COGEM V1

## Substituir somente o frontend atual

1. Feche o servidor do Vite com `Ctrl + C`.
2. Faça uma cópia da pasta `frontend` atual.
3. Substitua a pasta `frontend` pelos arquivos deste pacote.
4. No PowerShell, entre na nova pasta:

```powershell
cd C:\Projetos\cogem-github\frontend
```

5. Instale exatamente as dependências do projeto:

```powershell
npm ci --no-audit --no-fund
```

6. Confira o build:

```powershell
npm run build
```

7. Execute:

```powershell
npm run dev -- --force
```

Abra `http://localhost:5173`.

## Credenciais demonstrativas

Senha para todos: `123456`.

- Administrador: `admin@cogem.com`
- Síndico: `sindico@cogem.com`
- Portaria: `portaria@cogem.com`
- Manutenção: `manutencao@cogem.com`
- Morador: `morador@cogem.com`

O perfil Morador mostra apenas Encomendas e Ocorrências.
O Financeiro aparece somente para o perfil Síndico.

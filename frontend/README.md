# COGEM Frontend

Frontend responsivo do sistema de Gestão de Ocorrências em Condomínios.

## Executar

```bash
npm install
npm run dev
```

O servidor de desenvolvimento abre em `http://localhost:5173` e encaminha as chamadas `/api` para a API FastAPI em `http://127.0.0.1:8000`.

## API utilizada

- `GET /Ocorrencias` — lista as ocorrências.
- `POST /Ocorrencia` — cadastra uma ocorrência.
- `PUT /Ocorrencia/{id}` — altera o status.

Para apontar o frontend para outro endereço, copie `.env.example` para `.env` e ajuste `VITE_API_URL`.

## Build de produção

```bash
npm run build
```

Os arquivos finais serão gerados em `dist/`.

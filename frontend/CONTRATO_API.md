# Contrato sugerido para a API COGEM

Base local sugerida: `http://127.0.0.1:8000/api`

O front-end funciona sem API nesta entrega. Este contrato serve para o back-end Python implementar recursos compatíveis sem precisar redesenhar as telas.

## Autenticação e autorização

- `POST /auth/login` — recebe `{ "email", "password" }`; retorna `{ "accessToken", "user" }`.
- `GET /auth/me` — retorna o usuário autenticado.
- `POST /auth/logout` — invalida a sessão, se o servidor mantiver sessão.

Perfis aceitos: `admin`, `manager`, `concierge`, `maintenance`, `resident`.

O servidor deve validar as permissões. Ocultar uma aba no React não impede acesso direto à API.

## Padrões

- JSON em todas as requisições e respostas, exceto upload de arquivo.
- Datas em ISO 8601, por exemplo `2026-09-20T18:30:00.000Z`.
- Listagens podem aceitar `?search=&status=&page=&limit=`.
- Erros devem retornar `{ "message": "Descrição legível" }`.
- Exclusão preferencialmente lógica, com auditoria.

## Rotas por módulo

### Ocorrências

- `GET /occurrences`
- `POST /occurrences`
- `GET /occurrences/{id}`
- `PATCH /occurrences/{id}`
- `PATCH /occurrences/{id}/status` com `{ "status": "em andamento" }`

Status inicial obrigatório no servidor: `em aberto`.

Fluxo comum: `em aberto → em andamento → concluída/incompleta`; `incompleta → em andamento`.

Fluxo urgente: `em aberto → em andamento → resolvida`.

### Encomendas

- `GET /packages`
- `POST /packages`
- `PATCH /packages/{id}/deliver` com `{ "deliveredTo": "Nome" }`

### Livro da portaria

- `GET /logbook`
- `POST /logbook`

### Chaves

- `GET /keys`
- `POST /keys`
- `PATCH /keys/{id}/checkout`
- `PATCH /keys/{id}/return`

### Visitantes e acesso

- `GET /visitors`
- `POST /visitors`
- `PATCH /visitors/{id}/entry`
- `PATCH /visitors/{id}/exit`
- `GET /access-logs`
- `POST /access-logs`

A entrada e a saída de um visitante devem atualizar o visitante e criar o registro de acesso na mesma transação.

### Estoque

- `GET /inventory`
- `POST /inventory`
- `PATCH /inventory/{id}`
- `POST /inventory/{id}/movements` com `{ "delta": -2, "reason": "Uso na manutenção" }`

O servidor não deve permitir saldo negativo.

### Reservas e eventos

- `GET /events`
- `POST /events`
- `PATCH /events/{id}`
- `PATCH /events/{id}/cancel`

O back-end deve impedir conflito de horários no mesmo espaço.

### Usuários e configurações

- `GET /users`
- `POST /users`
- `PATCH /users/{id}`
- `PATCH /users/{id}/status`
- `GET /settings`
- `PUT /settings`

## Estrutura mínima dos objetos

Os nomes das propriedades já usados no front estão documentados nos dados de exemplo em `src/data/seed.js`. Eles devem ser mantidos inicialmente para uma conexão direta. Campos principais:

- Ocorrência: `id`, `title`, `description`, `block`, `floor`, `side`, `type`, `status`, `reporter`, `createdAt`, `updatedAt`.
- Encomenda: `id`, `recipient`, `unit`, `carrier`, `tracking`, `description`, `status`, `receivedBy`, `receivedAt`, `deliveredAt`, `deliveredTo`.
- Visitante: `id`, `name`, `document`, `phone`, `unit`, `resident`, `type`, `validFrom`, `validUntil`, `status`, `enteredAt`, `exitedAt`, `vehicle`.
- Acesso: `id`, `person`, `unit`, `kind`, `direction`, `authorizedBy`, `registeredBy`, `createdAt`.
- Estoque: `id`, `name`, `sku`, `category`, `quantity`, `minimum`, `unit`, `location`, `updatedAt`.
- Usuário: `id`, `name`, `email`, `role`, `unit`, `active`. Nunca devolva a senha.

## CORS durante o desenvolvimento

Autorize pelo menos `http://localhost:5173` e `http://127.0.0.1:5173`. Em produção, restrinja ao domínio real do sistema.


# Contrato sugerido para a API COGEM

Base local sugerida: `http://127.0.0.1:8000/api`

O front-end funciona sem API nesta entrega. Este contrato serve para o back-end Python implementar recursos compatíveis sem precisar redesenhar as telas.

## Autenticação e autorização

- `POST /auth/login` — recebe `{ "email", "password" }`; retorna `{ "accessToken", "user" }`.
- `GET /auth/me` — retorna o usuário autenticado.
- `POST /auth/logout` — invalida a sessão, se o servidor mantiver sessão.

Perfis aceitos: `admin`, `manager`, `concierge`, `maintenance`, `resident`.

O servidor deve validar as permissões. Ocultar uma aba no React não impede acesso direto à API.

### Matriz de autorização obrigatória

| Perfil | Escopo permitido |
|---|---|
| `admin` | Operação geral, usuários e configurações da plataforma; sem acesso aos dados financeiros, assembleias ou cadastros privativos do condomínio. |
| `manager` | Gestão completa do condomínio. Único perfil autorizado para Financeiro, Assembleias e Pets/mudanças/consumo. |
| `concierge` | Portaria, ocorrências, encomendas, livro, chaves, visitantes, veículos, acesso, reservas e comunicação. |
| `maintenance` | Ocorrências, livro, estoque, manutenção/OS e documentos técnicos. |
| `resident` | Encomendas e ocorrências vinculadas à própria unidade/identidade, perfil e ajuda. |

O back-end deve responder `403 Forbidden` quando o token não possuir permissão para o módulo. Em especial, todas as rotas `/charges`, `/financial`, `/assemblies`, `/pets`, `/moves` e `/meter-readings` devem aceitar somente o perfil `manager`. Além da permissão por perfil, o servidor deve filtrar os dados do `resident` pela unidade e identidade contidas no token, nunca por parâmetros enviados livremente pelo navegador.

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

- `GET /packages?status=&unit=&resident=&carrier=&query=&page=&pageSize=` — busca paginada para a central da portaria.
- `POST /packages` (`multipart/form-data`) com destinatário, unidade, contatos, dados do volume, foto e canais de notificação.
- `GET /packages/{id}`
- `POST /packages/{id}/notifications` com `{ "channels": ["whatsapp", "email"] }` para reenviar os avisos.
- `POST /packages/notifications/bulk` com `{ "packageIds": [], "channels": ["whatsapp", "email"] }`.
- `POST /packages/{id}/comments` com `{ "text": "Volume no armário 03" }`.
- `GET /packages/{id}/label` — etiqueta pronta para impressão com protocolo, unidade e QR Code.
- `GET /packages/pickup/{token}` — valida token único e informa a encomenda sem expor dados sensíveis.
- `POST /packages/pickup/{token}/confirm` — baixa a encomenda via QR Code, com usuário autenticado ou validação complementar.
- `PATCH /packages/{id}/deliver` com `{ "deliveredTo": "Nome", "deliveryMethod": "manual|qr-code|documento|facial" }`.
- `GET /packages/{id}/audit` — histórico de cadastro, notificações, visualização e retirada.

O servidor deve gerar um token aleatório, único, com expiração e uso único. Nunca use apenas o ID sequencial como QR. A confirmação precisa ser transacional para impedir duas retiradas do mesmo volume.

Após o cadastro, o servidor deve enfileirar o upload seguro da foto, o envio do template aprovado pela API oficial do WhatsApp, o e-mail transacional e a gravação do status de cada canal (`queued`, `sent`, `delivered`, `read`, `failed`). O frontend usa `simulado` apenas para demonstrar esse fluxo sem credenciais externas.

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
- `POST /access/qr/validate` com `{ "token": "..." }`
- `POST /access/facial/identify` (`multipart/form-data`) com imagem capturada pela câmera.
- `POST /access/facial/confirm` com `{ "userId": 1, "direction": "entrada", "confidence": 0.97 }`.
- `GET /access/dashboard`

A entrada e a saída de um visitante devem atualizar o visitante e criar o registro de acesso na mesma transação.

O reconhecimento facial precisa de consentimento explícito, criptografia, política de retenção e possibilidade de exclusão da biometria conforme a LGPD. O frontend nunca deve guardar vetores biométricos ou chaves do provedor.

### Veículos

- `GET /vehicles`
- `POST /vehicles`
- `GET /vehicles/{id}`
- `PATCH /vehicles/{id}`
- `POST /vehicles/{id}/movements` com `{ "direction": "entrada", "method": "tag" }`.
- `GET /vehicle-movements`
- `POST /vehicles/plate-recognition` (`multipart/form-data`)
- `POST /vehicles/tag/validate` com `{ "tag": "TAG-0101" }`.

O backend deve bloquear uma segunda entrada se o veículo já estiver marcado como dentro e registrar operador, portão, data/hora, método e imagem quando disponível.

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

### Comunicação e enquetes

- `GET /announcements`
- `POST /announcements`
- `POST /announcements/{id}/read`
- `GET /announcements/{id}/audience-status`
- `GET /polls`
- `POST /polls`
- `POST /polls/{id}/vote`
- `PATCH /polls/{id}/close`

O backend deve impedir voto duplicado, respeitar o público-alvo e registrar leitura, canal, usuário e data/hora.

### Manutenção e ordens de serviço

- `GET /work-orders`
- `POST /work-orders`
- `GET /work-orders/{id}`
- `PATCH /work-orders/{id}`
- `PATCH /work-orders/{id}/status`
- `POST /work-orders/{id}/attachments`
- `POST /work-orders/{id}/checklist`
- `GET /maintenance-schedules`
- `POST /maintenance-schedules`

### Documentos

- `GET /documents`
- `POST /documents` (`multipart/form-data`)
- `GET /documents/{id}/download` — URL temporária autorizada.
- `POST /documents/{id}/versions`
- `PATCH /documents/{id}/visibility`

### Financeiro

- `GET /charges`
- `POST /charges`
- `GET /charges/{id}`
- `POST /charges/{id}/pix`
- `POST /charges/{id}/boleto`
- `POST /financial/webhooks/{provider}`
- `GET /financial/summary`
- `GET /financial/reconciliation`

PIX, boleto, CNAB, conciliação e baixa automática devem usar provedor financeiro homologado. Nunca armazene credenciais bancárias no frontend.

### Assembleias e votações

- `GET /assemblies`
- `POST /assemblies`
- `POST /assemblies/{id}/presence`
- `POST /assemblies/{id}/agenda/{agendaIndex}/vote`
- `GET /assemblies/{id}/quorum`
- `POST /assemblies/{id}/close`
- `GET /assemblies/{id}/minutes`

O backend deve validar unidade, procuração, fração ideal, quórum e unicidade do voto, mantendo trilha de auditoria.

### Pets, mudanças e consumos

- `GET /pets` / `POST /pets` / `PATCH /pets/{id}`
- `GET /moves` / `POST /moves` / `PATCH /moves/{id}/status`
- `GET /meter-readings` / `POST /meter-readings`
- `GET /meter-readings/consumption?unit=&reference=`

### Usuários e configurações

- `GET /users`
- `POST /users`
- `PATCH /users/{id}`
- `PATCH /users/{id}/status`
- `POST /users/{id}/face` (`multipart/form-data`)
- `DELETE /users/{id}/face`
- `GET /users/{id}/permissions`
- `PUT /users/{id}/permissions`
- `GET /settings`
- `PUT /settings`

## Estrutura mínima dos objetos

Os nomes das propriedades já usados no front estão documentados nos dados de exemplo em `src/data/seed.js`. Eles devem ser mantidos inicialmente para uma conexão direta. Campos principais:

- Ocorrência: `id`, `title`, `description`, `block`, `floor`, `side`, `type`, `status`, `reporter`, `createdAt`, `updatedAt`.
- Encomenda: `id`, `protocol`, `recipient`, `recipientEmail`, `recipientPhone`, `unit`, `carrier`, `tracking`, `packageType`, `keywords`, `description`, `photoUrl`, `status`, `receivedBy`, `receivedAt`, `deliveredAt`, `deliveredTo`, `deliveredBy`, `deliveryMethod`, `pickupTokenHash`, `notificationStatus`, `notificationLog`, `comments`.
- Visitante: `id`, `name`, `document`, `phone`, `unit`, `resident`, `type`, `validFrom`, `validUntil`, `status`, `enteredAt`, `exitedAt`, `vehicle`.
- Acesso: `id`, `person`, `unit`, `kind`, `direction`, `authorizedBy`, `registeredBy`, `createdAt`.
- Veículo: `id`, `plate`, `model`, `color`, `owner`, `unit`, `category`, `tag`, `status`, `enteredAt`, `exitedAt`, `active`.
- Estoque: `id`, `name`, `sku`, `category`, `quantity`, `minimum`, `unit`, `location`, `updatedAt`.
- Usuário: `id`, `name`, `email`, `phone`, `role`, `unit`, `active`, `faceStatus`, `faceRegisteredAt`. Nunca devolva senha, template biométrico ou credenciais internas.
- Comunicado: `id`, `title`, `category`, `audience`, `priority`, `content`, `author`, `createdAt`, `readBy`.
- Ordem de serviço: `id`, `protocol`, `title`, `category`, `type`, `priority`, `location`, `assignedTo`, `description`, `status`, `dueAt`, `createdAt`, `updatedAt`.
- Cobrança: `id`, `unit`, `resident`, `description`, `amount`, `dueAt`, `paidAt`, `status`, `barcode`, `pixPayload`.
- Assembleia: `id`, `title`, `description`, `startsAt`, `location`, `status`, `quorum`, `agenda`, `votes`.

## Matriz obrigatória do morador

O perfil `resident` pode acessar somente as próprias encomendas e ocorrências, criar ocorrência para a própria unidade e validar o próprio QR de retirada. O `residentId` e a unidade devem vir do token autenticado, nunca de parâmetros enviados pelo navegador.

## Integrações externas

- WhatsApp: API oficial Meta Cloud API ou BSP homologado, usando templates aprovados.
- E-mail: provedor transacional com webhook de entrega e falha.
- Arquivos: storage privado com URLs temporárias.
- Filas: notificações, compressão e tarefas demoradas não devem bloquear o cadastro.
- Observabilidade: logs estruturados, rastreio de falhas, auditoria e alertas.

## CORS durante o desenvolvimento

Autorize pelo menos `http://localhost:5173` e `http://127.0.0.1:5173`. Em produção, restrinja ao domínio real do sistema.

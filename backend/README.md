# Backend COGEM

## Configuração

Na raiz do repositório, instale as dependências do backend e inicie a API:

```powershell
python -m pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
```

Defina estas variáveis de ambiente antes da implantação:

- `COGEM_TOKEN_SECRET`: segredo aleatório e persistente usado para assinar tokens de acesso com expiração.
- `COGEM_STORAGE_ENCRYPTION_KEY`: segredo persistente usado para derivar a chave Fernet dos arquivos privados. Se ele mudar, os arquivos existentes deixarão de poder ser lidos.
- `COGEM_BOOTSTRAP_ADMIN_EMAIL` e `COGEM_BOOTSTRAP_ADMIN_PASSWORD`: criam a primeira conta `manager` quando o banco estiver vazio. A senha deve ter pelo menos 12 caracteres.
- `COGEM_CORS_ORIGINS`: origens permitidas, separadas por vírgula. Por padrão, são usadas as duas origens de desenvolvimento do Vite.
- `COGEM_WEBHOOK_SECRET` e `COGEM_NOTIFICATION_WEBHOOK_SECRET`: segredos exigidos pelos webhooks financeiros e de notificações.

Contas demonstrativas não são criadas por padrão. Defina `COGEM_SEED_DEMO_USERS=true` somente em um banco de desenvolvimento descartável.

## API

A API versionada está disponível sob `/api`. Ela inclui autenticação, usuários e permissões, configurações, ocorrências, encomendas, livro da portaria, chaves, visitantes, controle de acesso, veículos, estoque, eventos, comunicados, enquetes, ordens de serviço, agendas de manutenção, documentos, cobranças, assembleias, pets, mudanças, leituras de medidores, registros de auditoria e downloads privados. Quando aplicável, as listagens aceitam `search`, `status`, `unit`, `page` e `limit`.

Os registros são isolados por condomínio. Nas gravações de moradores, a unidade e a identidade do morador são obtidas da conta autenticada. As rotas antigas, destinadas a um único condomínio, foram mantidas por compatibilidade apenas para o tenant `cogem` e também validam o perfil de acesso.

Arquivos privados podem ser enviados pelo campo multipart `file` ou como corpo bruto de imagem/PDF com o cabeçalho `X-File-Name`. Os uploads têm limite de 10 MB e são criptografados em repouso. Downloads exigem autenticação e permissão para o módulo. O envio de fotos faciais é bloqueado se a dependência de criptografia ou a chave não estiver disponível.

## Integrações e filas

WhatsApp, e-mail, processamento de imagens, biometria, reconhecimento de placas e webhooks geram tarefas persistentes com os status `queued`, `sent`, `delivered`, `read` ou `failed`. `backend.jobs.process_job_batch` reserva tarefas e chama os manipuladores configurados para cada canal; as credenciais dos provedores e os adaptadores de envio precisam ser configurados separadamente. Solicitações de pagamento retornam `providerStatus: not_configured` até que um adaptador de pagamento seja conectado. Identificação facial e reconhecimento de placas são enfileirados e não afirmam uma identificação sem um provedor configurado.
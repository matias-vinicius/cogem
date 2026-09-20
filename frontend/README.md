# COGEM — Front-end de gestão condominial

Front-end responsivo do COGEM, construído em React + Vite. Esta entrega funciona sozinha no navegador usando `localStorage`, permitindo demonstrar e operar todos os fluxos antes de o back-end Python estar conectado.

## O que já está funcionando

- Login e encerramento de sessão.
- Cinco perfis com menus diferentes: administrador, síndico, portaria, manutenção e morador.
- Painel geral com indicadores e atividades recentes.
- Ocorrências com abertura automática no status **em aberto** e transições controladas.
- Recebimento e entrega de encomendas.
- Livro digital da portaria.
- Controle de retirada e devolução de chaves.
- Autorização de visitantes, entrada, saída e histórico.
- Registro manual de controle de acesso.
- Estoque com alertas de quantidade mínima e movimentações.
- Reservas de espaços e eventos.
- Cadastro e ativação/desativação de usuários.
- Configurações do condomínio e restauração dos dados demonstrativos.
- Perfil, preferências de notificação, central de alertas e ajuda.
- Layout responsivo para computador, tablet e celular.

## Como executar

Recomendação: Node.js 20 LTS ou 22 LTS.

```powershell
cd frontend
npm install
npm run dev -- --force
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`.

Para conferir a versão de produção:

```powershell
npm run build
npm run preview
```

## Acessos de demonstração

Todos usam a senha `123456`.

| Perfil | E-mail |
|---|---|
| Administrador | `admin@cogem.com` |
| Síndico | `sindico@cogem.com` |
| Portaria | `portaria@cogem.com` |
| Manutenção | `manutencao@cogem.com` |
| Morador | `morador@cogem.com` |

Também é possível entrar com um perfil usando os botões da própria tela de login.

## Organização

```text
src/
├── components/       Componentes compartilhados e estrutura da aplicação
├── config/           Matriz de permissões por perfil
├── context/          Sessão e estado dos módulos
├── data/             Dados demonstrativos
├── pages/            Telas dos módulos
├── styles/           Design system e responsividade
├── App.jsx           Rotas protegidas
└── main.jsx          Inicialização do React
```

## Integração com o back-end

O arquivo [`CONTRATO_API.md`](./CONTRATO_API.md) descreve a API sugerida para o back-end Python. Hoje os dados são persistidos no navegador nas chaves `cogem_data_v3` e `cogem_session_v3`.

Quando a API estiver pronta, substitua as funções do `DataContext.jsx` por chamadas HTTP e a autenticação simulada do `AuthContext.jsx` por login com token. A variável `VITE_API_URL` já está preparada no `.env.example`.

> Importante: as permissões atuais controlam a interface, mas segurança real exige que o back-end valide o token e a permissão de cada requisição.

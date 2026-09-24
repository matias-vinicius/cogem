# COGEM V1 — Plataforma inteligente de gestão condominial

Front-end responsivo do COGEM, construído em React + Vite. Esta entrega funciona sozinha no navegador usando `localStorage`, permitindo demonstrar e operar todos os fluxos antes de o back-end Python estar conectado.

## O que já está funcionando

- Login e encerramento de sessão.
- Cinco perfis com menus diferentes: administrador, síndico, portaria, manutenção e morador.
- Painel geral com indicadores e atividades recentes.
- Ocorrências com abertura automática no status **em aberto** e transições controladas.
- Central de encomendas com tabela operacional, painel lateral, protocolo, foto comprimida, etiqueta, WhatsApp/e-mail preparados, QR único e baixa auditada.
- Livro digital da portaria.
- Controle de retirada e devolução de chaves.
- Autorização de visitantes, entrada, saída e histórico.
- Controle de acesso manual, por QR e demonstração facial.
- Controle de veículos com TAG, placa, entradas, saídas e histórico.
- Estoque com alertas de quantidade mínima e movimentações.
- Reservas de espaços e eventos.
- Comunicados oficiais, segmentação de público e enquetes.
- Manutenção preventiva/corretiva e ordens de serviço.
- Documentos, atas, regulamentos, contratos e laudos.
- Financeiro demonstrativo com cobranças, vencimentos e segunda via.
- Assembleias, quórum e votações digitais.
- Pets, mudanças e leituras de água, gás e energia.
- Cadastro e ativação/desativação de usuários.
- Configurações do condomínio e restauração dos dados demonstrativos.
- Perfil, preferências de notificação, central de alertas e ajuda.
- Layout responsivo para computador, tablet e celular.

## Recursos em demonstração (BETA)

Os módulos **Comunicação**, **Manutenção e OS**, **Documentos**, **Assembleias**, **Financeiro** e **Pets, mudanças e consumo** aparecem identificados como **BETA · versão demonstrativa** no menu e dentro de cada tela. Eles servem para validar os fluxos com usuários reais antes do lançamento oficial e podem receber ajustes a partir dos feedbacks.

Esses recursos persistem dados somente no navegador. O financeiro pode registrar valores reais para controle, cobranças, vencimentos, baixas e demonstrações, mas não guarda saldo nem executa transferências bancárias por conta própria. As votações ainda não possuem validade jurídica e as notificações não são enviadas para destinatários reais enquanto o back-end não estiver integrado.

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

## Permissões por perfil

As telas são filtradas no menu e protegidas nas rotas. Se um usuário tentar abrir uma URL sem permissão, será redirecionado para a página inicial do próprio perfil.

| Perfil | Telas liberadas |
|---|---|
| Administrador | Operação geral, cadastros de usuários e configurações. Não acessa dados financeiros, assembleias ou cadastros privativos do condomínio. |
| Síndico | Gestão completa. É o único perfil com acesso a **Financeiro**, Assembleias e Pets/mudanças/consumo. |
| Portaria | Ocorrências, encomendas, livro da portaria, chaves, visitantes, veículos, controle de acesso, reservas e comunicação. |
| Manutenção | Ocorrências, livro da portaria, estoque, manutenção/OS e documentos técnicos. |
| Morador | Suas encomendas, ocorrências, perfil e ajuda. |

Na tela **Usuários e acessos**, a matriz de permissões fica visível para facilitar a configuração de cada equipe. O Síndico não pode criar ou desativar contas de Administrador da plataforma.

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

O arquivo [`CONTRATO_API.md`](./CONTRATO_API.md) descreve a API sugerida para o back-end Python. Nesta versão front-end, os dados demonstrativos permanecem persistidos localmente no navegador para facilitar testes.

Quando a API estiver pronta, substitua as funções do `DataContext.jsx` por chamadas HTTP e a autenticação simulada do `AuthContext.jsx` por login com token. A variável `VITE_API_URL` já está preparada no `.env.example`.

> Importante: as permissões atuais controlam a interface, mas segurança real exige que o back-end valide o token e a permissão de cada requisição.

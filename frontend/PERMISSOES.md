# Matriz de permissões — COGEM V1

Esta matriz é aplicada ao menu, aos atalhos, às notificações e às rotas do front-end.

| Módulo | Administrador | Síndico | Portaria | Manutenção | Morador |
|---|:---:|:---:|:---:|:---:|:---:|
| Visão geral | ✓ | ✓ | ✓ | ✓ | — |
| Ocorrências | ✓ | ✓ | ✓ | ✓ | ✓ |
| Encomendas | ✓ | ✓ | ✓ | — | ✓ |
| Livro da portaria | ✓ | ✓ | ✓ | ✓ | — |
| Chaves | ✓ | ✓ | ✓ | — | — |
| Visitantes | ✓ | ✓ | ✓ | — | — |
| Veículos | ✓ | ✓ | ✓ | — | — |
| Controle de acesso | ✓ | ✓ | ✓ | — | — |
| Estoque | ✓ | ✓ | — | ✓ | — |
| Reservas e eventos | ✓ | ✓ | ✓ | — | — |
| Comunicação | ✓ | ✓ | ✓ | — | — |
| Manutenção e OS | ✓ | ✓ | — | ✓ | — |
| Documentos | ✓ | ✓ | — | ✓ | — |
| Financeiro | — | **✓** | — | — | — |
| Assembleias | — | **✓** | — | — | — |
| Pets, mudanças e consumo | — | **✓** | — | — | — |
| Usuários e acessos | ✓ | ✓ | — | — | — |
| Configurações | ✓ | ✓ | — | — | — |
| Perfil e ajuda | ✓ | ✓ | ✓ | ✓ | ✓ |

## Regras adicionais

- O perfil **Síndico** é o único autorizado a abrir o Financeiro, inclusive por URL direta.
- O **Administrador** cuida da plataforma e da operação, mas não visualiza dados financeiros privativos do condomínio.
- O Síndico pode gerenciar usuários operacionais, mas não pode criar nem desativar um Administrador da plataforma.
- O **Morador** inicia em Encomendas e deve receber do back-end somente dados vinculados à própria identidade e unidade.
- O front-end redireciona acessos não autorizados; o back-end deve repetir as regras e responder `403 Forbidden` para garantir segurança real.

Os identificadores técnicos dos perfis são: `admin`, `manager`, `concierge`, `maintenance` e `resident`.

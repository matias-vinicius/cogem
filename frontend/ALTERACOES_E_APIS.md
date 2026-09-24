# COGEM V1 — remasterização completa

## Experiência visual V1

- Design system premium aplicado a todos os módulos, com hierarquia visual, cards operacionais, barras de fluxo e central de comandos.
- Cabeçalhos inteligentes por rota, indicadores de operação em tempo real e navegação responsiva.
- Encomendas com COGEM Pass: QR de uso único, jornada de retirada, validação segura, foto, WhatsApp, e-mail e trilha de auditoria.
- Ocorrências, livro da portaria e reservas agora exibem fluxo operacional completo em vez de simples listagens.
- Permissões por perfil continuam bloqueando tanto o menu quanto a rota protegida.

> **Status da entrega:** Comunicação, Manutenção e OS, Documentos, Financeiro, Assembleias e Cadastros complementares estão marcados na interface como **BETA · versão demonstrativa**. Os fluxos podem ser testados para coleta de feedback, mas ainda dependem das integrações listadas neste documento para operação oficial.

## Implementado no frontend

### Encomendas automatizadas

- Central operacional inspirada no fluxo real de portaria, com tabela e painel lateral de detalhes.
- Busca por unidade, destinatário, protocolo, rastreio e palavra-chave.
- Filtros por status e transportadora, paginação e seleção em lote.
- Protocolo automático e impressão de etiqueta.
- Cadastro com destinatário, unidade, WhatsApp, e-mail, transportadora, rastreio e descrição.
- Captura pela câmera traseira no celular ou seleção pela galeria/computador.
- Compressão, redimensionamento, prévia e remoção da imagem.
- Opções independentes de notificação por WhatsApp e e-mail.
- Aviso individual ou em lote para as unidades.
- QR Code real e único por encomenda.
- Prévia da mensagem enviada ao morador e botão para copiá-la.
- Leitor de QR preparado para câmera/API, com validação também por protocolo.
- Baixa por QR, documento, reconhecimento facial ou confirmação manual.
- Registro de quem recebeu, quem retirou, quem entregou, data, horário e método.
- Tipo de volume, palavras-chave e observações da portaria.
- Histórico de avisos e comentários dentro da encomenda.
- Detalhes completos, foto, contatos e auditoria visual dos canais.
- Botões de reenvio preparados para a API.
- Morador enxerga somente encomendas da própria unidade.

### Controle de veículos

- Nova página de veículos.
- Cadastro de placa, modelo, cor, categoria, proprietário, unidade e TAG/RFID.
- Situação atual dentro/fora e registro de entrada/saída.
- Métodos TAG/RFID, leitura de placa e manual.
- Histórico auditável com operador, método, data e horário.
- Indicadores de veículos no local, entradas, saídas e tags.

### Reconhecimento facial e acesso

- Cadastro facial na criação do usuário.
- Captura pela câmera frontal ou envio de imagem.
- Atualização posterior da facial e status cadastrada/pendente.
- Simulação funcional de identificação facial no controle de acesso.
- Liberação de entrada e criação automática do registro.
- Método auditado: facial, QR, tag, placa ou manual.

### Comunicação e participação

- Mural de comunicados com prioridade, categoria, público e confirmações.
- Enquetes com prazo e voto demonstrativo.
- Assembleias com pautas, quórum e votação digital.

### Gestão administrativa

- Ordens de serviço preventivas, corretivas e inspeções.
- Responsável, prioridade, prazo, localização e fluxo de execução.
- Central de documentos com categorias, visibilidade e versões.
- Financeiro com cobranças, segunda via, vencidos e registro de pagamento.
- O financeiro aceita valores reais como registro e controle operacional; movimentação bancária automática depende de integração homologada no back-end.
- Cadastros de pets e mudanças por unidade.
- Leituras de água, gás e energia com cálculo de consumo.

### Perfis e interface

- Novo design system inspirado no painel de referência: navegação azul-marinho, conteúdo claro, cards compactos, gráficos, operação em tempo real e atalhos rápidos.
- Dashboard e Financeiro totalmente redesenhados; as demais páginas compartilham o mesmo cabeçalho, espaçamento, painéis, tabelas, formulários, botões e comportamento responsivo.
- Morador restrito a Encomendas e Ocorrências, com redirecionamento automático para Encomendas após o login.
- Menus, atalhos, notificações e rotas diretas protegidos pela mesma matriz de permissão.
- Síndico com gestão completa e acesso exclusivo a Financeiro, Assembleias e Cadastros privativos.
- Administrador da plataforma sem acesso a Financeiro; Portaria e Manutenção recebem apenas módulos operacionais compatíveis com suas funções.
- Matriz de acesso visível na tela Usuários e acessos.
- Síndico não pode criar nem desativar uma conta de Administrador da plataforma.
- Responsividade revisada para computador, notebook, tablet e celular.

## Funciona sem backend

- Cadastros e fluxos demonstrativos.
- Foto comprimida, prévia e QR Code real.
- Simulação de leitura e baixa.
- Cadastro/validação facial demonstrativa.
- Veículos, histórico, permissões e persistência local.
- Comunicação, enquetes, OS, documentos, cobranças, assembleias, pets, mudanças e consumos demonstrativos.

## Depende do backend Python

- Envio real pela API oficial do WhatsApp e por e-mail.
- Banco compartilhado entre dispositivos.
- Upload privado das fotos.
- Token QR seguro, expirável e de uso único.
- Reconhecimento facial biométrico verdadeiro.
- Integração com câmera, catraca, cancela, placa e TAG física.
- Segurança, LGPD, backup, auditoria imutável e recuperação de conta.
- PIX, boleto, CNAB, conciliação bancária e webhooks.
- Votação com quórum legal, fração ideal e procurações.
- Upload/versionamento real de documentos e anexos de manutenção.

O contrato completo, campos, regras e endpoints está em `CONTRATO_API.md`.

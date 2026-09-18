# Tela — Roadmap de produto e decisões

Atualizado em 18/09/2026.

Este documento separa o que já foi decidido, o que deve entrar no próximo ciclo do MVP e o que deve ficar preparado para fases futuras. Ele evita transformar ideias úteis em alterações isoladas e reduz retrabalho.

## 1. Decisões já confirmadas

### Publicação
- Um conteúdo pode gerar vários destinos/publicações.
- Cada destino terá estado independente.
- O usuário pode usar o mesmo texto em todas as redes ou adaptar por plataforma.
- Qualquer versão adaptada pode ser editada manualmente.
- O padrão é um único horário; opcionalmente cada destino pode ter data/hora própria.
- Kwai entra na arquitetura de redes previstas.

### Contas sociais
- Um workspace poderá conectar várias contas.
- Deve ser possível conectar mais de uma conta da mesma rede.
- O destino de uma publicação deverá referenciar a conta conectada específica.

### Falhas
- Falhas devem mostrar motivo.
- Usuário poderá ter ações como tentar novamente, publicar agora e reagendar.
- O backend deverá registrar tentativas e erros.
- Retentativas automáticas devem existir para erros transitórios, com idempotência e backoff.
- Erros permanentes/credenciais expiradas devem pedir ação do usuário em vez de entrar em loop.

### Visual
- Direção mais minimalista, compacta e criativa.
- Cards de métricas menores.
- Conexões sociais mais compactas.
- Sidebar recolhível.
- Modo claro/escuro.
- Contraste legível em todos os temas.
- Miniatura da mídia no histórico.
- Ícones reconhecíveis/oficiais das redes, respeitando as regras de marca.
- Evitar o visual genérico de dashboard SaaS.

## 2. Próximo ciclo recomendado do MVP

Este é o pacote que vale implementar junto, depois de fechar a direção visual básica.

### Fundação de design
Criar design tokens para:
- fundo;
- superfície;
- texto principal/secundário;
- bordas;
- cor de marca/acento;
- sucesso/aviso/erro;
- sidebar;
- raios;
- sombras;
- espaçamento;
- tipografia.

Evitar hardcode de cores em dezenas de componentes.

### Temas
Implementar primeiro:
- claro;
- escuro;
- 3 a 5 presets visuais baseados nos mesmos tokens.

Permitir ajustes controlados de marca depois. Não liberar no MVP um editor irrestrito de cada cor/fonte individual: isso aumenta combinações inválidas, suporte e problemas de acessibilidade.

### Navegação
- Sidebar recolhível no desktop.
- Estado recolhido persistido.
- Mobile continua com menu em drawer.
- Perfil/avatar em área consistente.
- Preparar menu de configurações/aparência.

### Dashboard
- Compactar métricas.
- Reduzir altura e espaço desperdiçado.
- Dar prioridade às ações e conteúdos próximos, não a números decorativos.

### Conexões
- Lista/cards compactos.
- Suportar várias contas por plataforma.
- Mostrar avatar/nome/handle quando disponível.
- Estados e ações claras: conectar, reconectar, gerenciar, remover.
- Não pressupor uma única conexão por plataforma.

### Editor
- Texto-base.
- Alternador “Mesmo texto” / “Adaptar por rede”.
- Edição por destino.
- Horário comum / horários personalizados.
- Seleção da conta específica quando houver mais de uma conta da mesma rede.
- Resumo por destino.

### Histórico
- Miniatura.
- Resultado por conta/destino.
- Em falha: causa + ações.
- Acesso a detalhes técnicos sem poluir a visão principal.

### Calendário
- Navegação por mês e ano.
- Preparar visões futuras sem inflar o MVP.
- Não hardcodar horizonte de agendamento na UI.

## 3. Arquitetura que deve ser preparada agora, mas não precisa estar toda exposta na interface

### Provider capabilities
Cada adapter de rede deverá poder informar capacidades, por exemplo:
- tipos de mídia suportados;
- limites de texto;
- requisitos de título;
- publicação imediata;
- upload em etapas;
- restrições conhecidas;
- necessidade de revisão/permissões;
- limites/horizontes relevantes quando existirem.

A UI consulta capacidades; ela não espalha regras fixas de Instagram/TikTok/etc. pelo código.

### Agendamento
O Tela deve possuir sua própria fila/agendador. Quando a rede não aceitar agendamento nativo longo, o Tela pode guardar o job e chamar a API de publicação no horário correto, desde que isso seja permitido pelo provider.

Portanto, “máximo de 30/60/90 dias” não deve ser uma regra global do produto sem necessidade.

### Logs e retries
Guardar, por tentativa:
- destino;
- horário;
- número da tentativa;
- request/correlation id quando aplicável;
- resultado;
- código normalizado;
- mensagem amigável;
- detalhe técnico sanitizado;
- próxima tentativa, se houver.

Nunca armazenar tokens/senhas em logs.

## 4. Autenticação e cadastro

Para o produto comercial:
- e-mail + senha via Supabase Auth;
- Google OAuth como opção conveniente;
- recuperação de senha;
- verificação de e-mail conforme estratégia comercial;
- perfil do usuário separado da credencial;
- nunca criar tabela própria com senha legível.

A imagem do usuário poderá vir do Google ou ser enviada depois.

## 5. Agências, equipes e subcontas

Isto deve influenciar a modelagem, mas não precisa virar um módulo completo já.

Estrutura recomendada:
- usuário;
- workspace;
- membros do workspace;
- papéis/permissões;
- contas sociais conectadas ao workspace.

Futuro:
- owner;
- admin;
- editor/publicador;
- revisor/aprovador;
- viewer/cliente.

Uma agência poderá ter vários workspaces/clientes ou uma organização acima deles quando a necessidade real justificar.

### Planos comerciais
Planos devem controlar limites/capacidades, não duplicar telas:
- número de workspaces/clientes;
- membros;
- contas sociais;
- volume de publicações;
- IA;
- histórico;
- aprovações;
- personalização/branding.

A UI pode ocultar ou bloquear recursos conforme entitlement do plano.

## 6. Acesso administrativo Tela

Criar futuramente uma área administrativa separada da experiência comum do cliente.

Deve permitir, com controles fortes:
- usuários/workspaces;
- planos/entitlements;
- integrações;
- erros/jobs;
- suporte;
- auditoria;
- feature flags.

Não transformar o “acesso master” em bypass inseguro de permissões. Administração deve ser autorizada no backend e auditável.

## 7. Personalização e white-label

### MVP
- claro/escuro;
- presets;
- acento;
- opções limitadas de fonte/densidade.

### Depois
- logo do workspace;
- cores de marca;
- domínio personalizado;
- branding removível;
- temas específicos por plano.

White-label amplo deve ser recurso comercial avançado, não requisito para o fluxo principal funcionar.

## 8. Pesquisa pendente antes das integrações reais

Verificar em documentação oficial, rede por rede:
- requisitos de aprovação do app;
- tipos de conta aceitos;
- endpoints de publicação;
- permissões/scopes;
- limites de mídia;
- limites de texto;
- quotas/rate limits;
- regras de agendamento;
- políticas de uso;
- situação da API de publicação do Kwai;
- assets oficiais de marca permitidos.

Essas regras mudam. Registrar a data da pesquisa e não tratá-las como constantes permanentes.

## 9. Fora do ciclo imediato

Guardar para depois de validar o fluxo principal:
- billing;
- planos comerciais definitivos;
- analytics avançado;
- melhor horário por IA/dados próprios;
- aprovações complexas;
- white-label completo;
- automações avançadas;
- edição/transcodificação de vídeo;
- aplicativo móvel nativo;
- grande biblioteca de temas;
- customização pixel a pixel;
- painel administrativo completo.

## 10. Critério para considerar o MVP pronto para teste real

Antes de chamar o MVP de pronto para usuários externos, ele deverá:
1. autenticar usuário real;
2. persistir dados;
3. isolar workspaces corretamente;
4. conectar ao menos uma integração social real de ponta a ponta;
5. criar conteúdo e destino;
6. agendar/publicar;
7. registrar sucesso/falha;
8. permitir retry seguro;
9. preservar logs;
10. ter interface responsiva, clara e minimamente identificável como Tela;
11. ter backup/recuperação definidos para dados reais.

A identidade visual final pode continuar evoluindo depois disso.

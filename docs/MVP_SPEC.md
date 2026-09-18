# Tela — Especificação inicial do MVP

## Visão do produto
Tela será uma plataforma SaaS para gestão, preparação, agendamento, publicação e acompanhamento de conteúdo em múltiplas redes sociais a partir de uma única interface.

A proposta central do MVP é reduzir o trabalho repetitivo de quem publica o mesmo conteúdo em vários canais, sem obrigar o usuário a tratar todas as redes de forma idêntica.

## Fluxo principal do MVP
1. Usuário cria conta e entra no Tela.
2. Usuário cria ou acessa seu workspace.
3. Usuário conecta uma ou mais contas de redes sociais.
4. Usuário cria um conteúdo.
5. Usuário adiciona vídeo/imagem e um conteúdo-base.
6. Usuário escolhe entre usar o mesmo texto nas redes ou adaptar versões por plataforma.
7. Tela gera/adapta os textos por rede quando solicitado.
8. Usuário revisa e pode editar qualquer versão individualmente.
9. Usuário escolhe publicar agora ou agendar.
10. Por padrão, todos os destinos podem usar a mesma data/hora; opcionalmente cada destino pode ter seu próprio agendamento.
11. Tela registra status, tentativas, erros e resultado de cada destino de forma independente.

## Modelo conceitual
O Tela deve tratar uma criação como:

**1 conteúdo → vários destinos/publicações**

Cada destino poderá ter independentemente:
- conta social de destino;
- plataforma;
- texto/título/descrição;
- data e horário;
- status;
- número de tentativas;
- último erro;
- identificador externo;
- data de publicação.

Assim, uma falha em uma rede não transforma toda a publicação em falha.

## Redes previstas
Arquitetura preparada para:
- Instagram
- Facebook
- TikTok
- YouTube
- LinkedIn
- X
- Kwai

As integrações reais devem ser implementadas gradualmente por adapters/providers independentes. Não simular integração real como se estivesse pronta.

A disponibilidade, permissões e limitações de cada integração devem ser verificadas na documentação oficial no momento em que o provider real for implementado.

## Escopo funcional inicial

### Autenticação
- Cadastro por e-mail.
- Login por e-mail.
- Logout.
- Recuperação de senha.
- Sessão persistente.
- Arquitetura preparada para login social, começando por Google.
- Senhas nunca devem ser armazenadas pela aplicação em texto puro; usar o provedor de autenticação (Supabase Auth) para credenciais.

### Workspaces, contas e membros
- Cada usuário pertence a pelo menos um workspace.
- Todo dado de negócio deve ser isolado por workspace.
- Um workspace deve poder ter múltiplas contas sociais.
- Deve ser possível conectar mais de uma conta da mesma plataforma no mesmo workspace.
- Uma publicação deve apontar para a conta social específica, e não apenas para a plataforma.
- Preparar a modelagem para múltiplos membros, papéis e uso por equipes/agências.
- Planos, limites comerciais e permissões avançadas serão definidos posteriormente.

### Conexões sociais
- Tela para listar redes disponíveis e contas conectadas.
- Estado por conexão: desconectado, conectado, expirado, erro.
- Estrutura pronta para várias contas por plataforma.
- Estrutura de dados pronta para armazenar referências de tokens de forma segura no backend.
- Nunca expor tokens no frontend.

### Editor de publicação
- Upload de vídeo ou imagem.
- Campo de conteúdo-base.
- Seleção das contas/redes de destino.
- Opção clara: **usar o mesmo texto em todos os destinos**.
- Opção clara: **adaptar para cada plataforma**.
- Versão de texto específica por destino/plataforma quando aplicável.
- Possibilidade de editar manualmente qualquer versão.
- Publicar agora ou agendar.
- Agendamento comum para todos os destinos como padrão.
- Opção de data/hora individual por destino.
- Estrutura preparada para sugestão futura de melhor horário pelo Tela.
- Status independente por destino.

### Adaptação de conteúdo
No MVP, priorizar adaptação de texto:
- legenda;
- título quando aplicável;
- descrição;
- hashtags quando aplicável;
- CTA opcional.

A adaptação automática de vídeo por duração, proporção, cortes e recodificação NÃO faz parte da primeira entrega. A arquitetura deve permitir esse módulo no futuro.

### Calendário
- Visualização das publicações agendadas.
- Navegação intuitiva por mês e ano.
- Acesso ao detalhe da publicação.
- Estados: rascunho, agendado, processando, publicado, falhou, cancelado.
- O calendário do Tela não deve depender de um número fixo de dias hardcoded. Limites e capacidades devem vir da estratégia/provider de cada integração.
- Quando o Tela usar agendamento próprio, o sistema poderá manter uma publicação na fila e executar a chamada à rede apenas no momento adequado, respeitando as regras vigentes da API.

### Histórico
- Listar publicações.
- Exibir miniatura da mídia quando disponível.
- Filtrar por rede, conta e status.
- Mostrar resultado individual por destino.
- Em falha, mostrar motivo compreensível.
- Preparar ações: tentar novamente, publicar agora, reagendar e abrir detalhes técnicos.

### Falhas, retries e observabilidade
- Operações de publicação devem ser idempotentes sempre que possível.
- Registrar cada tentativa por destino, com data/hora, resultado, código e mensagem de erro.
- Diferenciar erros temporários de erros permanentes.
- Erros temporários podem usar retentativas automáticas com backoff.
- Erros permanentes ou que exijam ação do usuário não devem ficar em loop.
- Guardar histórico suficiente para suporte e auditoria.
- A interface deve mostrar uma explicação amigável e permitir acesso a detalhes técnicos quando útil.
- Preparar uma área administrativa futura para diagnóstico operacional.

## Direção de interface do MVP
A interface atual é uma fundação e não define a identidade visual final.

Princípios já confirmados:
- visual mais minimalista e compacto;
- reduzir cards grandes para informações simples;
- sidebar recolhível no desktop;
- modo claro e escuro;
- contraste e legibilidade acessíveis em ambos os modos;
- ícones oficiais/reconhecíveis das redes sociais, seguindo os assets e regras de marca permitidos;
- conexões sociais mais compactas;
- histórico com miniaturas;
- estados de falha com ações claras;
- sistema visual baseado em tokens para evitar cores hardcoded espalhadas pela aplicação.

### Personalização e temas
Não permitir customização irrestrita de cada elemento no primeiro MVP.

Preparar um sistema de temas baseado em design tokens, permitindo evoluir para:
- temas pré-definidos;
- modo claro/escuro;
- cor principal/acento;
- tipografia entre opções suportadas;
- densidade/compactação;
- algumas cores de superfície e navegação.

Isso preserva desempenho, acessibilidade e consistência. Personalização mais profunda pode ser vinculada a planos futuros.

## Arquitetura e princípios
- Aplicação SaaS multi-tenant.
- Nunca criar infraestrutura separada para cada cliente.
- Separar domínio de publicação das integrações externas.
- Criar uma interface comum para providers de redes sociais.
- Cada provider deve declarar capacidades relevantes, evitando regras de plataforma espalhadas pela UI.
- Operações de publicação devem ser idempotentes sempre que possível.
- Registrar erros e tentativas por destino.
- Preparar processamento assíncrono para publicações agendadas.
- Não armazenar mídia pesada dentro do banco relacional.
- Usar object storage para mídia quando a integração real for feita.
- Segredos somente no servidor e por variáveis de ambiente.
- Não incluir chaves reais no repositório.

## Stack preferencial para a fundação
Usar uma stack simples, moderna e adequada a SaaS:
- Next.js com TypeScript;
- App Router;
- Tailwind CSS;
- Supabase para PostgreSQL e autenticação;
- estrutura preparada para object storage compatível com S3/R2;
- camada de jobs/agendamentos desacoplada da aplicação web.

Se houver motivo técnico forte para alterar algo, documentar a decisão antes de trocar.

## Qualidade
- TypeScript estrito.
- Componentes reutilizáveis.
- Separação clara entre UI, domínio, persistência e integrações.
- Validação de entrada.
- Tratamento de erros.
- Acessibilidade básica.
- Responsivo para desktop e celular.
- README com instalação local e variáveis de ambiente.
- .env.example sem segredos.
- Lint e verificação de tipos funcionando.

## O que NÃO fazer nesta primeira etapa
- Não implementar cobrança ainda.
- Não contratar ou exigir serviços pagos.
- Não implementar edição/transcodificação real de vídeo.
- Não inventar credenciais de APIs sociais.
- Não tentar integrar todas as redes de uma vez.
- Não criar arquitetura excessivamente complexa.
- Não fazer white-label irrestrito por cliente no MVP.
- Não gastar o ciclo atual em microanimações e acabamento visual antes de validar o fluxo principal.

## Primeira entrega esperada
A primeira entrega criou a fundação funcional. As próximas rodadas devem evoluir essa base sem recomeçar o produto do zero:
1. consolidar modelo de conteúdo → múltiplos destinos;
2. suportar várias contas da mesma rede na modelagem;
3. melhorar editor com texto comum/adaptação e horários por destino;
4. preparar logs/retries;
5. criar sistema visual por tokens, modo escuro e sidebar recolhível;
6. compactar dashboard/conexões/histórico;
7. adicionar Kwai à arquitetura visual/domínio;
8. depois conectar Supabase e integrações reais gradualmente.

A aplicação deve continuar conseguindo rodar localmente sem depender de credenciais reais das redes sociais.

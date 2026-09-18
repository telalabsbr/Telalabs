# Tela — Especificação inicial do MVP

## Visão do produto
Tela será uma plataforma SaaS para gestão, preparação, agendamento e publicação de conteúdo em múltiplas redes sociais a partir de uma única interface.

A proposta central do MVP é reduzir o trabalho repetitivo de quem publica o mesmo conteúdo em vários canais.

## Fluxo principal do MVP
1. Usuário cria conta e entra no Tela.
2. Usuário cria ou acessa seu workspace.
3. Usuário conecta suas contas de redes sociais por OAuth.
4. Usuário cria uma publicação.
5. Usuário adiciona um vídeo ou imagem e um texto-base.
6. Tela gera/adapta os textos por rede social.
7. Usuário revisa as versões por plataforma.
8. Usuário escolhe publicar agora ou agendar.
9. Tela registra status e resultado de cada publicação por rede.

## Redes previstas
Arquitetura preparada para:
- Instagram
- Facebook
- TikTok
- YouTube
- LinkedIn
- X

As integrações reais devem ser implementadas gradualmente por adapters/providers independentes. Não simular integração real como se estivesse pronta.

## Escopo funcional inicial

### Autenticação
- Cadastro
- Login
- Logout
- Recuperação de senha
- Sessão persistente

### Workspaces
- Cada usuário pertence a pelo menos um workspace.
- Todo dado de negócio deve ser isolado por workspace.
- Preparar a modelagem para múltiplos membros por workspace no futuro.

### Conexões sociais
- Tela para listar redes disponíveis.
- Estado por conexão: desconectado, conectado, expirado, erro.
- Estrutura de dados pronta para armazenar tokens de forma segura no backend.
- Nunca expor tokens no frontend.

### Editor de publicação
- Upload de vídeo ou imagem.
- Campo de texto-base.
- Seleção das redes de destino.
- Versão de texto específica por rede.
- Possibilidade de editar manualmente cada versão.
- Publicar agora ou agendar data/hora.
- Status por destino.

### Adaptação de conteúdo
No MVP, priorizar adaptação de texto:
- legenda
- título quando aplicável
- descrição
- hashtags quando aplicável
- CTA opcional

A adaptação automática de vídeo por duração, proporção, cortes e recodificação NÃO faz parte da primeira entrega. A arquitetura deve permitir esse módulo no futuro.

### Calendário
- Visualização das publicações agendadas.
- Acesso ao detalhe da publicação.
- Estados: rascunho, agendado, processando, publicado, falhou, cancelado.

### Histórico
- Listar publicações.
- Filtrar por rede e status.
- Mostrar resultado individual por destino.

## Arquitetura e princípios
- Aplicação SaaS multi-tenant.
- Nunca criar infraestrutura separada para cada cliente.
- Separar domínio de publicação das integrações externas.
- Criar uma interface comum para providers de redes sociais.
- Operações de publicação devem ser idempotentes sempre que possível.
- Registrar erros e tentativas por destino.
- Preparar processamento assíncrono para publicações agendadas.
- Não armazenar mídia pesada dentro do banco relacional.
- Usar object storage para mídia quando a integração real for feita.
- Segredos somente no servidor e por variáveis de ambiente.
- Não incluir chaves reais no repositório.

## Stack preferencial para a fundação
Usar uma stack simples, moderna e adequada a SaaS:
- Next.js com TypeScript
- App Router
- Tailwind CSS
- Supabase para PostgreSQL e autenticação
- Estrutura preparada para object storage compatível com S3/R2
- Camada de jobs/agendamentos desacoplada da aplicação web

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
- Não implementar cobrança.
- Não contratar ou exigir serviços pagos.
- Não implementar edição/transcodificação real de vídeo.
- Não inventar credenciais de APIs sociais.
- Não tentar integrar todas as redes de uma vez.
- Não criar arquitetura excessivamente complexa.
- Não adicionar funcionalidades fora deste documento sem necessidade.

## Primeira entrega esperada
A primeira entrega deve criar somente a fundação funcional:
1. Inicializar o projeto.
2. Criar estrutura visual principal.
3. Criar autenticação preparada para Supabase.
4. Criar schema/modelagem inicial multi-tenant.
5. Criar dashboard.
6. Criar tela de conexões sociais com providers em estado mock/local.
7. Criar editor de publicação funcional em modo local/mock.
8. Criar calendário/histórico básicos usando dados mockados ou persistência local quando as credenciais externas não estiverem configuradas.
9. Criar interfaces/adapters para futuros providers.
10. Documentar como rodar e quais são os próximos passos.

A aplicação deve conseguir rodar localmente sem depender de credenciais reais das redes sociais.

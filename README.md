# Tela — fundação do MVP

Fundação funcional da plataforma SaaS **Tela**, para preparar, adaptar, agendar e acompanhar conteúdo em múltiplas redes sociais. Esta entrega segue [`docs/MVP_SPEC.md`](docs/MVP_SPEC.md) e usa dados demonstrativos: **nenhuma publicação é enviada para redes externas**.

## O que está disponível

- login, cadastro e recuperação de senha preparados para Supabase, com fallback demonstrativo;
- shell responsivo, dashboard e seletor visual de workspace;
- conexões sociais com os quatro estados previstos (`conectado`, `desconectado`, `expirado`, `erro`);
- editor com mídia local, texto-base, destinos, adaptação inicial de texto editável e escolha entre envio imediato/agendado;
- calendário e histórico com filtro, status geral e resultado por destino;
- domínio tipado, contrato comum para providers e adapter mock que falha explicitamente (não finge integração);
- migration PostgreSQL multi-tenant com RLS, idempotência, tentativas e erros por destino.

## Rodar localmente

Requer Node.js 20.9+ e npm.

```bash
npm install
cp .env.example .env.local # opcional no modo demo
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). A raiz leva ao dashboard demonstrativo; a tela de autenticação fica em `/login`.

### Verificações

```bash
npm run lint
npm run typecheck
npm run build
```

## Variáveis de ambiente

Consulte [`.env.example`](.env.example). Sem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`, o app permanece totalmente navegável no modo demonstração. `SUPABASE_SERVICE_ROLE_KEY` e futuras credenciais de storage são exclusivamente server-side e nunca devem ser expostas com prefixo `NEXT_PUBLIC_`.

## Arquitetura

```text
src/
├── app/                     # rotas App Router; grupos (auth) e (app)
├── components/              # shell, editor e UI reutilizável
├── data/                    # fixtures locais explícitas
├── domain/                  # tipos e contrato de providers
├── integrations/social/     # adapters externos (somente mock nesta fase)
└── lib/supabase/            # cliente opcional e configuração segura
supabase/migrations/         # schema inicial, enums, índices lógicos e RLS
```

O isolamento ocorre por `workspace_id`; políticas RLS verificam membership. Uma publicação possui destinos independentes, permitindo status, tentativa, erro e `idempotency_key` por rede. Mídia guarda somente uma futura chave de object storage, nunca o arquivo pesado no PostgreSQL. Providers implementam `SocialProvider`, isolando o domínio dos SDKs externos. Jobs agendados deverão consumir os registros de publicação no futuro, fora do processo web.

## Decisões desta etapa

- **Modo demonstração em memória:** mantém a interface utilizável sem serviços externos; uma recarga restaura fixtures.
- **Adaptação determinística local:** o botão adiciona sugestões simples e editáveis. Não há promessa de IA ou integração ainda.
- **Upload somente visual:** o seletor aceita imagem/vídeo, mas não envia, armazena ou processa arquivos.
- **Supabase opcional:** o cliente só é criado quando as duas variáveis públicas existem. A migration é entregue para ativação posterior.
- **Sem middleware de sessão nesta fundação:** rotas demonstrativas ficam abertas; proteção server-side deve entrar junto à persistência real.

## Próximos passos (dentro da especificação)

1. Aplicar a migration em um projeto Supabase e conectar CRUD/autenticação às telas.
2. Adicionar callback OAuth e um adapter por rede, gradualmente, mantendo tokens no backend.
3. Conectar mídia a storage compatível com S3/R2 com URLs assinadas.
4. Implementar worker/fila desacoplado e idempotente para agendamentos, retries e observabilidade.
5. Adicionar testes de unidade, integração/RLS e fluxos end-to-end antes das integrações reais.

Fora desta entrega: cobrança, integrações sociais reais e qualquer edição/transcodificação de vídeo.

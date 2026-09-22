# Rollout das conexões oficiais de APIs sociais

## Decisão
Iniciar a camada de conexão OAuth agora, mas separar conexão de conta de publicação externa. Primeiro validamos login/autorização, identidade da conta e capacidades; somente depois ligamos envio de mídia ao worker.

## Ordem sugerida
1. Meta: Instagram + Facebook Pages
2. TikTok
3. YouTube
4. LinkedIn
5. Kwai
6. X

## Etapa 1 — somente conexão
- botão Adicionar conta abre o provedor;
- OAuth oficial;
- callback seguro no backend;
- tokens somente em private/oauth_credentials;
- social_connections guarda metadados não sensíveis;
- descobrir conta, username/display name e expiração;
- capability registry por conexão;
- reconectar e desconectar;
- health check.

## Etapa 2 — publicação controlada
- adapter por provedor;
- preflight;
- upload/staging de mídia;
- worker e scheduled_jobs;
- idempotência;
- publication_attempts;
- retry/reconcile seguindo PUBLICATION_RECOVERY_STRATEGY.md.

## TikTok Shop
Para o usuário permanece dentro da área TikTok. A conexão de comércio usa commerce_connections e autorização própria quando a funcionalidade Shop for ativada.

## Pré-requisitos antes de produção
- URLs definitivas de callback;
- política de privacidade e termos;
- credenciais/apps de desenvolvedor dos provedores;
- ambientes de teste quando disponíveis;
- revisão/permissões exigidas por cada provedor;
- secrets apenas em ambiente servidor;
- logs sem tokens.

## Regra
Nunca habilitar um botão como 'Conectado' ou 'Publicado' sem confirmação real da API.
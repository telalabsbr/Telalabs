# Checklist de ativação externa — Tela Social

Este documento separa o que já está implementado no código do que ainda depende de contas, credenciais ou configuração em serviços externos.

## 1. Supabase Auth

Já implementado no app:
- e-mail + senha;
- cadastro;
- confirmação por e-mail;
- recuperação e redefinição de senha;
- sessão persistente;
- proteção de rotas;
- callback em `/auth/callback`;
- botão “Continuar com Google”.

Para ativar completamente no ambiente:
1. configurar a URL oficial do site no Supabase Auth;
2. adicionar URLs de redirect do preview e da produção;
3. revisar os templates de confirmação/recuperação;
4. ativar Google como provider caso o botão de login Google seja mantido;
5. configurar Client ID/Secret do Google no Supabase.

O Tela Social não armazena senhas de redes sociais.

## 2. Meta — Instagram e Facebook Pages

Já implementado:
- início do OAuth;
- callback server-side;
- state anti-CSRF;
- descoberta de contas;
- persistência de conexão;
- criptografia AES-GCM dos tokens;
- credenciais privadas em `private.oauth_credentials`;
- desconexão local segura;
- cliente Graph server-side com classificação de erros;
- adapter de publicação do Instagram preparado por feature flag;
- fluxo de container → status → `media_publish` para Instagram;
- reaproveitamento do mesmo container em retry para reduzir risco de duplicidade;
- registro de IDs do provider em `provider_assets`;
- preflight inicial para imagem JPEG e Reels MP4/MOV;
- adapter permanece DESLIGADO até teste real.

Endpoint de callback criado:
`/api/oauth/meta/callback`

Variáveis exigidas:
- `META_CLIENT_ID`
- `META_CLIENT_SECRET`
- `META_OAUTH_AUTHORIZE_URL`
- `META_OAUTH_TOKEN_URL`
- `META_GRAPH_BASE_URL`
- `META_OAUTH_SCOPES`
- `OAUTH_TOKEN_ENCRYPTION_KEY`
- `APP_PUBLIC_URL`

`APP_PUBLIC_URL` é a origem canônica do callback Meta e deve ser configurada por ambiente. No preview, use a URL estável do preview/branch; em produção, o domínio de produção. O início do OAuth e o callback precisam ocorrer na mesma origem para que o cookie `state` anti-CSRF permaneça válido.

Feature flag:
- `INSTAGRAM_PUBLISHING_ADAPTER_ENABLED=false` por padrão.

A lista de scopes, URLs e a versão da Graph API ficam configuráveis de propósito. Antes de ativar produção, validar os valores na documentação e no painel atual da Meta e passar pelo processo de revisão/permissões exigido para o aplicativo.

Ainda pendente:
- credenciais reais;
- app Meta configurado;
- URLs oficiais de callback registradas;
- permissões/review;
- teste real do adapter Instagram;
- adapter de publicação Facebook Pages;
- reconciliação real com o provider quando o resultado externo ficar incerto.

## 3. Object storage / Cloudflare R2

Já implementado:
- multipart upload;
- partes assinadas;
- envio direto navegador → object storage;
- conclusão e cancelamento;
- progresso no Composer;
- vínculo da mídia ao post;
- limite inicial de 10 GB;
- pipeline especial interno acima de 2 GB;
- retenção temporária ou biblioteca;
- Media Delivery Gateway público em `/d/{token}`;
- token opaco armazenado somente como hash no banco;
- validade configurável do token;
- GET e HEAD autorizados pelo gateway;
- após validar o token, o gateway emite redirect temporário para uma URL assinada do object storage, de modo que os bytes da mídia não atravessem a Function/Vercel;
- URL assinada downstream curta (15 minutos) e renovável enquanto o token opaco do Tela Social continuar válido;
- revogação dos tokens de delivery após conclusão conhecida da publicação.

Variáveis exigidas:
- `APP_PUBLIC_URL`
- `OBJECT_STORAGE_ENDPOINT`
- `OBJECT_STORAGE_BUCKET`
- `OBJECT_STORAGE_ACCESS_KEY_ID`
- `OBJECT_STORAGE_SECRET_ACCESS_KEY`
- `OBJECT_STORAGE_REGION` (padrão `auto`)

Configuração CORS necessária no bucket:
- permitir as origens reais do Tela Social;
- permitir `PUT` para upload das partes;
- permitir os headers necessários aos uploads assinados;
- expor o header `ETag`, pois ele é usado para concluir o multipart upload.

O upload grande do usuário não passa inteiro pelo servidor Next.js. O gateway `/d/{token}` também não transporta o payload pesado: ele autoriza o acesso e redireciona o consumidor para uma URL S3/R2 assinada de curta duração. A compatibilidade de redirect, `Range` e tempo de ingestão deve ser comprovada com cada provider real antes de marcar a integração como pronta. Para vídeos muito grandes, deve-se preferir upload específico/resumível do provider quando a API oferecer esse fluxo.

## 4. Worker de publicação

Já existe no banco:
- `scheduled_jobs`;
- `publication_attempts`;
- claim com lock;
- claim filtrado apenas pelos providers realmente habilitados;
- idempotência;
- retry;
- backoff + jitter;
- Retry-After;
- estados de auth/ação necessária;
- UNKNOWN + agendamento de reconciliação;
- retry manual apenas de falhas finais;
- RPC server-only para carregar contexto completo de publicação sem expor credenciais ao browser.

Já existe no app:
- endpoint server-only `/api/internal/worker/publications`;
- proteção por Bearer secret;
- flag global de ativação;
- registry de adapters por provider;
- Instagram só entra no registry com feature flag explícita;
- nenhum job é consumido se não existir provider adapter habilitado.

Variáveis:
- `PUBLISHING_WORKER_ENABLED=false` por padrão;
- `WORKER_SECRET`;
- `INSTAGRAM_PUBLISHING_ADAPTER_ENABLED=false` por padrão.

Não ativar o executor periódico contra as redes até o adapter correspondente estar revisado, configurado e testado com uma conta real de teste.

## 5. Ordem de ativação recomendada

1. validar login/cadastro/recuperação no preview;
2. configurar Google Auth se desejado;
3. criar/configurar o bucket R2 e testar upload real;
4. validar o Media Delivery Gateway com um arquivo de teste e confirmar que o provider segue o redirect para a URL assinada;
5. criar/configurar o app Meta;
6. testar conexão Instagram;
7. deixar `INSTAGRAM_PUBLISHING_ADAPTER_ENABLED=false` durante os testes de OAuth;
8. validar preflight e publicar um conteúdo controlado em conta de teste;
9. somente depois habilitar a flag do adapter e o worker;
10. implementar Facebook Pages;
11. expandir para TikTok, YouTube, LinkedIn, Kwai e X.

## 6. Regra de lançamento

Nunca mostrar:
- “Conectado” sem confirmação real do provider;
- “Publicado” sem resposta/reconciliação real da API;
- sucesso geral se um destino falhou.

Sucesso e erro continuam sendo registrados por destino.

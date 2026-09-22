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
- desconexão local segura.

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

A lista de scopes e URLs fica configurável de propósito. Antes de ativar produção, validar os valores na documentação e no painel atual da Meta e passar pelo processo de revisão/permissões exigido para o aplicativo.

Ainda pendente:
- credenciais reais;
- app Meta configurado;
- URLs oficiais de callback registradas;
- permissões/review;
- adapter de publicação real.

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
- retenção temporária ou biblioteca.

Variáveis exigidas:
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

O arquivo grande não passa inteiro pelo servidor Next.js.

## 4. Worker de publicação

Já existe no banco:
- `scheduled_jobs`;
- `publication_attempts`;
- claim com lock;
- idempotência;
- retry;
- backoff + jitter;
- Retry-After;
- estados de auth/ação necessária;
- UNKNOWN + reconciliação;
- retry manual apenas de falhas finais.

Ainda não ativar um executor periódico contra as redes até existir pelo menos um provider adapter real e testado.

## 5. Ordem de ativação recomendada

1. validar login/cadastro/recuperação no preview;
2. configurar Google Auth se desejado;
3. criar/configurar o bucket R2 e testar upload real;
4. criar/configurar o app Meta;
5. testar conexão Instagram;
6. testar conexão Facebook Pages;
7. implementar e validar preflight Meta;
8. implementar primeira publicação real controlada;
9. ligar o worker somente para o provider validado;
10. expandir para TikTok, YouTube, LinkedIn, Kwai e X.

## 6. Regra de lançamento

Nunca mostrar:
- “Conectado” sem confirmação real do provider;
- “Publicado” sem resposta/reconciliação real da API;
- sucesso geral se um destino falhou.

Sucesso e erro continuam sendo registrados por destino.

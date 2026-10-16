# Cloudflare R2 — Runbook de ativação do Tela Social

**Status:** preparação operacional; nenhum bucket/segredo é considerado configurado até o teste real.

Este runbook cobre apenas a ativação externa do object storage já implementado no Tela Social. Ele não habilita publicação social nem altera as feature flags do worker/providers.

## 1. Princípios

- O bucket deve permanecer **privado**.
- Arquivos grandes são enviados diretamente do navegador ao R2 por multipart/presigned URLs.
- Credenciais R2 ficam somente no servidor/Vercel; nunca usar `NEXT_PUBLIC_`.
- `/d/{token}` é uma porta opaca do Tela Social. Após validar o token, ela redireciona para uma URL S3/R2 assinada de curta duração; os bytes não atravessam a Function da Vercel.
- A compatibilidade do redirect com cada provider deve ser testada antes de marcar o adapter como pronto.

## 2. Criar o bucket

No Cloudflare R2:

1. criar um bucket privado para o ambiente de teste;
2. não habilitar acesso público ao bucket;
3. criar credenciais S3/R2 com acesso de leitura e escrita restrito ao bucket sempre que o painel permitir esse escopo;
4. guardar Account ID, Access Key ID e Secret Access Key fora do repositório.

Não definir um nome de bucket como requisito de código. O nome entra por variável de ambiente.

## 3. Endpoint S3

Usar o endpoint S3 do R2 no formato fornecido pela Cloudflare para a conta:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Configuração esperada pelo app:

```text
OBJECT_STORAGE_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
OBJECT_STORAGE_BUCKET=<NOME_DO_BUCKET>
OBJECT_STORAGE_ACCESS_KEY_ID=<SECRET_SERVER_ONLY>
OBJECT_STORAGE_SECRET_ACCESS_KEY=<SECRET_SERVER_ONLY>
OBJECT_STORAGE_REGION=auto
```

`OBJECT_STORAGE_PUBLIC_HOST` está reservado para usos futuros. A entrega privada atual usa o endpoint S3 com presigned URL e não depende de custom domain.

## 4. CORS do bucket

Origens atualmente conhecidas do Tela Social:

- Preview estável do branch: `https://telalabs-git-feat-ui-redesign-v1-thiagofti-2849.vercel.app`
- Produção histórica: `https://telalabs.vercel.app`

Política inicial recomendada:

```json
[
  {
    "AllowedOrigins": [
      "https://telalabs-git-feat-ui-redesign-v1-thiagofti-2849.vercel.app",
      "https://telalabs.vercel.app"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

O requisito essencial para o multipart atual é:

- permitir `PUT` vindo das origens do app;
- expor `ETag`, porque o cliente coleta o ETag de cada parte para o `CompleteMultipartUpload`.

Se o browser mostrar no preflight um header adicional que o cliente realmente envia, adicionar somente esse header à lista. Não ampliar CORS por tentativa e erro sem observar a requisição real.

## 5. Variáveis por ambiente na Vercel

### Preview

```text
APP_PUBLIC_URL=https://telalabs-git-feat-ui-redesign-v1-thiagofti-2849.vercel.app
```

Adicionar também todas as `OBJECT_STORAGE_*` server-only ao ambiente Preview.

### Production

```text
APP_PUBLIC_URL=https://telalabs.vercel.app
```

Adicionar também todas as `OBJECT_STORAGE_*` server-only ao ambiente Production quando a produção for ativada conscientemente.

Não reutilizar a `APP_PUBLIC_URL` de produção no preview durante OAuth Meta. O cookie `state` anti-CSRF é ligado à origem que iniciou o fluxo.

## 6. Smoke test 1 — upload multipart pequeno

Objetivo: provar browser → R2 → complete sem publicação social.

1. autenticar no preview com uma conta real de teste;
2. selecionar a marca ativa;
3. anexar uma imagem ou vídeo pequeno;
4. observar criação de `media_assets` com `PENDING_UPLOAD`;
5. confirmar que o browser recebe URLs assinadas das partes;
6. confirmar `PUT` direto ao R2;
7. confirmar que a resposta de cada parte expõe `ETag` ao JavaScript;
8. concluir o multipart;
9. confirmar `media_assets.processing_status = 'READY'` e `object_key` válido;
10. confirmar que o arquivo não passou como payload pelo endpoint Next.js.

Critério de aprovação: upload conclui, progresso chega a 100%, ETags são aceitos e o asset fica READY.

## 7. Smoke test 2 — abort e retry

1. iniciar upload de um arquivo de teste;
2. interromper a rede ou cancelar antes da conclusão;
3. confirmar chamada ao endpoint de abort;
4. confirmar que o upload multipart é encerrado no R2;
5. repetir upload e confirmar que um novo fluxo conclui normalmente.

Critério de aprovação: upload interrompido não fica tratado como READY e um novo upload não é contaminado pelo anterior.

## 8. Smoke test 3 — Media Delivery Gateway

Executar somente depois de existir um asset READY anexado a um PostTarget de teste.

1. emitir token de delivery pelo fluxo server-only já implementado;
2. acessar `HEAD /d/{token}`;
3. confirmar resposta `307` apontando para presigned URL R2 de curta duração;
4. seguir o redirect e confirmar `HEAD` no objeto;
5. acessar `GET /d/{token}`;
6. confirmar `307` e download direto do R2, sem streaming pela Vercel;
7. testar leitura parcial com `Range` seguindo o redirect;
8. revogar o token Tela Social e confirmar que novas tentativas de obter um novo redirect deixam de funcionar;
9. lembrar que uma presigned URL já emitida continua válida apenas até seu próprio TTL curto.

Critério de aprovação: a Function autoriza/redireciona, mas não carrega o payload pesado.

## 9. Smoke test 4 — provider real

Não assumir que um provider segue redirects apenas porque um navegador ou `curl` segue.

Para cada provider:

1. usar conta de teste controlada;
2. fornecer a URL `/d/{token}` pelo adapter;
3. confirmar que o provider segue o redirect para R2;
4. confirmar que consegue iniciar a leitura antes da expiração da presigned URL;
5. confirmar comportamento com vídeo e, quando aplicável, `Range`;
6. somente depois marcar esse mecanismo de delivery como compatível com o provider.

Se um provider não aceitar redirect, o adapter específico deve receber uma presigned URL direta ou usar o protocolo de upload próprio/resumível do provider. Não voltar a proxyar arquivos grandes pela Vercel.

## 10. Arquivos grandes

A implementação do Tela Social aceita até 10 GB no fluxo long-form aprovado. Para R2, multipart é a base adequada para arquivos grandes.

Testes progressivos recomendados:

1. pequeno: poucos MB;
2. médio: centenas de MB;
3. acima do limiar técnico interno de 2 GB;
4. somente depois testar próximo ao limite de 10 GB.

Não transformar o limiar interno de 2 GB em copy de produto.

## 11. Lifecycle

Há dois lifecycles distintos:

- **multipart incompleto:** o R2 possui limpeza própria para uploads multipart abandonados, configurável no bucket;
- **mídia temporária concluída:** continua sendo responsabilidade do Tela Social decidir quando excluir com segurança após todos os targets concluírem e passar a safety window.

Não apagar mídia enquanto existir target pendente, retry, erro recuperável ou estado `UNKNOWN`.

## 12. Checklist de segurança

- [ ] bucket privado;
- [ ] chaves R2 server-only;
- [ ] nenhum segredo no GitHub;
- [ ] nenhum segredo com prefixo `NEXT_PUBLIC_`;
- [ ] CORS limitado às origens reais;
- [ ] `ETag` exposto;
- [ ] `APP_PUBLIC_URL` correta por ambiente;
- [ ] `/d/{token}` retorna redirect, não payload;
- [ ] presigned URL curta;
- [ ] token Tela Social revogável;
- [ ] adapter/worker continuam desligados até teste real.

## 13. Estado de conclusão

Este runbook só pode ser marcado como concluído depois de existir evidência dos smoke tests no ambiente real. A presença do código ou das variáveis no `.env.example` não conta como ativação.

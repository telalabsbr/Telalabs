# Estratégia de recuperação de erros de publicação

## Princípio
Uma falha em um destino nunca cancela automaticamente os demais. A recuperação acontece por destino e evita republicar onde já houve sucesso.

## Ação por tipo de erro

### 1. Falha temporária
Exemplos: timeout, indisponibilidade do provedor, erro 5xx e algumas falhas de rede.
- tentar novamente automaticamente;
- usar backoff exponencial com jitter;
- limite inicial: 3 tentativas automáticas;
- mostrar estado `Tentando novamente` e próxima tentativa quando disponível;
- depois do limite, mudar para falha final e oferecer `Tentar novamente` manual.

### 2. Rate limit
- respeitar Retry-After/cabeçalhos do provedor quando existirem;
- não tratar como erro final imediatamente;
- reagendar automaticamente;
- não exigir ação do usuário enquanto ainda houver uma tentativa segura.

### 3. Autorização, token ou permissão
- não repetir cegamente;
- marcar como `Ação necessária`;
- CTA principal: `Reconectar conta`;
- depois da reconexão, permitir retomar apenas os destinos que falharam.

### 4. Conteúdo inválido ou configuração incompatível
Exemplos: texto acima do limite, formato não aceito, configuração exigida pela rede.
- não repetir automaticamente;
- CTA principal: `Corrigir publicação`;
- levar o usuário diretamente ao campo problemático;
- executar preflight novamente antes de reenviar.

### 5. Resultado desconhecido
Quando a requisição saiu, mas não existe certeza se a rede publicou:
- não publicar novamente de imediato;
- entrar em `Verificando`/UNKNOWN;
- criar um job `RECONCILE_TARGET` separado do job de publicação;
- consultar/reconciliar com o provedor;
- somente voltar para a fila de publicação quando a reconciliação provar que uma nova tentativa é segura;
- se a rede confirmar que a mídia já foi publicada, registrar o sucesso local sem republicar;
- se a incerteza continuar depois das verificações seguras, mudar para `Ação necessária` em vez de arriscar duplicidade.

## Reconciliação Instagram implementada
A primeira implementação real de reconciliação usa evidência do próprio provider:

1. **Container criado, persistência local incerta**
   - o adapter preserva o ID do container retornado pela Meta;
   - o reconciliador consulta o status desse container;
   - se o container falhou/expirou, encerra como falha final;
   - se o container terminou e o `media_publish` ainda não ocorreu, restaura o registro local e marca `SAFE_TO_RETRY`;
   - somente então um novo `PUBLISH_TARGET` é criado.

2. **`media_publish` respondeu com mídia publicada, persistência local incerta**
   - o adapter preserva o ID da mídia retornado pela Meta;
   - o reconciliador confirma esse ID no provider;
   - se confirmado, registra `provider_assets`, revoga URLs temporárias de delivery e conclui o destino como `PUBLISHED` sem fazer novo `media_publish`.

3. **Estado ainda ambíguo**
   - não transforma container `FINISHED` em autorização automática para republicar quando não é possível provar em que etapa a exceção ocorreu;
   - mantém `UNKNOWN` e repete apenas a consulta de reconciliação;
   - ao esgotar as verificações seguras, muda para `NEEDS_ACTION`.

## Falha final
Quando não há mais retentativa automática segura:
1. mostrar motivo em linguagem simples;
2. mostrar ação recomendada por contexto;
3. oferecer `Tentar novamente` apenas quando a falha é realmente final e repetível;
4. manter `Excluir` como ação secundária, nunca como recomendação principal.

`UNKNOWN` e `NEEDS_ACTION` não devem oferecer retentativa cega.

## Sucesso parcial
Exemplo: Instagram e Facebook publicados, TikTok falhou.
- mostrar `2 de 3 publicados`;
- preservar os sucessos;
- qualquer retentativa atua apenas no destino que falhou;
- nunca republicar automaticamente nos destinos já concluídos.

## Exclusão
`Excluir` significa remover/cancelar a publicação da operação do Tela Social. Não deve ser usada como solução padrão para erro. Histórico/auditoria técnica deve permanecer conforme a política de retenção.

## Implementação atual do worker
Já implementado:
- idempotência por destino;
- `schedule_version` para invalidar jobs antigos;
- `publication_attempts` para registrar tentativas de publicação e reconciliação;
- `scheduled_jobs` para publicação, retries e `RECONCILE_TARGET`;
- claim separado para publicação e reconciliação, filtrado por providers habilitados;
- prioridade para reconciliar resultados incertos antes de consumir novos jobs do mesmo lote;
- até 3 tentativas automáticas iniciais;
- backoff exponencial com jitter;
- `Retry-After` para rate limit;
- `AUTH_REQUIRED` → `NEEDS_ACTION`;
- `UNKNOWN` → reconciliação, nunca republicação cega;
- `SAFE_TO_RETRY` → novo job de publicação somente após confirmação segura;
- falha final manualmente repetível sem tocar destinos já publicados;
- classificação de erro do adapter em transient, rate limit, auth, invalid content, unknown e permanent.

## Regra de ativação
A existência dessa lógica não autoriza ligar o worker em produção. `PUBLISHING_WORKER_ENABLED` e o adapter do provider continuam desligados até OAuth, storage, mídia e publicação real serem validados com conta de teste controlada.

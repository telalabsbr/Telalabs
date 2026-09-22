# Estratégia de recuperação de erros de publicação

## Princípio
Uma falha em um destino nunca cancela automaticamente os demais. A recuperação acontece por destino e evita republicar onde já houve sucesso.

## Ação por tipo de erro

### 1. Falha temporária
Exemplos: timeout, indisponibilidade do provedor, erro 5xx e algumas falhas de rede.
- tentar novamente automaticamente;
- usar backoff exponencial com jitter;
- limite inicial sugerido: 3 tentativas automáticas;
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
- consultar/reconciliar com o provedor;
- somente repetir quando houver segurança de que não haverá duplicidade.

## Falha final
Quando não há mais retentativa automática segura:
1. mostrar motivo em linguagem simples;
2. mostrar ação recomendada por contexto;
3. oferecer `Tentar novamente` quando aplicável;
4. manter `Excluir` como ação secundária, nunca como recomendação principal.

## Sucesso parcial
Exemplo: Instagram e Facebook publicados, TikTok falhou.
- mostrar `2 de 3 publicados`;
- preservar os sucessos;
- qualquer retentativa atua apenas no TikTok;
- nunca republicar automaticamente nos destinos já concluídos.

## Exclusão
`Excluir` significa remover/cancelar a publicação da operação do Tela Social. Não deve ser usada como solução padrão para erro. Histórico/auditoria técnica deve permanecer conforme a política de retenção.

## Implementação futura do worker
- idempotência por destino;
- schedule_version para invalidar jobs antigos;
- publication_attempts para registrar cada tentativa;
- scheduled_jobs para retries;
- reconciliação antes de repetir eventos UNKNOWN;
- classificação de erro do adapter do provedor em transient, rate_limit, auth, validation, unknown e permanent.
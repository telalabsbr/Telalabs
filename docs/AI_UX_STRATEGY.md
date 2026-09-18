# Tela — Estratégia de IA e experiência intuitiva

Atualizado em 18/09/2026.

## Objetivo

IA no Tela deve reduzir trabalho e decisões repetitivas. Ela não deve existir apenas como “chat dentro do aplicativo”.

A experiência central recomendada é:

**Tema/brief + mídia → gerar conteúdo → adaptar por rede → revisar → publicar.**

O usuário pode ignorar a IA e escrever tudo manualmente.

## MVP de IA

### 1. Criar conteúdo a partir de um tema
Entrada mínima:
- tema ou ideia.

Entradas opcionais:
- texto/rascunho;
- objetivo;
- público;
- tom;
- CTA;
- palavras obrigatórias/proibidas.

Saída:
- conteúdo-base editável.

### 2. “Adaptar para todas”
Um botão gera por destino:
- legenda;
- título/descrição quando a rede usa;
- hashtags pertinentes;
- CTA quando fizer sentido;
- versão mais curta/longa conforme a plataforma.

A geração deve respeitar as capabilities e limites conhecidos do provider.

### 3. Mesmo texto
Alternativa simples:
- usar exatamente o conteúdo-base em todas as redes compatíveis.

O sistema deve avisar se aquele texto violar limite/formato de alguma rede.

### 4. Assistente de preflight
Antes de publicar, IA + regras determinísticas podem explicar:
- texto longo demais;
- mídia incompatível;
- proporção ruim;
- ausência de título obrigatório;
- conta sem permissão;
- hashtags excessivas;
- opção não suportada.

Regras objetivas vêm do provider; IA apenas traduz/sugere.

### 5. Explicar falhas
Transformar erro técnico de API em instrução simples:
- “Sua autorização do YouTube expirou. Reconecte a conta.”
- “O TikTok não permite Duet para esta conta.”
- “Este arquivo excede o limite aceito pela rede.”

Nunca esconder o código técnico nos logs administrativos.

### 6. Acessibilidade
Gerar como sugestão:
- alt text;
- descrição visual;
- legendas/transcrição quando houver pipeline de áudio.

## Próximas funções de IA

Prioridade média:
- 2 a 4 variações de texto para escolha;
- voz de marca por workspace;
- tradução/localização;
- reaproveitar um texto longo em posts curtos;
- transformar transcrição de vídeo em descrição;
- sugestões de calendário editorial;
- sugestões de CTA;
- ideias de posts a partir de conteúdos anteriores;
- classificação automática de mídia e tags internas.

Depois de termos analytics reais:
- melhor horário por conta/rede;
- comparação de desempenho por tipo de conteúdo;
- recomendação baseada no histórico real daquele workspace;
- sugestão de repost/reciclagem;
- detecção de queda/anomalia de performance.

Fase multimídia posterior:
- crop/resize por rede;
- transcodificação;
- remoção de silêncios;
- cortes de melhores trechos;
- legendas queimadas;
- geração/seleção de thumbnail;
- variações de capa;
- adaptação horizontal ↔ vertical;
- resumo de vídeo longo em clipes.

## Guardrails de produto

- Sempre mostrar o que a IA gerou antes da publicação automática no MVP.
- Usuário mantém controle e pode editar.
- Não inventar capacidades de uma rede.
- Não afirmar que hashtags/horários “garantem alcance”.
- Sugestões de melhor horário devem distinguir heurística genérica de análise baseada em dados reais da conta.
- Conteúdo gerado por IA pode exigir marcação específica em algumas plataformas; providers devem acompanhar essas regras.
- Dados de um cliente não devem ser usados para personalizar outro cliente sem base jurídica e desenho explícito.

## Experiência para usuário leigo

Princípio: **complexidade progressiva**.

Tela inicial de criação:
1. Adicionar mídia.
2. Escrever um tema, texto ou ambos.
3. Escolher redes/contas.
4. Escolher:
   - usar o mesmo texto; ou
   - adaptar com IA.
5. Publicar agora/agendar.

Depois, um link ou botão:
**“Ajustar detalhes por rede”**

Somente aí aparecem controles avançados de cada destino.

Isto permite que o Tela seja simples sem ser limitado.

## Descoberta de recursos

Para o usuário perceber que o Tela faz mais do que “postar”:
- onboarding curto no primeiro uso;
- checklist inicial;
- dicas contextuais, não pop-ups constantes;
- templates de fluxo (“Publicar em todas”, “Só Stories”, “Vídeo curto”, “YouTube + Shorts” quando tecnicamente aplicável);
- empty states úteis;
- central de recursos/pesquisa;
- “O que o Tela pode fazer?” acessível, sem ocupar a tela principal.

## Testes de usabilidade

Antes de comercializar:
- testar criação/publicação com pessoas que nunca viram o Tela;
- observar sem ensinar;
- medir onde travam;
- registrar cliques desnecessários;
- verificar se entendem “conteúdo-base”, “destino”, “conexão”, “agendamento” e “ajustes por rede”;
- repetir o teste após as correções.

O objetivo é reduzir explicações externas: a interface deve ensinar pelo próprio fluxo.

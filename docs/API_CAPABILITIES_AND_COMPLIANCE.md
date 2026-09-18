# Tela — Capacidades de APIs, mídia e conformidade

Pesquisa inicial atualizada em 18/09/2026.

Este documento é um snapshot de produto/engenharia, não uma promessa de que toda função estará disponível em todas as contas. APIs sociais mudam, permissões variam por tipo de conta/região e algumas capacidades precisam ser resolvidas em tempo real.

## Princípio de produto: capacidade por destino

O Tela não deve mostrar o mesmo formulário para todas as redes.

Cada provider deve informar o que aquela conexão suporta e a interface deve montar os controles dinamicamente. Exemplos de superfícies:
- feed;
- reel;
- story;
- short;
- vídeo tradicional.

Exemplos de opções:
- título;
- legenda/descrição;
- hashtags;
- privacidade;
- localização;
- comentários;
- duet/stitch;
- compartilhar também no feed;
- frame de capa;
- thumbnail customizada;
- alt text;
- conteúdo de marca/parceria;
- música automática ou catálogo de música, quando a API realmente permitir.

A disponibilidade pode ser: suportada, não suportada, condicional ou ainda desconhecida.

## Instagram — achados iniciais

A coleção oficial da Meta no Postman documenta publicação para contas profissionais. No fluxo com Facebook Login:
- contas Business/Creator podem usar Content Publishing;
- Stories via API são indicados como disponíveis apenas para contas Business;
- Reels usam container de mídia e publicação posterior;
- o parâmetro `share_to_feed` permite escolher se um Reel também aparece no feed.

Não encontramos, no fluxo público de publicação consultado, um parâmetro equivalente a “escolher música do catálogo do Instagram”. Para o MVP, áudio de vídeo deve ser tratado como parte do arquivo enviado. Se a Meta expuser um recurso oficial de música no futuro, ele entra como nova capability.

Fontes:
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://www.postman.com/meta/instagram/folder/y6xustx/reels-publishing

## TikTok — achados iniciais

A Content Posting API oficial suporta Direct Post e exige que a aplicação consulte informações do criador para montar corretamente a UX.

Para vídeo, a documentação atual expõe, entre outros:
- caption/título;
- nível de privacidade;
- permitir/bloquear comentários;
- permitir/bloquear Duet;
- permitir/bloquear Stitch;
- frame de capa por timestamp;
- marcação de conteúdo de marca.

As opções permitidas podem depender da conta. A própria documentação exige que a UI respeite as opções retornadas pela API e obtenha consentimento explícito antes da publicação.

Para posts de foto, a documentação mostra `auto_add_music`. Isso não equivale a escolher livremente uma faixa de um catálogo.

Apps não auditados têm restrições de visibilidade; aprovação/auditoria é requisito real para uma integração comercial.

Fontes:
- https://developers.tiktok.com/docs/en/content-posting-api-reference-direct-post
- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://developers.tiktok.com/docs/en/content-sharing-guidelines

## YouTube — achados iniciais

A Data API permite upload e metadados de vídeo. A API também possui endpoint próprio para thumbnail customizada.

Shorts não precisam ser tratados como uma API de publicação totalmente separada: a classificação depende das características do vídeo. A documentação atual do YouTube informa que vídeos quadrados ou verticais de até 3 minutos podem ser categorizados como Shorts.

As ferramentas de criação do app do YouTube permitem adicionar música/áudio, mas isso não significa que o Data API exponha o catálogo musical para um SaaS selecionar faixas. Para o MVP, tratar música como áudio já incorporado ao vídeo, salvo futura API oficial/licenciamento específico.

Fontes:
- https://developers.google.com/youtube/v3/docs/thumbnails/set
- https://developers.google.com/youtube/v3/docs/videos
- https://support.google.com/youtube/answer/15424877

## LinkedIn — achados iniciais

A Posts API atual suporta publicação orgânica de vários tipos, incluindo:
- texto;
- imagem;
- vídeo;
- documento;
- artigo;
- múltiplas imagens;
- enquete.

A API é versionada por cabeçalho e versões antigas são descontinuadas. O provider do Tela não deve hardcodar uma versão sem estratégia de atualização.

Fontes:
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/post-api-schema

## X — orientação inicial

A API possui recursos de criação de posts e mídia, além de campos/opções específicos. Como acesso e preços do X mudam com frequência, a matriz exata de capacidades deve ser validada novamente quando o adapter real for implementado.

Fonte principal:
- https://docs.x.com/

## Kwai / Kuaishou — achados iniciais

A Open Platform da Kuaishou documenta OAuth, scope `user_video_publish`, upload de vídeo e publicação assíncrona. A documentação encontrada também expõe caption e upload de capa.

Isto é um sinal concreto de que existe capacidade oficial de publicação, mas ainda devemos validar no piloto comercial se o mesmo onboarding/acesso se aplica às contas Kwai internacionais que o Tela pretende atender.

Fontes:
- https://open.kuaishou.com/platformDocs/openAbility/contentManagement/createAVideo
- https://open.kuaishou.com/platform/openApi?menu=55

## Música e direitos

Não construir no MVP uma “biblioteca de músicas” própria sem licenciamento.

Estratégia segura inicial:
1. usuário envia vídeo com áudio que ele declara ter direito de usar; ou
2. usar somente recursos musicais que a própria API oficial exponha explicitamente para publicação por terceiros.

Disponibilizar uma música no app para o usuário inserir em conteúdo pode envolver direitos de reprodução, adaptação, sincronização/inclusão audiovisual e distribuição. Isso precisa de tratamento jurídico/licenciamento próprio.

A Lei 9.610/1998 prevê autorização para várias modalidades de uso de obras, inclusive reprodução, adaptação, inclusão em produção audiovisual, distribuição e armazenamento.

Fonte:
- https://www.planalto.gov.br/ccivil_03/leis/l9610.htm

## LGPD e armazenamento de vídeos

Armazenar vídeo não é proibido por si só. Porém, se o conteúdo contém pessoas identificadas/identificáveis, metadados, localização, contas sociais ou outros dados pessoais, há tratamento de dados e a LGPD pode se aplicar.

Arquitetura mínima antes de usuários reais:
- finalidade e base legal documentadas;
- política de privacidade;
- termos com papéis e responsabilidades;
- minimização: guardar somente o necessário;
- retenção e exclusão definidas;
- criptografia em trânsito e, quando aplicável, em repouso;
- controle de acesso;
- logs de acesso/ações administrativas;
- backups e plano de recuperação;
- processo para direitos do titular;
- processo para incidentes;
- contratos adequados com suboperadores de nuvem.

Dependendo da operação, o cliente pode atuar como controlador dos dados presentes no conteúdo e o Tela como operador ao hospedar/processar/publicar em nome dele. O Tela também será controlador em tratamentos próprios, como cadastro, cobrança, segurança e suporte. A classificação deve ser feita operação por operação.

Fontes:
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm
- https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados
- https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-orientativo-para-definicoes-dos-agentes-de-tratamento-de-dados-pessoais-e-do-encarregado

## Atualizações das APIs

Mudanças na API não “atualizam o código do Tela sozinhas”.

Algumas APIs são versionadas e algumas oferecem changelogs, alertas ou webhooks para eventos. Webhook informa eventos do uso/conta; ele não reescreve nossa integração quando uma versão muda.

Estratégia recomendada:
1. provider encapsulado por plataforma;
2. versão da API configurável quando possível;
3. testes automatizados de contrato/smoke;
4. monitor de changelogs/deprecações;
5. alerta quando houver mudança relevante;
6. revisão humana antes de alterar integração em produção;
7. feature flags para desligar temporariamente uma função quebrada;
8. fallback amigável na UI.

O YouTube mantém histórico de revisões e o LinkedIn usa versões explícitas. TikTok oferece notificações de atualizações e a Meta trabalha com versões do Graph API. Logo, o Tela deve possuir rotina de manutenção de integrações desde o início.

Fontes:
- https://developers.google.com/youtube/v3/revision_history
- https://developers.tiktok.com/docs/en/content-posting-api-get-started
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api

## Regra de UX

O objetivo não é copiar todas as telas de configuração de todas as redes e despejá-las de uma vez no usuário.

A experiência deve ter:
- **Modo rápido:** mídia + tema/texto + destinos + publicar/agendar.
- **Configurações por rede:** seção opcional “Ajustar detalhes”, mostrando somente controles realmente suportados.
- **Avisos inteligentes:** o Tela explica quando uma opção não existe naquela rede/conta.
- **Preflight:** antes de publicar, validar mídia, texto, permissões e configurações.

Assim atendemos usuários leigos sem impedir usuários avançados.

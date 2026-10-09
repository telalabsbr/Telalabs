# Painel Administrativo do Tela Social — plano de arquitetura

## Objetivo
O painel administrativo é interno ao operador do Tela Social e não deve aparecer na navegação normal do cliente. Ele será usado para administrar usuários, organizações, planos, cobrança, cupons, suporte, indicações e saúde operacional.

## Segurança
- rota separada da experiência do cliente;
- acesso apenas para SUPER_ADMIN definido em metadados seguros do usuário;
- nunca confiar apenas em ocultar o menu;
- todas as ações sensíveis devem ocorrer no servidor;
- MFA obrigatório antes de liberar produção;
- log de auditoria para suspensão, exclusão, alteração de plano, crédito manual, cupom, reembolso e impersonation;
- nenhuma senha social ou token OAuth deve aparecer no painel.

## Módulos

### 1. Visão geral
- usuários cadastrados;
- organizações/marcas;
- contas sociais conectadas;
- planos gratuitos/pagos;
- MRR, receita, inadimplência e churn quando billing existir;
- publicações processadas;
- falhas por provedor;
- consumo de storage, IA e filas;
- chamados abertos.

### 2. Clientes
- busca por nome, e-mail, organização e marca;
- detalhes da assinatura;
- uso e limites;
- status da conta;
- conexões por rede;
- suspender/reativar;
- solicitar exclusão;
- histórico de ações administrativas;
- futuro: ver como cliente somente com auditoria e sem descobrir senha.

### 3. Planos e preços
- catálogo de planos;
- preço mensal/anual;
- limites de marcas, contas conectadas, publicações, IA, storage e histórico;
- feature flags por plano;
- ativar/desativar oferta sem deploy;
- preservar versão histórica para assinantes antigos.

### 4. Cobrança
- assinaturas;
- status de pagamento;
- faturas;
- reembolsos/créditos manuais;
- inadimplência;
- gateway e IDs externos;
- nunca armazenar número completo de cartão.

### 5. Cupons
- código;
- tipo percentual ou valor fixo;
- validade;
- limite global;
- limite por cliente;
- plano elegível;
- primeiro pagamento somente, quando desejado;
- origem/campanha/influenciador;
- métricas de uso e conversão.

### 6. Indicações e afiliados
Fase inicial recomendada:
- indicação por crédito na própria assinatura;
- qualificação após primeiro pagamento confirmado;
- prevenção de autoindicação e múltiplas contas artificiais.

Fase posterior:
- afiliado com saldo e saque;
- regras fiscais e antifraude antes de liberar pagamento em dinheiro.

### 7. Suporte
- fila de chamados;
- categoria e status;
- cliente/organização vinculados;
- contexto técnico capturado automaticamente;
- resposta por e-mail/in-app;
- macros de resposta;
- artigos de ajuda relacionados;
- métricas de volume e tempo de resolução.

### 8. Operação técnica
- status dos provedores;
- OAuth expirando;
- filas e scheduler;
- falhas e retries;
- webhooks;
- eventos UNKNOWN;
- API Watch;
- storage;
- health checks.

### 9. Configuração global
- feature flags;
- limites;
- mensagens operacionais;
- manutenção programada;
- parâmetros de trial/free credits;
- configuração de e-mail e notificações.

### 10. Auditoria
Registrar ator, ação, entidade, valor anterior, valor novo, IP/contexto quando disponível e timestamp.

## Sequência recomendada
1. fechar billing/gateway;
2. criar autorização SUPER_ADMIN;
3. construir Clientes + Suporte + Visão geral;
4. adicionar Billing + Planos + Cupons;
5. adicionar Indicações;
6. adicionar Operação técnica e feature flags avançados.

## Princípio
O painel administrativo deve reduzir trabalho manual. Evitar construir telas que apenas reproduzam dados sem permitir ação segura e auditável.
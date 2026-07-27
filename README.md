# ASAX CRM — Atendimento e Agentes de IA

Plataforma de CRM omnichannel white-label para organizar leads, atender pelo
WhatsApp e criar fluxos de pré-atendimento com agentes de inteligência
artificial.

O projeto reúne CRM Kanban, inbox multiatendimento, automações visuais,
qualificação de leads, agentes configuráveis e uma base preparada para
operações multi-tenant.

> Projeto em desenvolvimento. Antes de utilizar em produção, revise segurança,
> consentimento dos contatos, políticas dos canais e infraestrutura.

## Funcionalidades atuais

### WhatsApp

- Conexão por QR Code através da Evolution API.
- Sincronização de contatos salvos.
- Recebimento e envio de mensagens em tempo real.
- Envio de texto, imagens, vídeos, documentos, figurinhas e áudio.
- Gravação de mensagem de voz com prévia, cancelamento e confirmação.
- Seleção de vários arquivos e visualização em formato de álbum.
- Arrastar arquivos diretamente para dentro do chat.
- Links clicáveis e status de entrega.
- Atendimento humano com pausa individual da automação.

### CRM

- Pipeline Kanban com movimentação por arrastar e soltar.
- Criação automática de lead a partir do pré-atendimento.
- Classificação de contatos pelo menu do botão direito.
- Qualificação, histórico, tags e etapas comerciais.
- Acesso rápido do negócio para a conversa no WhatsApp.

### Automações

- Editor visual com blocos posicionáveis e conexões por saída.
- Gatilho por qualquer mensagem ou palavra-chave.
- Blocos de mensagem, condição, menu, espera, classificação, ticket, webhook,
  agente de IA e transferência para humano.
- Ramificações `Sim`, `Não`, `Concluído`, `Humano` e opções personalizadas.
- Validação antes da publicação.
- Pausa definitiva após conclusão da qualificação ou transferência humana.
- Proteção contra reinício do fluxo para contatos já qualificados.

### Agentes de IA

- Integração com Google Gemini e OpenAI.
- Cadastro de identidade, função, tom de voz e contexto da empresa.
- Planos e preços cadastrados separadamente.
- Roteiro ordenado de perguntas para qualificação.
- Perguntas interpretadas como intenção, sem repetição mecânica.
- Respeito à recusa de dados, sem insistência.
- Transferência imediata quando o contato solicita atendimento humano.
- Registro de consumo de tokens.
- Cofre local criptografado para múltiplas credenciais de IA.
- Seleção de uma credencial diferente em cada bloco de automação.

### White-label e operação

- Interface ASAX responsiva.
- Estrutura multi-tenant no banco de dados.
- Painel do parceiro para clientes, planos e identidade visual.
- API NestJS versionada em `/api/v1`.
- Autenticação JWT, RBAC, auditoria e documentação Swagger.
- Modelos para campanhas, tickets, canais, integrações e webhooks.

## Estrutura do projeto

```text
apps/
  web/                 Painel principal ASAX e rotas operacionais
  api-gateway/         API NestJS, autenticação e regras de negócio
  dashboard-partner/   Painel white-label do parceiro
packages/
  database/            Schema Prisma e dados iniciais
  shared-types/        Contratos compartilhados
docker/
  docker-compose.yml   Infraestrutura opcional
```

O monorepo utiliza pnpm e Turborepo.

## Tecnologias

- Next.js 15 e React 19
- NestJS
- TypeScript
- PostgreSQL e Prisma
- Evolution API
- Google Gemini e OpenAI
- Redis, RabbitMQ, Qdrant e MinIO na arquitetura completa

## Requisitos

- Node.js 20 ou superior
- pnpm 10
- PostgreSQL 16 para a API principal
- Uma Evolution API acessível para a conexão por QR Code

Redis, RabbitMQ, Qdrant e MinIO são opcionais durante o desenvolvimento local,
mas fazem parte da infraestrutura planejada para produção.

## Configuração

Crie um arquivo `.env` na raiz usando `.env.example` como referência:

```env
DATABASE_URL="postgresql://crm:senha@localhost:5432/crm_white_label"
JWT_SECRET="substitua-por-uma-chave-segura-com-32-caracteres"
WEB_URL="http://localhost:3000"
PORT="3001"
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

Para o painel web e WhatsApp, crie `apps/web/.env.local`:

```env
EVOLUTION_API_URL="http://127.0.0.1:8080"
EVOLUTION_API_KEY="sua-chave-da-evolution"
EVOLUTION_INSTANCE_NAME="asax-principal"
EVOLUTION_WEBHOOK_SECRET="crie-um-segredo-para-o-webhook"
```

As chaves do Gemini e da OpenAI podem ser cadastradas pela própria interface em
**Configurações → APIs e credenciais**. As chaves são criptografadas localmente
e nunca retornam completas para o navegador.

Nunca publique arquivos `.env`, `.env.local`, a pasta `.runtime` ou credenciais
reais.

## Executar sem Docker

Instale as dependências:

```bash
pnpm install
```

Gere o cliente Prisma e prepare o banco:

```bash
pnpm db:generate
pnpm db:push
pnpm --filter @crm/database db:seed
```

Inicie todos os aplicativos:

```bash
pnpm dev
```

Ou inicie somente o CRM:

```bash
pnpm --filter web dev
```

Endereços locais:

| Serviço | Endereço |
| --- | --- |
| CRM ASAX | `http://localhost:3000` |
| API | `http://localhost:3001/api/v1` |
| Swagger | `http://localhost:3001/docs` |
| Painel do parceiro | `http://localhost:3002` |

## Infraestrutura opcional com Docker

Para iniciar PostgreSQL, Redis, RabbitMQ, Qdrant e MinIO:

```bash
docker compose -f docker/docker-compose.yml up -d
```

## Conectar o WhatsApp

1. Configure a Evolution API no arquivo `apps/web/.env.local`.
2. Inicie a Evolution API e o painel ASAX.
3. Abra **Canais** no CRM.
4. Solicite o QR Code e leia-o com o WhatsApp do telefone.
5. Aguarde o estado mudar para conectado.
6. Abra **Conversas** para sincronizar contatos e testar mensagens.

### Aviso sobre conexão por QR Code

A conexão via Evolution API não é a API oficial da Meta. Ela é útil para
desenvolvimento e operações de baixo custo, mas pode apresentar desconexões e
risco de restrição ou banimento do número.

Para produção e números comerciais importantes, prefira a **WhatsApp Cloud API
oficial da Meta**. Independentemente do provedor, respeite consentimento,
opt-out e as políticas de mensagens do WhatsApp.

## Criar uma automação com IA

1. Cadastre a empresa, os planos e o roteiro em **Agentes de IA**.
2. Cadastre e teste uma chave em **Configurações → APIs e credenciais**.
3. Abra **Automações** e adicione um bloco **Agente de IA**.
4. Selecione a credencial que o bloco deverá usar.
5. Conecte o gatilho ao agente e configure as saídas de conclusão e humano.
6. Corrija os avisos do editor e clique em **Salvar e publicar**.

Quando a qualificação termina ou o contato pede uma pessoa, a automação é
pausada para aquele número. A reativação só ocorre manualmente pela conversa.

## Verificações

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter api-gateway typecheck
pnpm --filter @crm/database typecheck
```

## Segurança

- Dados operacionais locais ficam em diretórios ignorados pelo Git.
- Credenciais de IA são protegidas com AES-256-GCM.
- Credenciais nunca devem ser expostas em respostas da API ou logs.
- Use segredos fortes e diferentes em produção.
- Restrinja CORS, webhooks e acesso à Evolution API.
- Implemente backup, rotação de chaves e monitoramento antes da operação
  comercial.

## Status

O ASAX já possui uma experiência local funcional para CRM, WhatsApp e
pré-atendimento com IA. A evolução para produção inclui persistência integral
no PostgreSQL, filas distribuídas, Meta Cloud API, Instagram oficial, campanhas,
billing e observabilidade.

## Licença

Nenhuma licença pública foi definida até o momento. Todos os direitos
reservados ao proprietário do repositório.

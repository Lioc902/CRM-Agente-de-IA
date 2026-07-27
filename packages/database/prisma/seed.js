const { PrismaClient } = require('@prisma/client')
const { createHash } = require('crypto')
const db = new PrismaClient()

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: 'nexo' },
    update: {},
    create: {
      slug: 'nexo', name: 'Nexo CRM', primaryColor: '#123626', accentColor: '#D8FF72',
      plan: 'ENTERPRISE', status: 'ACTIVE', maxUsers: 50, maxContacts: 50000,
      modules: ['crm','inbox','campaigns','automations','ai','reports','integrations'],
    },
  })
  await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@nexocrm.local' } },
    update: {},
    create: {
      tenantId: tenant.id, email: 'admin@nexocrm.local', name: 'Administrador',
      role: 'OWNER', passwordHash: createHash('sha256').update('Nexo@2026!').digest('hex'),
    },
  })
  const pipeline = await db.pipeline.findFirst({ where: { tenantId: tenant.id } }) ?? await db.pipeline.create({
    data: { tenantId: tenant.id, name: 'Pipeline principal', stages: { create: [
      { name: 'Entrada', order: 1, color: '#87A7FF' }, { name: 'Qualificação', order: 2, color: '#B994FF' },
      { name: 'Proposta enviada', order: 3, color: '#FFB66E' }, { name: 'Fechamento', order: 4, color: '#58D6AE' },
    ]}},
  })
  const stages = await db.stage.findMany({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } })
  if (await db.contact.count({ where: { tenantId: tenant.id } }) === 0) {
    for (const [index, item] of [
      ['Marina Costa','Orbe Studio','marina@example.com','5511999990001',4800],
      ['Rafael Nunes','Clínica Vitta','rafael@example.com','5511999990002',7200],
      ['Bianca Lima','Norte Solar','bianca@example.com','5511999990003',12500],
      ['Joana Freire','Atlas RH','joana@example.com','5511999990004',15400],
    ].entries()) {
      const [name, company, email, phone, value] = item
      const contact = await db.contact.create({ data: { tenantId: tenant.id, name, company, email, phone, tags: index === 2 ? ['IA qualificado'] : ['Inbound'] } })
      await db.deal.create({ data: { tenantId: tenant.id, stageId: stages[Math.min(index, stages.length - 1)].id, contactId: contact.id, title: `${company} — Plano CRM`, value } })
    }
  }
  if (await db.aiAgent.count({ where: { tenantId: tenant.id } }) === 0) {
    await db.aiAgent.create({ data: { tenantId: tenant.id, name: 'SDR Nexo', provider: 'openai', modelId: 'gpt-4.1-mini', instructions: 'Qualifique o lead com objetividade, nunca invente informações e transfira para um humano quando necessário.', active: true } })
  }
  console.log('Seed concluído: admin@nexocrm.local / senha definida no arquivo seed para ambiente local.')
}
main().finally(() => db.$disconnect())

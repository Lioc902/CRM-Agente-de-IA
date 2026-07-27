import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

const profilePath = path.join(process.cwd(), '.runtime', 'ai-profile.json')
const defaultQuestion = (field:string) => ({
  id: field.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-'),
  field,
  question: field === 'Nome' ? 'Antes de continuarmos, qual é o seu nome?'
    : field === 'Empresa' ? 'Qual é o nome da sua empresa?'
    : field === 'Necessidade principal' ? 'O que você procura ou precisa resolver hoje?'
    : field === 'Prazo para começar' ? 'Quando você pretende começar?'
    : `Qual é o seu ${field.toLowerCase()}?`,
  required: true,
})
const defaults = {
  companyName: 'ASAX',
  agentName: 'Assistente ASAX',
  role: 'Pré-atendimento comercial',
  tone: 'Consultivo, cordial, objetivo e natural',
  companyContext: '',
  offers: [] as { id:string; name:string; description:string; price:string; billing:string; conditions:string }[],
  salesRules: '',
  qualificationFields: ['Nome','Necessidade principal','Prazo para começar'] as string[],
  qualificationQuestions: ['Nome','Necessidade principal','Prazo para começar'].map(defaultQuestion),
  forbiddenTopics: 'Não prometer descontos não cadastrados\nNão inventar preços ou funcionalidades',
  handoffRules: 'Quando o cliente pedir um humano, demonstrar irritação, solicitar negociação especial ou fizer pergunta sem resposta na base.',
}

export async function GET() {
  try {
    const saved=JSON.parse(await fs.readFile(profilePath,'utf8'))
    const legacyOffer=(saved.plans||saved.prices)?[{id:'legacy',name:saved.plans||'Plano principal',description:saved.plans||'',price:saved.prices||'',billing:'Conforme proposta',conditions:''}]:[]
    const qualificationFields=Array.isArray(saved.qualificationFields)?saved.qualificationFields:String(saved.requiredQuestions??'').split(/\r?\n/).filter(Boolean)
    const qualificationQuestions=Array.isArray(saved.qualificationQuestions)&&saved.qualificationQuestions.length
      ? saved.qualificationQuestions
      : qualificationFields.map(defaultQuestion)
    return NextResponse.json({ ...defaults, ...saved, offers:Array.isArray(saved.offers)?saved.offers:legacyOffer, qualificationFields, qualificationQuestions })
  }
  catch { return NextResponse.json(defaults) }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const profile = {
    companyName:String(body.companyName??''),agentName:String(body.agentName??''),role:String(body.role??''),tone:String(body.tone??''),
    companyContext:String(body.companyContext??''),salesRules:String(body.salesRules??''),forbiddenTopics:String(body.forbiddenTopics??''),handoffRules:String(body.handoffRules??''),
    offers:(Array.isArray(body.offers)?body.offers:[]).slice(0,30).map((offer:any)=>({id:String(offer.id||Date.now()),name:String(offer.name??''),description:String(offer.description??''),price:String(offer.price??''),billing:String(offer.billing??''),conditions:String(offer.conditions??'')})).filter((offer:any)=>offer.name),
    qualificationFields:(Array.isArray(body.qualificationFields)?body.qualificationFields:[]).map(String).slice(0,20),
    qualificationQuestions:(Array.isArray(body.qualificationQuestions)?body.qualificationQuestions:[]).slice(0,20).map((item:any,index:number)=>({
      id:String(item.id||`question-${index+1}`),
      field:String(item.field??'').trim(),
      question:String(item.question??'').trim(),
      required:item.required!==false,
    })).filter((item:any)=>item.field&&item.question),
  }
  await fs.mkdir(path.dirname(profilePath), { recursive: true })
  await fs.writeFile(profilePath, JSON.stringify(profile, null, 2), 'utf8')
  return NextResponse.json(profile)
}

import { NextRequest, NextResponse } from 'next/server'

const baseUrl=process.env.EVOLUTION_API_URL??'http://127.0.0.1:8080'
const apiKey=process.env.EVOLUTION_API_KEY
const instanceName=process.env.EVOLUTION_INSTANCE_NAME??'nexo-teste'
const headers=()=>({apikey:apiKey!,'content-type':'application/json'})

async function findSticker(id?:string){
  const response=await fetch(`${baseUrl}/chat/findMessages/${instanceName}`,{method:'POST',headers:headers(),body:JSON.stringify(id?{where:{key:{id}},page:1,offset:1}:{page:1,offset:500}),cache:'no-store'})
  const data=await response.json()
  const records=data?.messages?.records??[]
  return id?records[0]:records.filter((record:any)=>record.message?.stickerMessage).slice(-24).reverse()
}
async function media(record:any){
  const response=await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`,{method:'POST',headers:headers(),body:JSON.stringify({message:{key:record.key,message:record.message}})})
  return response.json()
}
export async function GET(){
  if(!apiKey)return NextResponse.json({message:'WhatsApp não configurado'},{status:503})
  try{
    const records=await findSticker() as any[]
    const stickers=(await Promise.all(records.map(async record=>{try{const item=await media(record);return item?.base64?{id:record.key.id,dataUrl:`data:${item.mimetype||'image/webp'};base64,${item.base64}`}:null}catch{return null}}))).filter(Boolean)
    return NextResponse.json({stickers})
  }catch{return NextResponse.json({message:'Não foi possível carregar as figurinhas'},{status:503})}
}
export async function POST(request:NextRequest){
  if(!apiKey)return NextResponse.json({message:'WhatsApp não configurado'},{status:503})
  const {id,number}=await request.json()
  try{
    const record=await findSticker(String(id));if(!record)return NextResponse.json({message:'Figurinha não encontrada'},{status:404})
    const item=await media(record);if(!item?.base64)return NextResponse.json({message:'Figurinha indisponível'},{status:404})
    const response=await fetch(`${baseUrl}/message/sendSticker/${instanceName}`,{method:'POST',headers:headers(),body:JSON.stringify({number:String(number).replace(/\D/g,''),sticker:item.base64})})
    const data=await response.json();return response.ok?NextResponse.json(data):NextResponse.json({message:data?.message??'Falha ao enviar figurinha'},{status:response.status})
  }catch{return NextResponse.json({message:'Falha ao enviar figurinha'},{status:503})}
}

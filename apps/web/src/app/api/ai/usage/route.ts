import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
const usagePath=path.join(process.cwd(),'.runtime','ai-usage.json')
export async function GET(){
  try{return NextResponse.json(JSON.parse(await fs.readFile(usagePath,'utf8')))}
  catch{return NextResponse.json({inputTokens:0,outputTokens:0,totalTokens:0,calls:0,lastUsedAt:null})}
}

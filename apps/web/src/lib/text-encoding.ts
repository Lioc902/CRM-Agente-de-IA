export function repairTextEncoding<T>(value:T):T {
  if(typeof value==='string'){
    let current:string=value
    for(let attempt=0;attempt<2&&/[ÃÂâ]/.test(current);attempt++){
      const repaired=Buffer.from(current,'latin1').toString('utf8')
      if(repaired.includes('�'))break
      current=repaired
    }
    return current as T
  }
  if(Array.isArray(value))return value.map(item=>repairTextEncoding(item)) as T
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,repairTextEncoding(item)])) as T
  }
  return value
}

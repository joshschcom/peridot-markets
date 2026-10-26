/** Classify transport failures only. Contract and JSON-RPC failures must remain visible. */
export function isReadTransportFailure(error:unknown):boolean {
  if(!error||typeof error!=='object')return false;
  const record=error as Record<string,unknown>;
  const response=record.response;
  if(response&&typeof response==='object'){
    const {status,data}=response as {status?:unknown;data?:unknown};
    if(status===408||status===429)return true;
    if(data&&typeof data==='object'&&'error' in data){
      const rpcError=data.error;
      if(rpcError&&typeof rpcError==='object'&&'code' in rpcError&&typeof rpcError.code==='number'&&rpcError.code<0)return false;
    }
    if(typeof status==='number')return status===408||status===429||(status>=500&&status<=599);
  }
  if(typeof record.code==='number'&&record.code<0)return false;
  if(typeof record.code==='string'&&[
    'ERR_NETWORK','ECONNABORTED','ETIMEDOUT','ECONNRESET','ENOTFOUND','EAI_AGAIN',
    'UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET',
  ].includes(record.code))return true;
  if(record.name==='TimeoutError')return true;
  return record.name==='TypeError'&&typeof record.message==='string'&&[
    'Failed to fetch','fetch failed','Load failed','NetworkError when attempting to fetch resource.',
  ].includes(record.message);
}

/**
 * Read-only failover, never a submission retry mechanism. The caller must whitelist
 * read RPC methods and keep sendTransaction on its original, single-submit path.
 * Callbacks must have their own bounded timeouts and validate the primary network.
 */
export class ReadFailover {
  private fallbackUntil=0;
  private verification:Promise<void>|undefined;
  constructor(
    private readonly verifyFallback:()=>Promise<void>,
    private readonly cooldownMs=30_000,
    private readonly now:()=>number=Date.now,
  ){
    if(!Number.isFinite(cooldownMs)||cooldownMs<0)throw new Error('Invalid read RPC failover cooldown.');
  }

  async run<T>(primaryRead:()=>Promise<T>,fallbackRead:()=>Promise<T>):Promise<T>{
    if(this.now()<this.fallbackUntil)return this.readFallback(fallbackRead);
    try{return await primaryRead();}
    catch(error){
      if(!isReadTransportFailure(error))throw error;
      this.fallbackUntil=this.now()+this.cooldownMs;
      return this.readFallback(fallbackRead);
    }
  }

  private async readFallback<T>(read:()=>Promise<T>):Promise<T>{
    if(!this.verification){
      const pending=Promise.resolve().then(this.verifyFallback).catch(error=>{
        if(this.verification===pending){this.verification=undefined;this.fallbackUntil=0;}
        throw error;
      });
      this.verification=pending;
    }
    await this.verification;
    try{return await read();}
    catch(error){
      // Do not bounce between providers inside one read. A future call can probe primary again.
      if(isReadTransportFailure(error)){this.verification=undefined;this.fallbackUntil=0;}
      throw error;
    }
  }
}

/** Bound wallet requests whose upstream popup transport never rejects on close/block. */
export class WalletRequest {
  private cancelPending: (()=>void)|undefined;
  run<T>(start:()=>Promise<T>, timeoutMs=60_000):Promise<T>{
    if(this.cancelPending)return Promise.reject(new Error('Another wallet request is already open. Cancel it before trying again.'));
    return new Promise<T>((resolve,reject)=>{
      let settled=false;
      const finish=(error:unknown,value?:T)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);this.cancelPending=undefined;
        if(error)reject(error);else resolve(value as T);
      };
      const timer=setTimeout(()=>finish(new Error('The wallet did not respond. Close its old window and try again. If no window opened, check your browser popup settings.')),timeoutMs);
      this.cancelPending=()=>finish(new Error('Wallet request cancelled. Close its window before trying again.'));
      // Execute immediately, not in a Promise.then: preserve the browser user gesture.
      try{start().then(value=>finish(undefined,value),error=>finish(error));}
      catch(error){finish(error);}
    });
  }
  cancel():void{this.cancelPending?.();}
}

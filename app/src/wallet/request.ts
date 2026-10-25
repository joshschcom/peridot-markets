/** Distinguishes failures the user can fix without repeating the whole transaction preparation. */
export class WalletWindowError extends Error {
  constructor(public readonly kind:'blocked'|'closed',message:string){super(message);this.name='WalletWindowError';}
}
export const POPUP_BLOCKED_MESSAGE='Your browser blocked the Albedo window. Allow pop-ups for this site (the icon at the right of the address bar, or browser settings), then try again.';
export const POPUP_CLOSED_MESSAGE='The Albedo window was closed before it responded. Nothing was signed. Open it again to continue.';
/** Wait before reporting a closed window: Albedo closes its own window right after it replies. */
const CLOSED_GRACE_MS=1000,CLOSED_POLL_MS=500;
export interface RunOptions {
  /** Watch the window the request opens (Albedo) so a blocked or closed window fails fast instead of waiting for the timeout. */
  watchPopup?:boolean;
}
/** Bound wallet requests whose upstream popup transport never rejects on close/block. */
export class WalletRequest {
  private cancelPending: (()=>void)|undefined;
  get isBusy():boolean{return this.cancelPending!==undefined;}
  run<T>(start:()=>Promise<T>, timeoutMs=60_000, options:RunOptions={}):Promise<T>{
    if(this.cancelPending)return Promise.reject(new Error('Another wallet request is already open. Cancel it before trying again.'));
    return new Promise<T>((resolve,reject)=>{
      let settled=false,win:{popup:Window|null}={popup:null},poll:ReturnType<typeof setInterval>|undefined,grace:ReturnType<typeof setTimeout>|undefined;
      const closePopup=()=>{try{if(win.popup&&!win.popup.closed)win.popup.close();}catch{/* Cross-origin handles may refuse. */}};
      const finish=(error:unknown,value?:T,closeWindow=false)=>{
        if(settled)return;
        settled=true;clearTimeout(timer);clearInterval(poll);clearTimeout(grace);this.cancelPending=undefined;
        if(closeWindow)closePopup();
        if(error)reject(error);else resolve(value as T);
      };
      const timer=setTimeout(()=>finish(new Error('The wallet did not respond. Close its old window and try again. If no window appeared, check your browser popup settings.'),undefined,true),timeoutMs);
      this.cancelPending=()=>finish(new Error('Wallet request cancelled. Close its window before trying again.'),undefined,true);
      // Execute immediately, not in a Promise.then: preserve the browser user gesture.
      const watch=options.watchPopup&&typeof window!=='undefined';
      const original=watch?window.open:undefined;
      let opened=false;
      if(watch)window.open=function(this:unknown,...args:Parameters<typeof window.open>){
        const handle=(original as typeof window.open).apply(window,args);
        opened=true;win.popup=handle;return handle;
      } as typeof window.open;
      try{start().then(value=>finish(undefined,value),error=>finish(error));}
      catch(error){finish(error);}
      finally{if(watch&&window.open!==original)window.open=original as typeof window.open;}
      // window.open ran (or not) synchronously inside start(). Freighter and iframe flows never open one, so "not called" is not "blocked".
      if(watch&&opened&&!settled){
        if(!win.popup){finish(new WalletWindowError('blocked',POPUP_BLOCKED_MESSAGE));return;}
        try{win.popup.focus();}catch{/* Focus is best effort for browsers that open the window behind this one. */}
        poll=setInterval(()=>{
          let closed=false;try{closed=!!win.popup?.closed;}catch{closed=false;}
          if(closed&&!grace)grace=setTimeout(()=>finish(new WalletWindowError('closed',POPUP_CLOSED_MESSAGE)),CLOSED_GRACE_MS);
        },CLOSED_POLL_MS);
      }
    });
  }
  cancel():void{this.cancelPending?.();}
}

/** Pace read-only RPC calls so loading several cards cannot burst past a public provider's limit. */
export class ReadScheduler {
  private active=0;
  private nextStart=0;
  private timer:ReturnType<typeof setTimeout>|undefined;
  private queue:Array<()=>void>=[];
  constructor(private readonly concurrency=3,private readonly intervalMs=200){}
  run<T>(read:()=>Promise<T>):Promise<T>{
    return new Promise<T>((resolve,reject)=>{
      this.queue.push(()=>{
        this.active++;this.nextStart=Date.now()+this.intervalMs;
        Promise.resolve().then(read).then(resolve,reject).finally(()=>{this.active--;this.pump();});
      });
      this.pump();
    });
  }
  private pump(){
    if(this.timer||this.active>=this.concurrency||!this.queue.length)return;
    const delay=this.nextStart-Date.now();
    if(delay>0){this.timer=setTimeout(()=>{this.timer=undefined;this.pump();},delay);return;}
    this.queue.shift()!();this.pump();
  }
}
export function isRateLimited(error:unknown):boolean{
  if(!error||typeof error!=='object'||!('response' in error))return false;
  const response=error.response;
  return !!response&&typeof response==='object'&&'status' in response&&response.status===429;
}

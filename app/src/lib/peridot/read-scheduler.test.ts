import test from 'node:test';
import assert from 'node:assert/strict';
import {ReadScheduler,isRateLimited} from './read-scheduler';
test('read scheduler bounds concurrency and keeps processing after a failure',async()=>{
 const scheduler=new ReadScheduler(2,0);let active=0,peak=0;
 const jobs=Array.from({length:8},(_,i)=>scheduler.run(async()=>{
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;
  if(i===2)throw new Error('read failed');return i;
 }));
 const results=await Promise.allSettled(jobs);assert.equal(peak,2);assert.equal(active,0);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,7);assert.equal(results[2].status,'rejected');
});
test('rate-limit retry recognizes only HTTP429, never contract or submission errors',()=>{
 assert.equal(isRateLimited({response:{status:429}}),true);
 for(const error of [new Error('429'),{response:{status:500}},{status:429},{response:{status:'429'}},null])assert.equal(isRateLimited(error),false);
});

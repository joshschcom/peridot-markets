/** Real Albedo popup smoke check. Does not authorize an account or sign transactions.
 * Start a production build with mocks off, then:
 * WALLET_TEST_URL=http://127.0.0.1:3021 node --import tsx tests/browser-wallet-popup.ts
 * Install WebKit once with: npx playwright install webkit
 */
import assert from 'node:assert/strict';
import { chromium, webkit, expect } from '@playwright/test';

async function main(){
 const engine=process.env.WALLET_TEST_BROWSER==='chromium'?chromium:webkit;
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.addInitScript(()=>{
   const original=window.open.bind(window);
   (window as unknown as {popupGestures:boolean[]}).popupGestures=[];
   window.open=(...args)=>{
    (window as unknown as {popupGestures:boolean[]}).popupGestures.push(navigator.userActivation?.isActive??false);
    return original(...args);
   };
  });
  await page.goto(process.env.WALLET_TEST_URL??'http://127.0.0.1:3021',{waitUntil:'domcontentloaded'});
  const provider=page.getByRole('combobox',{name:'Wallet provider'});
  await expect(provider).toHaveValue('albedo',{timeout:60_000});
  await provider.selectOption('freighter');
  await expect(provider).toHaveValue('freighter');
  await provider.selectOption('albedo');
  const connect=page.getByRole('button',{name:'Connect wallet',exact:true});
  await expect(connect).toBeEnabled({timeout:60_000});
  const popupReady=page.waitForEvent('popup');
  await connect.click();
  const popup=await popupReady;
  await popup.waitForURL('https://albedo.link/confirm',{timeout:30_000,waitUntil:'domcontentloaded'}).catch(error=>{console.log(JSON.stringify({popupUrl:popup.url()}));throw error;});
  console.log('Real Albedo popup reached.');
  assert.deepEqual(await page.evaluate(()=>(window as unknown as {popupGestures:boolean[]}).popupGestures),[true]);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(connect).toBeEnabled();
  await expect(provider).toBeEnabled();
  await popup.close();
  // Reproduce a browser that refuses the popup. Verify bounded recovery with virtual time.
  await page.clock.install();
  await page.evaluate(()=>{window.open=()=>null;});
  await connect.click();
  await expect(page.getByRole('button',{name:'Connecting',exact:true})).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(page.locator('.wallet-alert')).toContainText('wallet did not respond');
  await expect(connect).toBeEnabled();
  await context.close();
  console.log('Connect, cancel and blocked-popup recovery passed.');
  // Isolated protocol fixture: public address only, never a wallet signature.
  // All transaction submission requests are blocked as a second safety boundary.
  const isolated=await browser.newContext();
  let submitAttempts=0;
  await isolated.route('**/*',async route=>{
   let body:unknown;
   try{body=route.request().postDataJSON();}catch{/* Non-JSON assets are normal. */}
   if(body&&typeof body==='object'&&'method' in body&&body.method==='sendTransaction'){
    submitAttempts++;await route.abort('blockedbyclient');return;
   }
   await route.continue();
  });
  const account='GBTAM7KI53O5CMJW7QHS2TG7JX65H4Y2TGDXS42ZLJEK6YMGDBBZOOQD';
  await isolated.route('https://albedo.link/confirm',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><title>Albedo protocol fixture</title><p id="state">Public address fixture. No keys.</p><script>
   window.addEventListener('message',event=>{
    if(event.source!==window.opener)return;
    const request=event.data;
    if(request.intent==='public_key')window.opener.postMessage({albedoIntentResult:{__reqid:request.__reqid,pubkey:${JSON.stringify(account)},intent:'public_key'}},event.origin);
    if(request.intent==='tx')document.getElementById('state').textContent='Unsigned test request received. No signing occurs.';
   });
   window.opener.postMessage({albedo:{protocol:3}},'*');
  </script>`}));
  const flow=await isolated.newPage();
  await flow.addInitScript(()=>{
   const original=window.open.bind(window);
   (window as unknown as {popupGestures:boolean[]}).popupGestures=[];
   window.open=(...args)=>{
    (window as unknown as {popupGestures:boolean[]}).popupGestures.push(navigator.userActivation?.isActive??false);
    return original(...args);
   };
  });
  const base=process.env.WALLET_TEST_URL??'http://127.0.0.1:3021';
  await flow.goto(base,{waitUntil:'domcontentloaded'});
  await flow.getByRole('button',{name:'Connect wallet',exact:true}).click({timeout:60_000});
  await expect(flow.locator('.wallet-button')).toContainText('GBTA',{timeout:30_000});
  console.log('Isolated public-address fixture connected.');
  await flow.getByRole('link',{name:'Explore',exact:true}).first().click();
  // Navigate while preserving the connected provider through client-side routing.
  await flow.getByRole('link',{name:/Meridian/}).first().click({timeout:90_000});
  await flow.getByRole('button',{name:'Manage XLM',exact:true}).click({timeout:90_000}).catch(async error=>{console.log((await flow.locator('body').innerText()).slice(0,6000));throw error;});
  await flow.getByRole('button',{name:'Enable market',exact:true}).click();
  const dialog=flow.getByRole('dialog',{name:'Ready to sign with Albedo'});
  await expect(dialog).toBeVisible({timeout:90_000});
  console.log('Unsigned transaction reached prepared-sign dialog.');
  await expect(dialog).toContainText('enter market');
  const signPopupReady=flow.waitForEvent('popup');
  await dialog.getByRole('button',{name:'Open Albedo to sign',exact:true}).click();
  const signPopup=await signPopupReady;
  await expect(signPopup.getByText('Unsigned test request received. No signing occurs.',{exact:true})).toBeVisible();
  assert.deepEqual(await flow.evaluate(()=>(window as unknown as {popupGestures:boolean[]}).popupGestures),[true,true]);
  await dialog.getByRole('button',{name:'Cancel signing',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await expect(flow.locator('.wallet-button')).toContainText('GBTA');
  await signPopup.close();
  assert.equal(submitAttempts,0);
  await isolated.close();
  console.log(JSON.stringify({browser:engine.name(),albedoDefault:true,freighterSelectable:true,popupOpenedInGesture:true,cancelRecovered:true,blockedPopupRecovered:true,preparedSignatureFixture:true,signaturePopupInGesture:true,signatureCancelled:true,submissions:submitAttempts,realWalletAcceptance:false}));
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});

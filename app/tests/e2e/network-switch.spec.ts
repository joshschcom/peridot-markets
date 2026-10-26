import {test,expect} from '@playwright/test';
import {disclaimerPreAcceptScript} from '../../src/lib/ui/risk-disclaimer';

// Setup only: pre-accept the one-time risk disclaimer so the modal never covers the page under test.
test.beforeEach(async({page})=>{await page.addInitScript(disclaimerPreAcceptScript);});

test('header network pill switches mainnet and testnet at runtime and persists',async({page})=>{
 const problems:string[]=[];
 page.on('pageerror',e=>problems.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/hydrat/i.test(m.text()))problems.push(m.text());});
 await page.goto('/');
 const pill=page.getByRole('button',{name:/^Network: .*Change network$/}).filter({visible:true});
 await expect(pill).toContainText('Mainnet');
 await page.screenshot({path:'../docs/ui/netswitch-mainnet.png'});
 await pill.click();
 const menu=page.getByRole('menu',{name:'Choose network'});
 await expect(menu).toContainText('Testnet uses free test tokens, launchpad demo lives here.');
 await expect(page.getByRole('menuitemradio',{name:/Mainnet/})).toHaveAttribute('aria-checked','true');
 await page.screenshot({path:'../docs/ui/netswitch-menu.png'});
 await Promise.all([page.waitForEvent('load'),page.getByRole('menuitemradio',{name:/Testnet/}).click()]);
 await expect(pill).toContainText('Testnet');
 await expect(pill).toContainText('TEST');
 expect(await page.evaluate(()=>localStorage.getItem('peridot:network'))).toBe('testnet');
 await page.screenshot({path:'../docs/ui/netswitch-testnet.png'});
 // Persists across navigation; an explicit URL param overrides and an invalid one is ignored.
 await page.goto('/groups');
 await expect(pill).toContainText('Testnet');
 await page.goto('/groups?network=bogus');
 await expect(pill).toContainText('Testnet');
 await page.goto('/groups?network=mainnet');
 await expect(pill).toContainText('Mainnet');
 expect(await page.evaluate(()=>localStorage.getItem('peridot:network'))).toBe('mainnet');
 // Switching back drops a stale ?network= param so it cannot override the new choice.
 await pill.click();
 await Promise.all([page.waitForEvent('load'),page.getByRole('menuitemradio',{name:/Testnet/}).click()]);
 await expect(page).not.toHaveURL(/network=/);
 await expect(pill).toContainText('Testnet');
 expect(problems.filter(p=>!/Failed to load resource|favicon/.test(p))).toEqual([]);
});

test('mobile width keeps the pill reachable',async({page})=>{
 await page.setViewportSize({width:375,height:760});
 await page.goto('/?network=testnet');
 const pill=page.getByRole('button',{name:/^Network: .*Change network$/}).filter({visible:true});
 await expect(pill).toBeVisible();
 await pill.click();
 const box=await page.getByRole('menu',{name:'Choose network'}).boundingBox();
 expect(box!.x).toBeGreaterThanOrEqual(0);
 expect(box!.x+box!.width).toBeLessThanOrEqual(375);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=375)).toBe(true);
 await page.screenshot({path:'../docs/ui/netswitch-mobile.png'});
});

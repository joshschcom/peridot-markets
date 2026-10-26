import {test,expect} from '@playwright/test';
import {disclaimerPreAcceptScript} from '../../src/lib/ui/risk-disclaimer';

test.beforeEach(async({page})=>{await page.addInitScript(disclaimerPreAcceptScript);});

test('connect wallet modal lists providers, traps focus, closes with Escape and supports connect and disconnect',async({page})=>{
 await page.goto('/');
 const header=page.getByRole('button',{name:/Demo account/});
 await header.click();
 const modal=page.getByRole('dialog',{name:'Wallet connected'});
 await expect(modal).toBeVisible();
 await modal.getByRole('button',{name:'Disconnect'}).click();
 await expect(modal).toBeHidden();

 const connect=page.getByRole('button',{name:'Connect wallet',exact:true}).first();
 await connect.click();
 const picker=page.getByRole('dialog',{name:'Connect a wallet'});
 await expect(picker).toBeVisible();
 const names=await picker.locator('.wm-pick .wm-name').allInnerTexts();
 expect(names.slice(0,2).map(n=>n.split('\n')[0])).toEqual(['Albedo','Freighter']);
 for(const wallet of ['Albedo','Freighter','xBull','LOBSTR','Hana'])await expect(picker.locator('.wm-pick',{hasText:wallet})).toBeVisible();
 await expect(picker.locator('.wm-pick',{hasText:'WalletConnect'})).toHaveCount(0);
 await expect(picker.locator('.wm-pick',{hasText:'Albedo'})).toContainText('Popup');
 // Focus stays inside the dialog.
 for(let i=0;i<12;i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>!!document.activeElement?.closest('dialog.wm'))).toBe(true);
 await page.keyboard.press('Escape');
 await expect(picker).toBeHidden();

 await connect.click();
 await picker.locator('.wm-pick',{hasText:'Freighter'}).click();
 await expect(picker).toBeHidden();
 await expect(page.getByRole('button',{name:/Demo account/})).toBeVisible();
 expect(await page.evaluate(()=>window.localStorage.getItem('peridot:wallet'))).toBe('freighter');
 // The remembered wallet is flagged next time.
 await page.getByRole('button',{name:/Demo account/}).click();
 await page.getByRole('dialog',{name:'Wallet connected'}).getByRole('button',{name:'Disconnect'}).click();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).first().click();
 await expect(picker.locator('.wm-pick',{hasText:'Freighter'})).toContainText('Last used');
});

test('wallet modal fits a 375px phone',async({page})=>{
 await page.setViewportSize({width:375,height:740});
 await page.goto('/');
 await page.getByRole('button',{name:/Demo account/}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Disconnect'}).click();
 await page.getByRole('button',{name:'Connect wallet',exact:true}).first().click();
 const box=await page.getByRole('dialog',{name:'Connect a wallet'}).boundingBox();
 expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(375);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=375)).toBe(true);
});

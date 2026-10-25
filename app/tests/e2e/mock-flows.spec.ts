import {test,expect} from '@playwright/test';

test('launch, lend, claim, margin and owner staged changes work together in explicit demo mode',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();
 await page.goto('/launch');
 await expect(page.getByText('Demo launch',{exact:true})).toBeVisible();
 await page.getByLabel(/Group name/).fill('BrowserCheck');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Enable group rewards').check();
 await page.getByRole('button',{name:'Use demo USDC rewards'}).click();
 await page.getByLabel('Supply rewards per day',{exact:true}).nth(0).fill('86.4');
 await page.getByLabel('Supply rewards per day',{exact:true}).nth(1).fill('86.4');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Enable leverage for this group').check();
 await page.getByRole('button',{name:'Discover and verify pool routes'}).click();
 await expect(page.getByText('Demo pool route',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'Create demo group'}).click();
 await expect(page.getByRole('heading',{name:'Your group is ready'})).toBeVisible();
 await page.getByRole('link',{name:/Open group #/}).click();
 await expect(page).toHaveURL(/\/groups\/\d+$/);
 await expect(page.getByRole('heading',{name:'BrowserCheck',exact:true,level:1})).toBeVisible();
 await page.getByRole('button',{name:'Manage USDC'}).click();
 await page.getByLabel('Supply amount in USDC').fill('100');
 await page.getByRole('button',{name:'Supply USDC',exact:true}).click();
 await expect(page.getByText('Demo action saved. No onchain transaction.')).toBeVisible();
 await page.getByRole('button',{name:'Enable market',exact:true}).click();
 await expect(page.getByText(/Enabled as collateral in this group/)).toBeVisible();
 await page.getByRole('button',{name:'Borrow',exact:true}).click();
 await page.getByLabel('Borrow amount in USDC').fill('10');
 await page.getByRole('button',{name:'Borrow USDC',exact:true}).click();
 await expect(page.getByText('Demo action saved. No onchain transaction.')).toBeVisible();
 await page.getByRole('button',{name:'Repay',exact:true}).click();
 await page.getByLabel('Repay the full accrued debt').check();
 await page.getByRole('button',{name:'Repay USDC',exact:true}).click();
 await page.getByRole('button',{name:'Claim rewards',exact:true}).click();
 await expect(page.getByText('Demo claim saved. No real tokens moved.')).toBeVisible();
 await page.getByRole('button',{name:'Leverage',exact:true}).click();
 await page.getByLabel('Margin amount',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Review position',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Review 2x long'})).toBeVisible();
 await page.getByRole('button',{name:'Confirm and open',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review close',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Review close',exact:true}).click();
 await page.getByRole('button',{name:'Confirm close',exact:true}).click();
 await expect(page.getByText('No open or pending positions for this wallet.')).toBeVisible();
 await page.getByRole('link',{name:'Control Panel',exact:true}).click();
 const cf=page.getByLabel(/Collateral factor \(%\)/).first();
 await cf.fill('90');
 await page.getByRole('button',{name:'Save risk settings'}).first().click();
 await expect(page.getByText(/Collateral factor must be between 1% and 75%/)).toBeVisible();
 await cf.fill('60');
 await page.getByRole('button',{name:'Save risk settings'}).first().click();
 await expect(page.getByText(/Applies in \d+s/)).toBeVisible();
 await page.getByLabel('Prompt automatically when a staged change is ready').uncheck();
 await page.clock.fastForward(61_000);
 await page.getByRole('button',{name:'Apply market changes',exact:true}).click();
 await expect(page.getByText('No staged changes.',{exact:true})).toBeVisible();
 await expect(page.getByText('Markets cannot be added after group rewards are enabled. Create and activate every market before setting the reward token.')).toBeVisible();
 expect(errors).toEqual([]);
});


test('owner can deploy, recover and activate a new market before enabling rewards',async({page})=>{
 await page.goto('/groups/1/control');
 await page.getByText('Configure another market',{exact:true}).click();
 await page.getByRole('button',{name:'Use EURC',exact:true}).click();
 await page.getByRole('button',{name:'Verify token and price feed',exact:true}).click();
 await expect(page.getByText('EURC · 7 decimals · Reflector covered (demo)')).toBeVisible();
 await page.getByRole('button',{name:'Deploy market',exact:true}).click();
 await expect(page.getByText('Activation: pending. Yield: not configured.')).toBeVisible();
 await page.reload();
 await expect(page.getByText('Resume market addition',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Activate market',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Activate market',exact:true}).click();
 await expect(page.getByText('Activation: complete. Yield: not configured.')).toBeVisible();
 await page.getByRole('button',{name:'Finish market addition',exact:true}).click();
 await page.goto('/groups/1');
 await expect(page.getByRole('button',{name:'Manage EURC',exact:true})).toBeVisible();
});

test('all main routes fit a 375px viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 for(const route of ['/','/groups','/groups/1','/groups/1/control','/launch']){
   await page.goto(route);await page.waitForLoadState('networkidle');
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBeTruthy();
 }
});

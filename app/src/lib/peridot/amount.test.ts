import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, formatAmount } from './amount';
test('token amounts preserve exact units above Number precision', () => {
 const value='9007199254740993.1234567';
 assert.equal(parseAmount(value,7),90071992547409931234567n);
 assert.equal(formatAmount(parseAmount(value,7),7),value);
});
test('reject precision loss, exponent syntax and out-of-range i128', () => {
 for(const value of ['0.00000001','1e3','-1','NaN','1,000']) assert.throws(()=>parseAmount(value,7));
 assert.throws(()=>parseAmount((1n<<127n).toString(),0));
 assert.equal(parseAmount('0.0000001',7),1n);
 assert.equal(parseAmount(((1n<<127n)-1n).toString(),0),(1n<<127n)-1n);
});
test('formats zero-decimal and negative display amounts without rounding',()=>{
 assert.equal(formatAmount(12n,0),'12');assert.equal(formatAmount(-12345n,3),'-12.345');assert.equal(formatAmount(0n,7),'0');
});

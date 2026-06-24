// test/specs/debug-simple.spec.ts
import { browser } from '@wdio/globals';
import { expect } from 'chai';

describe('Debug Simple Test', function() {
    it('should run a basic test', async function() {
        console.log('✅ Basic test is running!');
        expect(true).to.equal(true);
    });
});
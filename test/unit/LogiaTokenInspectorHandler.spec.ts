import { ethers } from 'hardhat';
import { expect } from 'chai';
import { Contract } from 'ethers';

describe('LogiaTokenInspectorHandler', () => {
  let TokenInspectorHandlerImplFactory;
  let tokenInspectorHandler: Contract;

  beforeEach(async function () {
    TokenInspectorHandlerImplFactory = await ethers.getContractFactory('LogiaTokenInspectorHandlerImpl');
    tokenInspectorHandler = await TokenInspectorHandlerImplFactory.deploy();
  });

  describe('Rarity', () => {
    it('Should return true for Master rarity', async function () {
      expect(await tokenInspectorHandler.callStatic.isMaster(6)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isMaster(10)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isMaster(20)).to.equal(true);
    });

    it('Should return true for Fellow rarity', async function () {
      expect(await tokenInspectorHandler.callStatic.isFellow(0)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(2)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(5)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(9)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(11)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(15)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(16)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(24)).to.equal(true);
      expect(await tokenInspectorHandler.callStatic.isFellow(25)).to.equal(true);
    });

    it('Should return correct rarity', async function () {
      for (let i = 1; i <= 58; i++) {
        // 58 = 29 * 2, just to make sure it's working correctly.
        let rarity = await tokenInspectorHandler.callStatic.getRarity(i);
        if (await tokenInspectorHandler.callStatic.isMaster(i % 29)) {
          expect(rarity).to.equal(2);
        } else if (await tokenInspectorHandler.callStatic.isFellow(i % 29)) {
          expect(rarity).to.equal(1);
        } else {
          expect(rarity).to.equal(0);
        }
      }
    });
  });
});

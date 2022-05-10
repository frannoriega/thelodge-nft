import { ethers } from 'hardhat';
import { expect } from 'chai';
import { TheLodgeTokenInspectorHandlerImpl, TheLodgeTokenInspectorHandlerImpl__factory } from '@typechained';
import { BigNumber } from 'ethers';

describe('TheLodgeTokenInspectorHandler', () => {
  const MAX_SUPPLY = 7777;
  const SLICE_SIZE = 500;

  let tokenInspectorHandler: TheLodgeTokenInspectorHandlerImpl;

  before(async function () {
    const TokenInspectorHandlerImplFactory: TheLodgeTokenInspectorHandlerImpl__factory = await ethers.getContractFactory(
      'TheLodgeTokenInspectorHandlerImpl'
    );
    tokenInspectorHandler = await TokenInspectorHandlerImplFactory.deploy({ baseURI: '', unrevealedURI: '' });
  });

  describe('getRarity', () => {
    describe('distribution', () => {
      let amountPerRarity: Map<number, number>;
      beforeEach(async () => {
        // Count all rarities
        amountPerRarity = new Map();
        for (const tokenIds of getAllTokenIdsInSlices()) {
          const rarities = await tokenInspectorHandler.getRarities(tokenIds);
          for (const rarity of rarities) amountPerRarity.set(rarity, (amountPerRarity.get(rarity) ?? 0) + 1);
        }
      });
      it('Should only be 4646 Apprentice', async () => {
        expect(amountPerRarity.get(0)).to.equal(4646);
      });
      it('Should only be 2727 Fellow', async () => {
        expect(amountPerRarity.get(1)).to.equal(2727);
      });
      it('Should only be 404 Fellow', async () => {
        expect(amountPerRarity.get(2)).to.equal(404);
      });
    });

    describe('when a token does not exist', () => {
      const TOKEN_ID = 10;
      beforeEach(async () => {
        return tokenInspectorHandler.setIfTokenExists(TOKEN_ID, false);
      });
      it('asking for its rarity should fail', async () => {
        await expect(tokenInspectorHandler.getRarity(TOKEN_ID)).to.have.revertedWith('TokenDoesNotExist');
      });
    });
  });

  describe('getURIId', () => {
    const usedURIIds: Map<number, number> = new Map();
    it('All token ids should return a valid and different URI id', async () => {
      for (const tokenIds of getAllTokenIdsInSlices()) {
        const uriIds = await tokenInspectorHandler.getURIIds(tokenIds);
        for (let i = 0; i < uriIds.length; i++) {
          const uriId = uriIds[i].toNumber();
          expect(uriId).to.be.greaterThanOrEqual(1).and.lessThanOrEqual(MAX_SUPPLY);
          expect(
            usedURIIds.has(uriId),
            `URI id '${uriId}' was calculated for token id '${tokenIds[i]}' but it already had been calculated for '${usedURIIds.get(uriId)}'`
          ).to.be.false;
          usedURIIds.set(uriId, tokenIds[i]);
        }
      }
      expect(usedURIIds.size).to.equal(MAX_SUPPLY);
    });
  });

  function getAllTokenIdsInSlices() {
    const slices: number[][] = [];
    for (let i = 0; i < MAX_SUPPLY; i += SLICE_SIZE) {
      const tokenIds = new Array(SLICE_SIZE)
        .fill(0)
        .map((_, index) => index + i + 1)
        .filter((id) => id <= MAX_SUPPLY);
      slices.push(tokenIds);
    }
    return slices;
  }
});

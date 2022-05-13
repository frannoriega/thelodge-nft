import { ethers } from 'hardhat';
import { expect } from 'chai';
import { TheLodgeTokenInspectorHandlerImpl, TheLodgeTokenInspectorHandlerImpl__factory } from '@typechained';
import { given, then, when } from '@utils/bdd';
import { snapshot } from '@utils/evm';

describe('TheLodgeTokenInspectorHandler', () => {
  enum Rarity {
    Apprentice,
    Fellow,
    Master,
    Transcended,
  }

  const BASE_URI: string = 'baseUri/';
  const UNREVEALED_URI: string = 'unrevealedUri';
  let maxSupply: number;
  let firstIdApprentice: number, firstIdFellow: number, firstIdMaster: number, firstIdTrascended: number;
  let maxMintableApprentice: number, maxMintableFellow: number, maxMintableMaster: number;
  let tokenInspectorHandler: TheLodgeTokenInspectorHandlerImpl;
  let snapshotId: string;

  before(async function () {
    const TokenInspectorHandlerImplFactory: TheLodgeTokenInspectorHandlerImpl__factory = await ethers.getContractFactory(
      'TheLodgeTokenInspectorHandlerImpl'
    );
    tokenInspectorHandler = await TokenInspectorHandlerImplFactory.deploy({ baseURI: BASE_URI, unrevealedURI: UNREVEALED_URI });
    maxMintableApprentice = await tokenInspectorHandler.MAX_MINTABLE_APPRENTICE();
    maxMintableFellow = await tokenInspectorHandler.MAX_MINTABLE_FELLOW();
    maxMintableMaster = await tokenInspectorHandler.MAX_MINTABLE_MASTER();
    firstIdApprentice = await tokenInspectorHandler.APPRENTICE_FIRST_ID();
    firstIdFellow = await tokenInspectorHandler.FELLOW_FIRST_ID();
    firstIdMaster = await tokenInspectorHandler.MASTER_FIRST_ID();
    firstIdTrascended = await tokenInspectorHandler.TRANSCENDED_FIRST_ID();
    maxSupply = maxMintableApprentice + maxMintableFellow + maxMintableMaster;
    snapshotId = await snapshot.take();
  });

  beforeEach(async function () {
    await snapshot.revert(snapshotId);
  });

  describe('tokenUri', () => {
    describe('Reveal not executed', () => {
      given(async () => {
        await tokenInspectorHandler.setRevealed(false);
      });

      when('calling `tokenURI` for existing token', () => {
        then('The rarity should be returned successfully', async () => {
          expect(await tokenInspectorHandler.tokenURI(1)).to.be.equal(UNREVEALED_URI);
        });
      });
      when('calling `tokenURI` for non-existing token', () => {
        given(async () => {
          await tokenInspectorHandler.setIfTokenExists(2, false);
        });
        then('Transaction should be reverted with TokenDoesNotExist', async () => {
          await expect(tokenInspectorHandler.tokenURI(2)).to.be.revertedWith('TokenDoesNotExist');
        });
      });
    });
    describe('Reveal was executed', () => {
      given(async () => {
        await tokenInspectorHandler.setRandomNumber(23113);
      });
      when('calling `tokenURI` for existing token', () => {
        then('The rarity should be returned successfully', async () => {
          // ((1 - 1) / 77) * 4 + 8167 + 0 = 8167
          expect(await tokenInspectorHandler.tokenURI(1)).to.be.equal(BASE_URI + 8167);
          // ((2 - 1) / 77) * 27 + 4646 + 5 = 4652
          expect(await tokenInspectorHandler.tokenURI(2)).to.be.equal(BASE_URI + 4652);
          // ((3 - 1) / 77) * 46 + 0 + 9 = 10
          expect(await tokenInspectorHandler.tokenURI(3)).to.be.equal(BASE_URI + 10);
        });
      });
      when('calling `tokenURI` for non-existing token', () => {
        given(async () => {
          await tokenInspectorHandler.setIfTokenExists(4, false);
        });
        then('Transaction should be reverted with TokenDoesNotExist', async () => {
          await expect(tokenInspectorHandler.tokenURI(4)).to.be.revertedWith('TokenDoesNotExist');
        });
      });
    });
  });

  describe('getRarity', () => {
    describe('distribution', () => {
      let amountPerRarity: Map<Rarity, number>;
      given(async () => {
        // Count all rarities
        amountPerRarity = new Map();
        for (const tokenIds of getAllTokenIdsInSlices()) {
          const rarities = await tokenInspectorHandler.getRarities(tokenIds);
          for (const rarity of rarities) amountPerRarity.set(rarity, (amountPerRarity.get(rarity) ?? 0) + 1);
        }
      });
      it('all minted rarities are assigned correctly', async () => {
        expect(amountPerRarity.get(Rarity.Apprentice)).to.equal(maxMintableApprentice);
        expect(amountPerRarity.get(Rarity.Fellow)).to.equal(maxMintableFellow);
        expect(amountPerRarity.get(Rarity.Master)).to.equal(maxMintableMaster);
      });
    });

    when('calling `getRarity for existing token', () => {
      given(async () => {
        await tokenInspectorHandler.setRandomNumber(23113);
      });
      then('The rarity should be returned successfully', async () => {
        // The random number is 23113, which means the normalized value for tokens 1, 2 and 3
        // are going to be 14, 15 and 16 respectively.
        // The rarities should be Master, Fellow and Apprentice (respectively), and there is no other group
        // of normalized values that yield those rarities in that order.
        expect(await tokenInspectorHandler.getRarity(1)).to.be.equal(2); // 2 = Master
        expect(await tokenInspectorHandler.getRarity(2)).to.be.equal(1); // 1 = Fellow
        expect(await tokenInspectorHandler.getRarity(3)).to.be.equal(0); // 0 = Apprentice
      });
    });

    when('a token does not exist', () => {
      const TOKEN_ID = 10;
      given(async () => {
        return tokenInspectorHandler.setIfTokenExists(TOKEN_ID, false);
      });
      then('asking for its rarity should fail', async () => {
        await expect(tokenInspectorHandler.getRarity(TOKEN_ID)).to.have.revertedWith('TokenDoesNotExist');
      });
    });
  });

  describe('getURIId', () => {
    const usedURIIds: Map<number, number> = new Map();
    it('All token ids should return a valid and unique URI id', async () => {
      for (const tokenIds of getAllTokenIdsInSlices()) {
        const uriIds = await tokenInspectorHandler.getURIIds(tokenIds);
        for (let i = 0; i < uriIds.length; i++) {
          const uriId = uriIds[i].toNumber();
          const wasGivenMintedId =
            (firstIdApprentice <= uriId && uriId < firstIdApprentice + maxMintableApprentice) ||
            (firstIdFellow <= uriId && uriId < firstIdFellow + maxMintableFellow) ||
            (firstIdMaster <= uriId && uriId < firstIdMaster + maxMintableMaster);

          expect(wasGivenMintedId).to.be.true;
          expect(
            usedURIIds.has(uriId),
            `URI id '${uriId}' was calculated for token id '${tokenIds[i]}' but it already had been calculated for '${usedURIIds.get(uriId)}'`
          ).to.be.false;
          usedURIIds.set(uriId, tokenIds[i]);
        }
      }
      expect(usedURIIds.size).to.equal(maxSupply);
    });
  });

  const SLICE_SIZE = 50;
  function getAllTokenIdsInSlices() {
    const slices: number[][] = [];
    for (let i = 0; i < maxSupply; i += SLICE_SIZE) {
      const tokenIds = new Array(SLICE_SIZE)
        .fill(0)
        .map((_, index) => index + i + 1)
        .filter((id) => id <= maxSupply);
      slices.push(tokenIds);
    }
    return slices;
  }
});

import { ethers } from 'hardhat';
import { expect } from 'chai';
import { TheLodgeTokenInspectorHandlerImpl, TheLodgeTokenInspectorHandlerImpl__factory } from '@typechained';
import { given, then, when } from '@utils/bdd';
import { snapshot } from '@utils/evm';
import { TransactionResponse } from '@ethersproject/abstract-provider';

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
  let firstIdApprentice: number, firstIdFellow: number, firstIdMaster: number, firstIdTranscended: number;
  let maxMintableApprentice: number, maxMintableFellow: number, maxMintableMaster: number;
  let maxPromotionsFellow: number, maxPromotionsMaster: number, maxPromotionsTranscended: number;
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
    firstIdTranscended = await tokenInspectorHandler.TRANSCENDED_FIRST_ID();
    maxPromotionsFellow = await tokenInspectorHandler.MAX_PROMOTIONS_TO_FELLOW();
    maxPromotionsMaster = await tokenInspectorHandler.MAX_PROMOTIONS_TO_MASTER();
    maxPromotionsTranscended = await tokenInspectorHandler.MAX_PROMOTIONS_TO_TRANSCENDED();
    maxSupply = maxMintableApprentice + maxMintableFellow + maxMintableMaster;
    snapshotId = await snapshot.take();
  });

  beforeEach(async function () {
    await snapshot.revert(snapshotId);
  });

  describe('constructor', () => {
    when('contract is deployed', () => {
      then('promotion for apprentice is set up correctly', async () => {
        const { nextId, promotionsLeft } = await tokenInspectorHandler.promotionPerRarity(Rarity.Apprentice);
        expect(nextId).to.equal(firstIdFellow + maxMintableFellow);
        expect(promotionsLeft).to.equal(maxPromotionsFellow);
      });
      then('promotion for fellow is set up correctly', async () => {
        const { nextId, promotionsLeft } = await tokenInspectorHandler.promotionPerRarity(Rarity.Fellow);
        expect(nextId).to.equal(firstIdMaster + maxMintableMaster);
        expect(promotionsLeft).to.equal(maxPromotionsMaster);
      });
      then('promotion for master is set up correctly', async () => {
        const { nextId, promotionsLeft } = await tokenInspectorHandler.promotionPerRarity(Rarity.Master);
        expect(nextId).to.equal(firstIdTranscended);
        expect(promotionsLeft).to.equal(maxPromotionsTranscended);
      });
    });
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
        expect(await tokenInspectorHandler.getRarity(1)).to.be.equal(Rarity.Master);
        expect(await tokenInspectorHandler.getRarity(2)).to.be.equal(Rarity.Fellow);
        expect(await tokenInspectorHandler.getRarity(3)).to.be.equal(Rarity.Apprentice);
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

  describe('promote', () => {
    const PANIC_CODE_ERROR = 'panic code 0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)';
    given(async () => {
      await tokenInspectorHandler.setRandomNumber(23113);
    });

    promoteTest({
      tokenId: 3,
      typeBeingPromoted: 'apprentice',
      current: () => ({ rarity: Rarity.Apprentice, promotionsLeft: maxPromotionsFellow, nextId: firstIdFellow + maxMintableFellow }),
      newRarity: Rarity.Fellow,
    });
    promoteTest({
      tokenId: 2,
      typeBeingPromoted: 'fellow',
      current: () => ({ rarity: Rarity.Fellow, promotionsLeft: maxPromotionsMaster, nextId: firstIdMaster + maxMintableMaster }),
      newRarity: Rarity.Master,
    });
    promoteTest({
      tokenId: 1,
      typeBeingPromoted: 'master',
      current: () => ({ rarity: Rarity.Master, promotionsLeft: maxPromotionsTranscended, nextId: firstIdTranscended }),
      newRarity: Rarity.Transcended,
    });

    when('there are no more promotions left and a promotion is executed', () => {
      let tx: Promise<TransactionResponse>;
      given(async () => {
        await tokenInspectorHandler.setPromotionData(Rarity.Apprentice, { nextId: 10, promotionsLeft: 0 });
        tx = tokenInspectorHandler.promote(3);
      });
      then('the tx reverts', async () => {
        await expect(tx).to.have.revertedWith(PANIC_CODE_ERROR);
      });
    });

    when('a transcended is set up for promotion', () => {
      const TOKEN_ID = 1;
      let tx: Promise<TransactionResponse>;
      given(async () => {
        // Promote once to transcended
        await tokenInspectorHandler.promote(TOKEN_ID);
        tx = tokenInspectorHandler.promote(TOKEN_ID);
      });
      then('the tx reverts', async () => {
        await expect(tx).to.have.revertedWith(PANIC_CODE_ERROR);
      });
    });

    it('an apprentice can be promoted many times, into transcended', async () => {
      const tokenId = 3;
      await tokenInspectorHandler.promote(tokenId);
      expect(await tokenInspectorHandler.getRarity(tokenId)).to.equal(Rarity.Fellow);
      await tokenInspectorHandler.promote(tokenId);
      expect(await tokenInspectorHandler.getRarity(tokenId)).to.equal(Rarity.Master);
      await tokenInspectorHandler.promote(tokenId);
      expect(await tokenInspectorHandler.getRarity(tokenId)).to.equal(Rarity.Transcended);
      expect(await tokenInspectorHandler.tokenURI(tokenId)).to.equal(BASE_URI + firstIdTranscended);
    });

    function promoteTest({
      tokenId,
      current,
      newRarity,
      typeBeingPromoted,
    }: {
      tokenId: number;
      current: () => { rarity: Rarity; promotionsLeft: number; nextId: number };
      newRarity: Rarity;
      typeBeingPromoted: string;
    }) {
      when(`token of type ${typeBeingPromoted} is promoted`, () => {
        given(async () => {
          await tokenInspectorHandler.promote(tokenId);
        });
        then('promotion data is updated correctly', async () => {
          const { nextId, promotionsLeft } = await tokenInspectorHandler.promotionPerRarity(current().rarity);
          expect(nextId).to.equal(current().nextId + 1);
          expect(promotionsLeft).to.equal(current().promotionsLeft - 1);
        });
        then('promotion is assigned correctly', async () => {
          expect(await tokenInspectorHandler.promotions(tokenId)).to.equal(current().nextId);
        });
        then('token id reads new promotion id correctly', async () => {
          expect(await tokenInspectorHandler.tokenURI(tokenId)).to.equal(BASE_URI + current().nextId);
        });
        then('rarity is reported correctly', async () => {
          expect(await tokenInspectorHandler.getRarity(tokenId)).to.equal(newRarity);
        });
      });
    }
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

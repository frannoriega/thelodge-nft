import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import chai, { expect } from 'chai';
import { BigNumber } from 'ethers';
import { advanceToTime, snapshot } from '@utils/evm';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { AggregatorV3Interface, IERC20Metadata, TheLodgeSaleHandlerImpl, TheLodgeSaleHandlerImpl__factory } from '@typechained';
import { contract, given, then, when } from '@test-utils/bdd';
import moment from 'moment';
import { keccak256 } from 'ethers/lib/utils';
import {
  AddressType,
  SaleTestConfig,
  SaleState,
  generateAirdropTests,
  generateBuyWithTokenTests,
  generateMintTests,
  generateWhitelistBuyWithTokenTests,
  generateWhitelistMintTests,
  generateWithdrawETHTests,
  generateWithdrawTokenTests,
  generateSaleSetterTests,
} from '@utils/sale-test-generator';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TransactionResponse } from '@ethersproject/abstract-provider';

chai.use(smock.matchers);

const ONE_YEAR_IN_SECONDS = 31556952;

contract('TheLodgeSaleHandler', () => {
  let saleHandler: TheLodgeSaleHandlerImpl;
  let tokenPriceOracle: FakeContract<AggregatorV3Interface>;
  let token: FakeContract<IERC20Metadata>;
  let saleStartTimestamp: number;
  let openSaleStartTimestamp: number;
  let saleTestConfig: SaleTestConfig;

  const NAME: string = 'Test';
  const SYMBOL: string = 'T';

  let snapshotId: string;

  before(async function () {
    const accounts = await ethers.getSigners();
    let owner = accounts[0];
    let tokenPriceOracleAddress = accounts[1];
    let whitelisted = accounts.slice(3, 10);
    let nonWhitelisted = accounts.slice(11, 15);
    let otherAddress = accounts[16];
    tokenPriceOracle = await smock.fake('@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface', {
      address: tokenPriceOracleAddress.address,
    });
    token = await smock.fake('IERC20Metadata');
    const leaves = whitelisted.map((account) => keccak256(account.address));
    let merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
    let now = moment().unix();
    saleStartTimestamp = now + ONE_YEAR_IN_SECONDS;
    openSaleStartTimestamp = saleStartTimestamp + ONE_YEAR_IN_SECONDS;
    let nftPrice = BigNumber.from(10).pow(18);
    let maxTokensPerAddress = 3;
    let maxDelay = moment.duration(24, 'hours').asSeconds();
    let config = {
      tokenName: NAME,
      tokenSymbol: SYMBOL,
      oracle: tokenPriceOracle.address,
      maxDelay: maxDelay,
      nftPrice: nftPrice.toString(), // 1 ETH
      maxTokensPerAddress: maxTokensPerAddress,
      alternativePaymentToken: token.address,
      saleStartTimestamp: saleStartTimestamp,
      openSaleStartTimestamp: openSaleStartTimestamp,
      merkleRoot: merkleTree.getHexRoot(),
    };
    let TheLodgeSaleHandlerImpl: TheLodgeSaleHandlerImpl__factory = await ethers.getContractFactory('TheLodgeSaleHandlerImpl');
    saleHandler = await TheLodgeSaleHandlerImpl.deploy(config);
    await saleHandler.setEnded(false);
    let DummyCallerContract = await ethers.getContractFactory('DummyCallerContract');
    let dummyCallerContract = await DummyCallerContract.deploy(saleHandler.address);
    let signers = new Map();
    signers.set(AddressType.Whitelisted, whitelisted);
    signers.set(AddressType.NonWhitelisted, nonWhitelisted);
    signers.set(AddressType.Owner, [owner]);
    saleTestConfig = new SaleTestConfig(
      saleHandler,
      tokenPriceOracle,
      token,
      merkleTree,
      saleStartTimestamp,
      openSaleStartTimestamp,
      nftPrice,
      maxTokensPerAddress,
      maxDelay,
      signers,
      otherAddress,
      dummyCallerContract
    );
    snapshotId = await snapshot.take();
  });

  beforeEach(async function () {
    await snapshot.revert(snapshotId);
    token.transferFrom.returns(true);
    token.decimals.returns(10);
  });

  afterEach(async function () {
    token.transferFrom.reset();
  });

  describe('ECR721 setup', () => {
    when('asked for token name', () => {
      then("It should be 'Test'", async () => {
        expect(await saleHandler.name()).to.be.equal(NAME);
      });
    });

    when('asked for token symbol', () => {
      then("It should be 'T'", async () => {
        expect(await saleHandler.symbol()).to.be.equal(SYMBOL);
      });
    });

    when('asked for start token id', () => {
      then('It should be 1', async () => {
        expect(await saleHandler.getStartTokenId()).to.be.equal(1);
      });
    });
  });

  describe('Mint', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateMintTests(state, addressType, () => saleTestConfig);
        }
      });
    }
  });

  describe('Whitelist mint', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateWhitelistMintTests(state, addressType, () => saleTestConfig);
        }
      });
    }
  });

  describe('Buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateBuyWithTokenTests(state, addressType, () => saleTestConfig);
        }
      });
    }
  });

  describe('Whitelist buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateWhitelistBuyWithTokenTests(state, addressType, () => saleTestConfig);
        }
      });
    }
  });

  describe('Whitelist buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateAirdropTests(state, addressType, () => saleTestConfig);
        }
      });
    }
  });

  describe('Burn', () => {
    let ownerToken1: SignerWithAddress, ownerToken2: SignerWithAddress;
    given(async () => {
      [ownerToken1, ownerToken2] = saleTestConfig.getSigners().get(AddressType.Whitelisted)!;
      await advanceToTime(openSaleStartTimestamp + 1);
      await saleHandler.connect(ownerToken1).mint(1, { value: saleTestConfig.getNftPrice() });
      await saleHandler.connect(ownerToken2).mint(1, { value: saleTestConfig.getNftPrice() });
    });

    when('user owner calls burn', () => {
      given(async () => {
        await saleHandler.connect(ownerToken1).burn([1]);
      });

      then('supply is reduced', async () => {
        expect(await saleHandler.totalSupply()).to.equal(1);
      });

      then('balance is reduced', async () => {
        expect(await saleHandler.balanceOf(ownerToken1.address)).to.equal(0);
      });

      then('token is burned', async () => {
        await expect(saleHandler.ownerOf(1)).to.have.revertedWith('OwnerQueryForNonexistentToken');
      });
    });

    when('user non-owner calls burn', () => {
      let tx: Promise<TransactionResponse>;
      given(() => {
        tx = saleHandler.connect(ownerToken1).burn([2]);
      });
      then('tx reverts', async () => {
        await expect(tx).to.have.revertedWith('TransferCallerNotOwnerNorApproved');
      });
    });
  });

  // Withdraw tests
  describe('Withdraw ETH', () => {
    for (const addressType of Object.values(AddressType)) {
      generateWithdrawETHTests(addressType, () => saleTestConfig);
    }
  });

  describe('Withdraw token', () => {
    for (const addressType of Object.values(AddressType)) {
      generateWithdrawTokenTests(addressType, () => saleTestConfig);
    }
  });

  // Setters
  describe('Setters', () => {
    for (const addressType of Object.values(AddressType)) {
      generateSaleSetterTests(addressType, () => saleTestConfig);
    }
  });

  function generateGiven(state: SaleState) {
    switch (state) {
      case SaleState.SaleStarted: {
        given(async () => {
          await advanceToTime(saleStartTimestamp + 1);
          tokenPriceOracle.latestRoundData.returns([0, 1, 0, moment().unix() + saleStartTimestamp, 0]);
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        given(async () => {
          await advanceToTime(openSaleStartTimestamp + 1);
          tokenPriceOracle.latestRoundData.returns([0, 1, 0, moment().unix() + openSaleStartTimestamp, 0]);
        });
        break;
      }
      case SaleState.Revealed: {
        given(async () => {
          await advanceToTime(openSaleStartTimestamp + 1);
          tokenPriceOracle.latestRoundData.returns([0, 1, 0, moment().unix() + openSaleStartTimestamp, 0]);
          await saleHandler.setEnded(true);
        });
        break;
      }
      default:
        break;
    }
  }
});

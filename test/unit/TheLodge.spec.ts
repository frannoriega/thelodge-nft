import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import chai, { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { advanceToTime, snapshot } from '@utils/evm';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { AggregatorV3Interface, IERC20, IERC20Metadata, VRFCoordinatorV2Interface } from '@typechained';
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

chai.use(smock.matchers);

const ONE_YEAR_IN_SECONDS = 31556952;

contract('TheLodge', () => {
  let saleHandler: Contract;
  let tokenPriceOracle: FakeContract<AggregatorV3Interface>;
  let token: FakeContract<IERC20Metadata>;
  let vrfCoordinator: FakeContract<VRFCoordinatorV2Interface>;
  let saleStartTimestamp: number;
  let openSaleStartTimestamp: number;
  let nftPrice: BigNumber;
  let saleTestConfig: SaleTestConfig;

  const NAME: string = 'Test';
  const SYMBOL: string = 'T';
  const BASE_URI: string = 'baseUri/';
  const UNREVEALED_URI: string = 'unrevealedUri';
  const RANDOM_NUMBER: number = 23113;

  let snapshotId: string;

  before(async function () {
    const accounts = await ethers.getSigners();
    let owner = accounts[0];
    let tokenPriceOracleAddress = accounts[1];
    let vrfCoordinatorAddress = accounts[3];
    let whitelisted = accounts.slice(4, 11);
    let nonWhitelisted = accounts.slice(12, 16);
    let otherAddress = accounts[17];
    tokenPriceOracle = await smock.fake('@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface', {
      address: tokenPriceOracleAddress.address,
    });
    token = await smock.fake('IERC20Metadata');
    vrfCoordinator = await smock.fake('VRFCoordinatorV2Interface', { address: vrfCoordinatorAddress.address });
    let revelationConfig = {
      subId: 0,
      vrfCoordinator: vrfCoordinator.address,
      keyHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    const leaves = whitelisted.map((account) => keccak256(account.address));
    let merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
    let now = moment().unix();
    saleStartTimestamp = now + ONE_YEAR_IN_SECONDS;
    openSaleStartTimestamp = saleStartTimestamp + ONE_YEAR_IN_SECONDS;
    nftPrice = BigNumber.from(10).pow(18);
    let maxTokensPerAddress = 3;
    let maxDelay = moment.duration(24, 'hours').asSeconds();
    let saleConfig = {
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
    let uriConfig = {
      baseURI: BASE_URI,
      unrevealedURI: UNREVEALED_URI,
    };
    let config = {
      saleConfig: saleConfig,
      revelationConfig: revelationConfig,
      uriConfig: uriConfig,
    };
    let TheLodge = await ethers.getContractFactory('TheLodge');
    saleHandler = await TheLodge.deploy(config);
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
    token.decimals.returns(18);
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

  describe('Airdrop', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateAirdropTests(state, addressType, () => saleTestConfig);
        }
      });
    }
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
          await saleHandler.connect(vrfCoordinator.wallet).rawFulfillRandomWords(0, [RANDOM_NUMBER]);
        });
      }
      default:
        break;
    }
  }
});

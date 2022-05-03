import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import chai, { expect } from 'chai';
import { Contract, ContractFactory, Signer } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceToTime, snapshot } from '@utils/evm';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { AggregatorV3Interface, IERC20 } from '@typechained';
import { then, when, contract, given } from '@test-utils/bdd';
import { LogiaConfig } from 'typechained/Logia';
import { keccak256 } from 'ethers/lib/utils';

chai.use(smock.matchers);

const ONE_YEAR_IN_SECONDS = 31556952;

enum SaleState {
  NotStarted = 'Sale not started yet',
  SaleStarted = 'Sale has started',
  OpenSaleStarted = 'Open sale has started',
  Revealed = 'Reveal method was called',
}

enum AddressType {
  Whitelisted = 'whitelisted address',
  NonWhitelisted = 'non whitelisted address',
  Owner = 'owner',
  Contract = 'contract',
}

contract('TheLodgeSaleHandler', () => {
  let TheLodgeSaleHandlerImpl: ContractFactory;
  let saleHandler: Contract;
  let tokenPriceOracle: FakeContract<AggregatorV3Interface>;
  let token: FakeContract<IERC20>;
  let snapshotId: string;
  let owner: SignerWithAddress;
  let whitelisted: SignerWithAddress[];
  let nonWhitelisted: SignerWithAddress[];
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let saleStartTimestamp: number;
  let openSaleStartTimestamp: number;
  let nftPrice: string;
  let config: LogiaConfig.SaleConfigStruct;
  let signers: Map<AddressType, SignerWithAddress[]>;
  let dummyCallerContract: Contract;

  before(async function () {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    let tokenPriceOracleAddress = accounts[1];
    let tokenAddress = accounts[2];
    whitelisted = accounts.slice(3, 10);
    nonWhitelisted = accounts.slice(11, 15);
    tokenPriceOracle = await smock.fake('@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface', {
      address: tokenPriceOracleAddress.address,
    });
    token = await smock.fake('IERC20', { address: await tokenAddress.getAddress() });
    const leaves = whitelisted.map((account) => keccak256(account.address));
    merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
    merkleRoot = merkleTree.getHexRoot();
    let now = Date.now();
    saleStartTimestamp = now + ONE_YEAR_IN_SECONDS;
    openSaleStartTimestamp = saleStartTimestamp + ONE_YEAR_IN_SECONDS;
    nftPrice = (10 ** 18).toString();
    config = {
      tokenName: 'Test',
      tokenSymbol: 'T',
      oracle: tokenPriceOracle.address,
      maxDelay: 10_000,
      // 1 ETH
      nftPrice: nftPrice,
      maxTokensPerAddress: 2,
      alternativePaymentToken: token.address,
      saleStartTimestamp: saleStartTimestamp,
      openSaleStartTimestamp: openSaleStartTimestamp,
      merkleRoot: merkleRoot,
    };
    TheLodgeSaleHandlerImpl = await ethers.getContractFactory('TheLodgeSaleHandlerImpl');
    saleHandler = await TheLodgeSaleHandlerImpl.deploy(config);
    await saleHandler.setEnded(false);
    let DummyCallerContract = await ethers.getContractFactory('DummyCallerContract');
    dummyCallerContract = await DummyCallerContract.deploy(saleHandler.address);
    signers = new Map();
    signers.set(AddressType.Whitelisted, whitelisted);
    signers.set(AddressType.NonWhitelisted, nonWhitelisted);
    signers.set(AddressType.Owner, [owner]);
    snapshotId = await snapshot.take();
  });

  beforeEach(async function () {
    await snapshot.revert(snapshotId);
  });

  for (const addressType of Object.values(AddressType)) {
    for (const state of Object.values(SaleState)) {
      generateTests(state, addressType);
    }
  }

  function generateTests(state: SaleState, addressType: AddressType) {
    // TODO: Let `state` have an associated `given` function (to set dates).
    describe(state, () => {
      let quantity = 1;
      when(addressType + ' mints with right funds', () => {
        switch (state) {
          case SaleState.NotStarted:
          case SaleState.SaleStarted: {
            then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('1') })).to.be.revertedWith(
                  'OpenSaleNotStarted(' + openSaleStartTimestamp + ')'
                );
              }
            });
            break;
          }
          case SaleState.OpenSaleStarted: {
            then('Address should get the tokens', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('1') });
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(quantity);
              }
            });
            break;
          }
          case SaleState.Revealed: {
            then('Transaction should be reverted with SaleEnded error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('1') })).to.be.revertedWith(
                  'SaleEnded'
                );
              }
            });
            break;
          }
        }
      });
      when(addressType + ' mints with insufficient funds', () => {
        switch (state) {
          case SaleState.NotStarted:
          case SaleState.SaleStarted: {
            then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('0.9') })).to.be.revertedWith(
                  'OpenSaleNotStarted(' + openSaleStartTimestamp + ')'
                );
              }
            });
            break;
          }
          case SaleState.OpenSaleStarted: {
            then('Transaction should be reverted with InvalidFunds error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await saleHandler
                  .connect(signerAddress)
                  .mint(quantity, { value: ethers.utils.parseEther('0.9') })
                  .to.be.revertedWith('InvalidFunds(' + 9 * 10 ** 17 + ', ' + nftPrice + ')');
              }
            });
            break;
          }
          case SaleState.Revealed: {
            then('Transaction should be reverted with SaleEnded error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('0.9') })).to.be.revertedWith(
                  'SaleEnded'
                );
              }
            });
            break;
          }
        }
      });
      when(addressType + ' mints with more funds than needed', () => {
        switch (state) {
          case SaleState.NotStarted:
          case SaleState.SaleStarted: {
            then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('0.9') })).to.be.revertedWith(
                  'OpenSaleNotStarted(' + openSaleStartTimestamp + ')'
                );
              }
            });
            break;
          }
          case SaleState.OpenSaleStarted: {
            then('Transaction should be reverted with InvalidFunds error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await saleHandler
                  .connect(signerAddress)
                  .mint(quantity, { value: ethers.utils.parseEther('0.9') })
                  .to.be.revertedWith('InvalidFunds(' + 9 * 10 ** 17 + ', ' + nftPrice + ')');
              }
            });
            break;
          }
          case SaleState.Revealed: {
            then('Transaction should be reverted with SaleEnded error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                await expect(saleHandler.connect(signerAddress).mint(quantity, { value: ethers.utils.parseEther('0.9') })).to.be.revertedWith(
                  'SaleEnded'
                );
              }
            });
            break;
          }
        }
      });
    });
  }
});

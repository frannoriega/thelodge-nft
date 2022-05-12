import { JsonRpcSigner, TransactionResponse } from '@ethersproject/providers';
import { BigNumber, constants } from 'ethers';
import { deployments, ethers } from 'hardhat';
import { evm, wallet } from '@utils';
import { expect } from 'chai';
import { getNodeUrl } from 'utils/env';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AggregatorV3Interface, IERC20Metadata, TheLodge } from '@typechained';
import { abi as IERC20_METADATA_ABI } from '@openzeppelin/contracts/build/contracts/IERC20Metadata.json';
import AGGREGATOR_V3_ABI from '@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json';
import { MerkleTree } from 'merkletreejs';
import { keccak256 } from 'ethers/lib/utils';

const BLOCK_NUMBER = 14757530;
const BLOCK_TIMESTAMP = 1652308534;
const AN_HOUR_LATER = BLOCK_TIMESTAMP + 60 * 60;
const APE_WHALE = '0x1633b453c3ca5a244c66f4418ff5120282370053';
const UNREVEALED_URI = 'https://unrevealed.uri';
const BASE_URI = 'https://base.uri';

describe('E2E test @skip-on-coverage', () => {
  const initialETHBalance: Record<string, BigNumber> = {};
  const initialAPEBalance: Record<string, BigNumber> = {};
  let whitelistedETH: SignerWithAddress,
    whitelistedAPE: SignerWithAddress,
    saleETH: SignerWithAddress,
    saleAPE: SignerWithAddress,
    airdropped: SignerWithAddress,
    recipient: SignerWithAddress;

  let theLodge: TheLodge;
  let apeWhale: JsonRpcSigner, coordinator: JsonRpcSigner;
  let APE: IERC20Metadata;
  let mintPriceETH: BigNumber, mintPriceAPE: BigNumber;
  let merkleTree: MerkleTree;

  before(async () => {
    [, whitelistedETH, whitelistedAPE, saleETH, saleAPE, airdropped, recipient] = await ethers.getSigners();
    await evm.reset({
      jsonRpcUrl: getNodeUrl('mainnet'),
      blockNumber: BLOCK_NUMBER,
    });

    // Set up contracts
    await deployments.fixture('TheLodge', { keepExistingDeployments: false });
    theLodge = await ethers.getContract('TheLodge');
    APE = await ethers.getContractAt(IERC20_METADATA_ABI, await theLodge.alternativePaymentToken());
    const priceOracle: AggregatorV3Interface = await ethers.getContractAt(AGGREGATOR_V3_ABI, await theLodge.priceOracle());

    // Impersonations
    apeWhale = await wallet.impersonate(APE_WHALE);
    coordinator = await wallet.impersonate(await theLodge.coordinator());
    await ethers.provider.send('hardhat_setBalance', [await apeWhale.getAddress(), '0xffffffffffffffff']);
    await ethers.provider.send('hardhat_setBalance', [await coordinator.getAddress(), '0xffffffffffffffff']);

    // Some config
    await theLodge.setBaseURI(BASE_URI);
    await theLodge.setUnrevealedURI(UNREVEALED_URI);
    await theLodge.setStartTimestamps(BLOCK_TIMESTAMP, AN_HOUR_LATER);
    await theLodge.setMaxDelay(BigNumber.from(2).pow(32).sub(1));
    mintPriceETH = await theLodge.tokenPrice();
    const { answer } = await priceOracle.latestRoundData();
    mintPriceAPE = mintPriceETH.mul(BigNumber.from(10).pow(await APE.decimals())).div(answer);

    // Give tokens to users
    await APE.connect(apeWhale).transfer(whitelistedAPE.address, mintPriceAPE.mul(3));
    await APE.connect(apeWhale).transfer(saleAPE.address, mintPriceAPE.mul(2));

    // Set whitelist
    const whitelisted = [keccak256(whitelistedETH.address), keccak256(whitelistedAPE.address)];
    merkleTree = new MerkleTree(whitelisted, keccak256, { sort: true });
    await theLodge.setMerkleRoot(merkleTree.getHexRoot());

    // Fill initial balances
    for (const signer of await ethers.getSigners()) {
      initialETHBalance[signer.address] = await ethers.provider.getBalance(signer.address);
      initialAPEBalance[signer.address] = await APE.balanceOf(signer.address);
    }
    initialETHBalance[theLodge.address] = constants.Zero;
    initialAPEBalance[theLodge.address] = constants.Zero;
  });

  it('E2E', async () => {
    // Users approve contract for APE transfering
    await APE.connect(whitelistedAPE).approve(theLodge.address, constants.MaxUint256);
    await APE.connect(saleAPE).approve(theLodge.address, constants.MaxUint256);

    // Whitelisted users mint through whitelist
    const tx1 = await theLodge
      .connect(whitelistedETH)
      .whitelistMint(merkleTree.getHexProof(keccak256(whitelistedETH.address)), 2, { value: mintPriceETH.mul(2) });
    await theLodge.connect(whitelistedAPE).whitelistBuyWithToken(merkleTree.getHexProof(keccak256(whitelistedAPE.address)), 2);

    // Assertions
    await assertFundsWhereTransferedInSale(whitelistedETH, 'eth', mintPriceETH, 2, tx1);
    await assertFundsWhereTransferedInSale(whitelistedAPE, 'ape', mintPriceAPE, 2);
    await assertAddressHasTokens(whitelistedETH, 1, 2);
    await assertAddressHasTokens(whitelistedAPE, 3, 4);

    // Now users can mint without whitelist
    await evm.advanceTimeAndBlock(AN_HOUR_LATER);

    // Users mint without whitelist
    const tx2 = await theLodge.connect(saleETH).mint(2, { value: mintPriceETH.mul(2) });
    await theLodge.connect(saleAPE).buyWithToken(2);

    // Assertions
    await assertFundsWhereTransferedInSale(saleETH, 'eth', mintPriceETH, 2, tx2);
    await assertFundsWhereTransferedInSale(saleAPE, 'ape', mintPriceAPE, 2);
    await assertAddressHasTokens(saleETH, 5, 6);
    await assertAddressHasTokens(saleAPE, 7, 8);

    // Whitelisted users can also mint without whitelist
    const tx3 = await theLodge.connect(whitelistedETH).mint(1, { value: mintPriceETH });
    await theLodge.connect(whitelistedAPE).buyWithToken(1);

    // Assertions
    await assertFundsWhereTransferedInSale(whitelistedETH, 'eth', mintPriceETH, 1, tx3);
    await assertFundsWhereTransferedInSale(whitelistedAPE, 'ape', mintPriceAPE, 1);
    await assertAddressHasTokens(whitelistedETH, 1, 2, 9);
    await assertAddressHasTokens(whitelistedAPE, 3, 4, 10);

    // Owner airdrops to a user
    await theLodge.airdrop([{ to: airdropped.address, quantity: 2 }]);

    // Assertions
    await assertAddressHasTokens(airdropped, 11, 12);
    const ALL_TOKENS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    await assertTokensAreUnrevealed(...ALL_TOKENS);
    expect(await theLodge.totalSupply()).to.equal(ALL_TOKENS.length);

    // Reveal
    await theLodge.connect(coordinator).rawFulfillRandomWords(1, [30]);

    // Assertions
    await assertAllTokensReturnRevealedURI(...ALL_TOKENS);
    await assertAllTokensReturnARarity(...ALL_TOKENS);

    // Perform withdraw of all funds
    await theLodge.withdrawETH(recipient.address);
    await theLodge.withdrawAlternativeToken(recipient.address);

    // Assertions
    await assertTransferWasMade('eth', theLodge, recipient, mintPriceETH.mul(5));
    await assertTransferWasMade('ape', theLodge, recipient, mintPriceAPE.mul(5));
  });

  async function assertAllTokensReturnRevealedURI(...tokenIds: number[]) {
    const usedTokenURIs: Set<string> = new Set();
    for (const tokenId of tokenIds) {
      const tokenURI = await theLodge.tokenURI(tokenId);
      expect(tokenURI.startsWith(BASE_URI)).to.be.true;
      expect(usedTokenURIs.has(tokenURI)).to.be.false;
      usedTokenURIs.add(tokenURI);
    }
  }

  async function assertAllTokensReturnARarity(...tokenIds: number[]) {
    for (const tokenId of tokenIds) {
      expect(await theLodge.getRarity(tokenId))
        .to.be.greaterThanOrEqual(0)
        .and.lessThanOrEqual(2);
    }
  }

  async function assertFundsWhereTransferedInSale(
    from: SignerWithAddress,
    token: 'eth' | 'ape',
    pricePerMint: BigNumber,
    amountMinted: number,
    ...txs: TransactionResponse[]
  ) {
    const totalTransferred = pricePerMint.mul(amountMinted);
    await assertTransferWasMade(token, from, theLodge, totalTransferred, ...txs);
  }

  async function assertTransferWasMade(
    token: 'eth' | 'ape',
    from: { address: string },
    to: { address: string },
    amount: BigNumber,
    ...txs: TransactionResponse[]
  ) {
    const totalSpentInGas = await spentInGas(...txs);
    await expectFundDiff(token, from.address, amount.add(totalSpentInGas), 'sent');
    await expectFundDiff(token, to.address, amount, 'received');
  }

  async function spentInGas(...txs: TransactionResponse[]) {
    const spentInGas = await Promise.all(txs.map((tx) => tx.wait().then((receipt) => receipt.gasUsed.mul(receipt.effectiveGasPrice))));
    return spentInGas.reduce((accum, curr) => accum.add(curr), constants.Zero);
  }

  async function expectFundDiff(token: 'eth' | 'ape', address: SignerWithAddress | string, diff: BigNumber, type: 'sent' | 'received') {
    const signedDiff = diff.mul(type === 'sent' ? -1 : 1);
    const check = typeof address === 'string' ? address : address.address;
    let balanceCheck: (address: string) => Promise<BigNumber>;
    let balanceBook: Record<string, BigNumber>;
    if (token === 'eth') {
      balanceCheck = ethers.provider.getBalance;
      balanceBook = initialETHBalance;
    } else {
      balanceCheck = APE.balanceOf;
      balanceBook = initialAPEBalance;
    }
    const balanceNow = await balanceCheck(check);
    const expectedBalance = balanceBook[check].add(signedDiff);
    expect(balanceNow).to.equal(expectedBalance);
    balanceBook[check] = expectedBalance;
  }

  async function assertAddressHasTokens(signer: SignerWithAddress, ...tokenIds: number[]) {
    expect(await theLodge.balanceOf(signer.address)).to.equal(tokenIds.length);
    for (const tokenId of tokenIds) {
      expect(await theLodge.ownerOf(tokenId)).to.equal(signer.address);
    }
  }

  async function assertTokensAreUnrevealed(...tokenIds: number[]) {
    for (const tokenId of tokenIds) {
      const tokenUri = await theLodge.tokenURI(tokenId);
      expect(tokenUri).to.equal(UNREVEALED_URI);
    }
  }
});

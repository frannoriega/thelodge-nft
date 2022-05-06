import { ethers } from 'hardhat';
import { MerkleTree } from 'merkletreejs';
import chai, { expect } from 'chai';
import { BigNumber, Contract, ContractFactory, Signer, Transaction } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { advanceToTime, snapshot } from '@utils/evm';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { AggregatorV3Interface, IERC20 } from '@typechained';
import { then, when, contract, given } from '@test-utils/bdd';
import moment from 'moment';
import { keccak256 } from 'ethers/lib/utils';
import { setBalance } from '@utils/contracts';

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
  let otherAddress: SignerWithAddress;
  let merkleTree: MerkleTree;
  let merkleRoot: string;
  let saleStartTimestamp: number;
  let openSaleStartTimestamp: number;
  let nftPrice: BigNumber;
  let maxTokensPerAddress: number;
  let maxDelay: number;
  let signers: Map<AddressType, SignerWithAddress[]>;
  let dummyCallerContract: Contract;

  before(async function () {
    const accounts = await ethers.getSigners();
    owner = accounts[0];
    let tokenPriceOracleAddress = accounts[1];
    let tokenAddress = accounts[2];
    whitelisted = accounts.slice(3, 10);
    nonWhitelisted = accounts.slice(11, 15);
    otherAddress = accounts[16];
    tokenPriceOracle = await smock.fake('@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol:AggregatorV3Interface', {
      address: tokenPriceOracleAddress.address,
    });
    token = await smock.fake('IERC20', { address: await tokenAddress.getAddress() });
    const leaves = whitelisted.map((account) => keccak256(account.address));
    merkleTree = new MerkleTree(leaves, keccak256, { sort: true });
    merkleRoot = merkleTree.getHexRoot();
    let now = moment().unix();
    saleStartTimestamp = now + ONE_YEAR_IN_SECONDS;
    openSaleStartTimestamp = saleStartTimestamp + ONE_YEAR_IN_SECONDS;
    nftPrice = BigNumber.from(10).pow(18);
    maxTokensPerAddress = 3;
    maxDelay = moment.duration(24, 'hours').asSeconds();
    let config = {
      tokenName: 'Test',
      tokenSymbol: 'T',
      oracle: tokenPriceOracle.address,
      maxDelay: maxDelay,
      nftPrice: nftPrice.toString(), // 1 ETH
      maxTokensPerAddress: maxTokensPerAddress,
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
    token.transferFrom.returns(true);
  });

  afterEach(async function () {
    token.transferFrom.reset();
  });

  describe('Mint', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateMintTests(state, addressType);
        }
      });
    }
  });
  describe('Whitelist mint', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateWhitelistMintTests(state, addressType);
        }
      });
    }
  });
  describe('Buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateBuyWithTokenTests(state, addressType);
        }
      });
    }
  });
  describe('Whitelist buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateWhitelistBuyWithTokenTests(state, addressType);
        }
      });
    }
  });
  describe('Whitelist buy with token', () => {
    for (const state of Object.values(SaleState)) {
      describe(state, () => {
        generateGiven(state);
        for (const addressType of Object.values(AddressType)) {
          generateAirdropTests(state, addressType);
        }
      });
    }
  });

  // Withdraw tests
  describe('Withdraw ETH', () => {
    for (const addressType of Object.values(AddressType)) {
      generateWithdrawETHTests(addressType);
    }
  });
  describe('Withdraw token', () => {
    for (const addressType of Object.values(AddressType)) {
      generateWithdrawTokenTests(addressType);
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

  function generateMintTests(state: SaleState, addressType: AddressType) {
    when(addressType + ' mints with right funds', () => {
      switch (state) {
        case SaleState.NotStarted:
        case SaleState.SaleStarted: {
          then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('OpenSaleNotStarted(' + openSaleStartTimestamp + ')');
            }
          });
          break;
        }
        case SaleState.OpenSaleStarted: {
          then('Address should get the tokens', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
              await saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) });
              expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('SaleEnded');
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
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
              ).to.be.revertedWith('OpenSaleNotStarted(' + openSaleStartTimestamp + ')');
            }
          });
          break;
        }
        case SaleState.OpenSaleStarted: {
          then('Transaction should be reverted with InvalidFunds error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
              ).to.be.revertedWith(
                'InvalidFunds(' + nftPrice.mul(maxTokensPerAddress).sub(1).toString() + ', ' + nftPrice.mul(maxTokensPerAddress) + ')'
              );
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
              ).to.be.revertedWith('SaleEnded');
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
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
              ).to.be.revertedWith('OpenSaleNotStarted(' + openSaleStartTimestamp + ')');
            }
          });
          break;
        }
        case SaleState.OpenSaleStarted: {
          then('Transaction should be reverted with InvalidFunds error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
              ).to.be.revertedWith(
                'InvalidFunds(' + nftPrice.mul(maxTokensPerAddress).add(1).toString() + ', ' + nftPrice.mul(maxTokensPerAddress) + ')'
              );
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
              ).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
    when(addressType + ' mints more than allowed', () => {
      switch (state) {
        case SaleState.NotStarted:
        case SaleState.SaleStarted: {
          then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress + 1, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('OpenSaleNotStarted(' + openSaleStartTimestamp + ')');
            }
          });
          break;
        }
        case SaleState.OpenSaleStarted: {
          then('Transaction should be reverted with TokenLimitExceeded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress + 1, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('TokenLimitExceeded');
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with TokenLimitExceeded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(
                saleHandler.connect(signerAddress).mint(maxTokensPerAddress + 1, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('TokenLimitExceeded');
            }
          });
          break;
        }
      }
    });
  }

  function generateWhitelistMintTests(state: SaleState, addressType: AddressType) {
    when(addressType + ' whitelist mints with right funds', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('SaleNotStarted');
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Address should get the tokens', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) });
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(
                  saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) })
                ).to.be.revertedWith('InvalidProof');
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) })
              ).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
    when(addressType + ' mints with insufficient funds', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
              ).to.be.revertedWith('SaleNotStarted');
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Transaction should be reverted with InvalidFunds error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(
                  saleHandler
                    .connect(signerAddress)
                    .whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
                ).to.be.revertedWith(
                  'InvalidFunds(' + nftPrice.mul(maxTokensPerAddress).sub(1) + ', ' + nftPrice.mul(maxTokensPerAddress) + ')'
                );
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(
                  saleHandler
                    .connect(signerAddress)
                    .whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
                ).to.be.revertedWith('InvalidProof');
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).sub(1) })
              ).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
    when(addressType + ' mints with more funds than needed', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
              ).to.be.revertedWith('SaleNotStarted');
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Transaction should be reverted with InvalidFunds error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(
                  saleHandler
                    .connect(signerAddress)
                    .whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
                ).to.be.revertedWith(
                  'InvalidFunds(' + nftPrice.mul(maxTokensPerAddress).add(1) + ', ' + nftPrice.mul(maxTokensPerAddress) + ')'
                );
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(
                  saleHandler
                    .connect(signerAddress)
                    .whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
                ).to.be.revertedWith('InvalidProof');
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(
                saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress).add(1) })
              ).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
  }

  function generateBuyWithTokenTests(state: SaleState, addressType: AddressType) {
    when(addressType + ' calls buyWithToken', () => {
      switch (state) {
        case SaleState.NotStarted:
        case SaleState.SaleStarted: {
          then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(saleHandler.connect(signerAddress).buyWithToken(maxTokensPerAddress)).to.be.revertedWith(
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
              await saleHandler.connect(signerAddress).buyWithToken(maxTokensPerAddress);
              expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
              expect(token.transferFrom).to.have.been.calledWith(signerAddress.address, saleHandler.address, nftPrice.mul(maxTokensPerAddress));
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              await expect(saleHandler.connect(signerAddress).buyWithToken(maxTokensPerAddress)).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
  }

  function generateWhitelistBuyWithTokenTests(state: SaleState, addressType: AddressType) {
    when(addressType + ' calls buyWithToken', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                'SaleNotStarted'
              );
              expect(token.transferFrom).to.have.not.been.called;
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Address should get the tokens', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) });
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                  'InvalidProof'
                );
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
    when(addressType + ' calls buyWithToken but oracle gives wrong answer', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                'SaleNotStarted'
              );
              expect(token.transferFrom).to.have.not.been.called;
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Transaction should be reverted with InvalidAnswer error', async () => {
              let signerAddresses = signers.get(addressType)!;
              tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) });
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                  'InvalidProof'
                );
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
    when(addressType + ' calls buyWithToken but oracle gives outdated answer', () => {
      switch (state) {
        case SaleState.NotStarted: {
          then('Transaction should be reverted with SaleNotStarted error', async () => {
            let signerAddresses = signers.get(addressType)!;
            tokenPriceOracle.latestRoundData.returns([0, 1, 0, moment().unix() + saleStartTimestamp - maxDelay - 1, 0]);
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                'SaleNotStarted'
              );
              expect(token.transferFrom).to.have.not.been.called;
            }
          });
          break;
        }
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          if (addressType == AddressType.Whitelisted) {
            then('Transaction should be reverted with OutdatedAnswer error', async () => {
              let signerAddresses = signers.get(addressType)!;
              tokenPriceOracle.latestRoundData.returns([0, 1, 0, moment().unix() + saleStartTimestamp - maxDelay - 1, 0]);
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).whitelistMint(proof, maxTokensPerAddress, { value: nftPrice.mul(maxTokensPerAddress) });
                expect(await saleHandler.balanceOf(signerAddress.address)).to.equal(maxTokensPerAddress);
              }
            });
          } else {
            then('Transaction should be reverted with InvalidProof error', async () => {
              let signerAddresses = signers.get(addressType)!;
              tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
              for (const signerAddress of signerAddresses) {
                let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
                await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith(
                  'InvalidProof'
                );
              }
            });
          }
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let signerAddresses = signers.get(addressType)!;
            tokenPriceOracle.latestRoundData.returns([0, -1, 0, moment().unix() + saleStartTimestamp, 0]);
            for (const signerAddress of signerAddresses) {
              let proof = merkleTree.getHexProof(keccak256(signerAddress.address));
              await expect(saleHandler.connect(signerAddress).whitelistBuyWithToken(proof, maxTokensPerAddress)).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    });
  }

  function generateAirdropTests(state: SaleState, addressType: AddressType) {
    when(addressType + ' calls airdrop', () => {
      if (addressType == AddressType.Owner) {
        switch (state) {
          case SaleState.NotStarted:
          case SaleState.SaleStarted:
          case SaleState.OpenSaleStarted: {
            then('The tokens should be sent to the address', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let quantity = maxTokensPerAddress + 1;
                let airdrop = {
                  to: otherAddress.address,
                  quantity: quantity,
                };
                expect(await saleHandler.balanceOf(otherAddress.address)).to.equal(0);
                await saleHandler.connect(signerAddress).airdrop([airdrop]);
                expect(await saleHandler.balanceOf(otherAddress.address)).to.equal(quantity);
              }
            });
            break;
          }
          case SaleState.Revealed: {
            then('The tokens should be sent to the address', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let quantity = maxTokensPerAddress + 1;
                let airdrop = {
                  to: otherAddress.address,
                  quantity: quantity,
                };
                await expect(saleHandler.connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('SaleEnded');
              }
            });
            break;
          }
        }
      } else {
        then('Transaction should be reverted with Ownable error', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let quantity = maxTokensPerAddress + 1;
            let airdrop = {
              to: otherAddress.address,
              quantity: quantity,
            };
            await expect(saleHandler.connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('Ownable: caller is not the owner');
          }
        });
      }
    });
    when(addressType + ' calls airdrop but exceeds supply', () => {
      if (addressType == AddressType.Owner) {
        switch (state) {
          case SaleState.NotStarted:
          case SaleState.SaleStarted:
          case SaleState.OpenSaleStarted: {
            then('The tokens should be sent to the address', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let quantity = 7777 + 1;
                let airdrop = {
                  to: otherAddress.address,
                  quantity: quantity,
                };
                await expect(saleHandler.connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('TokenSupplyExceeded');
              }
            });
            break;
          }
          case SaleState.Revealed: {
            then('Transaction should be reverted with SaleEnded error', async () => {
              let signerAddresses = signers.get(addressType)!;
              for (const signerAddress of signerAddresses) {
                let quantity = 7777 + 1;
                let airdrop = {
                  to: otherAddress.address,
                  quantity: quantity,
                };
                await expect(saleHandler.connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('SaleEnded');
              }
            });
            break;
          }
        }
      } else {
        then('Transaction should be reverted with Ownable error', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let quantity = maxTokensPerAddress + 1;
            let airdrop = {
              to: otherAddress.address,
              quantity: quantity,
            };
            await expect(saleHandler.connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('Ownable: caller is not the owner');
          }
        });
      }
    });
  }

  function generateWithdrawETHTests(addressType: AddressType) {
    when(addressType + ' calls withdrawEth with', () => {
      if (addressType == AddressType.Owner) {
        then('Address should get the ETH from the contract', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            setBalance(saleHandler.address, nftPrice);
            setBalance(otherAddress.address, BigNumber.from(0));
            let contractBalance = await ethers.provider.getBalance(saleHandler.address);
            expect(await ethers.provider.getBalance(otherAddress.address)).to.equal(0);
            await saleHandler.connect(signerAddress).withdrawETH(otherAddress.address);
            expect(await ethers.provider.getBalance(otherAddress.address)).to.equal(contractBalance);
            expect(await ethers.provider.getBalance(saleHandler.address)).to.be.equal(0);
          }
        });
      } else {
        then('Transaction should be reverted with Ownable error', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            setBalance(saleHandler.address, nftPrice);
            setBalance(otherAddress.address, BigNumber.from(0));
            let contractBalance = await ethers.provider.getBalance(saleHandler.address);
            expect(await ethers.provider.getBalance(otherAddress.address)).to.equal(0);
            await expect(saleHandler.connect(signerAddress).withdrawETH(otherAddress.address)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
            expect(await ethers.provider.getBalance(otherAddress.address)).to.equal(0);
            expect(await ethers.provider.getBalance(saleHandler.address)).to.be.equal(contractBalance);
          }
        });
      }
    });
  }

  function generateWithdrawTokenTests(addressType: AddressType) {
    when(addressType + ' calls withdrawAlternativeToken with', () => {
      if (addressType == AddressType.Owner) {
        then('Address should get the token from the contract', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let tokenAmount = 5;
            token.balanceOf.returns(tokenAmount);
            token.transfer.returns(true);
            await saleHandler.connect(signerAddress).withdrawAlternativeToken(otherAddress.address);
            expect(token.balanceOf).to.have.been.calledWith(saleHandler.address);
            expect(token.transfer).to.have.been.calledWith(otherAddress.address, tokenAmount);
          }
        });
      } else {
        then('Transaction should be reverted with Ownable error', async () => {
          let signerAddresses = signers.get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(saleHandler.connect(signerAddress).withdrawAlternativeToken(otherAddress.address)).to.be.revertedWith(
              'Ownable: caller is not the owner'
            );
            expect(token.balanceOf).to.have.not.been.called;
            expect(token.transferFrom).to.have.not.been.called;
          }
        });
      }
    });
  }
});

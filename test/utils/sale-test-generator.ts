import { FakeContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { AggregatorV3Interface, IERC20, IERC20Metadata } from '@typechained';
import chai, { expect } from 'chai';
import { BigNumber, Contract } from 'ethers';
import { ethers } from 'hardhat';
import { keccak256 } from 'ethers/lib/utils';
import MerkleTree from 'merkletreejs';
import moment from 'moment';
import { given, when, then } from './bdd';
import { setBalance } from './contracts';
import { advanceToTime } from './evm';

chai.use(smock.matchers);

export enum SaleState {
  NotStarted = 'Sale not started yet',
  SaleStarted = 'Sale has started',
  OpenSaleStarted = 'Open sale has started',
  Revealed = 'Reveal method was called',
}

export enum AddressType {
  Whitelisted = 'whitelisted address',
  NonWhitelisted = 'non whitelisted address',
  Owner = 'owner',
}

export class SaleTestConfig {
  private saleHandler: Contract;
  private tokenPriceOracle: FakeContract<AggregatorV3Interface>;
  private token: FakeContract<IERC20Metadata>;
  private merkleTree: MerkleTree;
  private saleStartTimestamp: number;
  private openSaleStartTimestamp: number;
  private nftPrice: BigNumber;
  private maxTokensPerAddress: number;
  private maxDelay: number;
  private signers: Map<AddressType, SignerWithAddress[]>;
  private otherAddress: SignerWithAddress;
  private callerContract: Contract;

  constructor(
    saleHandler: Contract,
    tokenPriceOracle: FakeContract<AggregatorV3Interface>,
    token: FakeContract<IERC20Metadata>,
    merkleTree: MerkleTree,
    saleStartTimestamp: number,
    openSaleStartTimestamp: number,
    nftPrice: BigNumber,
    maxTokensPerAddress: number,
    maxDelay: number,
    signers: Map<AddressType, SignerWithAddress[]>,
    otherAddress: SignerWithAddress,
    callerContract: Contract
  ) {
    this.saleHandler = saleHandler;
    this.tokenPriceOracle = tokenPriceOracle;
    this.token = token;
    this.merkleTree = merkleTree;
    this.saleStartTimestamp = saleStartTimestamp;
    this.openSaleStartTimestamp = openSaleStartTimestamp;
    this.nftPrice = nftPrice;
    this.maxTokensPerAddress = maxTokensPerAddress;
    this.maxDelay = maxDelay;
    this.signers = signers;
    this.otherAddress = otherAddress;
    this.callerContract = callerContract;
  }

  getSaleHandler(): Contract {
    return this.saleHandler;
  }

  getTokenPriceOracle(): FakeContract<AggregatorV3Interface> {
    return this.tokenPriceOracle;
  }

  getToken(): FakeContract<IERC20Metadata> {
    return this.token;
  }

  getMerkleTree(): MerkleTree {
    return this.merkleTree;
  }

  getSaleStartTimestamp(): number {
    return this.saleStartTimestamp;
  }

  getOpenSaleStartTimestamp(): number {
    return this.openSaleStartTimestamp;
  }

  getNftPrice(): BigNumber {
    return this.nftPrice;
  }

  getMaxTokensPerAddress(): number {
    return this.maxTokensPerAddress;
  }

  getMaxDelay(): number {
    return this.maxDelay;
  }

  getSigners(): Map<AddressType, SignerWithAddress[]> {
    return this.signers;
  }

  getOtherSigner(): SignerWithAddress {
    return this.otherAddress;
  }

  getCallerContract(): Contract {
    return this.callerContract;
  }
}

export function generateGiven(state: SaleState, configProvider: () => SaleTestConfig) {
  switch (state) {
    case SaleState.SaleStarted: {
      given(async () => {
        let config = configProvider();
        await advanceToTime(config.getSaleStartTimestamp() + 1);
        config.getTokenPriceOracle().latestRoundData.returns([0, 1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
      });
      break;
    }
    case SaleState.OpenSaleStarted: {
      given(async () => {
        let config = configProvider();
        await advanceToTime(config.getOpenSaleStartTimestamp() + 1);
        config.getTokenPriceOracle().latestRoundData.returns([0, 1, 0, moment().unix() + config.getOpenSaleStartTimestamp(), 0]);
      });
      break;
    }
    case SaleState.Revealed: {
      given(async () => {
        let config = configProvider();
        await advanceToTime(config.getOpenSaleStartTimestamp() + 1);
        config.getTokenPriceOracle().latestRoundData.returns([0, 1, 0, moment().unix() + config.getOpenSaleStartTimestamp(), 0]);
        await config.getSaleHandler().setEnded(true);
      });
      break;
    }
    default:
      break;
  }
}

export function generateMintTests(state: SaleState, addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls mint', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          await expect(
            callerContract.mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
          ).to.be.revertedWith('OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')');
        });
        break;
      }
      case SaleState.OpenSaleStarted:
      case SaleState.Revealed: {
        then('Transaction should be reverted with ContractsCantBuy error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          await expect(
            callerContract.mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
          ).to.be.revertedWith('ContractsCantBuy');
        });
        break;
      }
    }
  });
  when(addressType + ' mints with right funds', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
            ).to.be.revertedWith('OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')');
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Address should get the tokens', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
            await config
              .getSaleHandler()
              .connect(signerAddress)
              .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) });
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
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
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1) })
            ).to.be.revertedWith('OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')');
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Transaction should be reverted with InvalidFunds error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1) })
            ).to.be.revertedWith(
              'InvalidFunds(' +
                config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1).toString() +
                ', ' +
                config.getNftPrice().mul(config.getMaxTokensPerAddress()) +
                ')'
            );
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1) })
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
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1) })
            ).to.be.revertedWith('OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')');
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Transaction should be reverted with InvalidFunds error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1) })
            ).to.be.revertedWith(
              'InvalidFunds(' +
                config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1).toString() +
                ', ' +
                config.getNftPrice().mul(config.getMaxTokensPerAddress()) +
                ')'
            );
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1) })
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
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress() + 1, { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
            ).to.be.revertedWith('OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')');
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Transaction should be reverted with TokenLimitExceeded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress() + 1, { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
            ).to.be.revertedWith('TokenLimitExceeded');
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with TokenLimitExceeded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .mint(config.getMaxTokensPerAddress() + 1, { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
            ).to.be.revertedWith('TokenLimitExceeded');
          }
        });
        break;
      }
    }
  });
}

export function generateWhitelistMintTests(state: SaleState, addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls whitelistMint', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          let proof = config.getMerkleTree().getHexProof(keccak256(callerContract.address));
          await expect(
            callerContract.whitelistMint(proof, config.getMaxTokensPerAddress(), {
              value: config.getNftPrice().mul(config.getMaxTokensPerAddress()),
            })
          ).to.be.revertedWith('SaleNotStarted(' + config.getSaleStartTimestamp() + ')');
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted:
      case SaleState.Revealed: {
        then('Transaction should be reverted with ContractsCantBuy error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          let proof = config.getMerkleTree().getHexProof(keccak256(callerContract.address));
          await expect(
            callerContract.whitelistMint(proof, config.getMaxTokensPerAddress(), {
              value: config.getNftPrice().mul(config.getMaxTokensPerAddress()),
            })
          ).to.be.revertedWith('ContractsCantBuy');
        });
        break;
      }
    }
  });
  when(addressType + ' whitelist mints with right funds', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
            ).to.be.revertedWith('SaleNotStarted');
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Address should get the tokens', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
              await config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) });
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config
                  .getSaleHandler()
                  .connect(signerAddress)
                  .whitelistMint(proof, config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), { value: config.getNftPrice().mul(config.getMaxTokensPerAddress()) })
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
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                  value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1),
                })
            ).to.be.revertedWith('SaleNotStarted');
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Transaction should be reverted with InvalidFunds error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config
                  .getSaleHandler()
                  .connect(signerAddress)
                  .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                    value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1),
                  })
              ).to.be.revertedWith(
                'InvalidFunds(' +
                  config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1) +
                  ', ' +
                  config.getNftPrice().mul(config.getMaxTokensPerAddress()) +
                  ')'
              );
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config
                  .getSaleHandler()
                  .connect(signerAddress)
                  .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                    value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1),
                  })
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                  value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).sub(1),
                })
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
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                  value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1),
                })
            ).to.be.revertedWith('SaleNotStarted');
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Transaction should be reverted with InvalidFunds error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config
                  .getSaleHandler()
                  .connect(signerAddress)
                  .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                    value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1),
                  })
              ).to.be.revertedWith(
                'InvalidFunds(' +
                  config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1) +
                  ', ' +
                  config.getNftPrice().mul(config.getMaxTokensPerAddress()) +
                  ')'
              );
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config
                  .getSaleHandler()
                  .connect(signerAddress)
                  .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                    value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1),
                  })
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config
                .getSaleHandler()
                .connect(signerAddress)
                .whitelistMint(proof, config.getMaxTokensPerAddress(), {
                  value: config.getNftPrice().mul(config.getMaxTokensPerAddress()).add(1),
                })
            ).to.be.revertedWith('SaleEnded');
          }
        });
        break;
      }
    }
  });
}

export function generateBuyWithTokenTests(state: SaleState, addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls buysWithToken', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          await expect(callerContract.buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
            'OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')'
          );
        });
        break;
      }
      case SaleState.OpenSaleStarted:
      case SaleState.Revealed: {
        then('Transaction should be reverted with ContractsCantBuy error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          await expect(callerContract.buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith('ContractsCantBuy');
        });
        break;
      }
    }
  });
  when(addressType + ' calls buyWithToken', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')'
            );
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Address should get the tokens', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
            await config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress());
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
            expect(config.getToken().transferFrom).to.have.been.calledWith(
              signerAddress.address,
              config.getSaleHandler().address,
              config.getNftPrice().mul(config.getMaxTokensPerAddress())
            );
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'SaleEnded'
            );
          }
        });
        break;
      }
    }
  });
  when(addressType + ' calls buyWithToken but oracle gives wrong answer', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')'
            );
            expect(config.getToken().transferFrom).to.have.not.been.called;
          }
        });
        break;
      }
      case SaleState.OpenSaleStarted: {
        then('Transaction should be reverted with InvalidAnswer error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'InvalidAnswer'
            );
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'SaleEnded'
            );
          }
        });
        break;
      }
    }
  });
  when(addressType + ' calls buyWithToken but oracle gives outdated answer', () => {
    switch (state) {
      case SaleState.NotStarted:
      case SaleState.SaleStarted: {
        then('Transaction should be reverted with OpenSaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config
            .getTokenPriceOracle()
            .latestRoundData.returns([0, 1, 0, moment().unix() + config.getSaleStartTimestamp() - config.getMaxDelay() - 1, 0]);
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'OpenSaleNotStarted(' + config.getOpenSaleStartTimestamp() + ')'
            );
            expect(config.getToken().transferFrom).to.have.not.been.called;
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        then('Transaction should be reverted with OutdatedAnswer error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config
            .getTokenPriceOracle()
            .latestRoundData.returns([0, 1, 0, moment().unix() + config.getSaleStartTimestamp() - config.getMaxDelay() - 1, 0]);
          for (const signerAddress of signerAddresses) {
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
            await config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress());
            expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
          }
        });
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            await expect(config.getSaleHandler().connect(signerAddress).buyWithToken(config.getMaxTokensPerAddress())).to.be.revertedWith(
              'SaleEnded'
            );
          }
        });
        break;
      }
    }
  });
}

export function generateWhitelistBuyWithTokenTests(state: SaleState, addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls whitelistBuysWithToken', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          let proof = config.getMerkleTree().getHexProof(callerContract.address);
          await expect(callerContract.whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())).to.be.revertedWith(
            'SaleNotStarted(' + config.getSaleStartTimestamp() + ')'
          );
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted:
      case SaleState.Revealed: {
        then('Transaction should be reverted with ContractsCantBuy error', async () => {
          let config = configProvider();
          let callerContract = config.getCallerContract();
          let proof = config.getMerkleTree().getHexProof(callerContract.address);
          await expect(callerContract.whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())).to.be.revertedWith('ContractsCantBuy');
        });
        break;
      }
    }
  });
  when(addressType + ' calls whitelistBuyWithToken', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleNotStarted');
            expect(config.getToken().transferFrom).to.have.not.been.called;
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Address should get the tokens', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
              await config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress());
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleEnded');
          }
        });
        break;
      }
    }
  });
  when(addressType + ' calls whitelistBuyWithToken but oracle gives wrong answer', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleNotStarted');
            expect(config.getToken().transferFrom).to.have.not.been.called;
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Transaction should be reverted with InvalidAnswer error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
              ).to.be.revertedWith('InvalidAnswer');
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleEnded');
          }
        });
        break;
      }
    }
  });
  when(addressType + ' calls whitelistBuyWithToken but oracle gives outdated answer', () => {
    switch (state) {
      case SaleState.NotStarted: {
        then('Transaction should be reverted with SaleNotStarted error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config
            .getTokenPriceOracle()
            .latestRoundData.returns([0, 1, 0, moment().unix() + config.getSaleStartTimestamp() - config.getMaxDelay() - 1, 0]);
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleNotStarted');
            expect(config.getToken().transferFrom).to.have.not.been.called;
          }
        });
        break;
      }
      case SaleState.SaleStarted:
      case SaleState.OpenSaleStarted: {
        if (addressType == AddressType.Whitelisted) {
          then('Transaction should be reverted with OutdatedAnswer error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            config
              .getTokenPriceOracle()
              .latestRoundData.returns([0, 1, 0, moment().unix() + config.getSaleStartTimestamp() - config.getMaxDelay() - 1, 0]);
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(0);
              await config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress());
              expect(await config.getSaleHandler().balanceOf(signerAddress.address)).to.equal(config.getMaxTokensPerAddress());
            }
          });
        } else {
          then('Transaction should be reverted with InvalidProof error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
            for (const signerAddress of signerAddresses) {
              let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
              await expect(
                config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
              ).to.be.revertedWith('InvalidProof');
            }
          });
        }
        break;
      }
      case SaleState.Revealed: {
        then('Transaction should be reverted with SaleEnded error', async () => {
          let config = configProvider();
          let signerAddresses = config.getSigners().get(addressType)!;
          config.getTokenPriceOracle().latestRoundData.returns([0, -1, 0, moment().unix() + config.getSaleStartTimestamp(), 0]);
          for (const signerAddress of signerAddresses) {
            let proof = config.getMerkleTree().getHexProof(keccak256(signerAddress.address));
            await expect(
              config.getSaleHandler().connect(signerAddress).whitelistBuyWithToken(proof, config.getMaxTokensPerAddress())
            ).to.be.revertedWith('SaleEnded');
          }
        });
        break;
      }
    }
  });
}

export function generateAirdropTests(state: SaleState, addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls airdrop', () => {
    then('Transaction should be reverted with Ownable error', async () => {
      let config = configProvider();
      let callerContract = config.getCallerContract();
      let quantity = config.getMaxTokensPerAddress() + 1;
      let airdrop = {
        to: config.getOtherSigner().address,
        quantity: quantity,
      };
      await expect(callerContract.airdrop([airdrop])).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
  when(addressType + ' calls airdrop', () => {
    if (addressType == AddressType.Owner) {
      switch (state) {
        case SaleState.NotStarted:
        case SaleState.SaleStarted:
        case SaleState.OpenSaleStarted: {
          then('The tokens should be sent to the address', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let quantity = config.getMaxTokensPerAddress() + 1;
              let airdrop = {
                to: config.getOtherSigner().address,
                quantity: quantity,
              };
              expect(await config.getSaleHandler().balanceOf(config.getOtherSigner().address)).to.equal(0);
              await config.getSaleHandler().connect(signerAddress).airdrop([airdrop]);
              expect(await config.getSaleHandler().balanceOf(config.getOtherSigner().address)).to.equal(quantity);
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('The tokens should be sent to the address', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let quantity = config.getMaxTokensPerAddress() + 1;
              let airdrop = {
                to: config.getOtherSigner().address,
                quantity: quantity,
              };
              await expect(config.getSaleHandler().connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          let quantity = config.getMaxTokensPerAddress() + 1;
          let airdrop = {
            to: config.getOtherSigner().address,
            quantity: quantity,
          };
          await expect(config.getSaleHandler().connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('Ownable: caller is not the owner');
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
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let quantity = 7777 + 1;
              let airdrop = {
                to: config.getOtherSigner().address,
                quantity: quantity,
              };
              await expect(config.getSaleHandler().connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('TokenSupplyExceeded');
            }
          });
          break;
        }
        case SaleState.Revealed: {
          then('Transaction should be reverted with SaleEnded error', async () => {
            let config = configProvider();
            let signerAddresses = config.getSigners().get(addressType)!;
            for (const signerAddress of signerAddresses) {
              let quantity = 7777 + 1;
              let airdrop = {
                to: config.getOtherSigner().address,
                quantity: quantity,
              };
              await expect(config.getSaleHandler().connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('SaleEnded');
            }
          });
          break;
        }
      }
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          let quantity = config.getMaxTokensPerAddress() + 1;
          let airdrop = {
            to: config.getOtherSigner().address,
            quantity: quantity,
          };
          await expect(config.getSaleHandler().connect(signerAddress).airdrop([airdrop])).to.be.revertedWith('Ownable: caller is not the owner');
        }
      });
    }
  });
}

export function generateWithdrawETHTests(addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls withdrawEth', () => {
    then('Transaction should be reverted with Ownable error', async () => {
      let config = configProvider();
      let callerContract = config.getCallerContract();
      await expect(callerContract.withdrawETH(config.getOtherSigner().address)).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
  when(addressType + ' calls withdrawEth', () => {
    if (addressType == AddressType.Owner) {
      then('Address should get the ETH from the contract', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          setBalance(config.getSaleHandler().address, config.getNftPrice());
          setBalance(config.getOtherSigner().address, BigNumber.from(0));
          let contractBalance = await ethers.provider.getBalance(config.getSaleHandler().address);
          expect(await ethers.provider.getBalance(config.getOtherSigner().address)).to.equal(0);
          await config.getSaleHandler().connect(signerAddress).withdrawETH(config.getOtherSigner().address);
          expect(await ethers.provider.getBalance(config.getOtherSigner().address)).to.equal(contractBalance);
          expect(await ethers.provider.getBalance(config.getSaleHandler().address)).to.be.equal(0);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          setBalance(config.getSaleHandler().address, config.getNftPrice());
          setBalance(config.getOtherSigner().address, BigNumber.from(0));
          let contractBalance = await ethers.provider.getBalance(config.getSaleHandler().address);
          expect(await ethers.provider.getBalance(config.getOtherSigner().address)).to.equal(0);
          await expect(config.getSaleHandler().connect(signerAddress).withdrawETH(config.getOtherSigner().address)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
          expect(await ethers.provider.getBalance(config.getOtherSigner().address)).to.equal(0);
          expect(await ethers.provider.getBalance(config.getSaleHandler().address)).to.be.equal(contractBalance);
        }
      });
    }
  });
}

export function generateWithdrawTokenTests(addressType: AddressType, configProvider: () => SaleTestConfig) {
  when('Contract calls withdrawEth', () => {
    then('Transaction should be reverted with Ownable error', async () => {
      let config = configProvider();
      let callerContract = config.getCallerContract();
      await expect(callerContract.withdrawAlternativeToken(config.getOtherSigner().address)).to.be.revertedWith(
        'Ownable: caller is not the owner'
      );
    });
  });
  when(addressType + ' calls withdrawAlternativeToken with', () => {
    if (addressType == AddressType.Owner) {
      then('Address should get the token from the contract', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          let tokenAmount = 5;
          config.getToken().balanceOf.returns(tokenAmount);
          config.getToken().transfer.returns(true);
          await config.getSaleHandler().connect(signerAddress).withdrawAlternativeToken(config.getOtherSigner().address);
          expect(config.getToken().balanceOf).to.have.been.calledWith(config.getSaleHandler().address);
          expect(config.getToken().transfer).to.have.been.calledWith(config.getOtherSigner().address, tokenAmount);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        for (const signerAddress of signerAddresses) {
          await expect(
            config.getSaleHandler().connect(signerAddress).withdrawAlternativeToken(config.getOtherSigner().address)
          ).to.be.revertedWith('Ownable: caller is not the owner');
          expect(config.getToken().balanceOf).to.have.not.been.called;
          expect(config.getToken().transferFrom).to.have.not.been.called;
        }
      });
    }
  });
}

export function generateSaleSetterTests(addressType: AddressType, configProvider: () => SaleTestConfig) {
  when(addressType + ' calls setMaxDelay', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the max delay', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMaxDelay = config.getMaxDelay() + 10;
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().maxDelay()).to.be.equal(config.getMaxDelay());
          await config.getSaleHandler().connect(signerAddress).setMaxDelay(newMaxDelay);
          expect(await config.getSaleHandler().maxDelay()).to.be.equal(newMaxDelay);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMaxDelay = config.getMaxDelay() + 10;
        for (const signerAddress of signerAddresses) {
          await expect(config.getSaleHandler().connect(signerAddress).setMaxDelay(newMaxDelay)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        }
      });
    }
  });
  when(addressType + ' calls setStartTimestamps', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the sale start date', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newSaleStartTimestamp = config.getSaleStartTimestamp() + 10;
        let newOpenSaleStartTimestamp = config.getOpenSaleStartTimestamp() + 10;
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().saleStartTimestamp()).to.be.equal(config.getSaleStartTimestamp());
          expect(await config.getSaleHandler().openSaleStartTimestamp()).to.be.equal(config.getOpenSaleStartTimestamp());
          await config.getSaleHandler().connect(signerAddress).setStartTimestamps(newSaleStartTimestamp, newOpenSaleStartTimestamp);
          expect(await config.getSaleHandler().saleStartTimestamp()).to.be.equal(newSaleStartTimestamp);
          expect(await config.getSaleHandler().openSaleStartTimestamp()).to.be.equal(newOpenSaleStartTimestamp);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newSaleStartTimestamp = config.getSaleStartTimestamp() + 10;
        let newOpenSaleStartTimestamp = config.getOpenSaleStartTimestamp() + 10;
        for (const signerAddress of signerAddresses) {
          await expect(
            config.getSaleHandler().connect(signerAddress).setStartTimestamps(newSaleStartTimestamp, newOpenSaleStartTimestamp)
          ).to.be.revertedWith('Ownable: caller is not the owner');
        }
      });
    }
  });

  when(addressType + ' calls setStartTimestamps with invalid dates', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the sale start date', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newSaleStartTimestamp = config.getSaleStartTimestamp() + 10;
        let newOpenSaleStartTimestamp = config.getOpenSaleStartTimestamp() + 10;
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().saleStartTimestamp()).to.be.equal(config.getSaleStartTimestamp());
          expect(await config.getSaleHandler().openSaleStartTimestamp()).to.be.equal(config.getOpenSaleStartTimestamp());
          await expect(
            config.getSaleHandler().connect(signerAddress).setStartTimestamps(newOpenSaleStartTimestamp, newSaleStartTimestamp)
          ).to.be.revertedWith('OpenSaleBeforeWhitelistSale');
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newSaleStartTimestamp = config.getSaleStartTimestamp() + 10;
        let newOpenSaleStartTimestamp = config.getOpenSaleStartTimestamp() + 10;
        for (const signerAddress of signerAddresses) {
          await expect(
            config.getSaleHandler().connect(signerAddress).setStartTimestamps(newSaleStartTimestamp, newOpenSaleStartTimestamp)
          ).to.be.revertedWith('Ownable: caller is not the owner');
        }
      });
    }
  });

  when(addressType + ' calls setMerkleRoot', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the merkle root', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMerkleRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().merkleRoot()).to.be.equal(config.getMerkleTree().getHexRoot());
          await config.getSaleHandler().connect(signerAddress).setMerkleRoot(newMerkleRoot);
          expect(await config.getSaleHandler().merkleRoot()).to.be.equal(newMerkleRoot);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMerkleRoot = '0x0000000000000000000000000000000000000000000000000000000000000000';
        for (const signerAddress of signerAddresses) {
          await expect(config.getSaleHandler().connect(signerAddress).setMerkleRoot(newMerkleRoot)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        }
      });
    }
  });

  when(addressType + ' calls setTokenPrice', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the token price', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newTokenPrice = config.getNftPrice().add(10);
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().tokenPrice()).to.be.equal(config.getNftPrice());
          await config.getSaleHandler().connect(signerAddress).setTokenPrice(newTokenPrice);
          expect(await config.getSaleHandler().tokenPrice()).to.be.equal(newTokenPrice);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newTokenPrice = config.getNftPrice().add(10);
        for (const signerAddress of signerAddresses) {
          await expect(config.getSaleHandler().connect(signerAddress).setTokenPrice(newTokenPrice)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        }
      });
    }
  });

  when(addressType + ' calls setMaxTokensPerAddress', () => {
    if (addressType == AddressType.Owner) {
      then('Address should set the max tokens per address', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMaxTokensPerAddress = config.getMaxTokensPerAddress() + 10;
        for (const signerAddress of signerAddresses) {
          expect(await config.getSaleHandler().maxTokensPerAddress()).to.be.equal(config.getMaxTokensPerAddress());
          await config.getSaleHandler().connect(signerAddress).setMaxTokensPerAddress(newMaxTokensPerAddress);
          expect(await config.getSaleHandler().maxTokensPerAddress()).to.be.equal(newMaxTokensPerAddress);
        }
      });
    } else {
      then('Transaction should be reverted with Ownable error', async () => {
        let config = configProvider();
        let signerAddresses = config.getSigners().get(addressType)!;
        let newMaxTokensPerAddress = config.getMaxTokensPerAddress() + 10;
        for (const signerAddress of signerAddresses) {
          await expect(config.getSaleHandler().connect(signerAddress).setMaxTokensPerAddress(newMaxTokensPerAddress)).to.be.revertedWith(
            'Ownable: caller is not the owner'
          );
        }
      });
    }
  });
}

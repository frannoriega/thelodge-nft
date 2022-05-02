// import { ethers, deployments } from 'hardhat';
// import { MerkleTree } from 'merkletreejs';
// import { expect } from 'chai';
// import { Contract } from 'ethers';
// import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
// import { snapshot } from '@utils/evm';
// import { AbiCoder } from 'ethers/lib/utils';
// import { buildMerkle } from '@utils/merkle';

// const ONE_YEAR_IN_MILLIS = 31556952000;

// describe('TheLodgeSaleHandler', () => {
//   let saleHandler: Contract;
//   let tokenPriceOracle: Contract;
//   let tokenMock: Contract;
//   let snapshotId: string;
//   let owner: SignerWithAddress, wlAddress1: SignerWithAddress, wlAddress2: SignerWithAddress, otherAddress: SignerWithAddress;
//   let merkleTree: MerkleTree;
//   let merkleRoot: string;

//   before(async function () {
//     [owner, wlAddress1, wlAddress2, otherAddress] = await ethers.getSigners();
//     await deployments.fixture(["mocks"]);
//     tokenPriceOracle = await ethers.getContract('MockV3Aggregator');
//     tokenMock = await ethers.getContract('TokenMock');
//     let TheLodgeRevelationHandlerImpl = await ethers.getContract('TheLodgeRevelationHandlerImpl');
//     let abiCoder = new AbiCoder();
//     const {tree, root} = buildMerkle([wlAddress1, wlAddress2].map(a => abiCoder.encode(['address'], [a])));
//     merkleTree = tree;
//     merkleRoot = root;
//     let now = Date.now();
//     let config = {
//       tokenName: 'Test',
//       tokenSymbol: 'T',
//       oracle: tokenPriceOracle.address,
//       maxDelay: 10_000,
//       // 1 ETH
//       nftPrice: 1 * 10**18,
//       maxTokensPerAddress: 2,
//       alternativePaymentToken: tokenMock.address,
//       saleStartTimestamp: now + ONE_YEAR_IN_MILLIS,
//       openSaleStartTimestamp: now + 2 * ONE_YEAR_IN_MILLIS,
//       merkleRoot: merkleRoot
//     };
//     TheLodgeRevelationHandlerImpl.deploy(config);
//     await saleHandler.setEnded(false);
//     snapshotId = await snapshot.take();
//   })

//   beforeEach(async function () {
//     await snapshot.revert(snapshotId);
//   });

//   describe('ETH sale', () => {
//     describe('Whitelist sale', () => {
//       it('Should call the coordinator and request random number on reveal', async function () {
//         await expect(saleHandler.reveal()).to.emit(tokenPriceOracle, 'RandomWordsRequested');
//       });
//     })
//   })

//   describe('Request random number', () => {
//     it('Should call the coordinator and request random number on reveal', async function () {
//       await expect(saleHandler.reveal()).to.emit(tokenPriceOracle, 'RandomWordsRequested');
//     });

//     it('Only owner can call reveal', async function () {
//       await expect(saleHandler.connect(otherAddress).reveal()).to.be.revertedWith('Ownable: caller is not the owner');
//     });

//     it('VRF callback sets random number', async function () {
//       expect(await saleHandler.randomNumber()).to.equal(0);
//       expect(await saleHandler.revealed()).to.equal(false);

//       await saleHandler.reveal();
//       let requestId = await saleHandler.callStatic.requestId();

//       // simulate callback from the oracle network
//       let tx = await tokenPriceOracle.fulfillRandomWords(requestId, saleHandler.address);

//       expect(tx).to.emit(saleHandler, "Revealed");

//       // Get RandomWordsFulfilled event from VRF coordinator call.
//       const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
//       const eventInterface = new ethers.utils.Interface(["event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint96 payment, bool success)"]);
//       // Index number 1, since index 0 is the Revealed event from our contract.
//       const data = receipt.logs[1].data;
//       const topics = receipt.logs[1].topics;
//       const event = eventInterface.decodeEventLog("RandomWordsFulfilled", data, topics);

//       expect(event.requestId).to.equal(requestId);
//       expect(event.outputSeed).to.equal(requestId);
//       expect(event.success).to.equal(true);

//       expect(await saleHandler.randomNumber()).to.not.equal(0);
//       expect(await saleHandler.revealed()).to.equal(true);
//     });

//     it('Only allow one call to fulfill randomness', async function () {
//       await saleHandler.reveal();
//       let requestId = await saleHandler.callStatic.requestId();

//       // simulate callback from the oracle network
//       await expect(
//         tokenPriceOracle.fulfillRandomWords(requestId, saleHandler.address)
//       ).to.emit(saleHandler, "Revealed");

//       // We call reveal again, which will work.
//       await saleHandler.reveal();
//       requestId = await saleHandler.callStatic.requestId();

//       // But the callback will fail.
//       let tx = await tokenPriceOracle.fulfillRandomWords(requestId, saleHandler.address);

//       const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
//       const eventInterface = new ethers.utils.Interface(["event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint96 payment, bool success)"]);
//       const data = receipt.logs[0].data;
//       const topics = receipt.logs[0].topics;
//       const event = eventInterface.decodeEventLog("RandomWordsFulfilled", data, topics);

//       expect(event.requestId).to.equal(requestId);
//       expect(event.outputSeed).to.equal(requestId);
//       // The request should've failed
//       expect(event.success).to.equal(false);
//     });
//   });
// });

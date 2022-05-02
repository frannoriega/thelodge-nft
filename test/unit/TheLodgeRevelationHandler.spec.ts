import { ethers, network } from 'hardhat';
import chai, { expect } from 'chai';
import { Contract } from 'ethers';
import { then, when, contract, given } from '@test-utils/bdd';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { snapshot } from '@utils/evm';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { VRFCoordinatorV2Interface } from '@typechained';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import exp from 'constants';

chai.use(smock.matchers);

contract('TheLodgeRevelationHandler', () => {
  let revelationHandler: Contract;
  let vrfCoordinator: FakeContract<VRFCoordinatorV2Interface>;
  let snapshotId: string;
  let owner: SignerWithAddress, otherAddress: SignerWithAddress;

  before(async function () {
    let vrfCoordinatorAddress;
    [owner, otherAddress, vrfCoordinatorAddress] = await ethers.getSigners();
    vrfCoordinator = await smock.fake('VRFCoordinatorV2Interface', { address: await vrfCoordinatorAddress.getAddress() });
    let TheLodgeRevelationHandlerImpl = await ethers.getContractFactory('TheLodgeRevelationHandlerImpl');
    let config = {
      subId: 0,
      vrfCoordinator: vrfCoordinator.address,
      keyHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    };
    revelationHandler = await TheLodgeRevelationHandlerImpl.deploy(config);
    snapshotId = await snapshot.take();
  });

  beforeEach(async function () {
    await snapshot.revert(snapshotId);
  });

  describe('Reveal', () => {
    when('`reveal` method is called', () => {
      then('The VRF Coordinator should be requested a random number', async () => {
        let tx = await revelationHandler.reveal();
        expect(vrfCoordinator.requestRandomWords).to.have.callCount(1);
      });
    });
    when('`reveal` method is called by other than the owner', () => {
      then('The transaction should be reverted', async () => {
        await expect(revelationHandler.connect(otherAddress).reveal()).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
    when('no call to `reveal` has been made', () => {
      then('`revealed` flag should be false', async () => {
        expect(await revelationHandler.revealed()).to.be.false;
      });
      then('`randomNumber` should be zero', async () => {
        expect(await revelationHandler.randomNumber()).to.equal(0);
      });
    });
    when('VRF Coordinator calls rawFulfillRandomWords', async function () {
      let tx: TransactionResponse;
      const RANDOM_NUMBER = 69;
      given(async () => {
        tx = await revelationHandler.connect(vrfCoordinator.wallet).rawFulfillRandomWords(0, [RANDOM_NUMBER]);
      });
      then('The transaction should succeed', async () => {
        expect(tx).to.emit(revelationHandler, 'Revealed').withArgs(RANDOM_NUMBER);
      });
      then('The `revealed` flag should be set to true', async () => {
        expect(await revelationHandler.revealed()).to.equal(true);
      });
      then('The `randomNumber` should be set', async () => {
        expect(await revelationHandler.randomNumber()).to.equal(RANDOM_NUMBER);
      });
    });
    when('other than the VRF Coordinator calls rawFulfillRandomWords', async function () {
      let tx: Promise<TransactionResponse>;
      const RANDOM_NUMBER = 69;
      given(async () => {
        tx = revelationHandler.connect(otherAddress).rawFulfillRandomWords(0, [RANDOM_NUMBER]);
      });
      then('The transaction should be reverted', async () => {
        let otherAddressString = await otherAddress.getAddress();
        let vrfCoordinatorAddressString = await vrfCoordinator.wallet.getAddress();
        await expect(tx).to.be.revertedWith('OnlyCoordinatorCanFulfill("' + otherAddressString + '", "' + vrfCoordinatorAddressString + '")');
      });
      then('The `revealed` flag should still be false', async () => {
        expect(await revelationHandler.revealed()).to.equal(false);
      });
      then('The `randomNumber` should not be set', async () => {
        expect(await revelationHandler.randomNumber()).to.equal(0);
      });
    });
  });

  describe('Setters', () => {
    when('Calling `subId` setter', () => {
      then('The `subId` should be the set value', async () => {
        expect(await revelationHandler.getSubId()).to.equal(0);
        let newId = 10;
        await revelationHandler.setSubId(newId);
        expect(await revelationHandler.getSubId()).to.equal(newId);
      });
    });
  });
});

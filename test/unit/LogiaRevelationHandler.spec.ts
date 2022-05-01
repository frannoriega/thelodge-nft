import { ethers, deployments } from 'hardhat';
import { expect } from 'chai';
import { Contract } from 'ethers';

describe('LogiaRevelationHandler', () => {
  let revelationHandlerFactory;
  let revelationHandler: Contract;
  let vrfCoordinator: Contract;

  beforeEach(async function () {
    await deployments.fixture(['vrf']);
    vrfCoordinator = await ethers.getContract('VRFCoordinatorV2Mock');
    revelationHandlerFactory = await ethers.getContractFactory('LogiaRevelationHandlerMock');
    vrfCoordinator = await ethers.getContract('VRFCoordinatorV2Mock');
    let config = {
      vrfCoordinator: vrfCoordinator.address,
      keyHash: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
      subId: 0,
    };
    revelationHandler = await revelationHandlerFactory.deploy(config);
  });

  describe('Request random number', () => {
    it('Should call the coordinator and request random number', async function () {
      await expect(revelationHandler.reveal()).to.emit(vrfCoordinator, 'RandomWordsRequested');
    });
  });
});

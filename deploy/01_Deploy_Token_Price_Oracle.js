const { network } = require('hardhat');

const DECIMALS = '18';
const INITIAL_PRICE = '200000000000000000000';

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  // If we are on a local development network, we need to deploy mocks!
  if (chainId == 31337) {
    log('Local network detected! Deploying mocks...');
    await deploy('AggregatorV3Mock', {
      contract: 'AggregatorV3Mock',
      from: deployer,
      log: true,
      args: [DECIMALS, INITIAL_PRICE],
    });
    log('Token Price Oracle Deployed!');
    log('----------------------------------------------------');
    log("You are deploying to a local network, you'll need a local network running to interact");
    log('Please run `yarn hardhat console` to interact with the deployed smart contracts!');
    log('----------------------------------------------------');
  }
};
module.exports.tags = ['all', 'oracle'];

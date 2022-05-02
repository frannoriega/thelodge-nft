const { getNamedAccounts, deployments, network, run } = require('hardhat');
const { networkConfig, developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require('../helper-hardhat-config');
const { verify } = require('../helper-functions');

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;

  let ethTokenPriceFeedAddress;
  if (chainId == 31337) {
    const EthTokenAggregator = await deployments.get('MockV3Aggregator');
    ethTokenPriceFeedAddress = EthTokenAggregator.address;
  } else {
    ethTokenPriceFeedAddress = networkConfig[chainId]['ethTokenPriceFeed'];
  }
  // Price Feed Address, values can be obtained at https://docs.chain.link/docs/reference-contracts
  // Default one below is ETH/TOKEN contract on Kovan
  const waitBlockConfirmations = developmentChains.includes(network.name) ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS;
  log('----------------------------------------------------');
  const TheLodgeSaleHandlerImpl = await deploy('TheLodgeSaleHandlerImpl', {
    from: deployer,
    args: [ethTokenPriceFeedAddress],
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  // Verify the deployment
  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log('Verifying...');
    await verify(TheLodgeSaleHandlerImpl.address, [ethTokenPriceFeedAddress]);
  }

  log('Run Price Feed contract with command:');
  const networkName = network.name == 'hardhat' ? 'localhost' : network.name;
  log(`yarn hardhat read-price-feed --contract ${TheLodgeSaleHandlerImpl.address} --network ${networkName}`);
  log('----------------------------------------------------');
};

module.exports.tags = ['all', 'feed', 'main'];

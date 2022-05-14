import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { shouldVerifyContract } from '../utils/deploy';
import { TheLodgeConfig } from '../typechained/TheLodge';
import { ethers } from 'hardhat';
import { constants } from 'ethers';

const IN_32_YEARS = 2651499646;

const deployFunction: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  let oracle: string;
  let alternativePaymentToken: string;
  let vrfCoordinator: string;
  let keyHash: string;

  switch (hre.network.name) {
    case 'ethereum':
    case 'hardhat':
      oracle = '0xc7de7f4d4C9c991fF62a07D18b3E31e349833A18'; // APE/ETH Chainlink price feed
      alternativePaymentToken = '0x4d224452801aced8b2f0aebe155379bb5d594381'; // $APE address
      vrfCoordinator = '0x271682DEB8C4E0901D1a1550aD2e64D568E69909';
      keyHash = '0x9fe0eebf5e446e3c998ec9bb19951541aee00bb90ea201ae456421a2ded86805'; // 1000 gwei gas lane
      break;
    default:
      throw new Error(`Unsupported chain '${hre.network.name}`);
  }

  const config: TheLodgeConfig.ConfigStruct = {
    saleConfig: {
      tokenName: 'The Lodge',
      tokenSymbol: 'TLDG',
      alternativePaymentToken,
      oracle,
      maxDelay: 86400, // 1 day in seconds
      nftPrice: ethers.utils.parseEther('0.077'),
      maxTokensPerAddress: 7,
      saleStartTimestamp: IN_32_YEARS, // TODO: set properly
      openSaleStartTimestamp: IN_32_YEARS, // TODO: set properly
      merkleRoot: constants.HashZero, // TODO: set properly
    },
    revelationConfig: {
      vrfCoordinator,
      keyHash,
      subId: 0, // TODO: set properly
    },
    uriConfig: {
      baseURI: '', // TODO: set properly
      unrevealedURI: '', // TODO: set properly
    },
  };

  const deploy = await hre.deployments.deploy('TheLodge', {
    contract: 'solidity/contracts/TheLodge.sol:TheLodge',
    from: deployer,
    args: [config],
    log: true,
  });

  if (await shouldVerifyContract(deploy)) {
    await hre.run('verify:verify', {
      address: deploy.address,
      constructorArguments: [config],
    });
  }
};
deployFunction.dependencies = [];
deployFunction.tags = ['TheLodge'];
export default deployFunction;

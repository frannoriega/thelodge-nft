//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

library LogiaConfig {
  struct Config {
    SaleConfig saleConfig;
    RevelationConfig revelationConfig;
  }

  struct SaleConfig {
    string tokenName;
    string tokenSymbol;
    address oracle;
    uint32 maxDelay;
    uint256 nftPrice;
    uint16 maxTokensPerAddress;
    IERC20 alternativePaymentToken;
    uint256 saleStartTimestamp;
    uint256 openSaleStartTimestamp;
    bytes32 merkleRoot;
  }

  struct RevelationConfig {
    address vrfCoordinator;
    bytes32 keyHash;
    uint64 subId;
  }
}

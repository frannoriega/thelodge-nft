//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

/// @notice Helper library to hold the configuration structs
/// used by TheLodge contracts.
library TheLodgeConfig {
  /// @notice TheLodge configuration.
  struct Config {
    SaleConfig saleConfig;
    RevelationConfig revelationConfig;
    URIConfig uriConfig;
  }

  /// @notice TheLodgeSaleHandler configuration.
  struct SaleConfig {
    string tokenName;
    string tokenSymbol;
    address oracle;
    uint32 maxDelay;
    uint256 nftPrice;
    uint8 maxTokensPerAddress;
    IERC20Metadata alternativePaymentToken;
    uint256 saleStartTimestamp;
    uint256 openSaleStartTimestamp;
    bytes32 merkleRoot;
  }

  /// @notice TheLodgeRevelationHandler configuration.
  struct RevelationConfig {
    address vrfCoordinator;
    bytes32 keyHash;
    uint64 subId;
  }

  /// @notice The URI configuraiton used by TheLodgeTokenInspectorHandler.
  struct URIConfig {
    string baseURI;
    string unrevealedURI;
  }
}

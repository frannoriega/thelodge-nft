//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

library LogiaConfig {
    struct Config {
        SaleConfig saleConfig;
        RevelationConfig revelationConfig;
    }

    struct SaleConfig {
        address oracle;
        uint32 maxDelay; 
        uint256 nftPrice;
        uint16 maxTokensPerAddress;
        IERC20Metadata paymentToken;
        uint256 saleStartTimestamp;
        uint256 openSaleStartTimestamp;
        bytes32 merkleRoot;
    }

    struct RevelationConfig {
        address vrfCoordinator;
        address linkToken;
        bytes32 keyHash;
        uint256 fee;
        uint16 minimumRequestConfirmations;
        uint32 callbackGasLimit;
        uint64 subId;
    }
}
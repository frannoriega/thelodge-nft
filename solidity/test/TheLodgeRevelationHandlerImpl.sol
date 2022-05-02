//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/TheLodgeRevelationHandler.sol';
import '../library/TheLodgeConfig.sol';

contract TheLodgeRevelationHandlerImpl is TheLodgeRevelationHandler {
  uint256 public requestId;

  constructor(TheLodgeConfig.RevelationConfig memory _revelationConfig) TheLodgeRevelationHandler(_revelationConfig) {}

  function getSubId() external view returns (uint64) {
    return _subId;
  }
}

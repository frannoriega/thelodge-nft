//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/LogiaRevelationHandler.sol';
import '../library/LogiaConfig.sol';

contract LogiaRevelationHandlerImpl is LogiaRevelationHandler {
  uint256 public requestId;

  constructor(LogiaConfig.RevelationConfig memory _revelationConfig) LogiaRevelationHandler(_revelationConfig) {}

  function getSubId() external view returns (uint64) {
    return _subId;
  }
}

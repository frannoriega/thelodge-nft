//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/LogiaTokenInspectorHandler.sol';

contract LogiaTokenInspectorHandlerImpl is LogiaTokenInspectorHandler {
  function _getRandomNumber() internal pure override returns (uint256) {
    return 0;
  }

  function isMaster(uint256 value) external pure returns (bool) {
    return super._isMaster(value);
  }

  function isFellow(uint256 value) external pure returns (bool) {
    return super._isFellow(value);
  }
}

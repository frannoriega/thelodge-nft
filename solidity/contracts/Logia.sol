//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import 'hardhat/console.sol';
import '../library/LogiaConfig.sol';
import './LogiaRevelationHandler.sol';
import './LogiaSaleHandler.sol';
import './LogiaTokenInspectorHandler.sol';

contract Logia is LogiaRevelationHandler, LogiaSaleHandler, LogiaTokenInspectorHandler {
  constructor(LogiaConfig.Config memory _config)
    LogiaRevelationHandler(_config.revelationConfig)
    LogiaSaleHandler(_config.saleConfig)
    LogiaTokenInspectorHandler()
  {}

  function _hasEnded() internal view override returns (bool) {
    return revealed;
  }

  function _getRandomNumber() internal view override returns (uint256) {
    return randomNumber;
  }
}

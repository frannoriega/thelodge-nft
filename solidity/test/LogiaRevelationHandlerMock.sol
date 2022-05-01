//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/LogiaRevelationHandler.sol';
import '../library/LogiaConfig.sol';

contract LogiaRevelationHandlerMock is LogiaRevelationHandler {
  constructor(LogiaConfig.RevelationConfig memory _revelationConfig) LogiaRevelationHandler(_revelationConfig) {}
}

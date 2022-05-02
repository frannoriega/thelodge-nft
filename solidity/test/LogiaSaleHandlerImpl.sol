//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/LogiaSaleHandler.sol';
import '../library/LogiaConfig.sol';

contract LogiaSaleHandlerImpl is LogiaSaleHandler {
  bool public ended;

  constructor(LogiaConfig.SaleConfig memory _saleConfig) LogiaSaleHandler(_saleConfig) {}

  function setEnded(bool _ended) external {
    ended = _ended;
  }

  function _hasEnded() internal view override returns (bool) {
    return ended;
  }
}

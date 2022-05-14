//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/TheLodgeSaleHandler.sol';
import '../library/TheLodgeConfig.sol';

contract TheLodgeSaleHandlerImpl is TheLodgeSaleHandler {
  bool public ended;

  constructor(TheLodgeConfig.SaleConfig memory _saleConfig) TheLodgeSaleHandler(_saleConfig) {}

  function getStartTokenId() external pure returns (uint256) {
    return _startTokenId();
  }

  function MAX_SUPPLY() public pure override returns (uint16) {
    return 7777;
  }

  function setEnded(bool _ended) external {
    ended = _ended;
  }

  function _hasEnded() internal view override returns (bool) {
    return ended;
  }
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../library/TheLodgeConfig.sol';
import './TheLodgeRevelationHandler.sol';
import './TheLodgeSaleHandler.sol';
import './TheLodgeTokenInspectorHandler.sol';

contract TheLodge is TheLodgeRevelationHandler, TheLodgeSaleHandler, TheLodgeTokenInspectorHandler {
  constructor(TheLodgeConfig.Config memory _config)
    TheLodgeRevelationHandler(_config.revelationConfig)
    TheLodgeSaleHandler(_config.saleConfig)
    TheLodgeTokenInspectorHandler(_config.uriConfig)
  {}

  function tokenURI(uint256 tokenId) public view override(ERC721A, TheLodgeTokenInspectorHandler) returns (string memory) {
    return TheLodgeTokenInspectorHandler.tokenURI(tokenId);
  }

  function _hasEnded() internal view override returns (bool) {
    return revealed;
  }

  function _wasRevealed() internal view override returns (bool) {
    return revealed;
  }

  function _getRandomNumber() internal view override returns (uint256) {
    return randomNumber;
  }

  function _doesTokenExist(uint256 tokenId) internal view override returns (bool) {
    return _exists(tokenId);
  }
}

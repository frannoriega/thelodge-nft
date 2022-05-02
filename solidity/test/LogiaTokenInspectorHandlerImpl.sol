//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/LogiaTokenInspectorHandler.sol';

contract LogiaTokenInspectorHandlerImpl is LogiaTokenInspectorHandler {
  constructor(LogiaConfig.URIConfig memory _config) LogiaTokenInspectorHandler(_config) {}

  function _getRandomNumber() internal pure override returns (uint256) {
    return 123_456_789;
  }

  function _wasRevealed() internal pure override returns (bool) {
    return true;
  }

  function getRarities(uint256[] calldata tokenIds) external view returns (Rarity[] memory rarities) {
    rarities = new Rarity[](tokenIds.length);
    for (uint256 i; i < tokenIds.length; i++) {
      rarities[i] = getRarity(tokenIds[i]);
    }
  }

  function getURIIds(uint256[] calldata tokenIds) external view returns (uint256[] memory uriIds) {
    uriIds = new uint256[](tokenIds.length);
    for (uint256 i; i < tokenIds.length; i++) {
      uriIds[i] = getURIId(tokenIds[i]);
    }
  }
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/ILogiaTokenInspectorHandler.sol';

abstract contract LogiaTokenInspectorHandler is ILogiaTokenInspectorHandler {
  // Rarity distribution right now is: FAFAAFMAAFMFAAAFFAAAMAAAFFAAA
  // TODO: Consider manually re-distributing
  function getRarity(uint256 tokenId) external view override returns (Rarity) {
    uint256 normalizedValue = (tokenId + _getRandomNumber()) % 29;
    if (_isMaster(normalizedValue)) {
      return Rarity.Master;
    } else if (_isFellow(normalizedValue)) {
      return Rarity.Fellow;
    } else {
      return Rarity.Apprentice;
    }
  }

  function _getRandomNumber() internal view virtual returns (uint256);

  function _isMaster(uint256 value) internal pure returns (bool) {
    return value == 6 || value == 10 || value == 20;
  }

  function _isFellow(uint256 value) internal pure returns (bool) {
    return value == 0 || value == 2 || value == 5 || value == 9 || value == 11 || value == 15 || value == 16 || value == 24 || value == 25;
  }

  // TODO: What about tokenURI? Before the reveal, we need to point to some custom image. After the reveal, we need to point to the token's URI
  // TODO: We need to add a burn mechanism, so that owners can burn their own NFTs
}

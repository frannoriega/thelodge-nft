//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../contracts/TheLodgeTokenInspectorHandler.sol';

contract TheLodgeTokenInspectorHandlerImpl is TheLodgeTokenInspectorHandler {
  uint256 internal _randomNumber = 123_456_789;
  mapping(uint256 => bool) internal _tokenDoesNotExist;
  bool internal _revealed = true;

  constructor(TheLodgeConfig.URIConfig memory _config) TheLodgeTokenInspectorHandler(_config) {}

  function setRandomNumber(uint256 __randomNumber) external {
    _randomNumber = __randomNumber;
  }

  function setRevealed(bool __revealed) external {
    _revealed = __revealed;
  }

  function _getRandomNumber() internal view override returns (uint256) {
    return _randomNumber;
  }

  function _wasRevealed() internal view override returns (bool) {
    return _revealed;
  }

  function _doesTokenExist(uint256 tokenId) internal view override returns (bool) {
    return !_tokenDoesNotExist[tokenId];
  }

  function setIfTokenExists(uint256 tokenId, bool exists) external {
    _tokenDoesNotExist[tokenId] = !exists;
  }

  function setPromotionData(Rarity rarity, PromotionData calldata promotionData) external {
    promotionPerRarity[rarity] = promotionData;
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

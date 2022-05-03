//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/ITheLodgeTokenInspectorHandler.sol';
import '../library/TheLodgeConfig.sol';

abstract contract TheLodgeTokenInspectorHandler is Ownable, ITheLodgeTokenInspectorHandler {
  struct RarityByIndex {
    Rarity rarity;
    uint248 orderInRarity;
  }

  using Strings for uint256;

  string public baseURI;
  string public unrevealedURI;
  RarityByIndex[77] private rarities;

  constructor(TheLodgeConfig.URIConfig memory _config) {
    baseURI = _config.baseURI;
    unrevealedURI = _config.unrevealedURI;

    // Rarity distribution, shuffled with random.org: FAFAAFAAAFFAAAMFAAAFAFAAAAAAFFFAFFFFAFAAFMAFAAAAAFAAAMMAAAFAFAAAFAAAAFFFFAAFA
    rarities[0] = RarityByIndex(Rarity.Fellow, 0);
    rarities[1] = RarityByIndex(Rarity.Apprentice, 0);
    rarities[2] = RarityByIndex(Rarity.Fellow, 1);
    rarities[3] = RarityByIndex(Rarity.Apprentice, 1);
    rarities[4] = RarityByIndex(Rarity.Apprentice, 2);
    rarities[5] = RarityByIndex(Rarity.Fellow, 2);
    rarities[6] = RarityByIndex(Rarity.Apprentice, 3);
    rarities[7] = RarityByIndex(Rarity.Apprentice, 4);
    rarities[8] = RarityByIndex(Rarity.Apprentice, 5);
    rarities[9] = RarityByIndex(Rarity.Fellow, 3);
    rarities[10] = RarityByIndex(Rarity.Fellow, 4);
    rarities[11] = RarityByIndex(Rarity.Apprentice, 6);
    rarities[12] = RarityByIndex(Rarity.Apprentice, 7);
    rarities[13] = RarityByIndex(Rarity.Apprentice, 8);
    rarities[14] = RarityByIndex(Rarity.Master, 0);
    rarities[15] = RarityByIndex(Rarity.Fellow, 5);
    rarities[16] = RarityByIndex(Rarity.Apprentice, 9);
    rarities[17] = RarityByIndex(Rarity.Apprentice, 10);
    rarities[18] = RarityByIndex(Rarity.Apprentice, 11);
    rarities[19] = RarityByIndex(Rarity.Fellow, 6);
    rarities[20] = RarityByIndex(Rarity.Apprentice, 12);
    rarities[21] = RarityByIndex(Rarity.Fellow, 7);
    rarities[22] = RarityByIndex(Rarity.Apprentice, 13);
    rarities[23] = RarityByIndex(Rarity.Apprentice, 14);
    rarities[24] = RarityByIndex(Rarity.Apprentice, 15);
    rarities[25] = RarityByIndex(Rarity.Apprentice, 16);
    rarities[26] = RarityByIndex(Rarity.Apprentice, 17);
    rarities[27] = RarityByIndex(Rarity.Apprentice, 18);
    rarities[28] = RarityByIndex(Rarity.Fellow, 8);
    rarities[29] = RarityByIndex(Rarity.Fellow, 9);
    rarities[30] = RarityByIndex(Rarity.Fellow, 10);
    rarities[31] = RarityByIndex(Rarity.Apprentice, 19);
    rarities[32] = RarityByIndex(Rarity.Fellow, 11);
    rarities[33] = RarityByIndex(Rarity.Fellow, 12);
    rarities[34] = RarityByIndex(Rarity.Fellow, 13);
    rarities[35] = RarityByIndex(Rarity.Fellow, 14);
    rarities[36] = RarityByIndex(Rarity.Apprentice, 20);
    rarities[37] = RarityByIndex(Rarity.Fellow, 15);
    rarities[38] = RarityByIndex(Rarity.Apprentice, 21);
    rarities[39] = RarityByIndex(Rarity.Apprentice, 22);
    rarities[40] = RarityByIndex(Rarity.Fellow, 16);
    rarities[41] = RarityByIndex(Rarity.Master, 1);
    rarities[42] = RarityByIndex(Rarity.Apprentice, 23);
    rarities[43] = RarityByIndex(Rarity.Fellow, 17);
    rarities[44] = RarityByIndex(Rarity.Apprentice, 24);
    rarities[45] = RarityByIndex(Rarity.Apprentice, 25);
    rarities[46] = RarityByIndex(Rarity.Apprentice, 26);
    rarities[47] = RarityByIndex(Rarity.Apprentice, 27);
    rarities[48] = RarityByIndex(Rarity.Apprentice, 28);
    rarities[49] = RarityByIndex(Rarity.Fellow, 18);
    rarities[50] = RarityByIndex(Rarity.Apprentice, 29);
    rarities[51] = RarityByIndex(Rarity.Apprentice, 30);
    rarities[52] = RarityByIndex(Rarity.Apprentice, 31);
    rarities[53] = RarityByIndex(Rarity.Master, 2);
    rarities[54] = RarityByIndex(Rarity.Master, 3);
    rarities[55] = RarityByIndex(Rarity.Apprentice, 32);
    rarities[56] = RarityByIndex(Rarity.Apprentice, 33);
    rarities[57] = RarityByIndex(Rarity.Apprentice, 34);
    rarities[58] = RarityByIndex(Rarity.Fellow, 19);
    rarities[59] = RarityByIndex(Rarity.Apprentice, 35);
    rarities[60] = RarityByIndex(Rarity.Fellow, 20);
    rarities[61] = RarityByIndex(Rarity.Apprentice, 36);
    rarities[62] = RarityByIndex(Rarity.Apprentice, 37);
    rarities[63] = RarityByIndex(Rarity.Apprentice, 38);
    rarities[64] = RarityByIndex(Rarity.Fellow, 21);
    rarities[65] = RarityByIndex(Rarity.Apprentice, 39);
    rarities[66] = RarityByIndex(Rarity.Apprentice, 40);
    rarities[67] = RarityByIndex(Rarity.Apprentice, 41);
    rarities[68] = RarityByIndex(Rarity.Apprentice, 42);
    rarities[69] = RarityByIndex(Rarity.Fellow, 22);
    rarities[70] = RarityByIndex(Rarity.Fellow, 23);
    rarities[71] = RarityByIndex(Rarity.Fellow, 24);
    rarities[72] = RarityByIndex(Rarity.Fellow, 25);
    rarities[73] = RarityByIndex(Rarity.Apprentice, 43);
    rarities[74] = RarityByIndex(Rarity.Apprentice, 44);
    rarities[75] = RarityByIndex(Rarity.Fellow, 26);
    rarities[76] = RarityByIndex(Rarity.Apprentice, 45);
  }

  function getRarity(uint256 tokenId) public view override returns (Rarity rarity) {
    if (!_doesTokenExist(tokenId)) revert TokenDoesNotExist();
    uint256 normalizedValue = (tokenId + _getRandomNumber()) % 77;
    return rarities[normalizedValue].rarity;
  }

  function tokenURI(uint256 tokenId) public view virtual returns (string memory) {
    if (!_doesTokenExist(tokenId)) revert TokenDoesNotExist();
    if (_wasRevealed()) {
      uint256 uriId = getURIId(tokenId);
      return string(abi.encodePacked(baseURI, uriId.toString()));
    } else {
      return unrevealedURI;
    }
  }

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    baseURI = _baseURI;
  }

  function setUnrevealedURI(string calldata _unrevealedURI) external onlyOwner {
    unrevealedURI = _unrevealedURI;
  }

  function _wasRevealed() internal view virtual returns (bool);

  function _getRandomNumber() internal view virtual returns (uint256);

  function _doesTokenExist(uint256 tokenId) internal view virtual returns (bool);

  // We now want to randomly calculate a 'URI id', based on the tokenId. The 'URI id' also goes from 1 to 7337 but,
  // in order to make our lives easier, the first 4646 will be Apprentice, the following 2727 will be Fellow, and the
  // remaining 404 will be Master
  function getURIId(uint256 tokenId) internal view returns (uint256 uriId) {
    uint256 normalizedValue = (tokenId + _getRandomNumber()) % 77;
    RarityByIndex memory rarityByIndex = rarities[normalizedValue];
    uint256 amountEvery77Tokens;
    uint256 base;
    if (rarityByIndex.rarity == Rarity.Apprentice) {
      amountEvery77Tokens = 46;
    } else if (rarityByIndex.rarity == Rarity.Fellow) {
      base = 4646;
      amountEvery77Tokens = 27;
    } else {
      base = 7373;
      amountEvery77Tokens = 4;
    }
    uriId = ((tokenId - 1) / 77) * amountEvery77Tokens + base + rarityByIndex.orderInRarity + 1;
  }
}

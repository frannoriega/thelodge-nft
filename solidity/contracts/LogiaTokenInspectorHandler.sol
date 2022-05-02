//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/utils/Strings.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/ILogiaTokenInspectorHandler.sol';
import '../library/LogiaConfig.sol';

abstract contract LogiaTokenInspectorHandler is Ownable, ILogiaTokenInspectorHandler {
  using Strings for uint256;

  string public baseURI;
  string public unrevealedURI;

  constructor(LogiaConfig.URIConfig memory _config) {
    baseURI = _config.baseURI;
    unrevealedURI = _config.unrevealedURI;
  }

  function getRarity(uint256 tokenId) public view override returns (Rarity rarity) {
    if (!_doesTokenExist(tokenId)) revert TokenDoesNotExist();
    uint256 normalizedValue = (tokenId + _getRandomNumber()) % 29;
    (rarity, ) = _getRarityAndOrder(normalizedValue);
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
  // in order to make our lives easier, the first 4301 will be Apprentice, the following 2277 will be Fellow, and the
  // remaining 759 will be Master
  function getURIId(uint256 tokenId) internal view returns (uint256 uriId) {
    uint256 normalizedValue = (tokenId + _getRandomNumber()) % 29;
    (Rarity rarity, uint256 orderInRarity) = _getRarityAndOrder(normalizedValue);
    uint256 amountEvery29Tokens;
    uint256 base;
    if (rarity == Rarity.Apprentice) {
      amountEvery29Tokens = 17;
    } else if (rarity == Rarity.Fellow) {
      base = 4301;
      amountEvery29Tokens = 9;
    } else {
      base = 6578;
      amountEvery29Tokens = 3;
    }
    uriId = ((tokenId - 1) / 29) * amountEvery29Tokens + base + orderInRarity + 1;
  }

  // Rarity distribution, calculated with random.org: FAFAAFMAAFMFAAAFFAAAMAAAFFAAA
  function _getRarityAndOrder(uint256 value) internal pure returns (Rarity rarity, uint256 orderInRarity) {
    if (value == 0) {
      return (Rarity.Fellow, 0);
    } else if (value == 1) {
      return (Rarity.Apprentice, 0);
    } else if (value == 2) {
      return (Rarity.Fellow, 1);
    } else if (value == 3) {
      return (Rarity.Apprentice, 1);
    } else if (value == 4) {
      return (Rarity.Apprentice, 2);
    } else if (value == 5) {
      return (Rarity.Fellow, 2);
    } else if (value == 6) {
      return (Rarity.Master, 0);
    } else if (value == 7) {
      return (Rarity.Apprentice, 3);
    } else if (value == 8) {
      return (Rarity.Apprentice, 4);
    } else if (value == 9) {
      return (Rarity.Fellow, 3);
    } else if (value == 10) {
      return (Rarity.Master, 1);
    } else if (value == 11) {
      return (Rarity.Fellow, 4);
    } else if (value == 12) {
      return (Rarity.Apprentice, 5);
    } else if (value == 13) {
      return (Rarity.Apprentice, 6);
    } else if (value == 14) {
      return (Rarity.Apprentice, 7);
    } else if (value == 15) {
      return (Rarity.Fellow, 5);
    } else if (value == 16) {
      return (Rarity.Fellow, 6);
    } else if (value == 17) {
      return (Rarity.Apprentice, 8);
    } else if (value == 18) {
      return (Rarity.Apprentice, 9);
    } else if (value == 19) {
      return (Rarity.Apprentice, 10);
    } else if (value == 20) {
      return (Rarity.Master, 2);
    } else if (value == 21) {
      return (Rarity.Apprentice, 11);
    } else if (value == 22) {
      return (Rarity.Apprentice, 12);
    } else if (value == 23) {
      return (Rarity.Apprentice, 13);
    } else if (value == 24) {
      return (Rarity.Fellow, 7);
    } else if (value == 25) {
      return (Rarity.Fellow, 8);
    } else if (value == 26) {
      return (Rarity.Apprentice, 14);
    } else if (value == 27) {
      return (Rarity.Apprentice, 15);
    } else if (value == 28) {
      return (Rarity.Apprentice, 16);
    }
  }

  // TODO: We need to add a burn mechanism, so that owners can burn their own NFTs
}

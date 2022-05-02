//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ILogiaTokenInspectorHandler {
  error TokenDoesNotExist();

  enum Rarity {
    Apprentice,
    Fellow,
    Master
  }

  function getRarity(uint256 tokenId) external view returns (Rarity);
}

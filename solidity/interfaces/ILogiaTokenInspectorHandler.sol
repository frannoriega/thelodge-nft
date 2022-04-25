//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ILogiaTokenInspectorHandler {
    enum Rarity {
        Apprentice,
        Fellow,
        Master
    }

    function getRarity(uint tokenId) external view returns (Rarity);
}
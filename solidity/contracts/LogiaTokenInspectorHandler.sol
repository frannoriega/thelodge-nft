//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '../interfaces/ILogiaTokenInspectorHandler.sol';

abstract contract LogiaTokenInspectorHandler is ILogiaTokenInspectorHandler {

    function getRarity(uint tokenId) external pure override returns (Rarity) {
        uint normalizedValue = (tokenId + _getRandomNumber()) % 29;
        if (_isMaster(normalizedValue)) {
            return Rarity.Master;
        } else if (_isFellow(normalizedValue)) {
            return Rarity.Fellow;
        } else {
            return Rarity.Apprentice;
        }
    }

    function _getRandomNumber() internal virtual view returns (uint);

    function _isMaster(uint value) internal pure returns (bool) {
        return value == 6 || value == 10 || value == 20;
    }

    function _isFellow(uint value) internal pure returns (bool) {
        return value == 0 || value == 2 || value == 5
            || value == 9 || value == 11 || value == 15
            || value == 16 || value == 24 || value == 25;
    }
}
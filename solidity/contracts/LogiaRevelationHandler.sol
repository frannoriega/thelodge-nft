//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/ILogiaRevelationHandler.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import '../library/LogiaConfig.sol';

abstract contract LogiaRevelationHandler is Ownable, ILogiaRevelationHandler, VRFConsumerBaseV2 {
    uint256 public randomNumber;
    bool public revealed;

    VRFCoordinatorV2Interface coordinator;
    LinkTokenInterface linkToken;
    bytes32 private immutable _keyHash;
    uint256 private immutable _fee;
    
    uint16 private _minimumRequestConfirmations;
    uint32 private _callbackGasLimit;
    uint64 private _subId;

    constructor(LogiaConfig.RevelationConfig memory revelationConfig)
    VRFConsumerBaseV2(
        revelationConfig.vrfCoordinator
    )
    {
        if (revelationConfig.linkToken == address(0)) revert ZeroAddress();
        coordinator = VRFCoordinatorV2Interface(revelationConfig.vrfCoordinator);
        linkToken = LinkTokenInterface(revelationConfig.linkToken);
        _keyHash = revelationConfig.keyHash;
        _fee = revelationConfig.fee;
        _minimumRequestConfirmations = revelationConfig.minimumRequestConfirmations;
        _callbackGasLimit = revelationConfig.callbackGasLimit;
        _subId = revelationConfig.subId;
        randomNumber = 0;
        revealed = false;
    }

    function _generateRandomNumber() internal {
        coordinator.requestRandomWords(
            _keyHash,
            _subId,
            _minimumRequestConfirmations,
            _callbackGasLimit,
            1
        );
    }

    // TODO: Should we care about the requestId? Or was that meant to be used to keep track of how
    // many random numbers were generated?
    function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
        if (revealed) revert AlreadyGenerated();
        randomNumber = randomWords[0];
        revealed = true;
        emit GeneratedRandomNumber(randomNumber);
    }

    // Transfer this contract's funds to an address.
    // 1000000000000000000 = 1 LINK
    function withdraw(uint256 amount, address to) external onlyOwner {
        linkToken.transfer(to, amount);
    }
}
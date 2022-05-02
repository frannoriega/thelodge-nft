//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/ITheLodgeRevelationHandler.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import '../library/TheLodgeConfig.sol';

abstract contract TheLodgeRevelationHandler is Ownable, ITheLodgeRevelationHandler, VRFConsumerBaseV2 {
  uint256 public randomNumber;
  bool public revealed;

  VRFCoordinatorV2Interface public immutable coordinator;
  bytes32 private immutable _keyHash;

  uint64 internal _subId;

  constructor(TheLodgeConfig.RevelationConfig memory _revelationConfig) VRFConsumerBaseV2(_revelationConfig.vrfCoordinator) {
    if (_revelationConfig.vrfCoordinator == address(0)) revert ZeroAddress();
    coordinator = VRFCoordinatorV2Interface(_revelationConfig.vrfCoordinator);
    _keyHash = _revelationConfig.keyHash;
    _subId = _revelationConfig.subId;
  }

  function reveal() external onlyOwner {
    coordinator.requestRandomWords(
      _keyHash,
      _subId,
      3,
      100_000, // TODO: Set this once we run a test to see how much gas it costs
      1
    );
  }

  function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
    if (revealed) revert AlreadyRevealed();
    randomNumber = randomWords[0];
    revealed = true;
    emit Revealed(randomNumber);
  }

  // Setters
  function setSubId(uint64 __subId) external onlyOwner {
    _subId = __subId;
  }
}

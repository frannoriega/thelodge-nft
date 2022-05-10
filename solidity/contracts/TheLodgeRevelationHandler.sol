//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '../interfaces/ITheLodgeRevelationHandler.sol';
import '@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol';
import '@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol';
import '@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol';
import '../library/TheLodgeConfig.sol';

/// @title TheLodgeRevelationHandler
/// @notice Contract that handles all the revelation logic.
abstract contract TheLodgeRevelationHandler is Ownable, ITheLodgeRevelationHandler, VRFConsumerBaseV2 {
  /// @inheritdoc ITheLodgeRevelationHandler
  uint256 public randomNumber;
  /// @inheritdoc ITheLodgeRevelationHandler
  bool public revealed;

  /// @inheritdoc ITheLodgeRevelationHandler
  VRFCoordinatorV2Interface public immutable coordinator;
  /// @notice The key hash to be used for requesting random words
  /// to the VRF Coordinator.
  bytes32 private immutable _keyHash;
  /// @notice The subscription id for Chainlink's VRF.
  uint64 internal _subId;

  constructor(TheLodgeConfig.RevelationConfig memory _revelationConfig) VRFConsumerBaseV2(_revelationConfig.vrfCoordinator) {
    if (_revelationConfig.vrfCoordinator == address(0)) revert ZeroAddress();
    coordinator = VRFCoordinatorV2Interface(_revelationConfig.vrfCoordinator);
    _keyHash = _revelationConfig.keyHash;
    _subId = _revelationConfig.subId;
  }

  /// @inheritdoc ITheLodgeRevelationHandler
  function reveal() external override onlyOwner {
    coordinator.requestRandomWords(
      _keyHash,
      _subId,
      3,
      100_000, // TODO: Set this once we run a test to see how much gas it costs
      1
    );
  }

  /// @notice Callback for the VRF Coordinator to return the requested random number.
  /// @dev Once this method is called, the state of this contract will shift to "Revealed",
  /// which means that the random number is set in stone and subsequent calls to this
  /// method will throw an error and revert the transaction.
  /// @param randomWords A list with a single random number returned by the VRF Coordinator.
  function fulfillRandomWords(uint256, uint256[] memory randomWords) internal override {
    if (revealed) revert AlreadyRevealed();
    randomNumber = randomWords[0];
    revealed = true;
    emit Revealed(randomNumber);
  }

  /// @inheritdoc ITheLodgeRevelationHandler
  function setSubId(uint64 __subId) external override onlyOwner {
    _subId = __subId;
  }
}

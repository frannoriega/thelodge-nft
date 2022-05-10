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
  /// @notice The random number. Will be zero if the reveal was not made yet.
  uint256 public randomNumber;
  /// @notice Whether the reveal was already made or not.
  bool public revealed;

  /// @notice The address of the Chainlink's VRF Coordinator.
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

  /// @notice Triggers the reveal. This will send a request to the VRF Coordinator
  /// to generate a random number.
  /// @dev While this method can be called multiple times, only one request can be
  /// fulfilled. It's recommended that this method is called only once, or called
  /// again if the request failed; in order to save gas.
  function reveal() external onlyOwner {
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

  /// @notice Sets the subscription ID.
  function setSubId(uint64 __subId) external onlyOwner {
    _subId = __subId;
  }
}

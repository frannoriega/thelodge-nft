//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

/// @notice Errors, structs and functions that can be used
/// for token inspection (rarity).
interface ITheLodgeTokenInspectorHandler {
  /// @notice Thrown when attempting to get the rarity
  /// of a token that does not exist.
  error TokenDoesNotExist();

  /// @notice The different types of rarity a token can have.
  enum Rarity {
    Apprentice,
    Fellow,
    Master
  }

  /// @notice Computes the rarity of a token.
  /// @dev Should throw TokenDoesNotExist if the token does not exist.
  /// @param tokenId The ID of the token.
  /// @return The rarity of the given token.
  function getRarity(uint256 tokenId) external view returns (Rarity);
}

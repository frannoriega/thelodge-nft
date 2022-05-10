//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

/// @notice Handles everything related to determining the rarity of a token.
interface ITheLodgeTokenInspectorHandler {
  /// @notice The different types of rarity a token can have.
  enum Rarity {
    Apprentice,
    Fellow,
    Master
  }

  /// @notice Helper struct to organize the rarity of each token.
  struct RarityByIndex {
    Rarity rarity;
    uint248 orderInRarity;
  }

  /// @notice Thrown when attempting to get the rarity.
  /// of a token that does not exist.
  error TokenDoesNotExist();

  /// @notice Computes the rarity of a token.
  /// @dev Should throw TokenDoesNotExist if the token does not exist.
  /// @param tokenId The ID of the token.
  /// @return The rarity of the given token.
  function getRarity(uint256 tokenId) external view returns (Rarity);

  /// @notice Generates the token URI.
  /// @param tokenId The token ID used to generate the URI.
  /// @return The URI for the token.
  function tokenURI(uint256 tokenId) external view returns (string memory);

  /// @notice Sets the base URI.
  /// @param _baseURI The new base URI.
  function setBaseURI(string calldata _baseURI) external;

  /// @notice Sets the unrevealed URI.
  /// @param _unrevealedURI The new unrevealed URI.
  function setUnrevealedURI(string calldata _unrevealedURI) external;
}

//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

/// @notice Handles everything related to determining the rarity of a token.
interface ITheLodgeTokenInspectorHandler {
  /// @notice The different types of rarity a token can have.
  enum Rarity {
    Apprentice,
    Fellow,
    Master,
    Transcended
  }

  /// @notice Helper struct to organize the rarity of each token.
  struct RarityByIndex {
    Rarity rarity;
    uint248 orderInRarity;
  }

  /// @notice Emitted when a token is promoted
  /// @param tokenId The token that was promoted
  /// @param newRarity The new rarity
  event TokenPromoted(uint256 tokenId, Rarity newRarity);

  /// @notice Thrown when attempting to get the rarity of a token that does not exist
  error TokenDoesNotExist();

  /// @notice Thrown a caller that is not whitelisted tries to promote a token
  error CallerCannotPromote();

  /// @notice Computes the rarity of a token.
  /// @dev Should throw TokenDoesNotExist if the token does not exist.
  /// @param tokenId The ID of the token.
  /// @return The rarity of the given token.
  function getRarity(uint256 tokenId) external view returns (Rarity);

  /// @notice Generates the token URI.
  /// @param tokenId The token ID used to generate the URI.
  /// @return The URI for the token.
  function tokenURI(uint256 tokenId) external view returns (string memory);

  /// @notice Returns whether the given address is whitelisted to promote or not
  /// @param addressToCheck The address to check
  /// @return Whether the given address is whitelisted to promote or not
  function isWhitelistedToPromote(address addressToCheck) external view returns (bool);

  /// @notice Promotes a specific token to the next rarity level
  /// @param tokenId The id of the token to promote
  /// @return newRarity The token's new rarity
  function promote(uint256 tokenId) external returns (Rarity newRarity);

  /// @notice Sets whether the given address can execute promotions or not
  /// @param _address The address to give or take permissions from
  /// @param canPromote Whether the address will be able to promote or not
  function setPromotePermission(address _address, bool canPromote) external;

  /// @notice Sets the base URI.
  /// @param _baseURI The new base URI.
  function setBaseURI(string calldata _baseURI) external;

  /// @notice Sets the unrevealed URI.
  /// @param _unrevealedURI The new unrevealed URI.
  function setUnrevealedURI(string calldata _unrevealedURI) external;

  /// @notice Returns the maximum amount of tokens of type 'apprentice' that can be minted
  function MAX_MINTABLE_APPRENTICE() external view returns (uint16);

  /// @notice Returns the maximum amount of tokens of type 'fellow' that can be minted
  function MAX_MINTABLE_FELLOW() external view returns (uint16);

  /// @notice Returns the maximum amount of tokens of type 'master' that can be minted
  function MAX_MINTABLE_MASTER() external view returns (uint16);

  /// @notice Returns the maximum amount of tokens of type 'apprentice' that can be promoted to 'fellow'
  function MAX_PROMOTIONS_TO_FELLOW() external view returns (uint16);

  /// @notice Returns the maximum amount of tokens of type 'fellow' that can be promoted to 'master'
  function MAX_PROMOTIONS_TO_MASTER() external view returns (uint16);

  /// @notice Returns the maximum amount of tokens of type 'master' that can be promoted to 'transcended'
  function MAX_PROMOTIONS_TO_TRANSCENDED() external view returns (uint16);

  /// @notice Returns the first id that will be used for tokens of type 'apprentice'
  function APPRENTICE_FIRST_ID() external view returns (uint16);

  /// @notice Returns the first id that will be used for tokens of type 'fellow'
  function FELLOW_FIRST_ID() external view returns (uint16);

  /// @notice Returns the first id that will be used for tokens of type 'master'
  function MASTER_FIRST_ID() external view returns (uint16);

  /// @notice Returns the first id that will be used for tokens of type 'transcended'
  function TRANSCENDED_FIRST_ID() external view returns (uint16);
}

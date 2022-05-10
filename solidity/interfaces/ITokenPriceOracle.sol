//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

/// @notice Errors that can be used when interacting
/// with the token price oracle.
interface ITokenPriceOracle {
  /// @notice Thrown when the token price oracle returns an invalid
  /// answer (i.e: negative value).
  error InvalidAnswer();

  /// @notice Thrown when the token price oracle returns an answer
  /// with an updated timestamp that is too outdated.
  error OutdatedAnswer();
}

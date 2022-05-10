//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

/// @notice Errors and structs that can be used during the sale stage.
interface ITheLodgeSaleHandler {
  /// @notice An airdrop of tokens to a single recipient.
  struct IndividualAirdrop {
    /// @notice The address that will receive the tokens.
    address to;
    /// @notice The amount of tokens to send.
    /// @dev The quantity here is not bound to the maximum amount
    /// of tokens that the recipient can mint, but it's bound by
    /// the supply of tokens available.
    uint16 quantity;
  }

  /// @notice Thrown when the open sale date is configured
  /// to be before the whitelist sale date.
  error OpenSaleBeforeWhitelistSale();

  /// @notice Thrown when there's an attempt to mint/buy tokens
  /// after the sale has ended.
  error SaleEnded();

  /// @notice Thrown when there's an attempt to mint/buy more
  /// tokens than the current supply.
  error TokenSupplyExceeded();

  /// @notice Thrown when there's an attempt to mint/buy tokens
  /// from an address belonging to a smart contract.
  error ContractsCantBuy();

  /// @notice Thrown when a whitelisted address attempts to
  /// whitelist mint more than once.
  error AddressAlreadyClaimed();

  /// @notice Thrown when there's an attempt to mint/buy such
  /// that the tokens for the calling address exceeds the maximum
  /// amount of tokens per address.
  error TokenLimitExceeded();

  /// @notice Thrown when attempting to whitelist mint, but
  /// the provided proof is invalid.
  error InvalidProof();

  /// @notice Thrown when attempting to whitelist mint, but
  /// the sale has not started yet.
  /// @param saleStartTimestamp The sale start date.
  error SaleNotStarted(uint256 saleStartTimestamp);

  /// @notice Thrown when attempting to mint, but
  /// the open sale has not started yet.
  /// @param openSaleStartTimestamp The open sale start date.
  error OpenSaleNotStarted(uint256 openSaleStartTimestamp);

  /// @notice Thrown when attempting to mint, but there
  /// are either more funds or less than what's required to buy
  /// the specified amount of tokens.
  /// @param sent The amount of wei sent.
  /// @param required The amount of wei required.
  error InvalidFunds(uint256 sent, uint256 required);
}

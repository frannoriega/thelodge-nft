//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ILogiaSaleHandler {
  struct IndividualAirdrop {
    address to;
    uint16 quantity;
  }

  error OpenSaleBeforeWhitelistSale();

  error SaleEnded();

  error TokenSupplyExceeded();

  error ContractsCantBuy();

  error AddressAlreadyClaimed();

  error TokenLimitExceeded();

  error WhitelistedSaleEnded();

  error InvalidProof();

  error SaleNotStarted();

  error OpenSaleNotStarted();

  error InsufficientFunds();

  error AlreadyEnded();

  event EndSale();
}

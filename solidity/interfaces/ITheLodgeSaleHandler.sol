//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ITheLodgeSaleHandler {
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

  error SaleNotStarted(uint256 saleStartTimestamp);

  error OpenSaleNotStarted(uint256 openSaleStartTimestamp);

  error InvalidFunds(uint256 sent, uint256 required);

  error AlreadyEnded();

  event EndSale();
}

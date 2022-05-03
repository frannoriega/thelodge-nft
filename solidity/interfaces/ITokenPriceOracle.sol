//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ITokenPriceOracle {
  error InvalidAnswer();

  error OutdatedAnswer();
}

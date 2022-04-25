//SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.4 <0.9.0;

interface ILogiaRevelationHandler {
    error ZeroAddress();
    
    error AlreadyGenerated();

    error NotGeneratedYet();

    event GeneratedRandomNumber(uint number);
}

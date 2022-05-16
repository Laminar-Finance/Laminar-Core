//SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "hardhat/console.sol";
import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";

interface IPaymentReceiver {
    /**
     * @dev Check into the client and start streaming payment
     */
    function checkIn(address superGate) external;

    /**
     * @dev Check out of the client and stop streaming payment
     */
    function checkOut(address superGate) external;
}

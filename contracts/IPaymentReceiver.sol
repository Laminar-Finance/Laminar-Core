//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";

interface IPaymentReceiver {
    /**
     * @dev Check into the client and start streaming payment
     */
    function checkIn(uint256 clientId) external;

    /**
     * @dev Check out of the client and stop streaming payment
     */
    function checkOut(uint256 clientId) external;
}

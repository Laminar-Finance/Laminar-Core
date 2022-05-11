pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";

contract PaymentReceiver is IPaymentReceiver {
    uint private nonce;
    mapping (uint256 => address) private clients;

    constructor() {}

    function addClient() external returns (uint256) {
        uint256 clientId = uint256(keccak256(abi.encode(block.number, msg.data, nonce++)));

        return clientId;
    }

    function checkIn(uint256 clientId) external {

    }

    function checkOut(uint256 clientId) external {

    }

}
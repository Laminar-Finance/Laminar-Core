pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";

contract ClientDatabase {
    uint private nonce;
    mapping (uint256 => address) private clientIds;
    uint256[] private idList;
    // An address cannot have more than 128 associated clients.
    uint32 private maxClientIds = 128;

    constructor() {}

    function addClient() external returns (uint256) {
        uint256 _clientId = uint256(keccak256(abi.encode(block.number, msg.data, nonce++)));

        clientIds[_clientId] = msg.sender;

        idList.push(_clientId);

        return _clientId;
    }

    /**
    * @dev there can be more than 128 clientIds per address, but additional ids will never be returned by this function.
    */
    function getClients(address _addr) external view returns (uint256[] memory) {
        uint256[] memory _clientIds = new uint256[](128);    

        uint _count;
        for (uint256 index = 0; index < idList.length && index < maxClientIds; index++) {
            uint256 id = idList[index];
            if (clientIds[id] == _addr) {
                _clientIds[_count] = id;
                _count++;
            }
        }
        
        uint256[] memory _varibleClientIds = new uint256[](_count);

        for (uint256 index = 0; index < _count; index++) {
            _varibleClientIds[index] = _clientIds[index];
        }

        return _varibleClientIds;
    }

    function getClient(uint256 _clientId) external view returns (address) {
        return clientIds[_clientId];
    }
}

contract PaymentReceiver is IPaymentReceiver, ClientDatabase {
    function checkIn(uint256 clientId) external {

    }

    function checkOut(uint256 clientId) external {

    }

}
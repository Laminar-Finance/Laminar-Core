pragma solidity ^0.8.11;

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract Database {
    using Counters for Counters.Counter;

    Counters.Counter private idCounter;
    mapping (uint256 => address) private clientIds;
    uint256[] private idList;
    // An address cannot have more than 128 associated clients.
    uint32 private maxClientIds = 128;

    constructor() {}

    function addGateway() external returns (uint256) {
        uint256 _id = idCounter.current();

        idCounter.increment();

        clientIds[_id] = msg.sender;

        idList.push(_id);

        return _id;
    }

    /**
    * @dev there can be more than 128 clientIds per address, but additional ids will never be returned by this function.
    */
    function getGateway(address _addr) external view returns (uint256[] memory) {
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

    function getAddress(uint256 _clientId) public view returns (address) {
        return clientIds[_clientId];
    }
}
pragma solidity ^0.8.11;

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";
import {ISuperToken} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


contract Database {
    struct Gate{
        bytes name;
        address payee;
        uint96 flowRate; 
        ISuperToken token;
        address[] activeUsers; // unordered so it's not expensive to delete memebers
    }

    using Counters for Counters.Counter;

    Counters.Counter private idCounter;
    mapping (uint256 => Gate) private gates;
    mapping(address => uint256[]) private addressGates;

    ISuperToken private onlyToken;

    constructor(ISuperToken _token) {
        onlyToken = _token;
    }

    function addGate(string calldata _name, uint96 _flowRate) external returns (uint256) {
        uint256 _id = idCounter.current();

        idCounter.increment();
        gates[_id] = Gate(bytes(_name), msg.sender, _flowRate, onlyToken, new address[](0));

        addressGates[msg.sender].push(_id);

        return _id;
    }

    /**
    * @dev there can be more than 128 clientIds per address, but additional ids will never be returned by this function.
    */
    function getGateways(address _addr) external view returns (uint256[] memory) {
        return addressGates[_addr];
    }

    function getAddress(uint256 _gateId) public view returns (address) {
        return gates[_gateId].payee;
    }
}
pragma solidity ^0.8.11;

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";
import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


contract Database {
    struct Gate{
        string name;
        address payee;
        uint96 flowRate; 
        ISuperToken token;
        address[] activeUsers; // unordered so it's not expensive to delete memebers
    }

    using Counters for Counters.Counter;

    Counters.Counter private idCounter;
    mapping (uint256 => Gate) internal gates;
    mapping(address => uint256[]) private addressGates;

    ISuperToken internal onlyToken;

    constructor(ISuperToken _token) {
        onlyToken = _token;
    }

    function addGate(string calldata _name, uint96 _flowRate) external returns (uint256) {
        bytes32 _nameId = keccak256(bytes(_name));
        uint256[] memory gateIds = addressGates[msg.sender];
        for (uint256 index = 0; index < gateIds.length; index++) {
            Gate memory _gate = gates[gateIds[index]];
            require(keccak256(bytes(_gate.name)) != _nameId, string(abi.encodePacked("Cannot create a gate of name ", _name, "as one already exists with that name")));
        }
        
        uint256 _id = idCounter.current();

        idCounter.increment();
        gates[_id] = Gate(_name, msg.sender, _flowRate, onlyToken, new address[](0));

        addressGates[msg.sender].push(_id);

        return _id;
    }

    function deleteGate(uint256 _gateId) public {
        require(gates[_gateId].payee != address(0), "cannot delete nonexistant gate");
        require(gates[_gateId].payee == msg.sender, "cannot delete gate belonging to another merchant");


        uint256[] storage merchantGates = addressGates[msg.sender];

         for (uint256 index = 0; index < merchantGates.length; index++) {
            if (_gateId == merchantGates[index]) {
                merchantGates[index] = merchantGates[merchantGates.length - 1];
                merchantGates.pop();

                break;
            }
        }

        delete gates[_gateId];       
    }

    function getGateIds(address _addr) public view returns (uint256[] memory) {
        return addressGates[_addr];
    }

    function getGate(uint256 _gateId) public view returns (Gate memory) {
        return gates[_gateId];
    }
    
    function getGates(address _addr) public view returns (Gate[] memory) {
        uint256[] memory gateIds = addressGates[_addr];
        Gate[] memory _gates = new Gate[](gateIds.length);

        for (uint256 index = 0; index < gateIds.length; index++) {
            Gate memory _loadedGate = gates[gateIds[index]];
            _gates[index] = Gate(
                string(_loadedGate.name),
                _loadedGate.payee,
                _loadedGate.flowRate,
                _loadedGate.token,
                _loadedGate.activeUsers
            );
        }

        return _gates;
    }

    function getAddress(uint256 _gateId) public view returns (address) {
        return gates[_gateId].payee;
    }
}
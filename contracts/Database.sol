pragma solidity ^0.8.11;

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";
import { ISuperToken } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


contract Database {
    struct Gate{
        string name;
        address payee;
        int96 flowRate; 
        ISuperToken token;
        uint256 activeUsers;
    }

    using Counters for Counters.Counter;

    Counters.Counter private idCounter;
    mapping (uint256 => Gate) internal gates;
    mapping(address => uint256[]) private addressGates;
    mapping(address => mapping(uint256 => bool)) public checkedIn;
    mapping(uint256 => mapping(uint256 => address)) public gateUsers;

    ISuperToken internal onlyToken;

    constructor(ISuperToken _token) {
        onlyToken = _token;
    }

    function renameGate(uint256 _gateId, string memory _name) external {
        Gate storage gate = gates[_gateId];
     
        require(
            gate.payee != address(0), 
            string(abi.encodePacked("gate with id ", _gateId, " does not exist and so cannot be renamed"))
        );

        _checkGateName(_name);

        gate.name = _name;
    }

    function addGate(string calldata _name, int96 _flowRate) external returns (uint256) {
        _checkGateName(_name);

        uint256 _id = idCounter.current();

        idCounter.increment();
        gates[_id] = Gate(_name, msg.sender, _flowRate, onlyToken, 0);

        addressGates[msg.sender].push(_id);

        return _id;
    }

    function _checkGateName(string memory _name) private view {
        bytes32 _nameId = keccak256(bytes(_name));
        uint256[] memory gateIds = addressGates[msg.sender];
        for (uint256 index = 0; index < gateIds.length; index++) {
            Gate memory _gate = gates[gateIds[index]];
            require(keccak256(bytes(_gate.name)) != _nameId, string(abi.encodePacked(_name, "is already taken by another gate")));
        }
    }

    function deleteGate(uint256 _gateId) public virtual {
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

    function getGateUsers(uint256 _gateId) public view returns (address[] memory _gateUsers) {
        Gate memory gate = gates[_gateId];
        _gateUsers = new address[](gate.activeUsers);
        for(uint256 i = 0; i < gate.activeUsers; i++) {
            _gateUsers[i] = gateUsers[_gateId][i];
        }
        return _gateUsers;
    }
}
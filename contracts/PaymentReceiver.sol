pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";
import {ISuperfluid, ISuperToken, ISuperApp} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";

contract ClientDatabase {
    uint private nextId;
    mapping (uint256 => address) private clientIds;
    uint256[] private idList;
    // An address cannot have more than 128 associated clients.
    uint32 private maxClientIds = 128;

    constructor() {}

    function addClient() external returns (uint256) {
        uint256 _id = nextId;

        nextId++;

        clientIds[_id] = msg.sender;

        idList.push(_id);

        return _id;
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

    function getAddress(uint256 _clientId) public view returns (address) {
        return clientIds[_clientId];
    }
}

contract PaymentReceiver is IPaymentReceiver, ClientDatabase {
    ISuperfluid private _host; // host
    IConstantFlowAgreementV1 private _cfa; // the stored constant flow agreement class address

     constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa
    ) {
        _host = host;
        _cfa = cfa;

        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));
    }

 
    function checkIn(uint256 clientId, ISuperToken token) external {
        address _addr = getAddress(clientId);
        _createFlow(_addr, 1, token);
    }

    function checkOut(uint256 clientId) external {

    }


    function _createFlow(address to, int96 flowRate, ISuperToken _acceptedToken) internal {
        if (to == address(this) || to == address(0)) return;

        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.createFlow.selector,
                _acceptedToken,
                to,
                flowRate,
                new bytes(0)
            ),
            "0x"
        );
    }

}
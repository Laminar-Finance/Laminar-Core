pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";
import {ISuperfluid, ISuperToken, ISuperApp} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

contract ClientDatabase {
    using Counters for Counters.Counter;

    Counters.Counter private idCounter;
    mapping (uint256 => address) private clientIds;
    uint256[] private idList;
    // An address cannot have more than 128 associated clients.
    uint32 private maxClientIds = 128;

    constructor() {}

    function addClient() external returns (uint256) {
        uint256 _id = idCounter.current();

        idCounter.increment();

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
    IConstantFlowAgreementV1 private _cfa; // the stored constant flow agreement class 
    
    event CheckIn(address _checkee, uint256 _clientId, uint96 _flowRate, ISuperToken token);
    event CheckOut(address _checkee, uint256 _clientId);

     constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa
    ) {
        _host = host;
        _cfa = cfa;

        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));
    }
 
    function checkIn(uint256 _clientId, ISuperToken _token) external {
        address _addr = getAddress(_clientId);
 
        _createFlow(_addr, 1, _token);
        emit CheckIn(msg.sender, _clientId, 1, _token);
    }

    function checkOut(uint256 _clientId, ISuperToken _token) external {
        address _addr = getAddress(_clientId);

        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.deleteFlowByOperator.selector,
                _token,
                msg.sender,
                _addr,
                new bytes(0)
            ),
            "0x"
        );
    }

    function _createFlow(address _to, int96 _flowRate, ISuperToken _token) internal {
        if (_to == address(this) || _to == address(0)) return;

        /**
         * @dev flows between two different addreses can only be created by a contract
         * with superfluid operator permissions. 
         */
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.createFlowByOperator.selector,
                _token,
                msg.sender,
                _to,
                _flowRate,
                new bytes(0)
            ),
            "0x"
        );
    }

}
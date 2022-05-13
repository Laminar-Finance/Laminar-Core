pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";
import {ISuperfluid, ISuperToken, ISuperApp} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import {IConstantFlowAgreementV1} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { Database } from "./Database.sol";

contract PaymentReceiver is IPaymentReceiver, Database {
    ISuperfluid private _host; // host
    IConstantFlowAgreementV1 private _cfa; // the stored constant flow agreement class 
    
    event CheckIn(address _checkee, uint256 _gateId, uint96 _flowRate, ISuperToken token);
    event CheckOut(address _checkee, uint256 _gateId);

     constructor(
        ISuperfluid host,
        IConstantFlowAgreementV1 cfa,
        ISuperToken token
    ) Database(token) {
        _host = host;
        _cfa = cfa;

        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));
    }
 
    function checkIn(uint256 _gateId) external {
        address _addr = getAddress(_gateId);
 
        _createFlow(_addr, 1, onlyToken);
        emit CheckIn(msg.sender, _gateId, 1, onlyToken);
    }

    function checkOut(uint256 _gateId) external {
        address _addr = getAddress(_gateId);

        _deleteFlow(_addr, onlyToken);
        emit CheckOut(msg.sender, _gateId);
    }

    function _deleteFlow(address _to, ISuperToken _token) internal {
        _host.callAgreement(
            _cfa,
            abi.encodeWithSelector(
                _cfa.deleteFlowByOperator.selector,
                _token,
                msg.sender,
                _to,
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
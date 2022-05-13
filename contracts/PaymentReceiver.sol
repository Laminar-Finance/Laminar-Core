pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";
import { ISuperfluid, ISuperToken, ISuperApp } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { IConstantFlowAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { Database } from "./Database.sol";

contract PaymentReceiver is IPaymentReceiver, Database {
    ISuperfluid private host; // host
    IConstantFlowAgreementV1 private cfa; // the stored constant flow agreement class 
    
    event CheckIn(address checkee, uint256 gateId, uint96 flowRate, ISuperToken token);
    event CheckOut(address checkee, uint256 gateId);

     constructor(
        ISuperfluid _host,
        IConstantFlowAgreementV1 _cfa,
        ISuperToken _token
    ) Database(_token) {
        assert(address(_host) != address(0));
        assert(address(_cfa) != address(0));
        
        host = _host;
        cfa = _cfa;
    }
 
    function checkIn(uint256 _gateId) external {
        Gate storage gate = gates[_gateId];

        for (uint256 index = 0; index < gate.activeUsers.length; index++) {
            require(gate.activeUsers[index] != msg.sender, string(abi.encodePacked("already checked in at: ", gate.name)));
        }

        _createFlow(gate.payee, 1, onlyToken);
        gate.activeUsers.push(msg.sender);
        emit CheckIn(msg.sender, _gateId, 1, onlyToken);
    }

    function checkOut(uint256 _gateId) external {
        Gate storage gate = gates[_gateId];        

        _deleteFlow(gate.payee, onlyToken);

        for (uint256 index = 0; index < gate.activeUsers.length; index++) {
            if (msg.sender == gate.activeUsers[index]) {
                gate.activeUsers[index] = gate.activeUsers[gate.activeUsers.length - 1];
                gate.activeUsers.pop();

                break;
            }
        }
        emit CheckOut(msg.sender, _gateId);
    }

    function _deleteFlow(address _to, ISuperToken _token) internal {
        host.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.deleteFlowByOperator.selector,
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
        host.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.createFlowByOperator.selector,
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
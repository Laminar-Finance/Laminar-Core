pragma solidity ^0.8.11;

import "hardhat/console.sol";
import "./IPaymentReceiver.sol";
import { ISuperfluid, ISuperToken, ISuperApp } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";
import { IConstantFlowAgreementV1 } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { Database } from "./Database.sol";

contract PaymentReceiver is IPaymentReceiver, Database {
    ISuperfluid private host; // host
    IConstantFlowAgreementV1 private cfa; // the stored constant flow agreement class
    
    event CheckIn(address checkee, uint256 gateId, int96 flowRate, ISuperToken token);
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
    
    function deleteGate(uint256 _gateId) public override {
        Gate memory gate = getGate(_gateId);

        uint256 index = 0;
        for(index; index < gate.activeUsers; index++) {
            address addr = gateUsers[_gateId][index];
            _deleteFlow(addr, gate.payee, gate.flowRate, onlyToken);
            checkedIn[addr][_gateId] = false;
            emit CheckOut(addr , _gateId);
        }
        gate.activeUsers = 0;

        super.deleteGate(_gateId);
    }

    function checkIn(uint256 _gateId) external {
        require(checkedIn[msg.sender][_gateId] == false, "you are already checked in");

        Gate storage gate = gates[_gateId];

        _createFlow(gate.payee, gate.flowRate, onlyToken);
        checkedIn[msg.sender][_gateId] = true;
        gateUsers[_gateId][gate.activeUsers] = msg.sender;
        gate.activeUsers++;
        emit CheckIn(msg.sender, _gateId, gate.flowRate, onlyToken);
    }

    function checkOut(uint256 _gateId) external {
        require(checkedIn[msg.sender][_gateId] == true, "you are not checked in");

        Gate storage gate = gates[_gateId];        

        _deleteFlow(msg.sender, gate.payee, gate.flowRate, onlyToken);

        checkedIn[msg.sender][_gateId] = false;
        gate.activeUsers--;

        emit CheckOut(msg.sender, _gateId);
    }

    function _deleteFlow(address _from, address _to, int96 _flowRate, ISuperToken _token) internal {
        (,int96 flowRate,,) = cfa.getFlow(_token, _from, _to);
        _flowRate = flowRate - _flowRate;


        if(_flowRate != int96(0)) {
            host.callAgreement(
                cfa,
                abi.encodeWithSelector(
                    cfa.updateFlowByOperator.selector,
                    _token,
                    _from,
                    _to,
                    _flowRate,
                    new bytes(0)
                ),
                "0x"
            );
        }
        else{
            host.callAgreement(
                cfa,
                abi.encodeWithSelector(
                    cfa.deleteFlowByOperator.selector,
                    _token,
                    _from,
                    _to,
                    new bytes(0)
                ),
                "0x"
            );
        }
    }

    function _createFlow(address _to, int96 _flowRate, ISuperToken _token) internal {
        require (_to != address(this) && _to != address(0));

        (,int96 flowRate,,) = cfa.getFlow(_token, msg.sender, _to);

        if(flowRate != 0){
            host.callAgreement(
                cfa,
                abi.encodeWithSelector(
                    cfa.updateFlowByOperator.selector,
                    _token,
                    msg.sender,
                    _to,
                    _flowRate + flowRate,
                    new bytes(0)
                ),
                "0x"
            );
        }
        else{
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

}
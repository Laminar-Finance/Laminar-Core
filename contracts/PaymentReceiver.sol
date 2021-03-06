// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "./SuperGate.sol";
import "./IPaymentReceiver.sol";

import { Counters } from "@openzeppelin/contracts/utils/Counters.sol";

import {
    IConstantFlowAgreementV1
} from "@superfluid-finance/ethereum-contracts/contracts/interfaces/agreements/IConstantFlowAgreementV1.sol";
import { ISuperToken, ISuperfluid } from "@superfluid-finance/ethereum-contracts/contracts/interfaces/superfluid/ISuperfluid.sol";


contract PaymentReceiver is IPaymentReceiver {
    ISuperfluid private host; // host
    IConstantFlowAgreementV1 private cfa; // the stored constant flow agreement class
    mapping(address => SuperGate[]) private addressToGate;
    mapping(SuperGate => address) private gateToAddress;


    constructor(address _host, address _cfa){
        host = ISuperfluid(_host);
        cfa = IConstantFlowAgreementV1(_cfa);
    }

    function addGate(string calldata _name, int96 _flowRate, ISuperToken _token) external returns (address){
        SuperGate newGate = new SuperGate(host, cfa, _name, msg.sender, _token, _flowRate);
        gateToAddress[newGate] = msg.sender;
        addressToGate[msg.sender].push(newGate);
        return address(newGate);
    }


    /**
     * @dev Check into the client and start streaming payment
     */
    function checkIn(address superGate) external{
        SuperGate gate = SuperGate(superGate);
        require(!gate.isCheckedIn(msg.sender), "Already checked in");
        ISuperToken token = ISuperToken(gate.acceptedToken());
        int96 flowRate = int96(gate.flowRate());        

        //May want to add some context instead of bytes 0
        /**
         * @dev flows between two different addreses can only be created by a contract
         * with superfluid operator permissions. 
         */
        host.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.createFlowByOperator.selector,
                token,
                msg.sender,
                address(gate),
                flowRate,
                new bytes(0)
            ),
            "0x"
        );
    }

    /**
     * @dev Check out of the client and stop streaming payment
     */
    function checkOut(address superGate) external{
        SuperGate gate = SuperGate(superGate);
        require(gate.isCheckedIn(msg.sender), "Not checked in");

        //May want to add some context instead of bytes 0
        /**
         * @dev flows between two different addreses can only be created by a contract
         * with superfluid operator permissions. 
         */
        host.callAgreement(
            cfa,
            abi.encodeWithSelector(
                cfa.deleteFlowByOperator.selector,
                gate.acceptedToken(),
                msg.sender,
                address(gate),
                new bytes(0)
            ),
            "0x"
        );
    }


    /*
    * ------------------------------------------------------------
    * External view functions
    * ------------------------------------------------------------
    */

    function gatesOwnedBy(address _owner) external view returns (address[] memory result){
        result = new address[](addressToGate[_owner].length);
        for(uint i = 0; i < addressToGate[_owner].length; i++){
            result[i] = address(addressToGate[_owner][i]);
        }
    }

    function getOwner(address _gate) external view returns (address){
        return gateToAddress[SuperGate(_gate)];
    }
}
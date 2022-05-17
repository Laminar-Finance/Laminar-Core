const { expect } = require("chai");
const { ethers, web3 } = require("hardhat");
const { Framework } = require("@superfluid-finance/sdk-core");
const daiABI = require("./abis/fDAIABI");
const deployFramework = require("@superfluid-finance/ethereum-contracts/scripts/deploy-framework");
const deployTestToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-test-token");
const deploySuperToken = require("@superfluid-finance/ethereum-contracts/scripts/deploy-super-token");

const provider = web3;


const errorHandler = (err) => {
  if (err) throw err;
};

describe("SuperGate", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;

  let fauxDiax;

  let sf;
  let dai;
  let daix;

  let pr;
  let sg;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];
    cricket = accounts[3];
    dragonfly = accounts[4];
    earwig = accounts[5];

    await deployFramework(errorHandler, {
      web3,
      from: admin.address,
    });

    const fDAIAddress = await deployTestToken(errorHandler, [":", "fDAI"], {
      web3,
      from: admin.address,
    });

    // deploy a fake erc20 wrapper super token around the fDAI token
    const fDAIxAddress = await deploySuperToken(errorHandler, [":", "fDAI"], {
      web3,
      from: admin.address,
    });

    console.log("fDAIxAddress: ", fDAIxAddress);
    console.log("fDAIAddress: ", fDAIAddress);

    sf = await Framework.create({
      networkName: "custom",
      provider,
      dataMode: "WEB3_ONLY",
      resolverAddress: process.env.RESOLVER_ADDRESS,
      protocolReleaseVersion: "test",
    });

    daix = await sf.loadSuperToken("fDAIx");

    dai = new ethers.Contract(daix.underlyingToken.address, daiABI, admin);

    const appInitialBalance = await daix.balanceOf({
      account: admin.address,
      providerOrSigner: admin,
    });

    console.log("appInitialBalance: ", appInitialBalance); // initial balance of the app is 0

    await dai.mint(admin.address, ethers.utils.parseEther("3000"));
    await dai.approve(daix.address, ethers.utils.parseEther("3000"));

    const daixUpgradeOperation = daix.upgrade({
      amount: ethers.utils.parseEther("3000"),
    });

    await daixUpgradeOperation.exec(admin);
    let daixBal = await daix.balanceOf({
      account: admin.address,
      providerOrSigner: admin,
    });
    console.log("daix bal for acct 0: ", daixBal);

    let transferOperation = await daix.transfer({
      sender: admin.address,
      receiver: dragonfly.address,
      amount: 400,
    });
    await transferOperation.exec(admin);
    daixBal = await daix.balanceOf({
      account: dragonfly.address,
      providerOrSigner: dragonfly,
    });
    console.log("daix bal for acct 4: ", daixBal);

    transferOperation = await daix.transfer({
      sender: admin.address,
      receiver: earwig.address,
      amount: 240,
    });
    await transferOperation.exec(admin);
    daixBal = await daix.balanceOf({
      account: earwig.address,
      providerOrSigner: earwig,
    });
    console.log("daix bal for acct 5: ", daixBal);

    let PR = await ethers.getContractFactory("PaymentReceiver");
    pr = await PR.deploy(
      sf.settings.config.hostAddress,
      sf.settings.config.cfaV1Address
    );
    await pr.deployed();

    // Authorize the deployed PaymentReceiver contract as a superfluid operator
    // on behalf of the admin, dragonfly and earwig users
    const transaction = daix.authorizeFlowOperatorWithFullControl({
      flowOperator: pr.address,
    });
    await (await transaction.exec(admin)).wait();
    await (await transaction.exec(dragonfly)).wait();
    await (await transaction.exec(earwig)).wait();
    
  });



  it("Should create a flow upon check in and remove upon checkout", async function () {
    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");
    
    const antPR = pr.connect(ant);
    await antPR.addGate("bike 1", 1, daix.address);
    const antSGAddress = (await antPR.gatesOwnedBy(ant.address))[0];

    const antSG = await ethers.getContractAt("SuperGate", antSGAddress, admin);

    await pr.checkIn(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    let checkedIn  = await antSG.isCheckedIn(admin.address);
    expect(checkedIn).to.equal(true);

    await pr.checkOut(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    checkedIn  = await antSG.isCheckedIn(admin.address);
    expect(checkedIn).to.equal(false);

  });


});
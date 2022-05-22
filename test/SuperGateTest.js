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
  let dragonfly;
  let earwig;

  let sf;
  let dai;
  let daix;

  let pr;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];
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
      amount: 1000,
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
      amount: 1000,
    });
    await transferOperation.exec(admin);
    daixBal = await daix.balanceOf({
      account: earwig.address,
      providerOrSigner: earwig,
    });
    console.log("daix bal for acct 5: ", daixBal);

    const PR = await ethers.getContractFactory("PaymentReceiver");
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

    pr.connect(admin);
    await pr.checkIn(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    let checkedIn = await antSG.isCheckedIn(admin.address);
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

  it("Should prevent double checkins", async function () {
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

    pr.connect(admin);
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

    await expect(pr.checkIn(antSGAddress)).to.be.revertedWith("Already checked in");
    await pr.checkOut(antSGAddress);
  });

  it("Should redirect all flows to the owner", async function () {
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

    pr.connect(admin);

    await pr.checkIn(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    await pr.connect(earwig).checkIn(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: earwig.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    await pr.connect(dragonfly).checkIn(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: dragonfly.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: antSGAddress,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("3");

    await pr.connect(dragonfly).checkOut(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: dragonfly.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: antSGAddress,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("2");

    await pr.connect(earwig).checkOut(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: earwig.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: antSGAddress,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    await pr.connect(admin).checkOut(antSGAddress);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: antSGAddress,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");
  });

  it("Should checkin/checkout a user when directly creating/deleting a flow to the gate", async function () {
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

    await (await sf.cfaV1.createFlow({
      sender: admin.address,
      receiver: antSGAddress,
      superToken: daix.address,
      flowRate: "1",
      userData: "",
    })).exec(admin);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: antSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    checkedIn = await antSG.isCheckedIn(admin.address);
    expect(checkedIn).to.equal(true);

    await (await sf.cfaV1.deleteFlow({
      sender: admin.address,
      receiver: antSGAddress,
      superToken: daix.address,
      userData: "",
    })).exec(admin);

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

  it("Creating and updating flows works normally", async function () {
    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    await (
      await sf.cfaV1.createFlow({
        sender: admin.address,
        receiver: ant.address,
        superToken: daix.address,
        flowRate: "1",
        userData: "",
      })
    ).exec(admin);

    await (
      await sf.cfaV1.updateFlow({
        sender: admin.address,
        receiver: ant.address,
        superToken: daix.address,
        flowRate: "2",
        userData: "",
      })
    ).exec(admin);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("2");

    await (
      await sf.cfaV1.deleteFlow({
        sender: admin.address,
        receiver: ant.address,
        superToken: daix.address,
        userData: "",
      })
    ).exec(admin);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");
  });

  it("Should check out if existing flows are updated", async function () {
    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    const beetlePR = pr.connect(beetle);
    await beetlePR.addGate("bike 1", 2, daix.address);
    const beetleSGAddress = (await beetlePR.gatesOwnedBy(beetle.address))[0];

    const beetleSG = await ethers.getContractAt(
      "SuperGate",
      beetleSGAddress,
      admin
    );

    await (
      await sf.cfaV1.createFlow({
        sender: admin.address,
        receiver: beetleSGAddress,
        superToken: daix.address,
        flowRate: "2",
        userData: "",
      })
    ).exec(admin);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetleSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("2");

    let checkedIn = await beetleSG.isCheckedIn(admin.address);
    expect(checkedIn).to.equal(true);

    console.log("second flow to be created");
    console.log(admin.address);
    await (
      await sf.cfaV1.updateFlow({
        sender: admin.address,
        receiver: beetleSGAddress,
        superToken: daix.address,
        flowRate: "1",
        userData: "",
      })
    ).exec(admin);
    console.log("second flow was created");

    checkedIn = await beetleSG.isCheckedIn(admin.address);
    expect(checkedIn).to.equal(false);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetleSGAddress,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("2");
  });

  it("Should not checkin a user when directly creating a flow with an incorrect flow rate", async function () {
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

    await (await sf.cfaV1.createFlow({
      sender: admin.address,
      receiver: antSGAddress,
      superToken: daix.address,
      flowRate: "10",
      userData: "",
    })).exec(admin);


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
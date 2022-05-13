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

describe("PaymentReceiver", function () {
  let accounts;
  let admin;
  let ant;
  let beetle;
  let cricket;
  let dragonfly;

  let sf;
  let dai;
  let daix;

  let PR;
  let pr;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];
    beetle = accounts[2];
    cricket = accounts[3];
    dragonfly = accounts[4];

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

    const transferOperation = await daix.transfer({
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
  });

  beforeEach(async function () {
    PR = await ethers.getContractFactory("PaymentReceiver");
    pr = await PR.deploy(
      sf.settings.config.hostAddress,
      sf.settings.config.cfaV1Address,
      daix.address
    );
    await pr.deployed();

    // Authorize the deployed PaymentReceiver contract as a superfluid operator
    const transaction = daix.authorizeFlowOperatorWithFullControl({
      flowOperator: pr.address,
    });
    const result = await transaction.exec(admin);
    await result.wait();
  });

  it("Should create a flow upon check in", async function () {
    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");

    const antPR = pr.connect(ant);
    await antPR.addGate("bike 1", 1);

    const antGateId = (await antPR.getGateIds(ant.address))[0];
    await pr.checkIn(antGateId);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");
    await pr.checkOut(antGateId);
  });

  it("Should emit a CheckIn and CheckOut events", async function () {
    const antPR = pr.connect(ant);
    await antPR.addGate("bike 2", 1);

    const antGateId = (await antPR.getGateIds(ant.address))[0];
    await expect(pr.checkIn(antGateId))
      .to.emit(pr, "CheckIn")
      .withArgs(admin.address, antGateId, 1, daix.address);
    await expect(pr.checkOut(antGateId))
      .to.emit(pr, "CheckOut")
      .withArgs(admin.address, antGateId);
  });

  it("should prevent double checkins", async function () {
    const antPR = pr.connect(ant);
    await antPR.addGate("bike 77", 1);

    const antGateId = (await antPR.getGateIds(ant.address))[0];
    await pr.checkIn(antGateId);
    await expect(pr.checkIn(antGateId)).to.be.revertedWith(
      "already checked in at: bike 77"
    );
    await pr.checkOut(antGateId);
  });

  it("should track active users", async function () {
    const antPR = pr.connect(ant);

    await antPR.addGate("long term storage unit 99", 3);
    let antGate = (await pr.getGates(ant.address))[0];
    expect(antGate.activeUsers.length).to.equal(0);

    const antGateId = (await pr.getGateIds(ant.address))[0];
    await pr.checkIn(antGateId);

    antGate = (await pr.getGates(ant.address))[0];
    expect(antGate.activeUsers.length).to.equal(1);
    expect(antGate.activeUsers[0]).to.equal(admin.address);

    await pr.checkOut(antGateId);
    antGate = (await pr.getGates(ant.address))[0];
    expect(antGate.activeUsers.length).to.equal(0);
  });

  it("Should remove existing flows on check out", async function () {
    const beetlePR = pr.connect(beetle);
    await beetlePR.addGate("bike 4", 1);
    const beetleGateId = (await beetlePR.getGateIds(beetle.address))[0];
    await pr.checkIn(beetleGateId);

    const criketPR = pr.connect(cricket);
    await criketPR.addGate("storage unit 1", 1);
    const cricketGateId = (await beetlePR.getGateIds(cricket.address))[0];
    await pr.checkIn(cricketGateId);

    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    // This should not effect the beetle's flow.
    await pr.checkOut(cricketGateId);
    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    await pr.checkOut(beetleGateId);
    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");
  });
});

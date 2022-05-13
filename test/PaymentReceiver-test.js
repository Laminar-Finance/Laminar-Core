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

    const daiAddress = daix.underlyingToken.address;
    dai = new ethers.Contract(daiAddress, daiABI, admin);

    const appInitialBalance = await daix.balanceOf({
      account: admin.address,
      providerOrSigner: admin,
    });

    console.log("appInitialBalance: ", appInitialBalance); // initial balance of the app is 0

    await dai.mint(admin.address, ethers.utils.parseEther("1000"));
    await dai.approve(daix.address, ethers.utils.parseEther("1000"));

    const daixUpgradeOperation = daix.upgrade({
      amount: ethers.utils.parseEther("1000"),
    });

    await daixUpgradeOperation.exec(admin);
    const daixBal = await daix.balanceOf({
      account: admin.address,
      providerOrSigner: admin,
    });
    console.log("daix bal for acct 0: ", daixBal);
  });

  beforeEach(async function () {
    PR = await ethers.getContractFactory("PaymentReceiver");
    pr = await PR.deploy(
      sf.settings.config.hostAddress,
      sf.settings.config.cfaV1Address
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
    await antPR.addGate();

    const antClientId = (await antPR.getGateways(ant.address))[0];
    await pr.checkIn(antClientId, daix.address);

    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: ant.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");
    await pr.checkOut(antClientId, daix.address);
  });

  it("Should emit a CheckIn and CheckOut events", async function () {
    const antPR = pr.connect(ant);
    await antPR.addGate();

    const antClientId = (await antPR.getGateways(ant.address))[0];
    await expect(pr.checkIn(antClientId, daix.address))
      .to.emit(pr, "CheckIn")
      .withArgs(admin.address, antClientId, 1, daix.address);
    await expect(pr.checkOut(antClientId, daix.address))
      .to.emit(pr, "CheckOut")
      .withArgs(admin.address, antClientId);
  });

  it("Should remove existing flows on check out", async function () {
    const beetlePR = pr.connect(beetle);
    await beetlePR.addGate();
    const beetleClientId = (await beetlePR.getGateways(beetle.address))[0];
    await pr.checkIn(beetleClientId, daix.address);

    const criketPR = pr.connect(cricket);
    await criketPR.addGate();
    const cricketClientId = (await beetlePR.getGateways(cricket.address))[0];
    await pr.checkIn(cricketClientId, daix.address);

    let flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    // This should not effect the beetle's flow.
    await pr.checkOut(cricketClientId, daix.address);
    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("1");

    await pr.checkOut(beetleClientId, daix.address);
    flow = await sf.cfaV1.getFlow({
      superToken: daix.address,
      sender: admin.address,
      receiver: beetle.address,
      providerOrSigner: admin,
    });
    expect(flow.flowRate).to.equal("0");
  });
});

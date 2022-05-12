const { expect } = require("chai");
const { ethers, web3 } = require("hardhat");
const { Framework, ConstantFlowAgreementV1 } = require("@superfluid-finance/sdk-core");
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

  let sf;
  let dai;
  let daix;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
    ant = accounts[1];

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

  // it("Should fail to check in if the signer has no money", async function () {
    // const PR = await ethers.getContractFactory("PaymentReceiver");
    // const pr = await PR.deploy(
    //   sf.settings.config.hostAddress,
    //   sf.settings.config.cfaV1Address
    // );
    // await pr.deployed();

    // let clients = await pr.getClients(admin.address);
    // expect(clients.length).to.equal(0);

    // await pr.addClient();

    // clients = await pr.getClients(admin.address);
    // const clientId = clients[0];

    // const antilopeConnection = pr.connect(antilope);

    // await expect(antilopeConnection.checkIn(clientId, daix.address)).to.be.reverted;
  // });

  it.only("Should create a flow upon check in", async function () {
    const PR = await ethers.getContractFactory("PaymentReceiver");
    const pr = await PR.deploy(
      sf.settings.config.hostAddress,
      sf.settings.config.cfaV1Address
    );
    await pr.deployed();

    console.log(sf);
    console.log("contract addr", pr.address);
    console.log("host addr", sf.settings.config.hostAddress);
    console.log("flow contract addr", sf.settings.config.cfaV1Address);
    console.log("dai addr", daix.address);

    // console.log(sf.cfaV1.contract);

    let q = daix.authorizeFlowOperatorWithFullControl({
      flowOperator: sf.settings.config.cfaV1Address,
    });
    console.log("auth flow operation outcome: ", q);
    let result = await q.exec(admin);
    console.log("result", result);
    let final = await result.wait();
    console.log("final", final);

    q = daix.authorizeFlowOperatorWithFullControl({
      flowOperator: pr.address,
    });
    console.log("auth flow operation outcome: ", q);
    result = await q.exec(admin);
    console.log("result", result);
    final = await result.wait();
    console.log("final", final);

    q = daix.authorizeFlowOperatorWithFullControl({
      flowOperator: sf.settings.config.hostAddress,
    });
    console.log("auth flow operation outcome: ", q);
    result = await q.exec(admin);
    console.log("result", result);
    final = await result.wait();
    console.log("final", final);

    // q = await daix.authorizeFlowOperatorWithFullControl({
    //   flowOperator: sf.settings.config.cfaV1Address,
    // });
    // console.log("auth flow operation outcome: ", q);
    // await q.exec(daix);
    // q = await daix.authorizeFlowOperatorWithFullControl({
    //   flowOperator: pr.address,
    // });
    // console.log("auth flow operation outcome: ", q);
    // await q.exec(daix);

    console.log("authorized");

    const antPR = pr.connect(ant);
    await antPR.addClient();

    console.log("admin adddress", admin.address);

    const daixBal = await daix.balanceOf({
      account: admin.address,
      providerOrSigner: admin,
    });
    console.log("daix bal for acct 0: ", daixBal);

    const antClientId = (await antPR.getClients(ant.address))[0];
    await pr.checkIn(antClientId, daix.address);

    // await expect(pr.checkIn(antilopeClientId, daix.address)).not.to.be.reverted;
  });
});

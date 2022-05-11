const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ClientDatabase", function () {
  let accounts;
  let admin;

  before(async () => {
    accounts = await ethers.getSigners();
    admin = accounts[0];
  });

  it("Should generate and store unique client ids", async function () {
    const PR = await ethers.getContractFactory("ClientDatabase");
    const pr = await PR.deploy();
    await pr.deployed();

    let clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(0);

    await pr.addClient();
    await pr.addClient();
    await pr.addClient();

    clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(3);

    await pr.addClient();
    clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(4);
    expect(new Set(clients).size).to.equal(4);
  });

  it("Should prevent more than 128 client ids per address", async function () {
    const PR = await ethers.getContractFactory("ClientDatabase");
    const pr = await PR.deploy();
    await pr.deployed();

    for (let index = 0; index < 128; index++) {
      await pr.addClient();
    }

    let clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(128);

    await pr.addClient();
    await pr.addClient();
    await pr.addClient();

    clients = await pr.getClients(admin.address);
    expect(clients.length).to.equal(128);
  });

  it("Should show associated address when given a client id", async function () {
    const PR = await ethers.getContractFactory("ClientDatabase");
    const pr = await PR.deploy();
    await pr.deployed();

    await pr.addClient();
    await pr.addClient();
    const clients = await pr.getClients(admin.address);
    let clientAddress = await pr.getClient(clients[0]);
    expect(clientAddress).to.equal(admin.address);

    clientAddress = await pr.getClient(clients[1]);
    expect(clientAddress).to.equal(admin.address);
  });
});

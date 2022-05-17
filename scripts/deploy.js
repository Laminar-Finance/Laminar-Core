// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
const hre = require("hardhat");

async function main() {
  // Hardhat always runs the compile task when running scripts with its command
  // line interface.
  //
  // If this script is run directly using `node` you may want to call compile
  // manually to make sure everything is compiled
  // await hre.run('compile');

  // We get the contract to deploy
  const PaymentReceiver = await hre.ethers.getContractFactory("PaymentReceiver");
  const host = "0xEB796bdb90fFA0f28255275e16936D25d3418603";
  const cfa = "0x49e565Ed1bdc17F3d220f72DF0857C26FA83F873";
  const pr = await PaymentReceiver.deploy(host, cfa);

  await pr.deployed();
  
  console.log("Payment Receiver deployed at:", pr.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

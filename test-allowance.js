const { ethers } = require("ethers");
const provider = new ethers.JsonRpcProvider("http://localhost:8545");
const MOCK_USDC_ABI = ["function allowance(address owner, address spender) view returns (uint256)"];
const usdc = new ethers.Contract("0x59A77C94E43cFcFD40D0683D72183Fd60A4381eE", MOCK_USDC_ABI, provider);
usdc.allowance("0xa562Df3FB8d41299C5D1C9ac5789347bdaC11008", "0x8ad735C1ca5064479Be023d73fa84B059524107f").then(res => console.log("ALLOWANCE:", res.toString()));

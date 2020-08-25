require("dotenv").config();
const Web3 = require("web3");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
const schemeAdapter = new FileSync("./src/data/schemes.json");
const schemeDB = low(schemeAdapter);
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURAKEY}`
  )
);
const {
  getEvents,
  upsertGasSpending,
  upsertAccountGasSpending,
} = require("./src/utils/utils.js");

async function fetchGasSpenings() {
  console.log("Started fetching transactions...");
  let scheme = await schemeDB.get("schemes").value();
  let filter = { _organization: process.env.AVATAR_ADDRESS };
  let latestBlock = await web3.eth.getBlockNumber();
  let votingMachines = [];
  for (var j in scheme) {
    if (
      !votingMachines.includes(scheme[j].votingMachineAddress) &&
      scheme[j].votingMachineAddress
    ) {
      console.log(
        `Searching for proposals on voting machine ${scheme[j].votingMachineAddress}`
      );
      let latestBlock = await web3.eth.getBlockNumber();
      let orgFilter = { _organization: process.env.AVATAR_ADDRESS };

      if (scheme[j].votingMachineAddress) {
        votingMachines.push(scheme[j].votingMachineAddress);
        const votes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          "VoteProposal",
          orgFilter,
          JSON.parse(scheme[j].votingMachineAbi)
        );

        const stakes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          "Stake",
          orgFilter,
          JSON.parse(scheme[j].votingMachineAbi)
        );

        const proposalCreations = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          "NewProposal",
          orgFilter,
          JSON.parse(scheme[j].votingMachineAbi)
        );

        console.log(
          `Found ${votes.events.length} vote, ${stakes.events.length} staking & ${proposalCreations.events.length} proposalCreation transactions.`
        );
        console.log(`Processing now...`);

        for (var i in votes.events) {
          var receipt = await web3.eth.getTransactionReceipt(
            votes.events[i].transactionHash
          );
          var tx = await web3.eth.getTransaction(
            votes.events[i].transactionHash
          );
          var block = await web3.eth.getBlock(votes.events[i].blockNumber);

          upsertAccountGasSpending(
            { id: votes.events[i].returnValues._voter },
            {
              id: votes.events[i].returnValues._voter,
              totalVotes: 0,
              votesSpending: 0,
              totalStakings: 0,
              stakingSpending: 0,
              totalProposalCreations: 0,
              proposalCreationSpending: 0,
            }
          );

          if (receipt.status) {
            upsertGasSpending(
              { id: votes.events[i].transactionHash },
              {
                id: votes.events[i].transactionHash,
                proposalId: votes.events[i].returnValues._proposalId,
                transactionHash: votes.events[i].transactionHash,
                from: votes.events[i].returnValues._voter,
                gas: receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: receipt.gasUsed * tx.gasPrice,
                action: "voting",
                timestamp: block.timestamp,
              }
            );
          }
        }

        for (var i in proposalCreations.events) {
          var receipt = await web3.eth.getTransactionReceipt(
            proposalCreations.events[i].transactionHash
          );
          var tx = await web3.eth.getTransaction(
            proposalCreations.events[i].transactionHash
          );
          var block = await web3.eth.getBlock(
            proposalCreations.events[i].blockNumber
          );

          upsertAccountGasSpending(
            { id: proposalCreations.events[i].returnValues._proposer },
            {
              id: proposalCreations.events[i].returnValues._proposer,
              totalVotes: 0,
              votesSpending: 0,
              totalStakings: 0,
              stakingSpending: 0,
              totalProposalCreations: 0,
              proposalCreationSpending: 0,
            }
          );

          if (receipt.status) {
            upsertGasSpending(
              { id: proposalCreations.events[i].transactionHash },
              {
                id: proposalCreations.events[i].transactionHash,
                proposalId:
                  proposalCreations.events[i].returnValues._proposalId,
                transactionHash: proposalCreations.events[i].transactionHash,
                from: proposalCreations.events[i].returnValues._proposer,
                gas: receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: receipt.gasUsed * tx.gasPrice,
                action: "proposalCreation",
                timestamp: block.timestamp,
              }
            );
          }
        }

        for (var i in stakes.events) {
          var receipt = await web3.eth.getTransactionReceipt(
            stakes.events[i].transactionHash
          );
          var tx = await web3.eth.getTransaction(
            stakes.events[i].transactionHash
          );
          var block = await web3.eth.getBlock(stakes.events[i].blockNumber);

          upsertAccountGasSpending(
            { id: stakes.events[i].returnValues._staker },
            {
              id: stakes.events[i].returnValues._staker,
              totalVotes: 0,
              votesSpending: 0,
              totalStakings: 0,
              stakingSpending: 0,
              totalProposalCreations: 0,
              proposalCreationSpending: 0,
            }
          );

          if (receipt.status) {
            upsertGasSpending(
              { id: stakes.events[i].transactionHash },
              {
                id: stakes.events[i].transactionHash,
                proposalId: stakes.events[i].returnValues._proposalId,
                transactionHash: stakes.events[i].transactionHash,
                from: stakes.events[i].returnValues._staker,
                gas: receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: receipt.gasUsed * tx.gasPrice,
                action: "staking",
                timestamp: block.timestamp,
              }
            );
          }
        }
      }
    }
  }

  console.log(
    `Transactions written to ./data/gasSpendings.json aggregating data now....`
  );
}

fetchGasSpenings();

require("dotenv").config();
const Web3 = require("web3");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const gasSpendingAdapter = new FileSync("./src/data/gasSpendings.json");
const gasSpendingsDB = low(gasSpendingAdapter);
const AccountGasSpendingAdapter = new FileSync("./src/data/accountGasSpendings.json");
const AccountGasSpendingsDB = low(AccountGasSpendingAdapter);
const schemeAdapter = new FileSync("./src/data/schemes.json");
const schemeDB = low(schemeAdapter);
const { contracts } = require("./src/data/baseContracts.js");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${process.env.NETWORK}.infura.io/v3/${process.env.INFURAKEY}`
  )
);
const {
  getEvents,
  upsertGasSpending,
  upsertAccountGasSpending
} = require("./src/utils/utils.js");


async function fetchGasSpenings() {
  try {
    console.log("Started fetching gas Spendings...");
    let scheme = await schemeDB.get("schemes").value();
    let filter = { "_organization:": process.env.AVATAR_ADDRESS};
    let latestBlock = await web3.eth.getBlockNumber()

    let genesisVotes = await getEvents(
      contracts.GenesisProtocol.address,
      process.env.STARTING_BLOCK,
      process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
      "VoteProposal",
      filter,
      contracts.GenesisProtocol.abi
    );
    
    let genesisStakes = await getEvents(
      contracts.GenesisProtocol.address,
      process.env.STARTING_BLOCK,
      process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
      "Stake",
      filter,
      contracts.GenesisProtocol.abi
    );

    const genesisProposalCreations = await getEvents(
      contracts.GenesisProtocol.address,
      process.env.STARTING_BLOCK,
      process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
      "NewProposal",
      filter,
      contracts.GenesisProtocol.abi
    );
    
    console.log(`Found ${genesisVotes.events.length} vote, ${genesisStakes.events.length} staking & ${genesisProposalCreations.events.length} proposalCreation transactions on Genesis Protocol `)

    for (var i in genesisVotes.events) {
      var receipt = await web3.eth.getTransactionReceipt(genesisVotes.events[i].transactionHash)
      var tx = await web3.eth.getTransaction(genesisVotes.events[i].transactionHash)
      var block = await web3.eth.getBlock(genesisVotes.events[i].blockNumber)

      upsertAccountGasSpending({ id: genesisVotes.events[i].returnValues._voter }, { id: genesisVotes.events[i].returnValues._voter })

      if(receipt.status){
        upsertGasSpending(
          { id: genesisVotes.events[i].transactionHash },
          {
            id: genesisVotes.events[i].transactionHash,
            proposalId: genesisVotes.events[i].returnValues._proposalId,
            transactionHash: genesisVotes.events[i].transactionHash,
            from: genesisVotes.events[i].returnValues._voter,
            gas: receipt.gasUsed,
            gasPrice: parseInt(tx.gasPrice),
            gasTotal: (receipt.gasUsed*tx.gasPrice),
            action: "voting",
            scheme: "Genesis Protocol",
            timestamp: block.timestamp
          });
      }
    }

    for (var i in genesisStakes.events) {
      var receipt = await web3.eth.getTransactionReceipt(genesisStakes.events[i].transactionHash)
      var tx = await web3.eth.getTransaction(genesisStakes.events[i].transactionHash)
      var block = await web3.eth.getBlock(genesisStakes.events[i].blockNumber)

      upsertAccountGasSpending({ id: genesisStakes.events[i].returnValues._staker }, { id: genesisStakes.events[i].returnValues._staker })

      if(receipt.status){
          upsertGasSpending(
          { id: genesisStakes.events[i].transactionHash },
          {
            id: genesisStakes.events[i].transactionHash,
            proposalId: genesisStakes.events[i].returnValues._proposalId,
            transactionHash: genesisStakes.events[i].transactionHash,
            from: genesisStakes.events[i].returnValues._staker,
            gas: receipt.gasUsed,
            gasPrice: parseInt(tx.gasPrice),
            gasTotal: (receipt.gasUsed*tx.gasPrice),
            action: "staking",
            scheme: "Genesis Protocol",
            timestamp: block.timestamp
          });
        }
    }


    for (var i in genesisProposalCreations.events) {
      var receipt = await web3.eth.getTransactionReceipt(genesisProposalCreations.events[i].transactionHash)
      var tx = await web3.eth.getTransaction(genesisProposalCreations.events[i].transactionHash)
      var block = await web3.eth.getBlock(genesisProposalCreations.events[i].blockNumber)

      upsertAccountGasSpending({ id: tx.from }, { id: tx.from})

      if(receipt.status){
          upsertGasSpending(
          { id: genesisProposalCreations.events[i].transactionHash },
          {
            id: genesisProposalCreations.events[i].transactionHash,
            proposalId: genesisProposalCreations.events[i].returnValues._proposalId,
            transactionHash: genesisProposalCreations.events[i].transactionHash,
            from: tx.from,
            gas: receipt.gasUsed,
            gasPrice: parseInt(tx.gasPrice),
            gasTotal: (receipt.gasUsed*tx.gasPrice),
            action: "proposalCreation",
            scheme: "Genesis Protocol",
            timestamp: block.timestamp
          });
        }
    }

    
    for (var j in scheme) {
      await sleep(1000);
      console.log(`Searching for transaction on Scheme ${scheme[j].name}...`)
      let latestBlock = await web3.eth.getBlockNumber()
      let filter = {};

      if(scheme[j].votingMachineAddress){
       
        const votes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          "VoteProposal",
          filter,
          JSON.parse(scheme[j].votingMachineAbi)
        );
        
        const stakes = await getEvents(
          scheme[j].votingMachineAddress,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          "Stake",
          filter,
          JSON.parse(scheme[j].votingMachineAbi)
        );
        
        const proposalCreations = await getEvents(
          scheme[j].address,
          process.env.STARTING_BLOCK,
          process.env.END_BLOCK ? process.env.END_BLOCK : latestBlock,
          scheme[j].eventName,
          filter,
          JSON.parse(scheme[j].abi)
        );

        console.log(`Found ${votes.events.length} vote, ${stakes.events.length} staking & ${proposalCreations.events.length} proposalCreation transactions on ${scheme[j].name} `)
        
        for (var i in votes.events) {
          var receipt = await web3.eth.getTransactionReceipt(votes.events[i].transactionHash)
          var tx = await web3.eth.getTransaction(votes.events[i].transactionHash)
          var block = await web3.eth.getBlock(votes.events[i].blockNumber)

          upsertAccountGasSpending({ id: votes.events[i].returnValues._voter }, { id: votes.events[i].returnValues._voter })

          if(receipt.status){
            upsertGasSpending(
              { id: votes.events[i].transactionHash },
              {
                id: votes.events[i].transactionHash,
                proposalId: votes.events[i].returnValues._proposalId,
                transactionHash: votes.events[i].transactionHash,
                from: votes.events[i].returnValues._voter,
                gas:receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: (receipt.gasUsed*tx.gasPrice),
                action: "voting",
                scheme: scheme[j].name,
                timestamp: block.timestamp
              }
            );
          }
        }
    
        for (var i in proposalCreations.events) {
          var receipt = await web3.eth.getTransactionReceipt(proposalCreations.events[i].transactionHash)
          var tx = await web3.eth.getTransaction(proposalCreations.events[i].transactionHash)
          var block = await web3.eth.getBlock(proposalCreations.events[i].blockNumber)

          upsertAccountGasSpending({ id: tx.from }, { id: tx.from })

          if(receipt.status){
            upsertGasSpending(
              { id: proposalCreations.events[i].transactionHash },
              {
                id: proposalCreations.events[i].transactionHash,
                proposalId: proposalCreations.events[i].returnValues._proposalId,
                transactionHash: proposalCreations.events[i].transactionHash,
                from: proposalCreations.events[i].returnValues._staker,
                gas: receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: (receipt.gasUsed*tx.gasPrice),
                action: "proposalCreation",
                scheme: scheme[j].name,
                timestamp: block.timestamp
              }
            );
          }
        }


        for (var i in stakes.events) {
          var receipt = await web3.eth.getTransactionReceipt(stakes.events[i].transactionHash)
          var tx = await web3.eth.getTransaction(stakes.events[i].transactionHash)
          var block = await web3.eth.getBlock(stakes.events[i].blockNumber)

          upsertAccountGasSpending({ id: stakes.events[i].returnValues._staker }, { id: stakes.events[i].returnValues._staker })

          if(receipt.status){
            upsertGasSpending(
              { id: stakes.events[i].transactionHash },
              {
                id: stakes.events[i].transactionHash,
                proposalId: stakes.events[i].returnValues._proposalId,
                transactionHash: stakes.events[i].transactionHash,
                from: stakes.events[i].returnValues._staker,
                gas: receipt.gasUsed,
                gasPrice: parseInt(tx.gasPrice),
                gasTotal: (receipt.gasUsed*tx.gasPrice),
                action: "staking",
                scheme: scheme[j].name,
                timestamp: block.timestamp
              }
            );
          }
        }



        
      }
      
    }

    console.log(`Transactions written to ./data/gasSpendings.json aggregating data now....`)
    
  
    
    
  } catch (err) {
    console.log(err);
  }
}


async function aggregateData(){
  try{

    let uniqueAccounts = await AccountGasSpendingsDB.get("accountGasSpendings").value();

    for (var i in uniqueAccounts) {
      let votes = await gasSpendingsDB.get("gasSpendings").filter({ from: uniqueAccounts[i].id, action: 'voting' }).value();
      let stakings = await gasSpendingsDB.get("gasSpendings").filter({ from: uniqueAccounts[i].id, action: 'staking' }).value();
      let proposals = await gasSpendingsDB.get("gasSpendings").filter({ from: uniqueAccounts[i].id, action: 'proposalCreation' }).value();

      let votesSpending = 0, stakingSpending = 0, proposalCreationsSpending = 0;
      for (var v in votes){
        votesSpending = (votesSpending+ votes[v].gasTotal)
      }
      for (var s in stakings){
        stakingSpending = (stakingSpending + stakings[s].gasTotal)
      }

      for (var p in proposals){
        proposalCreationsSpending = (proposalCreationsSpending + proposals[p].gasTotal)
      }

      upsertAccountGasSpending(
        { id:  uniqueAccounts[i].id },
        { totalVotes: votes.length,
          votesSpending: votesSpending,
          totalStakings: stakings.length,
          stakingSpending: stakingSpending,
          totalProposalCreations: proposals.length,
          proposalCreationSpending: proposalCreationsSpending })

    }

    aggregateData()

  } catch(err){
    console.log(err)
  }
}

fetchGasSpenings();



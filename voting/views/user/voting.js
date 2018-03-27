(() => {
  const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  var votingContract = web3.eth.contract([{
    "constant": true,
    "inputs": [{
      "name": "candidate",
      "type": "bytes32"
    }],
    "name": "totalVotesFor",
    "outputs": [{
      "name": "",
      "type": "uint8"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "constant": true,
    "inputs": [{
      "name": "candidate",
      "type": "bytes32"
    }],
    "name": "validCandidate",
    "outputs": [{
      "name": "",
      "type": "bool"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "constant": true,
    "inputs": [{
      "name": "",
      "type": "bytes32"
    }],
    "name": "votesReceived",
    "outputs": [{
      "name": "",
      "type": "uint8"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "constant": true,
    "inputs": [{
      "name": "",
      "type": "uint256"
    }],
    "name": "candidateList",
    "outputs": [{
      "name": "",
      "type": "bytes32"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "constant": false,
    "inputs": [{
      "name": "candidate",
      "type": "bytes32"
    }],
    "name": "voteForCandidate",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }, {
    "constant": true,
    "inputs": [],
    "name": "getCandidateList",
    "outputs": [{
      "name": "",
      "type": "bytes32[]"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "inputs": [{
      "name": "candidateNames",
      "type": "bytes32[]"
    }],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "constructor"
  }]);

  const contractInstance = votingContract.at('0x21bcda6f16070f0b60ca34aec72ab3e871da1718');

  web3.eth.defaultAccount = web3.eth.accounts[0];
  // web3.personal.unlockAccount(web3.eth.accounts[0],0);

  // const tableElem = document.getElementById("table-body");
  const candidateOptions = document.getElementById("candidates");
  const voteForm = document.getElementById("vote-form");
  // console.log(voteForm)

  function populateCandidates() {
    const candidateList = contractInstance.getCandidateList.call(); // call() is used for sync read only calls.
    var i = 1;
    candidateList.forEach((candidate) => {

      const candidateName = web3.toUtf8(candidate);
      const name = document.createElement("h4")
      name.innerText = candidateName;

      const select = document.createElement("input");
      select.setAttribute("type", "radio");
      select.className = 'btn-block';
      select.innerText = "선택";
      select.name = "choice"
      select.id = "radio_" + candidateName;
      select.value = candidate
      //if(i==1) select.checked = "checked"

      const card_body = document.createElement("div")
      card_body.className = "card-body";
      card_body.appendChild(name);
      card_body.appendChild(select);

      const card_header = document.createElement("div")
      card_header.className = "card-header"
      card_header.innerText = "후보 " + i;

      const card = document.createElement("div");
      card.className = "card";
      card.appendChild(card_header);
      card.appendChild(card_body);

      const col4 = document.createElement("div")
      col4.className = "col-md-4"
      col4.appendChild(card);

      candidateOptions.appendChild(col4);

      i++;

    });
  }

  function handleVoteForCandidate(evt) {
    const candidate = new FormData(evt.target).get("choice");
    console.log(candidate)
    contractInstance.voteForCandidate(candidate, {
      from: web3.eth.accounts[0]
    }, function() {
      const votes = contractInstance.totalVotesFor.call(candidate);
    });
  }

  populateCandidates();
  voteForm.addEventListener("submit", handleVoteForCandidate, false);



})();

var express = require('express');
//var router   = express.Router();
var path = require('path');
var app = express();
var mongoose = require('mongoose');
var passport = require('passport');
var session = require('express-session');
var flash = require('connect-flash');
var async = require('async');
var bodyParser = require('body-parser');
var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider("http://localhost:8545"));

mongoose.connect("mongodb://test:testtest@ds019906.mlab.com:19906/my_db");
var db = mongoose.connection;
db.once("open", function() {
  console.log("DB Connected!");
});
db.on("error", function(err) {
  console.log("DB Error: ");
});

var votingSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true
  }, //제목
  category: {
    type: String,
    // required: true
  }, //부문
  college: {
    type: String
  }, //단대
  department: {
    type: String
  }, //학과
  startDate: {
    type: Date,
    // required: true,
    default: Date.now
  }, //시작날짜
  endDate: {
    type: Date,
    // required: true
  }, //종료날짜
  candidate: {
    type: Array
  },
  contract: {
    type: String,
    // required: true /*, unique:true*/
  } //컨트랙트주소
  //candidate: {type:String, required:true}
});
var Voting = mongoose.model('votings', votingSchema);

var userSchema = mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  }, //학번
  account: {
    type: String,
    required: true,
    unique: true
  } //계좌주소
});
var User = mongoose.model('users', userSchema);

app.set("view engine", 'ejs');
app.use(express.static(path.join(__dirname + '/public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(flash());
app.use(session({
  secret: 'Secret'
}));
app.use(passport.initialize());
app.use(passport.session());

//app.use('/',require('./routes/login'));
//app.use('/user',require('./routes/user'));
//app.use('/admin',require('./routes/admin'));

passport.serializeUser(function(user, done) {
  done(null, user._id);
});
passport.deserializeUser(function(_id, done) {
  User.findById(_id, function(err, user) {
    done(err, user);
  });
});

var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
  new LocalStrategy({
      usernameField: 'id',
      passwordField: 'password',
      passReqToCallback: true
    },
    function(req, id, password, done) {
      User.findOne({
        'id': id
      }, function(err, user) {
        //console.log(req.body.password);

        if (err) return done(err);

        if (!user) {
          req.flash("id", req.body.id);
          return done(null, false, req.flash('loginError', '등록되지 않은 회원입니다!'));
        }
        web3.eth.personal.unlockAccount(user.account, req.body.password).then(function() {
          return done(null, user);
        }, function() {
          req.flash("id", req.body.id);
          return done(null, false, req.flash('loginError', '비밀번호를 확인해주세요!'));
        });
      });
    }
  ));

//set routes
app.get('/', function(req, res) {
  res.redirect('/index');
});

app.get('/index', function(req, res) {
  res.render('index', {
    id: req.flash("id")[0],
    loginError: req.flash('loginError')
  })
});
app.post('/index',
  function(req, res, next) {
    req.flash("id");
    if (req.body.id.length === 0 || req.body.password.length === 0) {
      req.flash("id", req.body.id);
      req.flash('loginError', '아이디와 비밀번호를 모두 입력해주세요!');
      res.redirect('index');
    } else {
      next();
    }
  }, passport.authenticate('local-login', {
    failureRedirect: '/index',
    failureFlash: true
  }),
  function(req, res, votings) {
    Voting.find({}, function(err, votings) {
      if (err) return res.json({
        success: false,
        message: err
      });

      if (req.user.account === web3.eth.accounts[0])
        res.redirect("admin/lists");
      else
        res.redirect("user/lists");
    });
  }
);

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/register', function(req, res) {
  res.render('register', {
    id: req.flash("id")[0],
    password: req.flash("password")[0],
    idError: req.flash('idError')[0]
  });
});
app.post('/register', checkUserRegValidation, function(req, res, next) {
  var id = req.body.user.id;
  var password = req.body.user.password;
  //console.log(password);
  //var account = web3.eth.accounts.create().address;
  web3.eth.personal.newAccount(password).then(function(account) {
    return account;
  }).then(function(account) {
    var user = new User({
      'id': id,
      'account': account.toString(16)
    });
    user.save(function(err, silence) {
      if (err) {
        res.send(err);
        return;
      }
      res.redirect('index');
    })
  });
});

function checkUserRegValidation(req, res, next) {
  var isValid = true;

  async.waterfall(
    [function(callback) {
      User.findOne({
          'id': req.body.user.id,
          '_id': {
            $ne: mongoose.Types.ObjectId(req.params.id)
          }
        },
        function(err, user) {
          if (user) {
            isValid = false;
            req.flash("idError", "이미 등록된 회원입니다.");
          }
          callback(null, isValid);
        });
    }],
    function(err, isValid) {
      if (err) return res.json({
        success: false,
        message: err
      });
      if (isValid) {
        return next();
      } else {
        req.flash("formData", req.body.user.id);
        res.redirect("back");
      }
    });
}

app.get('/user/lists', function(req, res, votings) {
  var page = Math.max(1, req.query.page);
  var limit = 4;
  Voting.count({}, function(err, count) {
    if (err) return res.json({
      success: false,
      message: err
    });
    var skip = (page - 1) * limit;
    var maxPage = Math.ceil(count / limit);
    Voting.find({}).sort('-startDate').skip(skip).limit(limit).exec(function(err, votings) {
      if (err) return res.json({
        success: false,
        message: err
      });
      //res.json({success:true, data:votings, maxPage:maxPage, page:page});
      res.render("user/lists", {
        data: votings,
        user: req.user,
        maxPage: maxPage,
        page: page
      });
      //res.redirect("user/lists");
    });
  });
});

function populateCandidates(req, contract, votings) {
  const interface = JSON.parse('[ { "constant": true, "inputs": [ { "name": "", "type": "bytes32" } ], "name": "votesReceived", "outputs": [ { "name": "", "type": "uint8", "value": "0" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "candidate", "type": "bytes32" } ], "name": "validCandidate", "outputs": [ { "name": "", "type": "bool", "value": false } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "candidate", "type": "bytes32" } ], "name": "totalVotesFor", "outputs": [ { "name": "", "type": "uint8", "value": "0" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "getCandidateList", "outputs": [ { "name": "", "type": "bytes32[]", "value": [ "0x4a6965756e000000000000000000000000000000000000000000000000000000", "0x59656a6f6e670000000000000000000000000000000000000000000000000000", "0x5365616800000000000000000000000000000000000000000000000000000000" ] } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "uint256" } ], "name": "candidateList", "outputs": [ { "name": "", "type": "bytes32", "value": "0x4a6965756e000000000000000000000000000000000000000000000000000000" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "candidate", "type": "bytes32" } ], "name": "voteForCandidate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "inputs": [ { "name": "candidateNames", "type": "bytes32[]" } ], "payable": false, "stateMutability": "nonpayable", "type": "constructor" } ]');
  const VotingContract = new web3.eth.Contract(interface);

  Voting.findOne({
    'contract': contract
  }, function(err, votings) {
    const contractInstance = VotingContract.at('contract');
    const candidateList = contractInstance.getCandidateList.call(); // call() is used for sync read only calls.
    candidateList.forEach(function(candidate) {
      const candidateName = web3.toUtf8(candidate);
      const votes = contractInstance.totalVotesFor.call(candidate);

      // Creates a row element.
      const rowElem = document.createElement("tr");

      // Creates a cell element for the name.
      const nameCell = document.createElement("td");
      nameCell.innerText = candidateName;
      rowElem.appendChild(nameCell);

      // Creates a cell element for the votes.
      // const voteCell = document.createElement("td");
      // voteCell.id = "vote-" + candidate;
      // voteCell.innerText = votes;
      // rowElem.appendChild(voteCell);

      // Adds the new row to the voting table.
      tableElem.appendChild(rowElem);

      // Creates an option for each candidate
      const candidateOption = document.createElement("option");
      candidateOption.value = candidate;
      candidateOption.innerText = candidateName;
      candidateOptions.appendChild(candidateOption);
    });
  });
}
app.get('/user/lists/:id', function(req, res) {
  Voting.findById(req.params.id, function(err, votings) {
    if (err) return res.json({
      success: false,
      message: err
    });
    res.render('user/voting', {
      data: votings
    });
  });
});

app.get('/user/voting', function(req, res) {
  res.render('user/voting')
});

app.get('/admin/lists', function(req, res) {
  var page = Math.max(1, req.query.page);
  var limit = 4;
  Voting.count({}, function(err, count) {
    if (err) return res.json({
      success: false,
      message: err
    });
    var skip = (page - 1) * limit;
    var maxPage = Math.ceil(count / limit);
    Voting.find({}).sort('-startDate').skip(skip).limit(limit).exec(function(err, votings) {
      if (err) return res.json({
        success: false,
        message: err
      });
      //res.json({success:true, data:votings, maxPage:maxPage, page:page});
      res.render("admin/lists", {
        data: votings,
        user: req.user,
        maxPage: maxPage,
        page: page
      });
      //res.redirect("user/lists");
    });
  });
});

app.get('/admin/open', function(req, res) {
  res.render('admin/open');
});

app.post('/open', function(req, res) {
  Voting.create(req.body.voting, function(err, voting) {
    if (err) return res.json({
      success: false,
      message: err
    });
    res.redirect('admin/lists');
  });
});



//app.post('user/lists', function (req,res){
//res.render("user/lists", {data:votings, user:req.user, maxPage:maxPage, page:page});
//});

/*app.get('/user/:id', function (req,res){
    User.findById(req.params._id, function (err,user) {
        if(err) return res.json({sucess:false, message:err});
        res.render("user/lists", {user: user});
    });
});*/

/*app.get('/user/lists/:id', function (req,res){
    Voting.findById(req.params.id, function (err,votings){
        if(err) return res.json({success:false, message:err});
        res.render("user/show", {data:votings, maxPage:maxPage});
    });
});*/

/*app.get('/user/lists/:page', function(req,res,next) {
    var perPage=4;
    var page = req.params.page || 1;

    Voting
        .find({})
        .skip((perPage * page) - perPage)
        .limit(perPage)
        .exec(function(err, products) {
            Voting.count().exec(function(err, count) {
                if(err) return next(err)
                res.render('user/show', {data:votings, current:page, pages:Math.ceil(count/perPage)})
            })
        })
});*/

//app.put('/lists/:id', function (req,res){
//Voting.findByIdAndUpdate(req.params.id, req.body.votings, function (err,votings){
//if(err) return res.json({success:false, message:err});
//res.render("lists/show", {data:votings});
//});
//});

app.listen(3000, function() {
  console.log('Server On!');
});

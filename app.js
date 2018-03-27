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

var votingContract = new web3.eth.Contract([{
    "constant": true,
    "inputs": [],
    "name": "alreadyVoted",
    "outputs": [{
      "name": "",
      "type": "bool"
    }],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }, {
    "constant": false,
    "inputs": [],
    "name": "killContract",
    "outputs": [],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }, {
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

mongoose.connect("mongodb://test:testtest@ds019906.mlab.com:19906/my_db");
var db = mongoose.connection;
db.once("open", function (){
    console.log("DB Connected!");
});
db.on("error", function (err){
    console.log("DB Error: ");
});

var votingSchema = mongoose.Schema({
    round: {type:Number, required:true}, //회차
    category: {type:String, required:true}, //부문
    college: {type:String}, //단대
    department: {type:String}, //학과
    startDate: {type:Date, required:true, default:Date.now}, //시작날짜
    endDate: {type:Date, required:true, default:Date.now}, //종료날짜
    contract: {type:String, required:true/*, unique:true*/}, //컨트랙트주소
    id: {type:mongoose.Schema.Types.ObjectId, ref:'users'}
    //candidate: {type:String, required:true}
});
var Voting = mongoose.model('votings',votingSchema);

var userSchema = mongoose.Schema({
    id: {type:Number, required:true, unique:true}, //학번
    account: {type:String, required:true, unique:true} //계좌주소
});
var User = mongoose.model('users',userSchema);

app.set("view engine", 'ejs');
app.use(express.static(path.join(__dirname + '/public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(flash());
app.use(session({secret:'Secret'}));
app.use(passport.initialize());
app.use(passport.session());

//app.use('/',require('./routes/login'));
//app.use('/user',require('./routes/user'));
//app.use('/admin',require('./routes/admin'));

passport.serializeUser(function (user,done){
    done(null,user._id);
});
passport.deserializeUser(function (_id,done){
   User.findById(_id, function (err,user){
      done(err,user); 
   }); 
});

var LocalStrategy = require('passport-local').Strategy;
passport.use('local-login',
    new LocalStrategy({
        usernameField: 'id',
        passwordField: 'password',
        passReqToCallback: true
    },
    function (req,id,password,done){
        User.findOne({'id':id},function (err,user){
            //console.log(req.body.password);
            
            if(err) return done(err);
            
            if(!user){
                req.flash("id", req.body.id);
                return done(null,false,req.flash('loginError','등록되지 않은 회원입니다!'));
            }
            web3.eth.personal.unlockAccount(user.account, req.body.password).then(function (){
                return done(null,user);
            }, function (){
                req.flash("id", req.body.id);
                return done(null,false,req.flash('loginError','비밀번호를 확인해주세요!'));
            });
        });
    }
));

app.get('/partials/header', isLoggedIn, function (req,res){
    res.render('partials/header',{user:user})
});

app.get('/', function (req,res){
   res.redirect('/index'); 
});

app.get('/index', function (req,res){
    res.render('index',{id:req.flash("id")[0], loginError:req.flash('loginError')})
});

app.post('/index',
    function (req,res,next){
        req.flash("id");
        if(req.body.id.length === 0 || req.body.password.length === 0){
            req.flash("id", req.body.id);
            req.flash('loginError','아이디와 비밀번호를 모두 입력해주세요!');
            res.redirect('index');
        } else {
            next();
        }
    }, passport.authenticate('local-login',{
        failureRedirect: '/index',
        failureFlash: true
    }), function(req,res,votings) {
            Voting.find({},function (err,votings){
                if(err) return res.json({success:false, message:err});
                
                if (req.user.account === web3.eth.accounts[0]) 
                    res.redirect("admin/lists");
                else 
                    res.redirect("user/lists");
            });
        }
);

app.get('/logout', function (req,res){
    req.logout();
    res.redirect('/');
});

app.get('/register', function (req,res){
    res.render('register',{
      id: req.flash("id")[0],
      password: req.flash("password")[0],
      idError: req.flash('idError')[0]
   }); 
});

app.post('/register', checkUserRegValidation, function (req,res,next){
    var id = req.body.user.id;
    var password = req.body.user.password;
    //console.log(password);
    //var account = web3.eth.accounts.create().address;

    web3.eth.personal.newAccount(password).then(function (account){
        return account;
    }).then(function (account){
        // web3.eth.personal.sign(id,account,password).then(console.log);
        var user = new User({'id':id, 'account':account.toString(16)});
        user.save(function(err,silence){
            if(err){
                res.send(err);
                return;
            }
            res.redirect('index');
        })
    });
});

function checkUserRegValidation (req,res,next){
    var isValid = true;
    
    async.waterfall(
    [function (callback){
        User.findOne({'id': req.body.user.id, '_id': {$ne: mongoose.Types.ObjectId(req.params.id)}},
            function (err,user){
                if(user){
                    isValid = false;
                    req.flash("idError","이미 등록된 회원입니다.");
                }
                callback(null, isValid);
        });
    }], function(err,isValid){
        if(err) return res.json({success:false, message:err});
        if(isValid){
            return next();
        } else {
            req.flash("formData", req.body.user.id);
            res.redirect("back");
        }
    });
}

function isLoggedIn(req,res,next) {
  if (req.isAuthenticated()){
    return next();
  }
  res.redirect('/',{});
}

app.get('/user/lists', isLoggedIn, function (req,res){
    var page = Math.max(1,req.query.page);
    var limit = 4;
    var skip = (page-1)*limit;
    
    var temp1 = parseInt(req.user.id/1000, 10);
    var temp2 = parseInt(temp1/100, 10)*100;
    var departmentCheck = temp1-temp2;
    
    if(departmentCheck == 01) {
        Voting.find({$or:[{'category':'총학생회'}, {'college':'인문과학대학'}, {'department':'국어국문학과'}]}).populate('id').sort('-startDate').skip(skip).limit(limit).exec(function (err,voting,user){
            if(err) return res.json({success:false, message:err});
                
            Voting.count({$or:[{'category':'총학생회'}, {'college':'인문과학대학'}, {'department':'국어국문학과'}]}, function (err,count){
                if(err) return res.json({success:false, message:err});
                    
                var maxPage = Math.ceil(count/limit);
                res.render("user/lists", {data:voting, user:req.user, maxPage:maxPage, page:page});
            });
        });
    }
    
    if(departmentCheck == 15) {
        Voting.find({$or:[{'category':'총학생회'}, {'college':'엘텍공과대학'}, {'department':'컴퓨터공학과'}]}).populate('id').sort('-startDate').skip(skip).limit(limit).exec(function (err,voting,user){
            if(err) return res.json({success:false, message:err});
                
            Voting.count({$or:[{'category':'총학생회'}, {'college':'엘텍공과대학'}, {'department':'컴퓨터공학과'}]}, function (err,count){
                if(err) return res.json({success:false, message:err});
                    
                var maxPage = Math.ceil(count/limit);
                res.render("user/lists", {data:voting, user:req.user, maxPage:maxPage, page:page});
            });
        });
    }
});

app.get('/user/lists/:id', isLoggedIn, function (req,res){
   Voting.findById(req.params.id, function (err,votings,user){
        if(err) return res.json({success:false, message:err});
        res.render('user/voting', {data:votings, user:req.user});
   });
});

app.get('/user/voting/:id', isLoggedIn, function (req,res){
    Voting.findById(req.params.id, function (err,votings,user){
        if(err) return res.json({success:false, message:err});
        res.render('user/done', {data:votings, user:req.user});
   });
});

app.get('/user/result/:id', isLoggedIn, function (req,res){
    Voting.findById(req.params.id, function (err,votings,user){
        if(err) return res.json({success:false, message:err});
        res.render('user/result', {data:votings, user:req.user});
    });
});

app.get('/admin/lists', function (req,res){
    var page = Math.max(1,req.query.page);
    var limit = 4;
    Voting.count({},function (err,count){
        if(err) return res.json({success:false, message:err});
        var skip = (page-1)*limit;
        var maxPage = Math.ceil(count/limit);
        Voting.find({}).sort('-startDate').skip(skip).limit(limit).exec(function (err,votings){
            if(err) return res.json({success:false, message:err});
            res.render("admin/lists", {data:votings, user:req.user, maxPage:maxPage, page:page});
        });
    }); 
});

app.get('/admin/lists/:id', function (req,res) {
    Voting.findOneAndRemove({_id:req.params.id}, function (err,voting) {
        if(err) return res.json({success:false, message:arr});
        if(!voting) return res.json({success:false, message: "투표가 존재하지 않습니다!"});
        //alert("투표가 삭제되었습니다.");
        //res.send('<script type="text/javascript">alert("투표가 삭제되었습니다.");</script>');
        res.redirect('/admin/lists');
    });
});

app.get('/admin/open', function(req,res) {
    res.render('admin/open', {votingContract: votingContract});
});
  
app.post('/open', function (req,res) {
    var temp = req.body.voting.candidate
    // var candidate = []
    // if (typeof temp == 'string') {
    //     candidate.push(temp);
    // } else {
    //     candidate = temp
    // }

    var vote

    web3.eth.getAccounts().then(function (account) {
        votingContract.deploy({
            data: '0x6060604052341561000f57600080fd5b6040516104c53803806104c5833981016040528080518201919050508060019080519060200190610041929190610048565b50506100c0565b82805482825590600052602060002090810192821561008a579160200282015b82811115610089578251829060001916905591602001919060010190610068565b5b509050610097919061009b565b5090565b6100bd91905b808211156100b95760008160009055506001016100a1565b5090565b90565b6103f6806100cf6000396000f300606060405260043610610078576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff1680632f265cf71461007d578063392e6678146100be5780637021939f146100fd578063b13c744b1461013e578063cc9ab2671461017d578063fdbc4006146101a4575b600080fd5b341561008857600080fd5b6100a260048080356000191690602001909190505061020e565b604051808260ff1660ff16815260200191505060405180910390f35b34156100c957600080fd5b6100e3600480803560001916906020019091905050610253565b604051808215151515815260200191505060405180910390f35b341561010857600080fd5b6101226004808035600019169060200190919050506102b3565b604051808260ff1660ff16815260200191505060405180910390f35b341561014957600080fd5b61015f60048080359060200190919050506102d3565b60405180826000191660001916815260200191505060405180910390f35b341561018857600080fd5b6101a26004808035600019169060200190919050506102f7565b005b34156101af57600080fd5b6101b7610354565b6040518080602001828103825283818151815260200191508051906020019060200280838360005b838110156101fa5780820151818401526020810190506101df565b505050509050019250505060405180910390f35b600061021982610253565b151561022457600080fd5b600080836000191660001916815260200190815260200160002060009054906101000a900460ff169050919050565b600080600090505b6001805490508110156102a857826000191660018281548110151561027c57fe5b90600052602060002090015460001916141561029b57600191506102ad565b808060010191505061025b565b600091505b50919050565b60006020528060005260406000206000915054906101000a900460ff1681565b6001818154811015156102e257fe5b90600052602060002090016000915090505481565b61030081610253565b151561030b57600080fd5b6001600080836000191660001916815260200190815260200160002060008282829054906101000a900460ff160192506101000a81548160ff021916908360ff16021790555050565b61035c6103b6565b60018054806020026020016040519081016040528092919081815260200182805480156103ac57602002820191906000526020600020905b81546000191681526020019060010190808311610394575b5050505050905090565b6020604051908101604052806000815250905600a165627a7a723058206ad8eb50ac8f80aac813d853f6c1b0e8856c858cf4dbc0d5946124308cdae16a0029',
            arguments: [[web3.utils.asciiToHex(temp)]]
        }).send({
            from: account[0],
            gas: '4700000',
            gasPrice: '30000000000'
        }).then (function (contract) {
            if (typeof contract.options.address !== 'undefined') {
                vote = new Voting({
                    'round': req.body.voting.round,
                    'category': req.body.voting.category,
                    'college': req.body.voting.college,
                    'department': req.body.voting.department,
                    'startDate': req.body.voting.startDate,
                    'endDate': req.body.voting.endDate,
                    //'id': user.id,
                    'contract': contract.options.address
                });
                vote.save(function (err) {
                    if (err) {
                        res.send(err);
                        return;
                    }
                    res.redirect('admin/lists');
                });
            }
        });
    });
});

app.listen(3000, function (){
    console.log('Server On!');
});
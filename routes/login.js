var express  = require('express');
var router   = express.Router();
var mongoose = require('mongoose');
var passport = require('passport');

router.get('/', function (req,res) {
  res.redirect('index', {
    id:req.flash("id")[0],
    loginError:req.flash('loginError')
    //loginMessage:req.flash('loginMessage')
  });
});

router.post('/', passport.authenticate('local-login', {
  successRedirect : '/user/lists_user',
  failureRedirect : 'index',
  failureFlash : true
}));

router.get('/logout', function(req, res) {
  req.logout();
  req.flash("postsMessage", "Good-bye, have a nice day!");
  res.redirect('/');
});

module.exports = router;

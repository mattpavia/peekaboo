var njglobals = require('nunjucks/src/globals');
var socketio = require('socket.io');
var Message = require('../models/message');
var Group = require('../models/group');
var User = require('../models/user');

module.exports = function(app, server, passport) {

    app.all('*', function(req, res) {
        if (req.isAuthenticated()) {
            Group.find().or([{'user_1': req.user.fid}, {'user_2': req.user.fid}]).exec(function(err, groups) {
              console.log(groups);
              njglobals.groupList = groups;
            });
        }
    })

    var io = socketio.listen(server);
    var sockets = [];

    io.on('connection', function(socket) {
        sockets.push(socket);

        app.get('/group/:id', isLoggedIn, function(req, res) {
            socket.emit('fid', req.user.fid);
            
            Group.findOne({'id': req.param('id')}, function(err, g) {
                if (err) {
                    console.log(err);
                }
                if (g) {
                    if (g.user_1 === req.user.fid || g.user_2 === req.user.fid) {
                        res.render('group.html', {
                            title: 'Peekaboo',
                            group: g,
                            user: req.user
                        });
                    } else {
                        res.render('index.html', {
                            title: 'Peekaboo'
                        })
                    }
                } else {
                    res.render('error.html', {
                        group: req.param('id')
                    });
                }
            });
        });

        Message.find(function(err, msg) {
            msg.forEach(function(m) {
              socket.emit('message', m);
            });
        });

        socket.on('message', function(data) {
            var msg = new Message({'group': data.group, 'data': data.msg, 'sender': data.sender});
            msg.save(function(err) {
                if (err) {
                    console.error(err);
                    return;
                }
            });

            sockets.forEach(function(socket) {
                socket.emit('message', msg);
            });
        });

        socket.on('group', function(user_1) {
            var count = User.count({'fid' : { $ne : user_1 }});
            var rand = Math.floor(Math.random()*count);

            User.findOne({'fid' : { $ne : user_1 }}).limit(-1).skip(rand).exec(function (err, user) {

                var newGroup = new Group({'user_1' : user_1, 'user_2' : user.fid});
                newGroup.save(function(err) {
                    if (err) {
                        console.error(error);
                        return;
                    } else {
                        console.log(newGroup);
                    }
                });

            });

        })

        socket.on('disconnect', function() {
            sockets.splice(sockets.indexOf(socket), 1);
        });
    });

    app.get('/', function(req, res) {
        res.render('index.html', {
            title: 'Peekaboo'
        });
    });

    app.get('/login', passport.authenticate('facebook', { scope : 'email' }));

    // handle the callback after facebook has authenticated the user
    app.get('/login/callback', passport.authenticate('facebook', {
      successRedirect : '/',
      failureRedirect : '/login'
    }));

    // route for logging out
    app.get('/logout', function(req, res) {
      req.logout();
      res.redirect('/');
    });
}

function isLoggedIn(req, res, next) {

    // if user is authenticated in the session, carry on
    if (req.isAuthenticated())
        return next();

    // if they aren't redirect them to the home page
    res.redirect('/login');
}
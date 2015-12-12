var mongoModel = require("../models/mongoModel.js")
var bcrypt = require('bcrypt-nodejs');

exports.init = function(app){
    app.get('/', index);
    app.get('/content', content);
    app.post('/content/update', updateCount);
    app.get('/login', login);
    app.get('/logout', logout);
    app.get('/session', session);
    app.put('/users/new', newUser);
    app.get('/users/u', checkUser);
    app.get('/users/p', checkPassword);
    app.post('/users/update', updateUser);
    app.delete('/users/delete', deleteUser);
    app.put('/comments/new', newComment);
    app.get('/comments', getComment);
}

//TABLES
// Users: {username, email, password(encrypted)}
// Content: {contentId, type ('film' 'pic' 'music' 'news'), name, url, views, comments_count}
// Comments: {contentId, comment, username}

index = function(req, res){
    if (typeof req.session.user === 'undefined'){
        req.session.user = {};
    }
    res.render('index',{user:req.session.user});
}

content = function(req, res){
    mongoModel.retrieve('content', {}, function(data){
        data = shuffle(data);
        res.send(data);
    });
}

session = function(req, res){
    if (typeof req.session.user === 'undefined'){
        req.session.user = {};
    }
    res.send(req.session.user);
}

// Fisher-Yates Shuffle Algorithm taken from:
// http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}


login = function(req, res){
    mongoModel.retrieve('users', {username:req.query.username}, function(data){
        if (data.length){
        bcrypt.compare(req.query.password, data[0].password, function(err, rep){
            if (rep){
                req.session.user = data[0];
                index(req, res);
            }
        });
        }
        else{
            res.send(false);
        }
    });
}

logout = function(req, res){
    req.session.user = {};
    index(req, res);
}

newUser = function(req, res){
    mongoModel.retrieve('users', {username:req.body.username}, function(data){
        if (data.length){
            console.log("This user already exists");
        }
        else{
            bcrypt.hash(req.body.password, null, null, function(err, hash){
                var user = {username:req.body.username, email:req.body.email, password:hash};
                mongoModel.create('users', user, function(result){
                    if (result){
                        req.session.user = user;
                        index(req, res);
                    }
                });
            });
        }
    });
}

checkUser = function(req, res){
    mongoModel.retrieve('users', {username:req.query.username}, function(data){
        if (data.length){
            res.send(true);
        }
        else{
            res.send(false);
        }
    });
}

checkPassword = function(req, res){
    mongoModel.retrieve('users', {username:req.query.username}, function(data){
        bcrypt.compare(req.query.password, data[0].password, function(err, rep){
            if (rep){
                res.send(true);
            }
            else{
                res.send(false);
            }
        });
    });
}

updateUser = function(req, res){
    var filter = {"username": req.session.user.username};
    bcrypt.hash(req.body.newPassword, null, null, function(err, hash){
        var update = {"$set":{"password":hash}};
        mongoModel.update('users', filter, update, function(status){
            index(req, res);
        });
    });
}

updateCount = function(req, res){
    var filter = {"contentId": parseInt(req.body.contentId)};
    var update = {"$set":{"comments_count": req.body.newCount}};
    mongoModel.update('content', filter, update, function(status){
        res.send(true);
    });
}

deleteUser = function(req, res){
    var filter = {"username": req.session.user.username};
    mongoModel.delete('users', filter, function(status){
        req.session.user = {};
        index(req, res);
    });
}

newComment = function(req, res){
    var filter = {"contentId": req.body.contentId};
    if (typeof req.session.user.username === 'undefined'){
        var username = "Guest";
    }
    else{
        var username = req.session.user.username;
    }
    var comment = {"contentId":req.body.contentId, "comment":req.body.comment, "username":username};
    mongoModel.create('comments', comment, function(result){
        console.log("COMMENT ADDED");
        res.send(result);
    });
}

getComment = function(req, res){
    mongoModel.retrieve('comments', {'contentId':req.query.contentId}, function(data){
        res.send(data);
    });
}
                      
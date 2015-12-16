var mongoModel = require("../models/mongoModel.js")
var bcrypt = require('bcrypt-nodejs');

// All of the required routes
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
    app.post('/users/addFavorite', addFavorite);
    app.get('/users/favoriteIds', favoriteIds);
    app.delete('/users/delete', deleteUser);
    app.put('/comments/new', newComment);
    app.get('/comments', getComment);
}

//TABLES
// Users: {username, email, password(encrypted), favorites}
// Content: {contentId, type ('film' 'pic' 'music' 'news'), name, url, views, comments_count}
// Comments: {contentId, comment, username}

// Takes a user to the main page
index = function(req, res){
    if (typeof req.session.user === 'undefined'){
        req.session.user = {};
    }
    res.render('index',{user:req.session.user});
}

// Returns all of the content in the database
content = function(req, res){
    mongoModel.retrieve('content', {}, function(data){
        data = shuffle(data);
        res.send(data);
    });
}

// Returns the current active user
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

// Logs into the system
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

// Logs out of the system
logout = function(req, res){
    req.session.user = {};
    index(req, res);
}

// Creates a new user
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

// Checks if the user is in the system
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

// Checks if the password is correct for the user
checkPassword = function(req, res){
    mongoModel.retrieve('users', {username:req.query.username}, function(data){
        if (data[0]){
            bcrypt.compare(req.query.password, data[0].password, function(err, rep){
                if (rep){
                    res.send(true);
                }
                else{
                    res.send(false);
                }
            });
        }
    });
}

// Updates the password for the user
updateUser = function(req, res){
    var filter = {"username": req.session.user.username};
    bcrypt.hash(req.body.newPassword, null, null, function(err, hash){
        var update = {"$set":{"password":hash}};
        mongoModel.update('users', filter, update, function(status){
            index(req, res);
        });
    });
}

addFavorite = function(req, res){
    var filter = {"username": req.session.user.username};
    mongoModel.retrieve('users', {username:req.session.user.username}, function(data){
        if (typeof data[0].favorites === 'undefined'){
            var favorites = [];
        }
        else{
            var favorites = data[0].favorites;
        }
        mongoModel.retrieve('content', {"name": req.body.name}, function(data){
            var i = indexOf(favorites, data[0]);
            if (i == -1){
                favorites.push(data[0]);
            }
            else{
                favorites.splice(i, 1);
            }
            var update = {"$set":{"favorites":favorites}};
            mongoModel.update('users', filter, update, function(status){
                console.log(favorites);
                res.send(true);
            });
        });
    });
}

favoriteIds = function(req, res){
    var filter = {"username": req.session.user.username};
    mongoModel.retrieve('users', {username:req.session.user.username}, function(data){
        if (data[0] && typeof data[0].favorites !== 'undefined'){
            var favoriteIds = [];
            for (var i = 0; i < data[0].favorites.length; i++){
                favoriteIds.push(data[0].favorites[i].name);
            }
            res.send(favoriteIds);
        }
        else{
            res.send([]);
        }
    });
}

function indexOf(array, item){
    for (var j = 0; j < array.length; j++){
        if (array[j].name == item.name){
            return j;
        }
    }
    return -1;
}

// Updates the comments count of a content item
updateCount = function(req, res){
    var filter = {"contentId": parseInt(req.body.contentId)};
    var update = {"$set":{"comments_count": req.body.newCount}};
    mongoModel.update('content', filter, update, function(status){
        res.send(true);
    });
}

// Deletes a user from the system
deleteUser = function(req, res){
    var filter = {"username": req.session.user.username};
    mongoModel.delete('users', filter, function(status){
        req.session.user = {};
        index(req, res);
    });
}

// Adds a new comment to the system
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

// Returns all comments for a content item
getComment = function(req, res){
    mongoModel.retrieve('comments', {'contentId':req.query.contentId}, function(data){
        res.send(data);
    });
}
                      
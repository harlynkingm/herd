var querystring = require('querystring');
var https = require('https');
var parseString = require('xml2js').parseString;
var mongoClient = require('mongodb').MongoClient;
var connection_string = 'localhost:27017/herd';

if(process.env.OPENSHIFT_MONGODB_DB_PASSWORD){
  connection_string = process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
  process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
  process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
  process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
  process.env.OPENSHIFT_APP_NAME;
}
// Global variable of the connected database
var mongoDB;

// Creates server then sets to reset every 15 minutes
mongoClient.connect('mongodb://'+connection_string, function(err, db){
    if (err) doError(err);
    console.log("Connected to MongoDB server at: "+connection_string);
    mongoDB = db;
    resetData();
    setInterval(function(){ resetData()}, 1000 * 60 * 15);
});

// Resets the data in the system by pulling from API's
resetData = function(){
    mongoDB.collection('content').deleteMany({}, function(err, status){
        console.log("CONTENT CLEARED");
        insertData();
    });
    mongoDB.collection('comments').deleteMany({}, function(err, status){
        console.log("COMMENTS CLEARED");
    });
}

// Inserts all of the data into the database by calling API's
insertData = function(){
    var oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    getYoutubeVideos(30);
    getImgurPictures(60, 0);
    getSoundcloudSongs(10);
    getHypemachineSongs(25);
    getGoogleSearches();
}

// Returns a YouTube query of the most popular videos
getYoutubeVideos = function(quantity){
    performRequest("www.googleapis.com", "/youtube/v3/videos", "GET", {
        part: "snippet,statistics",
        key : "AIzaSyDEh4wbcH2c5RjsMByHgi_iSAsiIcdjwLY",
        chart: "mostPopular",
        maxResults: quantity
    }, {}, function(data){
        var vidEntry = [];
        for (var i = 0; i < data.items.length; i++){
            var url = 'https://www.youtube.com/embed/'+data.items[i].id;
            var obj = {contentId: i, type:'film', name:data.items[i].snippet.title, url: url, views: data.items[i].statistics.viewCount, comments_count:0};
            vidEntry.push(obj);
        }
        mongoDB.collection('content').insertMany(vidEntry, function(err, status){
            console.log(vidEntry.length + " VIDEOS INSERTED");
        });
    });
}

// Returns any number of popular Imgur pictures
getImgurPictures = function(quantity, page){
    performRequest("api.imgur.com", "/3/gallery/hot/viral/" + page + ".json", "GET", {}, {
        Authorization: "Client-ID 708faef2aabcf69"
    }, function(data){
        var imgEntry = [];
        for (var i = 0; i < data.data.length; i++){
            if (data.data[i].is_album == false){
                if (data.data[i].type === "image/gif"){
                    var url = data.data[i].mp4;
                }
                else{
                    var url = data.data[i].link;
                }
                var obj = {contentId: i + 100, type:'pic', name:data.data[i].title, url:url, views: data.data[i].views, comments_count:0};
                if (quantity > 0){
                    imgEntry.push(obj);
                    quantity--;
                }
            }
        }
        mongoDB.collection('content').insertMany(imgEntry, function(err, status){
            if (quantity > 0){
                getImgurPictures(quantity, page + 1);
            }
            console.log(imgEntry.length + " PICS INSERTED");
        });
    });
}

// Returns the most popular SoundCloud songs
getSoundcloudSongs = function(quantity){
    performRequest("api-v2.soundcloud.com", "/explore/Popular+Music", "GET", {
        client_id: "73de154679452e296b7781a98ca928c0",
        limit: quantity
    }, {}, function(data){
        var musicEntry = [];
        for (var i = 0; i < data.tracks.length; i++){
            var url = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/" + data.tracks[i].id + "&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true";
            var obj = {contentId: i + 1000, type:'music', name:data.tracks[i].title, url:url, views: data.tracks[i].playback_count, comments_count:0};
            musicEntry.push(obj);
        }
        mongoDB.collection('content').insertMany(musicEntry, function(err, status){
            console.log(musicEntry.length + " SONGS INSERTED");
        });
    });
}

// Gets the currently most popular songs on hype machine
getHypemachineSongs = function(quantity){
    performRequest("api.hypem.com", "/v2/popular", "GET", {
        mode: 'now',
        page: 1,
        count: quantity,
        key: 'swagger'
    }, {}, function(data){
        var titles = [];
        for (var i = 0; i < data.length; i++){
            var song = {};
            song.title = data[i].title;
            song.artist = data[i].artist;
            titles.push(song);
        }
        findSoundcloudSongs(titles);
        console.log(titles.length + " HYPEM SONGS INSERTED");
    });
}

// Using a list of song titles and artists, finds the songs in SoundCloud
findSoundcloudSongs = function(songs){
    for (var i = 0; i < songs.length; i++){
        performRequest("api.soundcloud.com", "/tracks", "GET", {
            client_id: "73de154679452e296b7781a98ca928c0",
            q: songs[i].title + " " + songs[i].artist
        }, {}, function(data){
            if (data[0]){
                var url = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/" + data[0].id + "&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true";
                var obj = {contentId: data[0].id, type:'music', name:data[0].title, url:url, views: data[0].playback_count, comments_count:0};
                mongoDB.collection('content').insertOne(obj, function(err, status){
                });
            }
        });
    }
}

// Gets the currently most popular Google searches
getGoogleSearches = function(){
    performRequest("www.google.com", "/trends/hottrends/atom/feed", "GET", {
        pn: "p1"
    }, {}, function(data){
        var newsEntry = [];
        var list = data.rss.channel[0].item;
        for (var i = 0; i < list.length; i++){
            var viewCount = parseInt(list[i]['ht:approx_traffic'][0].replace(/\D/g,''));
            var url = '<a href="' + list[i]['ht:news_item'][0]['ht:news_item_url'] + '"target="_blank">' + list[i]['ht:news_item'][0]['ht:news_item_title'] + '</a>';
            var obj = {contentId: i + 10000, type:'news', name:'Trending Search: '+list[i].title[0], url:url, views: viewCount, comments_count:0};
            newsEntry.push(obj);
        }
        mongoDB.collection('content').insertMany(newsEntry, function(err, status){
            console.log(newsEntry.length + " TRENDING SEARCHES INSERTED");
        });
    });
}

// Creates a document in the database
exports.create = function(collection, data, callback) {
  mongoDB.collection(collection).insertOne(data, function(err, status) {
      if (err) doError(err);
      var success = (status.result.n == 1 ? true : false);
      callback(success);
    });
}

// Retrieves a document from the database
exports.retrieve = function(collection, query, callback) {
  mongoDB.collection(collection).find(query).toArray(function(err, docs) {
    if (err) doError(err);
    callback(docs);
  });
}

// Updates a document in the database
exports.update = function(collection, filter, update, callback) {
  mongoDB.collection(collection).updateMany(
      filter, update, {upsert:false},function(err, status) {
        if (err) doError(err);
        callback('Modified '+ status.modifiedCount 
                 +' and added '+ status.upsertedCount+" documents");
    });
}

// Deletes an item from the database
exports.delete = function(collection, query, callback){
    console.log(query);
    mongoDB.collection(collection)
    .deleteMany(query, function(err, status){
        if (err) doError(err);
        callback('Deleted ' + status.result.n + ' items');
    });
}

// Throws an error in the system if something goes wrong
var doError = function(e) {
        console.error("ERROR: " + e);
        throw new Error(e);
    }

// Serverside request code taken from:
// http://rapiddg.com/blog/calling-rest-api-nodejs-script
function performRequest(host, endpoint, method, data, headers, success) {
  var dataString = JSON.stringify(data);
  
  if (method == 'GET') {
    endpoint += '?' + querystring.stringify(data);
  }
  else {
    headers = {
      'Content-Type': 'application/json',
      'Content-Length': dataString.length
    };
  }
  var options = {
    host: host,
    path: endpoint,
    method: method,
    headers: headers
  };

  var req = https.request(options, function(res) {
    res.setEncoding('utf-8');

    var responseString = '';

    res.on('data', function(data) {
      responseString += data;
    });

    res.on('end', function() {
//      console.log(responseString);
      try{
        var responseObject = JSON.parse(responseString);
        success(responseObject);
      } catch(err) {
        parseString(responseString, function(err, result){
            success(result);
        });
      }
    });
  });

  req.write(dataString);
  req.end();
}
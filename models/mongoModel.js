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

mongoClient.connect('mongodb://'+connection_string, function(err, db){
    if (err) doError(err);
    console.log("Connected to MongoDB server at: "+connection_string);
    mongoDB = db;
    resetData();
    setInterval(function(){ resetData()}, 1000 * 60 * 15);
});

resetData = function(){
    mongoDB.collection('content').deleteMany({}, function(err, status){
        console.log("CONTENT CLEARED");
        insertData();
    });
    mongoDB.collection('comments').deleteMany({}, function(err, status){
        console.log("COMMENTS CLEARED");
    });
}

insertData = function(){
    var oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    performRequest("www.googleapis.com", "/youtube/v3/videos", "GET", {
        part: "snippet,statistics",
        key : "AIzaSyDEh4wbcH2c5RjsMByHgi_iSAsiIcdjwLY",
        chart: "mostPopular",
        maxResults: 30
    }, {}, function(data){
        var vidEntry = [];
        for (var i = 0; i < data.items.length; i++){
            var url = 'https://www.youtube.com/embed/'+data.items[i].id;
            var obj = {contentId: i, type:'film', name:data.items[i].snippet.title, url: url, views: data.items[i].statistics.viewCount, comments_count:0};
            vidEntry.push(obj);
        }
        mongoDB.collection('content').insertMany(vidEntry, function(err, status){
            console.log("VIDEOS INSERTED");
        });
    });
    performRequest("api.imgur.com", "/3/gallery/hot/viral/0.json", "GET", {}, {
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
                imgEntry.push(obj);
            }
        }
        mongoDB.collection('content').insertMany(imgEntry, function(err, status){
            console.log("PICS INSERTED");
        });
    });
    performRequest("api-v2.soundcloud.com", "/explore/Popular+Music", "GET", {
        client_id: "73de154679452e296b7781a98ca928c0",
        limit: 10
    }, {}, function(data){
        var musicEntry = [];
        for (var i = 0; i < data.tracks.length; i++){
            var url = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/" + data.tracks[i].id + "&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true";
            var obj = {contentId: i + 1000, type:'music', name:data.tracks[i].title, url:url, views: data.tracks[i].playback_count, comments_count:0};
            musicEntry.push(obj);
        }
        mongoDB.collection('content').insertMany(musicEntry, function(err, status){
            console.log("MUSIC INSERTED");
        });
    });
    performRequest("api.hypem.com", "/v2/popular", "GET", {
        mode: 'now',
        page: 1,
        count: 20,
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
    });
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
            console.log("TRENDING SEARCHES INSERTED");
        });
    });
}

findSoundcloudSongs = function(songs){
    var hypemEntry = [];
    counter = 0;
    for (var i = 0; i < songs.length; i++){
        performRequest("api.soundcloud.com", "/tracks", "GET", {
            client_id: "73de154679452e296b7781a98ca928c0",
            q: songs[i].title + " " + songs[i].artist
        }, {}, function(data){
            counter++;
            if (data[0]){
                var url = "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/" + data[0].id + "&amp;auto_play=false&amp;hide_related=false&amp;show_comments=true&amp;show_user=true&amp;show_reposts=false&amp;visual=true";
                var obj = {contentId: data[0].id, type:'music', name:data[0].title, url:url, views: data[0].playback_count, comments_count:0};
                hypemEntry.push(obj);
                console.log(counter);
                if (counter == songs.length - 1){
                    console.log("ASDFLKASHDJFLKAJDFLKASJDFKLAJSKFDJLASKJDFLAKJ");
                    mongoDB.collection('content').insertMany(hypemEntry, function(err, status){
                        console.log("HYPEM MUSIC INSERTED");
                    });
                }
            }
        });
    }
}

exports.create = function(collection, data, callback) {
  mongoDB.collection(collection).insertOne(data, function(err, status) {
      if (err) doError(err);
      var success = (status.result.n == 1 ? true : false);
      callback(success);
    });
}

exports.retrieve = function(collection, query, callback) {
  mongoDB.collection(collection).find(query).toArray(function(err, docs) {
    if (err) doError(err);
    callback(docs);
  });
}

exports.update = function(collection, filter, update, callback) {
  mongoDB.collection(collection).updateMany(
      filter, update, {upsert:false},function(err, status) {
        if (err) doError(err);
        callback('Modified '+ status.modifiedCount 
                 +' and added '+ status.upsertedCount+" documents");
    });
}

exports.delete = function(collection, query, callback){
    console.log(query);
    mongoDB.collection(collection)
    .deleteMany(query, function(err, status){
        if (err) doError(err);
        callback('Deleted ' + status.result.n + ' items');
    });
}

var doError = function(e) {
        console.error("ERROR: " + e);
        throw new Error(e);
    }

// Request code taken from:
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
$(document).ready(function() {
    // Local storage keeps track of three things
    // The filter is what types of items are currently being viewed by the user
    filter = ["#pic-card", "#film-card", "#music-card", "#news-card"];
    // Loaded is the number of items the user currently has displayed on the page
    var loaded = 0;
    // allData is a list of every item imported from the database
    // I did this so every user could have a randomized order of the items
    // If users got items from the database on each new load, they would not be random
    var allData = [];

    // This variable keeps track of whether items are currently being loaded
    var canLoad = true;
    
    // This variable keeps the card partial to save load times
    var cardPartial;
    
    // This variable keeps the card comments partial
    var cardCommentsPartial;
    
    // When a page is first loaded, all of the data is grabbed from the database
    // The data is returned in a random order and stored locally
    $.ajax({
        url: '/content',
        type: 'GET',
        success: function(data){
            allData = data;
            console.log(allData.length);
            getTemplate('/views/cardPartial.ejs', function(err, template){
                cardPartial = _.template(template);
                loadMore();
            });
            getTemplate('/views/cardCommentsPartial.ejs', function(err, template){
                cardCommentsPartial = _.template(template);
            });
        }
    });
    
    // Binds touchstart events to clicks
    var clickHandler = ('ontouchstart' in document.documentElement ? "touchstart" : "click");
    
    // The load more function loads 20 more items into the page from local storage
    // It uses templating to load in individual cards
    function loadMore(){
        canLoad = false;
        startLoaded = loaded;
        if (loaded < allData.length - 10) loaded += 10;
        else{
            loaded += (allData.length - loaded);
            $(".loading").hide();
            console.log("LOADED ALL");
        }
        for (var i = startLoaded; i < loaded; i++){
            var templ = cardPartial({card: allData[i]});
            var card_type = "#" + $(templ).attr('id');
            if (filter.indexOf(card_type) != -1){
                $(".content-container").append(templ);
            }
        }
        $(".content-container").css("height", "");
        canLoad = true;
    }
    
    // If a user is more than 60% down the length of the page, load more content
    $(window).scroll(function(){
        var percent = ($(window).scrollTop() / ($(document).height() - $(window).height()));
        if (canLoad && percent > .8 && loaded < allData.length) loadMore();
    });
    
    // This function retrieves templates from the server for local interpretation.
    // It was taken from:
    // http://serebrov.github.io/html/2012-08-20-expressjs-ejs-reuse-templates.html
    function getTemplate(file, callback) {
        $.ajax(file, {
            type: 'GET',
            success: function(data, textStatus, xhr) {
            return callback(null, data);
            },
            error: function(xhr, textStatus, error) {
            return callback(error);
            }
        });
    }
    
    // The login button in the header loads the login overlay
    $("#login").on(clickHandler, function(){
        $(".overlay").fadeIn(150);
        $("body").toggleClass("noscroll");
    });
    
    // When anything outside the center box is pressed, the login overlay fades
    $("body").on(clickHandler, ".overlay", function(){
        $(".overlay").fadeOut(150);
        $("body").toggleClass("noscroll");
    });
    
    // Similarly, when anything outside the content-box is pressed, the content overlay fades
    $("body").on(clickHandler, ".content-viewer", function(){
        $(".content-viewer").fadeOut(150);
        $("body").removeClass("noscroll");
    });
    
    // When a user is logged in and they click on their username
    // They are presented with user options
    $("#user-header").on(clickHandler, function(){
        $(".user-options").fadeIn(150);
        $("body").toggleClass("noscroll");
    });
    
    // When anything outside of the options box is pressed
    // The box fades away
    $(".user-options").on(clickHandler, function(){
        $(".user-options").fadeOut(150);
        $("body").removeClass("noscroll");
    });
    
    // Prevents clicks inside the box from closing the overlay
    $(".center-box").on(clickHandler, function(event){ 
        event.stopPropagation(); 
    });
    
    // Inside the login modal, when new member is pressed
    // Causes the registration form to show
    $("#new-member").on(clickHandler, function(){
        $("#login-form").hide();
        $("#register-form").show();
    });
    
    // Similarly, if returning user is pressed
    // Causes the login form to show
    $("#returning-member").on(clickHandler, function(){
        $("#register-form").hide();
        $("#login-form").show();
    });
    
    // When a comment button is clicked,
    // Comments are loaded into the page for that item
    $(".content-container").on(clickHandler, ".card-footer-stats", function(){
        var orig = $(this);
        $.ajax({
            url: '/session',
            type: 'GET',
            success: function(user){
                loadComments(orig, user, orig.parent().parent().data("id"));
            }
        });
    });
    
    // This function loads comments into the page by retrieving data
    // Item specifies the item that was clicked
    // User is the current user retrieved from the session
    // contentId is the id of the card to retrieve comments for
    function loadComments(item, user, contentId){
        var childCount = item.parent().children().length;
        $.ajax({
            url: '/comments',
            type: 'GET',
            data: {contentId: contentId},
            success: function(data){
                // If comments have already been added, remove them for reloading
                if (childCount != 1){
                    item.next().remove();
                }
                // Put together the template for comments
                var templ = cardCommentsPartial({comments: data, user: user});
                item.parent().append(templ);
                // Scroll the div to the bottom so the user is focused on their input box
                item.next()[0].scrollTop = item.next()[0].scrollHeight;
                item.next().toggleClass("slideUp");
                item.parent().toggleClass("movedUp");
            }
        });
    }
    
    // Reloads the comments for a card, so a user can get an updated stream
    function reloadComments(card, user){
        $.ajax({
            url: '/comments',
            type: 'GET',
            data: {contentId: card.data("id")},
            success: function(data){
                var templ = cardCommentsPartial({comments: data, user: user});
                templ = $(templ).children().not(".add-comment");
                if (templ.length){
                    card.children().last().children().last().children().not(".add-comment").remove();
                    card.children().last().children().last().prepend(templ);
                }
                card.children().last().children().last()[0].scrollTop = card.children().last().children().last()[0].scrollHeight;
                var count = card.children().last().children().first().children().last().children().first();
                count.html(data.length);
                updateCommentCount(card.data("id"), data.length);
            }
        });
    }
    
    function updateCommentCount(id, newCount){
        $.ajax({
            url: '/content/update',
            type: 'POST',
            data: {contentId: id, newCount: newCount},
            success: function(data){
            }
        });
    }
    
    $.ajax({
        url: '/session',
        type: 'GET',
        success: function(user){
            setInterval(function(){refreshComments(user)}, 3000);
        }
    });
    function refreshComments(user){
        var openCards = $(".content-container .movedUp");
        openCards.each(function(i, elem){
            var card = $(elem).parent();
            reloadComments(card, user);
        });
    }
    
    // Turns off or on the filter buttons
    // Also adds the filter to a list, then filters the items
    $(".header-icons").on(clickHandler, function(e){
        // Handles cases for currently grey buttons
        if ($(this).children().children().css("color") == "rgb(161, 161, 161)"){
            if ($(this).children().hasClass("pic")){
                $(this).children().children().css("color", "#70e453");
                filter.push("#pic-card");
            }
            else if ($(this).children().hasClass("film")){
                $(this).children().children().css("color", "#9D68FE");
                filter.push("#film-card");
            }
            else if ($(this).children().hasClass("music")){
                $(this).children().children().css("color", "#FE4B4B");
                filter.push("#music-card");
            }
            else if ($(this).children().hasClass("news")){
                $(this).children().children().css("color", "#62D7FF");
                filter.push("#news-card");
            }
        }
        // Handles colored button cases
        else{
            $(this).children().children().css("color", "rgb(161, 161, 161)");
            if ($(this).children().hasClass("pic")){
                filter.splice(filter.indexOf('#pic-card'), 1);
            }
            else if ($(this).children().hasClass("film")){
                filter.splice(filter.indexOf('#film-card'), 1);
            }
            else if ($(this).children().hasClass("music")){
                filter.splice(filter.indexOf('#music-card'), 1);
            }
            else if ($(this).children().hasClass("news")){
                filter.splice(filter.indexOf('#news-card'), 1);
            }
        }
        // Filters the items using a plugin called isotope
        $(".content-container").isotope({
            filter: filter.toString(), 
            percentPosition: true,
            transitionDuration: '0.0001s'
        });
        $(".content-container").css("height", "");
    });
    
    // Defines how content can be viewed larger based on content type
    // Then opens up the content
    $(".content-container").on("mousedown", ".card-head", function(){
        var type = $(this).parent().attr("id");
        switch(type){
            case ('pic-card'):
                if ($(this).next().children().is("div")){
                var url = $(this).next().children().css("background-image");
                url = url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
                var elem = $("<img/>",{
                    src: url,
                    style: "max-width:640px; min-width: 300px;max-height:480px;position:relative;left:50%;transform:translate(-50%)"
                });
                } else {
                var url = $(this).next().children().attr("src");
                var elem = $("<video/>",{
                    src: url,
                    style:"max-width:640px; min-width: 300px;max-height:480px;position:relative;left:50%;transform:translate(-50%)",
                    autoplay: true,
                    loop: true
                });
                }
                $(".content-box").empty().append(elem);
                $(".content-viewer").fadeIn(150);
                $("body").addClass("noscroll");
                break;
            case ('music-card'):
                var elem = $("<iframe/>",{
                    width:"100%",
                    height: "400px",
                    scrolling: "no",
                    frameborder: "no",
                    src: $(this).next().children().attr("src")
                });
                $(".content-box").empty().append(elem);
                $(".content-viewer").fadeIn(150);
                $("body").addClass("noscroll");
                break;
            case ('news-card'):
                var url = $(this).next().children().children().attr("href");
                window.open(url, '_blank');
                break;
            case ('film-card'):
                var elem = $("<iframe/>",{
                    style: "max-width:600px; min-width: 300px;position:relative;left:50%;transform:translate(-50%)",
                    width: "600px",
                    height: "400px",
                    frameborder: "0",
                    allowfullscreen: true,
                    src: $(this).next().children().attr("src")
                });
                $(".content-box").empty().append(elem);
                $(".content-viewer").fadeIn(150);
                $("body").addClass("noscroll");
                break;
        }
    });
    
    $(".content-container").on("touchstart", ".card-head", function(e){
        e.preventDefault();
    });
    
    $(".content-container").on("touchend", "#image-container", function(){
        var url = $(this).css("background-image");
        url = url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
        window.open(url, '_blank');
    });
    
    // Checks if the two password fields match
    $("#new-repeat-password-input").on("input", function(){
        var password = $("#new-password-input").val();
        var passwordRepeat = $("#new-repeat-password-input").val();
        // Sets a custom error message if they do not match
        if (password != passwordRepeat){
            $("#new-repeat-password-input").get(0).setCustomValidity("Passwords do not match!");
        }
        else{
            $("#new-repeat-password-input").get(0).setCustomValidity("");
        }
    });
    
    // Checks if the username is a real user in the database
    $("#username-input").on("focusout", function(){
        var username = $("#username-input").val();
        $.ajax({
            url: '/users/u',
            type: 'GET',
            data: {username: username},
            success: function(data){
                // Sets a custom error message if the user is not real
                if (data){
                    $("#username-input")[0].setCustomValidity("");
                }
                else{
                    $("#username-input")[0].setCustomValidity("Username does not exist!");
                }
            }
        });
    });
    
    // Checks if the password is the correct password for the user
    $("#password-input").on("focusout", function(){
        var username = $("#username-input").val();
        var password = $("#password-input").val();
        $.ajax({
            url: '/users/p',
            type: 'GET',
            data: {username: username, password: password},
            success: function(data){
                // Sets a custom error message if the password is not correct
                if (data){
                    $("#password-input")[0].setCustomValidity("");
                }
                else{
                    $("#password-input")[0].setCustomValidity("Password incorrect.");
                }
            }
        });
    });
    
    // Checks if the username for a new user is taken already
    $("#new-username-input").on("focusout", function(){
        var username = $("#new-username-input").val();
        $.ajax({
            url: '/users/u',
            type: 'GET',
            data: {username: username},
            success: function(data){
                // Custom error message
                if (data){
                    $("#new-username-input")[0].setCustomValidity("Username taken!");
                }
                else{
                    $("#new-username-input")[0].setCustomValidity("");
                }
            }
        });
    });
    
    // Submits a new user form
    $("#register-form").submit(function(e){
        e.preventDefault();
        var email = $("#new-email-input").val();
        var username = $("#new-username-input").val();
        var password = $("#new-password-input").val();
        var passwordRepeat = $("#new-repeat-password-input").val();
        $.ajax({
            url: '/users/new',
            type: 'PUT',
            data: {email: email, username: username, password: password},
            success: function(){
                window.location.assign("/");
            }
        });
    });
    
    // Logs a user in
    $("#login-form").submit(function(e){
        e.preventDefault();
        var username = $("#username-input").val();
        var password = $("#password-input").val();
        $.ajax({
            url: '/login',
            type: 'GET',
            data: {username: username, password: password},
            success: function(data){
                window.location.assign("/");
            }
        });
    });
    
    // Submits update password form
    $("#update-password").submit(function(e){
        e.preventDefault();
        var newPassword = $("#update-password-input").val();
        $.ajax({
            url: '/users/update',
            type: 'POST',
            data: {newPassword: newPassword},
            success: function(){
                window.location.assign("/");
            }
        });
    });
    
    // Deletes a user on button press
    $("#delete-user").on(clickHandler, function(e){
        e.preventDefault();
        $.ajax({
            url: '/users/delete',
            type: 'DELETE',
            success: function(){
                window.location.assign("/");
            }
        });
    });
    
    // Logs a user out of the system on button press
    $("#logout").on(clickHandler, function(e){
        $.ajax({
            url: '/logout',
            type: 'GET',
            success: function(){
                window.location.assign("/");
            }
        });
    });
    
    // Adds a comment and then refreshes the comment box so a user can see it
    $(".content-container").on("submit", "#add-comment", function(event){
        event.preventDefault();
        var id = $(this).parent().parent().parent().parent().data("id");
        var item = $(this);
        var comment = item.children().first().val();
        item.children().first().val("");
        $.ajax({
            url: '/comments/new',
            type: 'PUT',
            data: {contentId: id, comment: comment},
            success: function(){
                var card = item.parent().parent().parent().parent();
                $.ajax({
                    url: '/session',
                    type: 'GET',
                    success: function(user){
                        reloadComments(card, user);
                    }
                });
            }
        });
    });

});
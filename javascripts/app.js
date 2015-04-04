/*
* Redditate
* Copyright 2011, Dave Gamache
* www.redditate.com
* Free to use under the MIT license.
* http://www.opensource.org/licenses/mit-license.php
* 10/01/2011
*/

$(document).ready(function() {


  //Global Vars -----------------------------------------------------

  var posts = $('.posts'),
  afterString,
  subdomain = location.pathname.substr(1),
  loader = $('.wash'),
  loadMore = $('.loadmore-button'),
  activePost = 0,
  post,
  subredditHint = $('.subreddit-hint p'),
  hintIndex = 0,
  lock = false,
  commandDown = false,
  subredditShortcutJustLaunched = false,
  loadedPosts = [];


//Initial Load -------------------------------------------------------------------------------

  // If viewType cookied, set it
  if(localStorage.getItem("viewtype")) {
    $('body')
      .removeClass('fullview')
      .removeClass('listview')
      .addClass(localStorage.getItem("viewtype"));
  }

  //Initial JSON load
  loadJSON();

  //JSON -------------------------------------------------------------------------------

  // Load data
  function loadJSON() {
    $.getJSON("http://www.reddit.com/"+subdomain+".json?limit=25&after="+afterString+"&jsonp=?", null, function(data) {
      $.each(data.data.children, function(i, post) {
        //If the post wasn't loaded before, render it.
        if(loadedPosts.indexOf(post.data.id) < 0) renderPost(post.data);
        afterString = post.data.name;
        //Save the post id.
        loadedPosts.push(post.data.id);
      });
    }).complete(function() {
      post = $('.post');
      loader.fadeOut(100);
      loadMore.removeClass('loading');
      lock = false;
    });
  }

  $(window).scroll(function(){
    // Load more JSON from scroll
    if ($(window).scrollTop() >= $(document).height() - $(window).height() - 10){
      if(lock == false) {
        lock = true;
        loader.fadeIn(100);
        loadJSON();
      }
    }
    //Control activePost value based on scroll position
    if($(document).scrollTop() > (post.eq(activePost).offset().top-90)) {
      activePost++
    }
    if($(document).scrollTop() < (post.eq(activePost-1).offset().top-90)) {
      if(activePost-1 > 0) {
        activePost--
      }
    }
    // console.log("activePost: "+activePost+", documentScrollTop: "+$(document).scrollTop()+", activePost offset top: "+(post.eq(activePost).offset().top-90))
  });

  // Load more JSON from click (tablet/mobile)
  $('.loadmore-button').click(function() {
    if(lock == false) {
      loadMore.addClass('loading')
      loadJSON();
    }
  });

  //Rendering -------------------------------------------------------------------------------

  // Render Post with Handlebars
  function renderPost(postData) {
    var postHTML = postTemplate(postData);

    // If it's an imgur album make a request to the imgur API
    if (/imgur\.com\/(a|gallery)\//.test(postData.url)) {
      fetchImgurAlbum(postData);
    }

      posts.append(postHTML);

  }

  // hit the imgur API for some sweet json
  function fetchImgurAlbum(postData) {
    var pathArray = postData.url.split( '/' ),
        hash = pathArray[4],
        albumUrl = 'http://api.imgur.com/2/album/' + hash + '.json';

    $.getJSON(albumUrl, function(json, textStatus) {

      renderAlbum(postData, json);

    });

  }

  // render first image as a preview and store rest of src tags as data attributes
  function renderAlbum(postData, imgurAlbumData) {
    var albumHTML = imgurAlbumTemplate(imgurAlbumData.album);


    $('#' + postData.name).find('.embed').html(albumHTML);

    var $previewImage = $('#album-' + imgurAlbumData.album.cover).find('li:first-of-type img'),
        previewImageSrc = $previewImage.data('src');

    $previewImage.attr('src', previewImageSrc);

    // bind click event to first image to load rest of album
    $('#album-' + imgurAlbumData.album.cover).find('.open-album').bind('click', function(event) {

      event.preventDefault();

      $(this).parent('.open-album-wrapper').siblings('li').find('img').each(function(index) {

        $(this).attr('src', $(this).data('src'));

      });

      $(this).parents('.imgur-album').addClass('show-album');

    });
  }

  //Create readable title from ?r= subdomain value
  if(!subdomain == "") {
    var readableSubdomain = subdomain.replace("r/", "").replace(/\/$/, "");
    $('.logo .subreddit .title').text(readableSubdomain);
    document.title = "Redditate: "+readableSubdomain;
  }


  // Template Caches -------------------------------------------------------------------------------

  var postTemplate        = Handlebars.compile($("#postTemplate").html());
  var imgurAlbumTemplate  = Handlebars.compile($("#imgurAlbumTemplate").html());
  var imageTemplate       = Handlebars.compile($("#imageTemplate").html());
  var inlineVideoTemplate = Handlebars.compile($("#inlineVideoTemplate").html());
  var iframeVideoTemplate = Handlebars.compile($("#iframeVideoTemplate").html());

  // Template Helpers -------------------------------------------------------------------------------

  // MEDIA
  Handlebars.registerHelper('hasMedia', function(url, fn) {
    var id;

    // imgur gifv
    id = getGifvId(url);
    if (id) {
      return inlineVideoTemplate({url: 'http://i.imgur.com/'+id});
    }

    // single imgur
    if (/imgur*/.test(url)) {
      if(!isImage(url)) {
        url += ".jpg";
      }
      return imageTemplate({url: url});
    }

    // youtube
    id = getYoutubeId(url);
    if (id) {
      var youtubeLinkTime = url.split("#")[1];
      return iframeVideoTemplate({url: 'http://www.youtube.com/embed/'+id+'#'+youtubeLinkTime});
    }

    // quickmeme
    id = getQuickMemeId(url);
    if (id) {
      return imageTemplate({url: "http://i.qkme.me/" + id + ".jpg"});
    }

    // livememe
    id = getLiveMemeId(url);
    if (id) {
      return imageTemplate({url: "http://ai1.livememe.com/" +id + ".gif"});
    }

    return false;
  });

  // LISTVIEW THUMBNAIL: If thumb is real, render it
  Handlebars.registerHelper('hasThumbnail', function(thumbnail, url, fn) {
    if(thumbnail != "") {
      return '<a class="thumbnail-embed" href="'+url+'" target="_blank"><img src="'+thumbnail+'" alt="" /></a>';
    } else {
      return false;
    }
  });

  // Handlebars.registerHelper('isAlbum', function(url, fn) {
  //   // If it's an imgur album return false
  //   if (url.indexOf('imgur.com/a/') >= 0) {
  //     return ' (album)';
  //   }
  // });


  //Interactions -------------------------------------------------------------------------------

  // Toggling grid/list/full view
  $('.view-options a').click(function(e) {
    e.preventDefault();
    setupViewtype($(this));
  });

  // Open Subreddit Picker
  $('.subreddit').click(function(e) {
    e.preventDefault();
    openSubredditPicker();
  });
  $('.subreddit-close-button').click(function(e) {
    e.preventDefault();
    closeSubredditPicker();
  });
  $('.subreddit-heading').click(function(e) {
    e.preventDefault();
    closeSubredditPicker();
  });

  //Cycling hints
  subredditHint.eq(hintIndex).show();
  $('.down-carrot-wrapper').click(function() {
    subredditHint.hide();
    if(hintIndex < subredditHint.length-1) {
      hintIndex++
      subredditHint.eq(hintIndex).show();
    } else {
      hintIndex = 0;
      subredditHint.eq(hintIndex).show();
    }
  })

  // Keyboard interactions
  document.onkeydown = function(evt) {
    evt = evt || window.event;
    // Esc close of subreddit picker
    if(commandDown == false) {
      if (evt.keyCode == 27) {
        closeSubredditPicker();
        $('.subreddit-shortcut').removeClass('visible');
        $('.subreddit-input input').removeClass('visible')
      }
      // Command key fix
      if (evt.keyCode == 91) {
        commandDown = true;
      }
      if (!$('.subreddit-shortcut').hasClass('visible')) {
        // "J" goes to next post
        if (evt.keyCode == 74) {
          if(activePost == post.length-1) {
            $("html, body").attr({ scrollTop: $(document).height() });
          } else {
            var postScrollOffset = post.eq(activePost).offset();
            window.scrollTo(postScrollOffset.left, postScrollOffset.top - $('nav').height() - 10)
          }
        }
        // "K" goes to prev post
        if (evt.keyCode == 75) {
          if(activePost > 1) {
            var postScrollOffset = post.eq(activePost-2).offset();
            window.scrollTo(postScrollOffset.left, postScrollOffset.top - $('nav').height() - 10)
          }
        }
        // "F" changes to fullview
        if (evt.keyCode == 70) {
          setupViewtype($('a.fullview'));
        }
        // "L" changes to listview
        if (evt.keyCode == 76) {
          setupViewtype($('a.listview'));
        }
        // "Z" zooms on image in post if there is one
        if (evt.keyCode == 90) {
          resizeImage(post.eq(activePost-1).find('.embed'));
        }
        // "C" zooms on image in post if there is one
        if (evt.keyCode == 67) {
          var permalink = post.eq(activePost-1).find('.permalink').attr('href')
          window.open(permalink,'_newtab');
        }
        // "R" launches the subreddit prompt
        if (evt.keyCode == 82) {
          $('.subreddit-shortcut').addClass('visible')
          subredditShortcutJustLaunched = true;
        }
        // Enter opens to current post
        if (evt.keyCode == 13) {
          var postLink = post.eq(activePost-1).find('.post-title').attr('href');
          window.open(postLink,'_newtab');
        }
      }
    }
  };

  document.onkeyup = function(evt) {
    evt = evt || window.event;
    // Esc close of subreddit picker
    if (evt.keyCode == 91) {
      commandDown = false;
    }
    if (evt.keyCode == 82) {
      if(subredditShortcutJustLaunched) {
        $('.subreddit-input input')
          .val("")
          .addClass('visible')
          .focus();
        subredditShortcutJustLaunched = false;
      }
    }
  }

  $(window).blur(function() {
    commandDown = false;
  })

 $('.subreddit-input input').keydown(function(e){
  if(e.keyCode == 13) {
    e.preventDefault();
    window.location.href = "http://www." + window.location.hostname + "/r/" + $('.subreddit-input input').val();
  }
});


  //Utility Functions -------------------------------------------------------------------------------

  // Read URL to get params
  function readParams(name) {
    name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
    var regexS = "[\\?&]"+name+"=([^&#]*)";
    var regex = new RegExp( regexS );
    var results = regex.exec( window.location.href );
    if( results == null )
      return "";
    else
      return results[1];
  }

  //Determine is this is an image
  function isImage(str){
    return /\.(gif|jpe?g|png)$/i.test(str);
  }

  //convert url into pieces
  function parseLink (url) {
    var link = document.createElement('a');
    link.href = url;
    return link;
  }

  // get imgur gifv id
  // http://i.imgur.com/ybwxlhB.gifv
  function getGifvId (url) {
    var matched = url.match(/imgur.com\/([^.]+)[.]gifv/);
    return matched && matched[1];
  }

  // quickmeme
  function getQuickMemeId (url) {
    var matched = url.match(/(?:qkme\.me|quickmeme\.com\/meme)\/(\w*)/);
    return matched && matched[1];
  }

  // livememe
  function getLiveMemeId (url) {
    var matched = url.match(/(?:livememe\.com)\/(\w*)/);
    return matched && matched[1];
  }


  //get youtube video id
  function getYoutubeId (url) {
    var link = parseLink(url);
    if (/youtu\.be/.test(link.hostname)) { // http://youtu.be/333333333
      return link.pathname.substr(1);
    }
    if (/youtube\.com/.test(link.hostname)) {
      var matched = link.search.match(/[?&]v=([^&]+)/);
      if (matched) {
        return matched[1];
      }
      //https://www.youtube.com/embed/-1yrVYDhCLo?feature=oembed…
      matched = link.pathname.match(/embed\/([^\/?]+)/);
      if (matched) {
        return matched[1];
      }
    }
    return false;
  }

  //Set and cookie the viewType (fullview/listview)
  function setupViewtype(viewClick) {
    var activeClass = viewClick.data('viewtype');
    $('body')
      .removeClass('listview')
      .removeClass('fullview')
      .addClass(activeClass);
    if(activePost != 0) {
      window.scrollTo(0,post.eq(activePost-1).offset().top);
    } else {
      window.scrollTo(0,0);
    }
    localStorage.setItem("viewtype", activeClass);
  }

  // Open picker
  function openSubredditPicker() {
    $('body').addClass('subreddit-picker-open');
    $('.subreddit-picker').slideDown(250);
  }

  // Close picker
  function closeSubredditPicker() {
    $('body').removeClass('subreddit-picker-open');
    $('.subreddit-picker').slideUp(250);
  }

  //Spinner -------------------------------------------------------------------------------
  var optsWash = {
    width: 2 // The line thickness
  },
  optsButton = {
    width: 2, // The line thickness
    radius: 6,
    length: 4
  },
  targetWash = document.getElementById('loading'),
  targetButton = document.getElementById('spinner'),
  spinnerWash = new Spinner(optsWash).spin(targetWash),
  spinnerButton = new Spinner(optsButton).spin(targetButton);

});

// Image fullsize on click
$(document).on('click','.post .embed', function(e) {
  e.preventDefault();
  resizeImage($(this));
});

// Resize fullview inlined image
function resizeImage(clickTarget) {
  if(clickTarget.hasClass('fullwidth')) {
    // Determine if image is above offscreen and if so, make it at top of shrink
    var postParentPosition = clickTarget.offset();
    if(postParentPosition.top < $(window).scrollTop()) {
      window.scrollTo(postParentPosition.left, (postParentPosition.top - $('nav').height() - 10));
    }
  }
  // Toggle fullwidth class
  clickTarget.toggleClass('fullwidth');
}

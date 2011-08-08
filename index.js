var http        = require('http'),
    fs          = require('fs'),
    querystring = require('querystring'),
    crypto      = require('crypto');



// Simple function to decode a base64url encoded string.
function base64_url_decode(data) {
  return new Buffer(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('ascii');
}


// Wait for and parse POST data
function parse_post(req, callback) {
  var data = '';

  req.addListener('data', function(chunk) {
    data += chunk;
  });

  req.addListener('end', function() {
    callback(querystring.parse(data));
  });
}



// Uncomment this to catch all exceptions so the server doesn't crash.
//process.on('uncaughtException', function (err) {
//  console.log(err.stack);
//});



// Make sure we are in the correct working directory, otherwise fs.readFile('header.html' will fail.
if (process.cwd() != __dirname) {
  process.chdir(__dirname);
}



var contentTypes = {
  'js':  'text/javascript',
  'css': 'text/css'
};

var validFile = new RegExp('^\/[a-z]+\/[0-9a-z\-]*\.(js|css)$');



var server = http.createServer(function(req, res) {
  // Serve .js and .css files (files must be in a subdirectory so users can't access the javascript files for nodejs).
  if (validFile.test(req.url)) {
    // substr(1) to strip the leading /
    fs.readFile(req.url.substr(1), function(err, data) {
      if (err) {
        res.writeHead(404, {'Content-Type': 'text/plain'});
        res.end('File not found.');
      } else {
        var ext = req.url.substr(req.url.lastIndexOf('.') + 1);
          
        res.writeHead(200, {'Content-Type': contentTypes[ext]});
        res.end(data);
      }
    });

    return;
  }


  // Facebook always opens the canvas with a POST
  if (req.method != 'POST') {
    res.end('Error: No POST');
    return;
  }

  // Get the POST data.
  parse_post(req, function(data) {
    if (!data.signed_request) {
      res.end('Error: No signed_request');
      return;
    }
    
    // The data Facebook POSTs to use consists of one variable named signed_request that contains 2 strings concatinated using a .
    data = data.signed_request.split('.', 2);

    var facebook = JSON.parse(base64_url_decode(data[1])); // The second string is a base64url encoded json object

    if (!facebook.algorithm || (facebook.algorithm.toUpperCase() != 'HMAC-SHA256')) {
      res.end('Error: Unknown algorithm');
      return;
    }

    // Make sure the data posted is valid and comes from facebook.
    var signature = crypto.createHmac('sha256', 'YOUR APP SECRET HERE').update(data[1]).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace('=', '');

    if (data[0] != signature) {
      res.end('Error: Bad signature');
      return;
    }

    // Has the user authenticated our application?
    if (!facebook.user_id) {
      res.writeHead(200, {'Content-Type': 'text/html'});

      // Redirect the user to a page where he/sh can authenticated our application.
      // For this example we only request user_about_me permission.
      // See http://developers.facebook.com/docs/reference/api/permissions/ for other types of permissions.
      var url = 'http://www.facebook.com/dialog/oauth?client_id=YOUR APPLICATION ID HERE&redirect_uri=http://apps.facebook.com/nodeexample/&scope=user_about_me';

      res.end('<!DOCTYPE html><html><head><meta charset=utf-8><script>top.location.href="'+url+'";</script></head><body>You are being redirected to <a href="'+url+'" target="_top">'+url+'</a></body></html>');
    } else {
      res.writeHead(200, {'Content-Type': 'text/html'});

      fs.readFile('header.html', function(err, data) {
        res.write(data);

        // We are going to write the facebook token for this user to the page so it can be passed to our lobby server.
        // Since it is possible to run our lobby server on a different node instance we can't just store it in a global variable here.
        // We don't want others to be able to see and use the token so we crypt it
        var tokencrypt = crypto.createCipher('des-ecb', 'SOME RANDOM KEY HERE');

        // base64 encoding should be smaller but old nodejs versions bug with this (see https://github.com/joyent/node/commit/e357acc55b8126e1b8b78edcf4ac09dfa3217146)
        var token = tokencrypt.update(facebook.oauth_token, 'ascii', 'hex')+tokencrypt.final('hex');

        res.write('<script>var nfe = {facebookid: '+facebook.user_id+', facebooktoken : "'+token+'"};</script>');

        fs.readFile('body.html', function(err, data) {
          res.end(data);
        });
      });
    }
  });
});


server.listen(8081);


// In this example we run the lobby server on the same node instance using the same port.
// In theory we could also run this on a seperate node instance.
var lobby = require('./lobby');

lobby.start(server);


// Never let something run as root when it's not needed!
if (process.getuid() == 0) {
  process.setgid('www-data');
  process.setuid('www-data');
}


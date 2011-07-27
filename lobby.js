
var request = require('request'),
    io      = require('socket.io'),
    crypto  = require('crypto');



// Global users array (will contain all connected users).
var users    = {};
var nextuser = 1;



exports.start = function(server) {
  // If we would run this on it's own node instance this would be io.listen(<port number here>);
  var socket = io.listen(server); 

  // Set socket.io logging to normal (comment to get verbose logging).
  socket.set('log level', 1);
        
  socket.sockets.on('connection', function(client) {
    // Store the userid in the scope of this connection so we can use it later on.
    // Don't use the facebook userid for things since some people might not like it when their id is visible for others.
    var userid = nextuser++;

    client.on('message', function(data) {
      data = JSON.parse(data);

      // Some more error handling needs to be done here. Malformed requests (missing data.type for example) would be able to crash this part of the server.

      switch (data.type) {
        case 'connect': {
          // Decrypt the facebook user token.
          // Make sure to use the exact same key as in index.js!
          var tokencrypt = crypto.createDecipher('des-ecb', 'SOME RANDOM KEY HERE');
          var token      = tokencrypt.update(data.token, 'hex', 'ascii')+tokencrypt.final('ascii');

          // Send a newuser message for all existing users to the just connected user.
          for (id in users) {
            client.send(JSON.stringify({
              'type': 'newuser',
              'id'  : id,
              'name': users[id].name
            }));
          }

          // Use the facebook graph api to request the users information.
          request({uri: 'https://graph.facebook.com/'+data.id+'?access_token='+token}, function(error, response, body) {
            var facebook = JSON.parse(body);
            var name     = facebook.name || 'Unknown';

            console.log(name+' connected');

            // Store the user information (could store more information from the facebook object).
            users[userid] = {
              'client'       : client,
              'facebooktoken': token,
              'facebookid'   : data.id,
              'name'         : name
            };

            socket.sockets.send(JSON.stringify({
              'type': 'newuser',
              'id'  : userid,
              'name': name
            }));
          });

          break;
        }

        case 'poke': {
          // We recieved a poke request, send it to the correct user.
          if (users[data.to]) {
            users[data.to].client.send(JSON.stringify({
              'type': 'poke',
              'from': users[userid].name
            }));
          }

          break;
        }

        default: {
          console.log('Unknown message type:');
          console.dir(data);

          break;
        }
      }
    });

    client.on('disconnect', function() {
      if (users[userid]) {
        socket.sockets.send(JSON.stringify({
          'type': 'olduser',
          'id'  : userid
        }));

        delete users[userid];
      }
    });
  });
};


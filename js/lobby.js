  
$(document).ready(function() {
  var socket = io.connect('http://dubbelboer.com:8081'); // It is possible to run the lobby server on a different node instance on a different port.

  socket.on('connect', function() {
    // Send our information to the lobby server.
    // nfe is injected in the header by index.js.
    socket.send(JSON.stringify({
      'type' : 'connect',
      'id'   : nfe.facebookid,
      'token': nfe.facebooktoken
    }));
  });

  socket.on('message', function(data) {
    data = JSON.parse(data);

    switch (data.type) {
      // A new user just came online.
      case 'newuser': {
        var div = $('<div id="user'+data.id+'">'+data.name+'</div>').click(function() {
          // Send a poke message to the server when the user clicks this div.
          socket.send(JSON.stringify({
            'type': 'poke',
            'to'  : data.id
          }));
        });

        $('#users').append(div);

        break;
      }

      case 'olduser': {
        // Remove the div when a user goes offline.
        $('#user'+data.id).remove();

        break;
      }

      case 'poke': {
        // We just got poked.
        $('#pokes').prepend('<div>'+data.from+' poked you!</div>');

        break;
      }

      default: {
        console.log('Unknown message type:');
        console.dir(data);

        break;
      }
    }
  });

  socket.on('disconnect', function() {
    // Clear the users list when we go offline.
    $('#users').empty();
  });
});


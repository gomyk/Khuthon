
var conf = {
    port: 3000,
    debug: false,
    dbPort: 6379,
    dbHost: '127.0.0.1',
    dbOptions: {},
    WaitRoom: 'WaitRoom'
};

// External dependencies
var express = require('express'),
    http = require('http'),
    events = require('events'),
    _ = require('underscore'),
    sanitize = require('validator').sanitize
    cookieparser = require('cookie-parser');

// HTTP Server configuration & launch
var app = express(),
    server = http.createServer(app);
    server.listen(conf.port);

// Express app configuration
app.configure(function() {
    app.use(express.bodyParser());
    app.use(express.static(__dirname + '/static'));
});

var io = require('socket.io')(server);
var redis = require('socket.io-redis');
io.adapter(redis({ host: conf.dbHost, port: conf.dbPort }));

var db = require('redis').createClient(conf.dbPort,conf.dbHost);

// Logger configuration
var logger = new events.EventEmitter();
logger.on('newEvent', function(event, data) {
    // Console log
    console.log('%s: %s', event, JSON.stringify(data));
    // Persistent log storage too?
    // TODO
});

// ***************************************************************************
// Express routes helpers
// ***************************************************************************

// Only authenticated users should be able to use protected methods
var requireAuthentication = function(req, res, next) {
    // TODO
    next();
};

// Send a message to all active rooms
var sendBroadcast = function(text) {
    _.each(io.nsps['/'].adapter.rooms, function(sockets, room) {
        var message = {'room':room, 'username':'Admin', 'msg':text, 'date':new Date()};
        io.to(room).emit('newMessage', message);
    });
    logger.emit('newEvent', 'newBroadcastMessage', {'msg':text});
};

// ***************************************************************************
// Express routes
// ***************************************************************************

// Welcome message
app.get('/', function(req, res) {
    res.send(200, "Welcome to chat server");
});

// Broadcast message to all connected users
app.post('/api/broadcast/', requireAuthentication, function(req, res) {
    sendBroadcast(req.body.msg);
    res.send(201, "Message sent to all rooms");
});

// ***************************************************************************
// Socket.io events
// ***************************************************************************
var roomList = [];
var check = false;
var cur = 0;
var UserCount = 0;
io.sockets.on('connection', function(socket) {

    // Welcome message on connection
    socket.emit('connected', 'Welcome to the chat server');
    logger.emit('newEvent', 'userConnected', {'socket':socket.id});

    // Store user data in db
    db.hset([socket.id, 'connectionDate', new Date()], redis.print);
    db.hset([socket.id, 'socketID', socket.id], redis.print);
    db.hset([socket.id, 'username', 'anonymous'], redis.print);
    UserCount++;
    io.sockets.emit('updateMainBadge',{'num':UserCount});
    // Join user to 'WaitRoom'
    socket.join(conf.WaitRoom);
    logger.emit('newEvent', 'userJoinsRoom', {'socket':socket.id, 'room':conf.WaitRoom});
    // Confirm subscription to user
    socket.emit('subscriptionConfirmed', {'room':conf.WaitRoom});
    // Notify subscription to all users in room
    var data = {'room':conf.WaitRoom, 'username':'anonymous', 'msg':'----- Joined the room -----', 'id':socket.id};

    logger.emit('newEvent','data내용w전 : ',data.id);
  //  io.to(conf.WaitRoom).emit('userJoinsRoom', data);

    socket.on('new_join',function(data){
      logger.emit('newEvent','data내용 중: ',data.id);
        var cookieman = cookieparser.JSONCookies(data.nickname);
        var ustring = cookieman.substring(cookieman.indexOf(':')+1);
          data.username = ustring;
          if(ustring ==''){
            data = {'room':conf.WaitRoom, 'username':'anonymous', 'msg':'----- Joined the room -----', 'id':socket.id};
          io.sockets.emit('updateWaitUser', data);
          }
          else{
            db.hset([socket.id, 'username', ustring], redis.print);
          socket.emit('userNicknameUpdated',{room: conf.WaitRoom,oldUsername :'annoymous',newUsername: ustring,'id':data.id})
          logger.emit('newEvent','new_join','test');
          data = {'room':conf.WaitRoom, 'username':ustring, 'msg':'----- Joined the room -----', 'id':socket.id};
          io.to(conf.WaitRoom).emit('updateWaitUser', data);
          logger.emit('newEvent','data내용 후: ',data.id);
          }
          /////방새로다 추가
          socket.emit('roomsInChat', {'users':roomList});
    });
    // User wants to subscribe to [data.rooms]
    socket.on('subscribe', function(data) {
        // Get user info from db
        db.hget([socket.id, 'username'], function(err, username) {
          check = true;
          var check2 = true;
          var temp ;
            // Subscribe user to chosen rooms

              room = data.rooms;
                room = room.replace(" ","");

            console.log(check2,room);
            if(check2){
                socket.join(room);
              for(var i = 0;i<roomList.length;i++){
                if(roomList[i].name ==  room){
                  if(roomList[i].num == 0){
                      io.sockets.emit('roomListadded', {'name':room,'num':1,'id':roomList[i].id});
                      roomList[i].num++;
                      io.sockets.emit('updateBadge',{'name':roomList[i].name,'num':roomList[i].num,'id':roomList[i].id});
                      check = false;
                  }
                  else{
                    logger.emit('newEvent', '이미 있는 방입니다 ', {'방이름':room, '사람수':roomList[i].num});
                    roomList[i].num++;
                      io.sockets.emit('updateBadge',{'name':roomList[i].name,'num':UserCount,'id':roomList[i].id});

                      io.sockets.emit('updateNum',roomList[i].id);
                    check = false;
                  }
                }
                }

              var check3 = true;
              if(check){

                for(var i=0;i<cur;i++){
                  if(roomList[i].num == 0){
                    roomList[i].name = room;
                    roomList[i].id = i+1;
                    roomList[i].num++;
                      check3 = false;
                      i  = cur;
                      io.sockets.emit('roomListadded', {'name':room,'num':1,'id':roomList[i].id});
                  }
                }
                if(check3){
                  cur++;
                  roomList.push({name:room,num:1,id:cur});
                  io.sockets.emit('roomListadded', {'name':room,'num':1,'id':cur});

                }

                //socket.emit('roomListadded', {'name':room,'num':1,'id':cur});
              //  io.sockets.emit('roomsInChat', {'users':roomList});
              }
              // Confirm subscription to user
              socket.emit('subscriptionConfirmed', {'room': room});

              // Notify subscription to all users in room
              var message = {'room':room, 'username':username, 'msg':'----- Joined the room -----', 'id':socket.id};
              io.to(room).emit('userJoinsRoom', message);
              for(var i = 0;i<roomList.length;i++){
                  logger.emit('newEvent', '방 ', {'방이름':roomList[i].name, '사람수':roomList[i].num,'id':roomList[i].id});
              }
            }
        });

    });

    // User wants to unsubscribe from [data.rooms]
    socket.on('unsubscribe', function(data) {
        // Get user info from db
        db.hget([socket.id, 'username'], function(err, username) {

            // Unsubscribe user from chosen rooms
            _.each(data.rooms, function(room) {
                if (room != conf.WaitRoom) {
                    socket.leave(room);
                    logger.emit('newEvent', 'userLeavesRoom', {'socket':socket.id, 'username':username, 'room':room});
                  //  roomList[data.cur]--;
                    // Confirm unsubscription to user
                    socket.emit('unsubscriptionConfirmed', {'room': room});

                    // Notify unsubscription to all users in room
                    var message = {'room':room, 'username':username, 'msg':'----- Left the room -----', 'id': socket.id};
                    for(var i=0;i<cur;i++){
                      if(roomList[i].name == room){
                        roomList[i].num--;
                          io.sockets.emit('updateBadge',{'name':roomList[i].name,'num':roomList[i].num,'id':roomList[i].id});
                        if(roomList[i].num == 0){
                          io.sockets.emit('removeButton',roomList[i].id);
                        }
                      }
                    }
                    io.to(room).emit('userLeavesRoom', message);
                }
            });
        });
    });
    socket.on('unsubscribeWaitRoom',function(data){
      db.hget([socket.id, 'username'], function(err, username) {

          // Unsubscribe user from chosen rooms
          _.each(data.rooms, function(room) {
              if (room == conf.WaitRoom) {
                  socket.leave(room);
                  logger.emit('newEvent', 'userLeavesRoom', {'socket':socket.id, 'username':username, 'room':room});

                  // Confirm unsubscription to user
                  socket.emit('unsubscriptionConfirmed', {'room': room});

                  // Notify unsubscription to all users in room
                  var message = {'room':room, 'username':username, 'msg':'----- Left the room -----', 'id': socket.id};
                  io.to(room).emit('userLeavesRoom', message);
              }
          });
      });
    });
    // User wants to know what rooms he has joined
    socket.on('getRooms', function(data) {
        socket.emit('roomsReceived', socket.rooms);
        logger.emit('newEvent', 'userGetsRooms', {'socket':socket.id});
    });

    // Get users in given room
    socket.on('getUsersInRoom', function(data) {
        var usersInRoom = [];
        var socketsInRoom = _.keys(io.nsps['/'].adapter.rooms[data.room]);
        for (var i=0; i<socketsInRoom.length; i++) {
            db.hgetall(socketsInRoom[i], function(err, obj) {
                usersInRoom.push({'room':data.room, 'username':obj.username, 'id':obj.socketID});
                // When we've finished with the last one, notify user
                if (usersInRoom.length == socketsInRoom.length) {
                    socket.emit('usersInRoom', {'users':usersInRoom});
                }
            });
        }
    });

    // User wants to change his nickname


    // New message sent to group
    socket.on('newMessage', function(data) {
        db.hgetall(socket.id, function(err, obj) {
            if (err) return logger.emit('newEvent', 'error', err);
            // Check if user is subscribed to room before sending his message
            if (_.contains(_.values(socket.rooms), data.room)) {
                var message = {'room':data.room, 'username':obj.username, 'msg':data.msg, 'date':new Date()};
                // Send message to room
                io.to(data.room).emit('newMessage', message);
                logger.emit('newEvent', 'newMessage', message);
            }
        });
    });
    socket.on('setNickname', function(data) {
        // Get user info from db
        db.hget([socket.id, 'username'], function(err, username) {

            // Store user data in db
            db.hset([socket.id, 'username', data.username], redis.print);
            logger.emit('newEvent', 'userSetsNickname', {'socket':socket.id, 'oldUsername':username, 'newUsername':data.username});

            // Notify all users who belong to the same rooms that this one
            _.each(socket.rooms, function(room) {
                if (room) {
                    var info = {'room':room, 'oldUsername':username, 'newUsername':data.username, 'id':socket.id};
                    io.to(room).emit('userNicknameUpdated', info);
                }
            });
        });
    });
    // Clean up on disconnect
    socket.on('disconnect', function(data) {

        // Get current rooms of user
        var rooms = socket.rooms;

        // Get user info from db

        logger.emit('newEvent', '방떠난다', {'socket':socket.id});
        UserCount--;
        io.sockets.emit('updateMainBadge',{'num':UserCount});
        logger.emit('newEvent', '진짜 떠난다', {'socket':socket.id});
      //  socket.emit('unsubscribe_room',{'num':UserCount}); 성아 콜

        var message2 = {'room':'WaitRoom', 'id':socket.id};
        io.to('WaitRoom').emit('leaveuser', message2);

        socket.leave('WaitRoom');
        // Delete user from db
        db.del(socket.id, redis.print);
    });
    socket.on('check',function(data){
      logger.emit('newEvent','테스트:',{'roomname : ':data});
    });
});

// Automatic message generation (for testing purposes)
if (conf.debug) {
    setInterval(function() {
        var text = 'Testing rooms';
        sendBroadcast(text);
    }, 60000);
}

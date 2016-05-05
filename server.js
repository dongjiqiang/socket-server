var io = require('socket.io')(3000);
// 连接mongodb
var conf = require('./config.json');
var connect = require('./db').connect(conf.db.url, conf.db.options);

connect(function(db) {
    // Get the documents collection
    var collection = db.collection('mb_user');
    var socketid;
    var onlineCount = 0;

    // 更改登录状态
    function updateOnlineStat(username, stat) {
        collection.update({
            username: username
        }, {
            $set: {
                online_stat: stat
            }
        });
    }

    // 更改socketid
    function updateSocketId(username, socketid) {
        collection.update({
            username: username
        }, {
            $set: {
                socketID: socketid
            }
        });
    }

    // 每次重启服务器时,重置用户登录状态和socketid
    collection.find({}).toArray(function(err, docs) {
        for (var i = 0; i < docs.length; i++) {
            collection.update({
                username: docs[i].username
            }, {
                $set: {
                    online_stat: false,
                    socketID: ""
                }
            });
        }
    });

    io.on('connection', function(socket) {
        console.log("a user connection");
        socket.on('login', function(obj) {
            onlineCount++; //在线人数+1
            console.log(obj.username + "加入! 当前在线人数:" + onlineCount)
            socket.name = obj.username;
            updateSocketId(obj.username, socket.id);
        });

        // 客户端验证服务端是否启动
        socket.on('serverOnlineStat', function() {
            io.emit('serverOnlineStat', {
                isOnlineStat: true
            })
        })

        // 接收消息并发送给指定客户端
        socket.on('private message', function(obj) {
            console.dir(obj);
            collection.find({
                username: obj.username
            }).toArray(function(err, docs) {
                if (docs[0].online_stat) { //查询用户是否在线
                    socketid = docs[0].socketID;
                    io.sockets.connected[socketid].emit('private message', {
                        title: obj.title,
                        desc: obj.desc,
                        typeid: obj.typeid
                    });
                }
            });
        });

        // 推送给所有客户端
        socket.on('public message', function(obj) {
            io.emit('public message', {
                title: obj.title,
                desc: obj.desc,
                typeid: obj.typeid
            });
        });

        // 监测登录成功的用户退出
        socket.on('disconnect', function() {
            collection.find({
                username: socket.name
            }).toArray(function(err, docs) {
                try {
                    if (docs[0].online_stat) {
                        onlineCount--;
                        console.log(socket.name + "退出! 当前在线人数:" + onlineCount);
                        updateOnlineStat(socket.name, false);
                        updateSocketId(socket.name, "");
                    }
                } catch (e) {
                    // 异常处理
                }
            });
        });

        // 用户退出
        socket.on('exit', function(obj) {
            onlineCount--;
            console.log(obj.username + "退出! 当前在线人数:" + onlineCount);
        });
    });
});

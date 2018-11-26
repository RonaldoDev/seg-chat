const express = require('express')
const app = express()
const crypto = require('crypto');

const file = require("fs");
const crypto2 = require("crypto2");
//set the template engine ejs
app.set('view engine', 'ejs')
app.use(express.static('public'))


//routes
app.get('/', (req, res) => {
	res.render('index')
})
server = app.listen(3000)
const ioConn = require("socket.io-client");
const io = require("socket.io")(server)


const alice = crypto.createDiffieHellman(2048);
const aliceKey = alice.generateKeys();
var socketSender = ioConn.connect('http://localhost:3003');

//listen on every connection
io.on('connection', (socket) => {
	console.log('New user connected')
    // const pk = file.readFileSync('./prk')
	//default username
	socket.username = "Alice"
    socket.on('dh', (data) => {
        bob = crypto.createDiffieHellman(data.alice.getPrime(), data.alice.getGenerator());
        const bobKeys = bob.generateKeys();
    });
    //listen on change_username
    socket.on('auth', (data) => {
        file.readFile('./pbkB', 'utf8', async (err, content) => {
            const message = await crypto2.encrypt.rsa({ 
                username: data.username,
                nonce: [crypto.randomBytes(12)]
            }, content);
            socketSender.emit("auth", { payload: message });
        })
        socket.username = data.username
    });
    socket.on('auth-1', (data) => {
        file.readFile('./pbkB', 'utf8', async (err, content) => {
            const prk = file.readFileSync('./prk', 'utf8');
            const message = await crypto2.decrypt.rsa(data.payload, prk);
            const payload = JSON.parse(message);
            const verification = await crypto2.encrypt.rsa({ 
                username: data.username,
                nonce: payload.nonce[1]
            }, content);
            socketSender.emit("auth-2", { payload: verification });
        })
        socket.username = data.username
    });
    //listen on new_message
    socket.on('new_message', (data) => {
        //broadcast the new message
        io.sockets.emit('new_message', {message : data.message, username : socket.username});
        socketSender.emit('new message', {message : data.message, username : socket.username})
    });

    //listen on typing
    socket.on('typing', (data) => {
    	socket.broadcast.emit('typing', {username : socket.username})
    })
})

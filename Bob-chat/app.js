const express = require('express')
const app = express();
const file = require("fs");
const crypto = require("crypto");
const crypto2 = require("crypto2");
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.get('/', (req, res) => {
	res.render('index');
});


server = app.listen(3003)
const ioConn = require("socket.io-client");
const io = require("socket.io")(server);
var socketSender = ioConn.connect('http://localhost:3000');

//listen on every connection
io.on('connection', (socket) => {
    console.log('New user connected')
    let bob = {};

	//default username
	socket.username = "Bob"
    socket.on('dh', (data) => {
        bob = crypto.createDiffieHellman(data.alice.getPrime(), data.alice.getGenerator());
        const bobKeys = bob.generateKeys();
    });
    //listen on change_username
    const nonce = crypto.randomBytes(12);
    socket.on('auth', (data) => {
       file.readFile('./pbkA', 'utf8', async (err, content) => {
            const prk = file.readFileSync('./prk', 'utf8')
            const message = await crypto2.decrypt.rsa(data.payload, prk)    
            const payload = JSON.parse(message);
            const sendBack = await crypto2.encrypt.rsa({ 
                username: data.username, 
                nonce: payload.nonce.push(nonce)
            }, content);
            socketSender.emit('auth-1', { payload: sendBack });
        })
    });
    socket.on('auth-2', (data) => {
        file.readFile('./pbkA', 'utf8', async (err, content) => {
             const prk = file.readFileSync('./prk', 'utf8')
             const message = await crypto2.decrypt.rsa(data.payload, prk)    
             const payload = JSON.parse(message);
             const sendBack = await crypto2.encrypt.rsa({ 
                 username: data.username, 
                 nonce: payload.nonce.push(nonce)
             }, content);
             socketSender.emit('auth-1', { payload: sendBack });
         })
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

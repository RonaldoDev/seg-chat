const express = require('express')
const app = express()
const crypto = require('crypto');

const file = require("fs");
const crypto2 = require("crypto2");
app.set('view engine', 'ejs')
app.use(express.static('public'))
app.get('/', (req, res) => {
	res.render('index')
})

server = app.listen(3001)
const ioConn = require("socket.io-client");
const io = require("socket.io")(server)
let nonce;
const alice = crypto.createDiffieHellman(256);
let aliceKey = alice.generateKeys();
var socketSender = ioConn.connect('http://localhost:3003');
let aliceSecret = null;
//listen on every connection
io.on('connection', (socket) => {
	console.log('New user connected')
    socket.username = "Alice"
    //listen on change_username
    socket.on('auth', async (data) => {
        const prk = file.readFileSync('./prk', 'utf8');
        const pbkB = file.readFileSync('./pbkB', 'utf8');
        const message = data.payload ? await crypto2.decrypt.rsa(data.payload, prk) : undefined;
        const payload = message ? JSON.parse(message) : { phase: undefined };
        if(payload.nonce)
            nonce = payload.nonce;
        switch(payload.phase) {
            case 2:
                const verification = await crypto2.encrypt.rsa({ 
                    phase: 3,
                    username: data.username,
                    nonce: payload.nonce[1]
                }, pbkB);
                socketSender.emit("auth", { payload: verification });
                
                const alicePrime = alice.getPrime();
                const aliceGen = alice.getGenerator();
                const dhKey = await crypto2.encrypt.rsa({ 
                    phase: 4,
                    dh1: alice.getPrime(),
                    dh2: alice.getGenerator()
                }, prk);
                const encrBob = await crypto2.encrypt.rsa(dhKey, pbkB);
                socketSender.emit("auth", { dh: true , payload: encrBob});
                io.sockets.emit('new_message', {message : "Authenticated", username : ""});
                break;
            default:
                const auth = await crypto2.encrypt.rsa({ 
                    phase: 1,
                    username: data.username,
                    nonce: await crypto2.createIv()
                }, pbkB);
                socketSender.emit("auth", { payload: auth });
        }
    });

    //listen on new_message
    socket.on('new_message', (data) => {
        io.sockets.emit('new_message', {message : data.message, username : socket.username});
        sendToBob(data.message)
    });
    
    socket.on('bobKey', (data) => {
        const bobKey = data;
        if(bobKey) {
            aliceSecret = alice.computeSecret(Buffer.from(bobKey));
            socketSender.emit('aliceKey', aliceKey.toJSON());
        }
    });

    const sendToBob = async (message) => {
        const msg = await crypto2.encrypt(message, aliceSecret, nonce[0]);
        socketSender.emit('send_receive', msg);
        aliceKey = alice.generateKeys();
        console.log(await crypto2.createPassword(aliceKey))
        socketSender.emit('aliceKey', aliceKey.toJSON());
    }
    
    socket.on('send_receive', async (data) => {
        const user = !!data.front ? "Alice" : "Bob"
        const msg = await crypto2.decrypt(data, aliceSecret, nonce[1]);
        io.sockets.emit('new_message', {message : msg, username : user });
    });
    //listen on typing
    socket.on('typing', (data) => {
    	socket.broadcast.emit('typing', {username : socket.username})
    })
})

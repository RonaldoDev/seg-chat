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
var socketSender = ioConn.connect('http://localhost:3001');
let nonce;
let bob = {};
let bobKeys = null;
let bobSecret = null;
//listen on every connection
io.on('connection', (socket) => {
    console.log('New user connected')
	socket.username = "Bob";
    //listen on change_username
    socket.on('auth', async  (data) => {
        const prk = file.readFileSync('./prk', 'utf8');
        const pbkA = file.readFileSync('./pbkA', 'utf8');
        const prkA = file.readFileSync('./prkA', 'utf8');
        const message = await crypto2.decrypt.rsa(data.payload, prk);
        const payload = data.dh ? { phase: 4, msg: message} : JSON.parse(message);
        switch(payload.phase) {
            case 1:
                nonce = [payload.nonce, await crypto2.createIv()]
                const auth = await crypto2.encrypt.rsa({ 
                    phase: 2,
                    username: data.username, 
                    nonce: nonce
                }, pbkA);
                socketSender.emit('auth', { payload: auth });
                break;
            case 4:
                const dh = await crypto2.decrypt.rsa(payload.msg, prkA);
                const dataDH = JSON.parse(dh);
                bob = crypto.createDiffieHellman(Buffer.from(dataDH.dh1), Buffer.from(dataDH.dh2.data));
                bobKey = bob.generateKeys();
                socketSender.emit('bobKey', bobKey.toJSON() );
                io.sockets.emit('new_message', {message : "Authenticated", username : ""});
            default:
                payload.nonce == nonce;
        }
        
    });
    //listen on new_message
    socket.on('new_message', (data) => {
        io.sockets.emit('new_message', {message : data.message, username : socket.username});
        sendToAlice(data.message)
    });
   
    socket.on('aliceKey',  (data) => {
        const aliceKey = data;
        if(aliceKey) {
            bobSecret = bob.computeSecret(Buffer.from(aliceKey));
        }
    });

    const sendToAlice = async (message) => {
        const msg = await crypto2.encrypt(message, bobSecret, nonce[1]);
        socketSender.emit('send_receive', msg);
        bobKey = bob.generateKeys();
        console.log(await crypto2.createPassword(bobKey))
        socketSender.emit('bobKey', bobKey.toJSON() );
    }
    socket.on('send_receive', async (data) => {
        const user = !!data.front ? "Bob" : "Alice"
        const msg = await crypto2.decrypt(data, bobSecret, nonce[0]);
        io.sockets.emit('new_message', {message : msg, username : user})
    });
    //listen on typing
    socket.on('typing', (data) => {
    	socket.broadcast.emit('typing', {username : socket.username})
    })
})

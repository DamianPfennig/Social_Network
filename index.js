const express = require('express');
const app = express();

const server = require('http').Server(app);
const io = require('socket.io')(server, {
    origins: 'localhost:3030'
});

const compression = require('compression');
const db = require('./db');
const cookieSession = require('cookie-session');
const csurf = require('csurf');
const cryptoRandomString = require('crypto-random-string');
const ses = require('./ses');

//////////////----for uploading image----///////////////

const multer = require('multer');
const uidSafe = require('uid-safe');
const path = require('path');

const diskStorage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, __dirname + '/uploads');
    },
    filename: function (req, file, callback) {
        uidSafe(24).then(function (uid) {
            callback(null, uid + path.extname(file.originalname));
        });
    }
});

const uploader = multer({
    storage: diskStorage,
    limits: {
        fileSize: 2097152
    }
});

//////////////////////////////////////////////////////////////////


const { hash, compare } = require('./bc');

app.use(compression());

// app.use(cookieSession({
//     secret: "I'm always angry",
//     maxAge: 1000 * 60 * 60 * 24 * 14
// }));

const cookieSessionMiddleware = cookieSession({
    secret: `I'm always angry.`,
    maxAge: 1000 * 60 * 60 * 24 * 90
});

app.use(cookieSessionMiddleware);
io.use(function (socket, next) {
    cookieSessionMiddleware(socket.request, socket.request.res, next);
});


app.use(csurf());

app.use(function (req, res, next) {
    //req.csrfToken generate token
    res.cookie('mytoken', req.csrfToken())
    //console.log('req.csrfToken', req.csrfToken())
    next();
})



app.use(express.json());

app.use(express.static('public'));


if (process.env.NODE_ENV != 'production') {
    app.use(
        '/bundle.js',
        require('http-proxy-middleware')({
            target: 'http://localhost:8081/'
        })
    );
} else {
    app.use('/bundle.js', (req, res) => res.sendFile(`${__dirname}/bundle.js`));
}


app.post('/register', (req, res) => {
    console.log('req.body: ', req.body);
    //create a database 
    let first = req.body.first;
    let last = req.body.last;
    let email = req.body.email;
    let pass = req.body.password;
    //console.log('req.session.userId :', req.session.userId)
    //res.json({ success: true });
    hash(pass).then(hashedPass => {
        db.addUser(first, last, email, hashedPass).then(results => {
            req.session.userId = results.rows[0].id;
            console.log('cookie after register addUser: ', req.session.userId);
            //console.log('hashedPass: ', hashedPass);
            results.rows[0].success = true;
            console.log('results: ', results.rows[0]);
            res.json(results.rows[0]);
        }).catch(err => console.log('error in registration', err));
    }).catch(err => console.log('error with password', err));
});

app.post('/login', (req, res) => {
    console.log('req.body in login ', req.body)
    let email = req.body.email;
    let pass = req.body.password;
    db.getPass(email).then(results => {
        console.log('results.rows: ', results.rows[0])
        if (results.rows == []) {
            console.log("did not register");
            location.replace('/');
        } else {
            if (email === results.rows[0].email) {
                console.log('pass inserted in login: ', pass)
                compare(pass, results.rows[0].password).then(match => {
                    if (match == true) {
                        console.log('pass match', match);
                        //let idInUser = results.rows[0].id;
                        //console.log('user id after login: ', idInUser);
                        results.rows[0].success = true;
                        req.session.userId = results.rows[0].id;
                        res.json(results.rows[0]);

                    } else {
                        console.log('pass did not match', match);
                        results.rows[0].success = false;
                        res.json(results.rows[0]);

                    }
                }).catch(err => {
                    console.log('error comparing password', err);
                    results.rows[0].success = false;
                    res.json(results.rows[0]);

                });

            } else {
                console.log('email not found')
                location.replace('/');
                res.json([]);
            }
        }

    }).catch(err => {
        console.log('error passing email', err);
        res.json([]);
    });

})

app.post('/reset/start', (req, res) => {
    console.log('req.body in login ', req.body)
    let email = req.body.email;
    db.getPass(email).then(results => {
        console.log('results from get email in /reset: ', results.rows[0])
        if (results.rows == []) {
            console.log("in /reset--> email not found");
            results.rows[0].success = false;
        } else {
            if (email === results.rows[0].email) {
                const secretCode = cryptoRandomString({
                    length: 6
                });
                db.addCode(email, secretCode).then(results => {
                    console.log('results from secretCode: ', results.rows[0])
                    console.log('email', email)
                    console.log('secretCode: ', secretCode)
                    const message = `Your code: ${secretCode}`
                    const subject = `Change your password`
                    ses.sendEmail(email, message, subject).then(results => {
                        console.log('email sent');
                        res.json();

                    }).catch(err => {
                        console.log('error sending email:', err);
                    });
                    console.log('results from addCode: ')
                    results.rows[0].success = true;

                    res.json(results.rows[0]);


                }).catch(err => console.log('error inserting secretCode', err));

            }
        }

    }).catch(err => {
        console.log('error getting email', err)
        res.json([])
    });
})

app.post('/reset/verify', (req, res) => {
    console.log('req.body in /reset/verify ', req.body)
    let email = req.body.email;
    db.getCode(email).then(results => {
        console.log('results from getCode: ', results.rows[0])
        if (req.body.code === results.rows[0].code) {
            let pass = req.body.password;
            hash(pass).then(hashedPass => {
                db.updatePass(email, hashedPass).then(results => {
                    console.log('results verify hashed pass: ', results.rows[0]);
                    results.rows[0].success = true;
                    res.json(results.rows[0]);
                }).catch(err => console.log('error in registration', err));
            }).catch(err => console.log('error with password', err));
        } else {
            results.rows[0].success = false;
            res.json(results.rows[0]);
        }
    }).catch(err => {
        console.log('error getting code', err);
    });
})

app.get('/user', (req, res) => {
    //console.log('req.session.userId:: ', req.session.userId)
    let userId = req.session.userId;
    db.getUserInfo(userId).then(results => {
        //console.log('results from getUserInfo: ', results.rows[0]);
        res.json(results.rows[0]);
    }).catch(err => console.log('error inserting secretCode', err));
})

app.get('/oldImage', async function (req, res) {
    const oldImage = await db.getOldImage(req.session.userId)
    console.log('oldImage.image::', oldImage.rows[0].image)
    if (oldImage.rows[0].image == null) {
        console.log('!!!!!!!!!!!!')
        res.json([]);
        res.end();
    }

    const results = await db.addOldImage(req.session.userId, oldImage.rows[0].image)
    results.rows[0].success = true;
    res.json(results.rows[0]);
    console.log('results ===>', results.rows);
})

app.post('/upload', uploader.single('file'), ses.upload, (req, res) => {
    console.log('axios in /upload')
    //console.log('req::', req)
    let userId = req.session.userId;
    let filename = req.file.filename;
    let url = `https://s3.amazonaws.com/spicedling/${filename}`;
    if (req.file) {
        db.addImage(userId, url).then(results => {
            console.log('results from addImages: ', results.rows);
            res.json(results.rows[0]);
        }).catch(err => {
            console.log('err: ', err);
        });
    } else {
        res.json({ success: false });
    }
})

app.post('/bioediting', (req, res) => {
    //console.log('req.body in bioediting::', req.body);
    let text = req.body.biotext;
    let userId = req.session.userId;
    //console.log('in bioediting::', text, userId)
    db.addBio(userId, text).then(results => {
        console.log('results from addBio: ', results.rows[0]);
        res.json(results.rows[0]);
    }).catch(err => console.log('error in bioediting', err));


})

app.get('/getBio', (req, res) => {
    console.log('req.session.userId: ', req.session.userId)
    db.getBio(req.session.userId).then(results => {
        console.log('results getting bio: ', results.rows[0])
        res.json(results.rows[0]);
    }).catch(err => {
        console.log('error in get_bio: ', err);
    })
})

app.get('/otherUser/:id', async function (req, res) {
    //console.log('req otherUser in index:', req.params.id)
    const otherUser = await db.getOtherUser(req.params.id);
    console.log('otherUser', otherUser)
    res.json(otherUser);
})

app.get('/users.json', async function (req, res) {
    //console.log('axios in /users')
    const users = await db.getUsers();
    //console.log('users::', users.rows);
    res.json(users.rows);
})

app.get('/findUsers/:id', (req, res) => {
    console.log('req.params.id in findUsers: ', req.params.id)
    if (req.params.id === '') {
        console.log('empty req.paramas')
    } else {
        db.getFindUsers(req.params.id).then(results => {
            console.log('findUsers: ', results.rows)
            console.log('::::::::::::::::::::::::::::')
            res.json(results.rows);

        }).catch(err => console.log('error in findUsers', err));
    }
})

app.get('/initial-friendship-status/:id', (req, res) => {
    console.log('req.params.id in /initial-friendship-status: ', req.params.id)
    console.log('cookie userId: ', req.session.userId);
    let userId = req.session.userId
    db.getFriendship(userId, req.params.id).then(results => {
        //console.log('results /friendship: ', results.rows);
        results.rows.userId = userId;
        res.json(results.rows);
    }).catch(err => {
        console.log('error in initial-friendship-status: ', err)
    })
})

app.post('/make-friend-request/:id', (req, res) => {
    console.log('req.params.id in /make-friend-request ', req.params.id);
    console.log('cookie userId: ', req.session.userId);
    db.addFriendship(req.session.userId, req.params.id).then(results => {
        console.log('results /make-friend-request: ', results.rows);
        res.json(results.rows);
    }).catch(err => {
        console.log('error in /make-friend-request: ', err);
    });
})

app.post('/accept-friend-request/:id', (req, res) => {
    console.log('req.params.id in /accept-friend-request ', req.params.id);
    db.acceptFriendship(req.session.userId, req.params.id).then(results => {
        console.log('results from /accept-friend-request: ', results.rows);
        res.json(results.rows[0]);
    }).catch(err => {
        console.log('error in accept-friend-request: ', err);
    })
})

app.post('/end-friendship/:id', (req, res) => {
    console.log('req.params.id in /end-friendship: ', req.params.id);
    db.deleteFriendship(req.session.userId, req.params.id).then(results => {
        console.log('results from end-friendship: ', results.rows)
        res.json(results.rows);
    }).catch(err => {
        console.log('error in end-friendship: ', err);
    })
})

app.get('/friends-requests', (req, res) => {
    console.log('friends request working')
    db.getFriendsAndRequests(req.session.userId).then(results => {
        console.log('results in getFriendsAndRequests', results.rows);
        res.json(results.rows)
    }).catch(err => {
        console.log('error in getFriendsAndRequests', err);
    })
})

app.get('/log-out', (req, res) => {
    req.session = null;
    //res.end();
    res.redirect('/welcome');
})

app.post('/delete', (req, res) => {
    // let promises = [];
    // let p1, p2, p3, p4;
    // p1 = db.deleteAccountOldImage(req.session.userId);
    // p2 = db.deleteAccountChat(req.session.userId);
    // p3 = db.deleteAccountFriendships(req.session.userId);
    // p4 = db.deleteAccountUsers(req.session.userId);

    // promises.push(p1, p2, p3);
    // Promise.all([promises]).then((results) => {
    // }).catch(err => {
    //     console.log('error in /delete: ', err)
    // })

    db.deleteAccountOldImage(req.session.userId).then(results => {
        db.deleteAccountChat(req.session.userId).then(results => {
            db.deleteAccountFriendships(req.session.userId).then(results => {
                db.deleteAccountUsers(req.session.userId).then(results => {
                    results.rows.success = true;
                    console.log('===>', results.rows);
                    res.json(results.rows);
                    // req.session = null;
                    // res.end();

                    //res.redirect('/welcome')

                }).catch(err => console.log('error in /delete: ', err));
            }).catch(err => console.log('error in /delete: ', err));
        }).catch(err => console.log('error in /delete: ', err));
    }).catch(err => console.log('error in /delete: ', err));



});

// app.get('/deleteRedirect', (req, res) => {
//     req.session = null;
//     //res.end();
//     res.redirect('/welcome');
// })

////////////////////////////////////////////////////
// app.get('/chat', (req, res) => {
//     db.getLastMessages().then(results => {
//         console.log('results from getLastMessages: ', results.rows);
//         //io.sockets.emit('chatMessages', results.rows);
//     }).catch(err => {
//         console.log('error in getLastMessage', err);
//     })
// })



//////////////////////////////////////////////////////////////////
app.get('/welcome', (req, res) => {
    if (req.session.userId) {
        res.redirect('/');
    } else {
        res.sendFile(__dirname + '/index.html');
    }
})

//final route in order...catch everything else
app.get('*', function (req, res) {
    if (!req.session.userId) {
        res.redirect('/welcome');
    } else {
        res.sendFile(__dirname + '/index.html');
    }
});
//////////////////////////////////////////////////////////////////////
server.listen(3030, function () {
    console.log("I'm listening.");
});
/////////////////////////////////////////////////////////////////////
//var users = [];
var onlineUsers = {};
// let eachUser = {};
io.on('connection', async function (socket) {
    //all socket code goes here:::
    //console.log(`socket id ${socket.id} is now connected`);

    if (!socket.request.session.userId) {
        return socket.disconnect(true);
    };
    //console.log('disconect? ', socket.disconnect == true)

    let socketUserId = socket.request.session.userId;
    onlineUsers[socketUserId] = socket.id;

    socket.on("disconnect", () => {
        delete onlineUsers[socketUserId];
    });

    users = [];
    console.log('onlineUsers', onlineUsers)
    for (let key in onlineUsers) {
        //console.log('onlineUsers[key]: ', onlineUsers[key])
        try {
            const test = await db.getConnectedUser(key)
            console.log('test', test.rows[0]);

            users.push(test.rows[0]);
        } catch (err) {
            console.log(err);

        }
        //     // console.log('users::', users)
        // }).catch(err => {
        //     console.log('error in getConnectedUser: ', err);
        // })
    }
    console.log('users outside:', users);

    io.sockets.emit('onlineUsers', users)


    //});


    //socket.broadcast.emit('onlineUsers', onlineUsers);
    //io.sockets.emit('onlineUsers', users)
    //console.log(':::::', eachUser)

    //console.log('onlineUsers: ', onlineUsers)


    // db.getConnectedUser(socketUserId).then(results => {
    //     //console.log('results from getConnectedUser: ', results.rows[0])
    //     users.push(results.rows[0]);
    //     console.log('users::', users)
    //     socket.broadcast.emit('onlineUsers', users)
    // }).catch(err => {
    //     console.log('error in getConnectedUser: ', err);
    // })
    // socket.on('disconnect', function () {
    //     console.log(`socket with the id ${socket.id} is now disconnected`);
    // });



    const userId = socket.request.session.userId;
    //get the last 10 chat messages
    if (userId) {
        //console.log('userId: ', userId)
        db.getLastMessages(userId).then(results => {
            //console.log('results from getLastMessages: ', results.rows);
            io.sockets.emit('chatMessages', results.rows.reverse());
        }).catch(err => {
            console.log('error in getLastMessages', err);
        });
    }

    //new chat message
    // let promises = [];
    // let p1, p2;

    socket.on('newMsg', async function (newMsg) {
        console.log('messsage from chat.js component ', newMsg);
        console.log('user who sent new message: ', userId);
        const newMessage = await db.addNewMessage(newMsg, userId)
        //console.log('newMessage async: ', newMessage.rows);

        db.getNewMessage(newMessage.rows[0].user_id).then(results => {
            console.log('results from getNewMessage: ', results.rows);
            io.sockets.emit('addChatMsg', results.rows);
        }).catch(err => {
            console.log('error inn getNewMessage: ', err);
        })
    })

    //     results => {
    //     console.log('results from addNewMessage: ', results.rows);
    // }).catch(err => {
    //     console.log('error in newMsg: ', err)
    // });



    //1. insert msg in chat table (Returning something?)
    //2.do query to get first, last, img (Join)
    //
    //emit the msg so that everyone can see it:
    //io.socket.emit('addChatMsg', ....)

});


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// app.post('/upload', uploader.single('file'), ses.upload, (req, res) => {

//     console.log('all worked well');
//     //console.log('file:', req.file);
//     console.log('req.body', req.body);
//     let filename = req.file.filename;
//     let url = `https://s3.amazonaws.com/spicedling/${filename}`;
//     console.log('title:::', title);
//     if (req.file) {
//         db.addImages(url).then(results => {
//             //console.log('results from addImages: ', results.rows[0])
//             res.json(results.rows[0]);
//         }).catch(err => {
//             console.log('err: ', err);
//         });
//     } else {
//         res.json({ success: false });
//     }
// })


// app.get('/oldImage', async function (req, res) {
//     const oldImage = await db.getOldImage(req.session.userId)
//     // .then(results => {
//     //     console.log('results in oldImage: ', results.rows);
//     // }).catch(err => {
//     //     console.log('error in get oldImage: ', err);
//     // })
//     console.log('oldImage.image::', oldImage.rows[0].image)

//     const results = await db.addOldImage(req.session.userId, oldImage.rows[0].image)
//     console.log('results ===>', results.rows)
//     // .then(results => {
//     //     console.log('results in addOldImage: ', results.rows)
//     // }).catch(err => {
//     //     console.log('error in addoldImage: ', err);
//     // })
//     app.post('/upload', uploader.single('file'), ses.upload, (req, res) => {
//         console.log('axios in /upload')
//         //console.log('req::', req)
//         let userId = req.session.userId;
//         let filename = req.file.filename;
//         let url = `https://s3.amazonaws.com/spicedling/${filename}`;
//         if (req.file) {
//             db.addImage(userId, url).then(results => {
//                 console.log('results from addImages: ', results.rows);
//                 res.json(results.rows[0]);
//             }).catch(err => {
//                 console.log('err: ', err);
//             });
//         } else {
//             res.json({ success: false });
//         }
//     })
// })
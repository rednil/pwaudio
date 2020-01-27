const express = require('express')
const session = require('express-session')
// const { ensureLoggedIn } = require('connect-ensure-login')
const passport = require('passport')
const OAuth2Strategy = require('passport-oauth2')
const fs = require('fs')
const fetch = require('node-fetch')
const cors = require('cors')
//var argv = require('minimist')(process.argv.slice(2))

if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config()
}

const {  
    FILESYSTEM_ROOT = 'fs',
    PORT = 80,
    OAUTH2_URL,
    OAUTH2_CLIENT_ID,
    OAUTH2_CLIENT_SECRET,
    OAUTH2_TOKEN_URL,
    OAUTH2_USER_URL
} = process.env

if(
    !OAUTH2_URL ||
    !OAUTH2_CLIENT_ID ||
    !OAUTH2_CLIENT_SECRET ||
    !OAUTH2_TOKEN_URL ||
    !OAUTH2_USER_URL
) return console.error('Missing OAUTH2 Settings')

const users = {}

/*
const getType = (dirent) => {
    if(dirent.isFile()) return 'File'
    if(dirent.isDirectory()) return 'Directory'
    if(dirent.isBlockDevice()) return 'BlockDevice'
    if(dirent.isCharacterDevice()) return 'CharacterDevice'
    if(dirent.isFIFO()) return 'FIFO'
    if(dirent.isSocket()) return 'Socket'
    if(dirent.isSymbolicLink()) return 'SymbolicLink'
}
const getResponseObj = (dir) => {
    return dir.map(dirent => {
        return {
            name: dirent.name,
            type: getType(dirent)
        }
    })
}
*/
const index = (FILESYSTEM_ROOT) => (req, res, next) => {
    const path = decodeURIComponent(req.path)
    if(path.slice(-1) == '/') {
        fs.readdir(FILESYSTEM_ROOT + path, {withFileTypes: true}, (err, dir) => {
            if(!err) {
                res.setHeader('Content-Type', 'application/json');
                res.send(dir.map(dirent => dirent.name + (dirent.isDirectory() ? '/' : '')))
            }
            else {
                console.error(`fs.readdir(${FILESYSTEM_ROOT + path}) failed`)
                res.status(404).end()
            }
        })
    }
    else next()
}

const protectApi = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).end()
    }
    next()
}

const authSuccess = (req, res) => {
    // Successful authentication, redirect home.
    res.redirect('/')
}

passport.serializeUser(function(user, done) {
    done(null, user.id)
})

passport.deserializeUser(function(id, done) {
    done(null, users[id])
})
// https://stackoverflow.com/questions/56089821/sharing-nextcloud-authentication-with-custom-web-application
const auth = new OAuth2Strategy({
    authorizationURL: OAUTH2_URL,
    tokenURL: OAUTH2_TOKEN_URL,
    clientID: OAUTH2_CLIENT_ID,
    clientSecret: OAUTH2_CLIENT_SECRET,
    //callbackURL: "/api/v1/auth/callback.html"
  },
  function(accessToken, refreshToken, profile, cb) {
    return fetch(OAUTH2_USER_URL, {
        headers: { 'Authorization': 'Bearer ' + accessToken}
    })
    .then(res => res.json())
    .then(json => {
        const user = json.ocs.data
        users[user.id] = user
        cb(null, user)
    })
  }
)
passport.use(auth)
const app = express()
app.use(cors())
app.use(session({
    secret: 'test',
    resave: false,
    saveUninitialized: true,
}))
app.use(passport.initialize())
app.use(passport.session())
app.use('/api/v1/auth/login.html',    passport.authenticate('oauth2'))
app.get('/api/v1/auth/callback.html', passport.authenticate('oauth2', { failureRedirect: '/fail' }), authSuccess)
app.use('/api/v1/fs', protectApi, index(FILESYSTEM_ROOT), express.static(FILESYSTEM_ROOT))
app.use(express.static('build/esm-bundled'))
app.listen(PORT, () => console.log(`PWA Audio player backend listening on port ${PORT}!`))
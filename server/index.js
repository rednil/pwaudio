const express = require('express')
const httpAuth = require('http-auth');
const fs = require('fs')
const cors = require('cors')
var argv = require('minimist')(process.argv.slice(2))
const root = argv.v || '/fs'
const port = argv.p || 80

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
const index = (root) => (req, res, next) => {
    const path = decodeURIComponent(req.path)
    console.log('index', root, path)
    if(path.slice(-1) == '/') {
        fs.readdir(root + path, {withFileTypes: true}, (err, dir) => {
            if(!err) {
                res.setHeader('Content-Type', 'application/json');
                console.log('send')
                //res.send(JSON.stringify(getResponseObj(dir), null, 2))
                res.send(dir.map(dirent => dirent.name + (dirent.isDirectory() ? '/' : '')))
            }
            else next()
        })
    }
    else next()
}
function getUnauthorizedResponse(req) {
    return req.auth
        ? ('Credentials ' + req.auth.user + ':' + req.auth.password + ' rejected')
        : 'No credentials provided'
}
const app = express()
app.use(cors())
const auth = httpAuth.basic({
    realm: "PWAudio",
    file: __dirname + "/users.htpasswd"
})
app.use('/fs', httpAuth.connect(auth), index(root), express.static(root))
app.use(express.static('build/esm-bundled'))
app.listen(port, () => console.log(`PWA Audio player backend listening on port ${port}!`))
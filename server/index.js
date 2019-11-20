const express = require('express')
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

    if(path.slice(-1) == '/') {
        fs.readdir(root + path, {withFileTypes: true}, (err, dir) => {
            if(!err) {
                res.setHeader('Content-Type', 'application/json');
                //res.send(JSON.stringify(getResponseObj(dir), null, 2))
                res.send(dir.map(dirent => dirent.name + (dirent.isDirectory() ? '/' : '')))
            }
            else next()
        })
    }
    else next()
}

const app = express()
app.use(cors())
app.use('/fs', index(root))
app.use('/fs', express.static(root))
app.use(express.static('build/esm-bundled'))
app.listen(port, () => console.log(`PWA Audio player backend listening on port ${port}!`))
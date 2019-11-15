const express = require('express')
const fs = require('fs')
const cors = require('cors')
const root = '/mnt/teracrypt/audio/music/modern'

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
const index = (req, res, next) => {
    const path = decodeURI(req.path)
    console.log('index', path)

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
app.use(express.static(root))
app.use(index)
const port = 3001

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
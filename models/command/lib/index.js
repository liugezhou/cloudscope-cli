'use strict';
const semver = require('semver')
const colors = require('colors/safe')

const  LOWEST_NODE_VERSION = '12.0.0'

class Command {
    constructor(argv){
        this._argv = argv
        let runner = new Promise((resolve,reject)=>{
            let chain = Promise.resolve()
            chain = chain.then(()=> this.checkNodeVersion())
            chain.catch(e =>{
                console.log(e.message)
            })
        })
    }

     checkNodeVersion(){
        const currentNodeVersion = process.version
        const lowestNodeVersion = LOWEST_NODE_VERSION
        if(semver.ltr(currentNodeVersion, lowestNodeVersion)) {
            throw new Error(colors.red(`cloudscope-cli 需要安装 v${lowestNodeVersion}以上版本的node.js`))
        }
    }

    init(){
         throw Error('init必须实现')
    }
    exec(){
        throw Error('exec必须实现')
    }
}

module.exports = Command;

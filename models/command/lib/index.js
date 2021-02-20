'use strict';
const semver = require('semver')
const colors = require('colors/safe')
const log = require('@cloudscope-cli/log')

const  LOWEST_NODE_VERSION = '12.0.0'

class Command {
    constructor(argv){
        if(!argv){
            throw new Error('argv参数不能为空')
        }
        if(!Array.isArray(argv)){
            throw new Error('argv参数必须为数组')
        }
        if(argv.length < 1){
            throw new Error('参数列表为空')
        }
        this._argv = argv
        let runner = new Promise((resolve,reject)=>{
            let chain = Promise.resolve()
            chain = chain.then(()=> this.checkNodeVersion())
            chain = chain.then(()=> this.initArgs())
            chain = chain.then(()=> this.init())
            chain = chain.then(()=> this.exec())
            chain.catch(e =>{
                log.error(e.message)
            })
        })
    }

    initArgs(){
        const len = this._argv.length - 1
        this._cmd = this._argv[len].opts()
        this._argv = this._argv.slice(0,len)
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

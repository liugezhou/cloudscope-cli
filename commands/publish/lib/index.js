'use strict';
const Command = require('@cloudscope-cli/command')
const log = require('@cloudscope-cli/log')
const fse = require('fs-extra')
const path = require('path')
const fs = require('fs');
const Git = require('@cloudscope-cli/git');
class PublishCommand extends Command {
    init(){
        // 处理参数
        log.verbose('publish init',this._argv)
            this.options = {
                refreshServer:this._argv[0].refreshServer,
                refreshOwner:this._argv[0].refreshOwner
            }
    }

    async exec(){
        try {
            const startTime = new Date().getTime()
            //1. 初始化检查
            this.prepare()
            //2.Git Flow自动化
            const git = new Git(this.projectInfo,this.options)
            await git.prepare()
            //3.云构建 + 云发布
            const endTime = new Date().getTime()
            log.info('本次发布耗时',Math.floor(endTime-startTime)/1000+'秒')
        } catch (e) {
            log.error(e.message)
            if(process.env.LOG_LEVEL === 'verbose'){
                log.error(e.message)
            }
        }
    }

    prepare(){
        // 1.确认项目是否为npm项目
        const projectPath =  process.cwd()
        const pkgPath = path.resolve(projectPath,'package.json')
        log.verbose('package.json',pkgPath)
        if(!fs.existsSync(pkgPath)){
            throw new Error('package.json不存在')
        }
        //2. 确认是否包含name\version\build命令
        const pkg = fse.readJsonSync(pkgPath)
        const {name,version,scripts} = pkg
        if(!name || !version || !scripts || !scripts.build ){
            throw new Error('package.json信息不全，请检查是否存在name、version和scripts(需提供build命令)')
        }
        this.projectInfo = {name,version,dir:projectPath}
    }
}

function init(argv){
    return new PublishCommand(argv)
}
module.exports = init
module.exports.PublishCommand = PublishCommand;
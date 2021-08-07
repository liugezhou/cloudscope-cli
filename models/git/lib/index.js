'use strict';

const path = require('path')
const fs = require('fs')
const SimpleGit = require('simple-git')
const userHome = require('user-home')
const log = require('@cloudscope-cli/log')
const { readFile,writeFile } = require('@cloudscope-cli/utils')
const fse = require('fs-extra')
const inquirer = require('inquirer')

const DEFAULT_CLI_HOME = '.cloudscope-cli'
const GIT_ROOT_DIR = '.git'
const GIT_SERVER_FILE = '.git_server'

const GITHUB = 'github'
const GITEE ='gitee'
const GIT_SERVER_TYPE = [{
    name:'Github',
    value: GITHUB
},{
    name: 'Gitee',
    value: GITEE
}]

class Git {
    constructor({name, version, dir},{refreshServer =false }){
        this.name = name
        this.version = version
        this.dir = dir
        this.git = SimpleGit(dir)
        this.gitServer = null
        this.homePath = null
        this.refreshServer = refreshServer
    }
    init(){
        console.log('Git init')
    }
    async prepare(){
        this.checkHomePath();// 检查缓存主目录
        await  this.checkGitServer();//检查用户远程仓库类型
    }
    
    checkHomePath(){
        if(!this.homePath){
            if(process.env.CLI_HOME_PATH){
                this.homePath = process.env.CLI_HOME_PATH
            }else{
                this.homePath = path.resolve(userHome,DEFAULT_CLI_HOME)
            }
        }
        log.verbose('home:',this.homePath )
        fse.ensureDirSync(this.homePath);
        if(!fs.existsSync(this.homePath)){
            throw new Error('用户主目录获取失败！')
        }
    }
    async checkGitServer(){
        const gitServerPath = this.createPath(GIT_SERVER_FILE)
        let gitServer = readFile(gitServerPath)
        if(!gitServer){ // 如果没有读取到.git-server文件中的内容
            gitServer = await this.choiceServer(gitServerPath)
            log.success('git server 写入成功',`${gitServer} -> ${gitServerPath}`)
        }else{ // 如果读取到了 内容
            if(this.refreshServer){ // 是否重写标识
                const refresh = (await inquirer.prompt([{
                    type:'confirm',
                    name:'ifContinue',
                    default:false,
                    message:'当前.git-server目录已存在，是否要重写选择托管平台？'
                }])).ifContinue
                if(refresh){
                    gitServer = await this.choiceServer(gitServerPath)
                    log.success('git server 重写成功',`${gitServer} -> ${gitServerPath}`)
                }else{
                    log.success('git server 获取成功 ', gitServer)
                }
            }else{ //不重写，直接读取
                log.success('git server 获取成功 ', gitServer)
            }
        }
        this.gitServer = this.createServer(gitServer)
    }

    createServer(gitServer){
        console.log(gitServer)
    }

    async choiceServer(gitServerPath){
        const gitServer = (await inquirer.prompt({
            type:'list',
            name:'server',
            message:'请选择你想要托管的Git平台',
            default: GITHUB,
            choices:GIT_SERVER_TYPE
        })).server;
        writeFile(gitServerPath,gitServer)
        return gitServer
    }

    createPath(file){
        const rootDir = path.resolve(this.homePath,GIT_ROOT_DIR)
        const serverDir = path.resolve(rootDir,file)
        fse.ensureDirSync(rootDir)
        return serverDir
    }
    
}

module.exports = Git;
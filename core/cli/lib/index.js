'use strict';
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync

const path = require('path')
const log = require('@cloudscope-cli/log')

const pkg = require('../package.json')
const constant  = require('./constant')

let args;

async function core() {
    try {
        checkPkgVersion()    // 检查包版本
        checkNodeVersion()  // 检查包版本
        rootCheck()             // root账号启动检查和自动降级
        checkUserHome()     //检查用户主目录
        checkInputArgs()      // 检查输入参数是否为debug模式
        checkEnv()              // 检查环境变量
        await checkGlobalUpdate() //检查是否需要全局更新
    } catch (e) {
        log.error(e.message)
    }
    
}

function checkPkgVersion(){
    log.notice('version:',pkg.version)
}
function checkNodeVersion(){
    const currentNodeVersion = process.version
    const lowestNodeVersion = constant.LOWEST_NODE_VERSION
    if(semver.ltr(currentNodeVersion, lowestNodeVersion)) {
        throw new Error(colors.red(`cloudscope-cli 需要安装 v${lowestNodeVersion}以上版本的node.js`))
    }
}

function checkUserHome(){
    if( !userHome || !pathExists(userHome)){
        throw new Error(colors.red('当前登录用户主目录不存在'))
    }
}
function rootCheck() {
    const rootCheck = require('root-check');
    rootCheck(); 
}
function checkInputArgs(){
    const minimist = require('minimist')
    args = minimist(process.argv.slice(2))
    checkArgs()
}

function checkEnv(){
    const dotenv = require('dotenv')
    const dotenvPath =  path.resolve(userHome,'.env') 
    if(dotenvPath){
         dotenv.config({
            path: dotenvPath
        })
    }
    createDefaultConfig()
    log.verbose('环境变量',process.env.CLI_HOME_PATH)
}

async function checkGlobalUpdate(){
    const currentPkgVersion = pkg.version
    const npmName = pkg.name
    const { getLatestVersion } = require('@cloudscope-cli/get-npm-info')
    // const versions = await getNpmSemverVersion(currentPkgVersion,npmName)
    const lastVersion = await getLatestVersion('@cloudscope-cli/core')
    if(lastVersion && semver.gt(lastVersion,currentPkgVersion)){
        log.warn('更新提示:',colors.yellow(`请手动更新${npmName}，当前版本：${currentPkgVersion},最新版本为：${lastVersion}
          更新命令为: npm install -g ${npmName}）`))
    }
}

// 创建默认.env文件
function createDefaultConfig(){
    const cliConfig = {
        home: userHome
    }
    if(process.env.CLI_HOME){// 这个值是通过 dotenv获取的
        cliConfig['cliHome'] = path.join(userHome,process.env.CLI_HOME)
    }else{
        cliConfig['cliHome'] = path.join(userHome,constant.DEFAULT_CLI_HOME)
    }
    process.env.CLI_HOME_PATH = cliConfig['cliHome']
}

function checkArgs(){
    if(args.debug){
        process.env.LOG_LEVEL = 'verbose'
    } else {
        process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
}

module.exports = core;

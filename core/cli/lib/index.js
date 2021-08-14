'use strict';
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const commander = require('commander')

const path = require('path')
const log = require('@cloudscope-cli/log')
const exec = require('@cloudscope-cli/exec')

const pkg = require('../package.json')
const constant  = require('./constant')

const program = new commander.Command()

async function core() {
    try {
        await prepare()
        registerCommand()       // 脚手架命令注册    
    } catch (e) {
        log.error(e.message)
        if(program.opts().debug){
            console.log(e)
        }
    }
}

function checkPkgVersion(){
    log.info('cloudscope-cli version:',pkg.version)
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

function checkEnv(){
    const dotenv = require('dotenv')
    const dotenvPath =  path.resolve(userHome,'.env') 
    if(dotenvPath){
         dotenv.config({
            path: dotenvPath
        })
    }
    createDefaultConfig()
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


//命令注册
function registerCommand(){
    program
        .name(Object.keys(pkg.bin)[0])
        .usage('<command> [options]')
        .version(pkg.version)
        .option('-d, --debug', '是否开启调试模式', false)
        .option('-tp, --targetPath <targetPath>','是否指定本地调试文件路径','')

    program
    .command('init [projectName]')
    .option('-f, --force','是否强制初始化项目')
    .action(exec)

    program
    .command('publish')
    .option('--refreshServer','强制更新远程Git仓库类型和token')
    .option('--refreshOwner','强制更新远程Git仓库用户类型')
    .option('--buildCmd <buildCmd>','构建命令')
    .action(exec)

     // 开启debug模式
     program.on('option:debug',function(){
        if(program.opts().debug){
            process.env.LOG_LEVEL='verbose'
        }else{
            process.env.LOG_LEVEL='info'
        }
        log.level = process.env.LOG_LEVEL
    })

    //指定targetPath
    program.on('option:targetPath',function(){
        process.env.CLI_TARGET_PATH = program.opts().targetPath 
    })
    // 对未知命令监听
    program.on('command:*',function(obj){
        const availableCommands = program.commands.map(cmd => cmd.name())
        console.log(colors.red('未知的命令：'+obj[0]))
        if(availableCommands.length > 0){
            console.log(colors.red('可用命令为：'+availableCommands.join(',')))
        }
    })
 

    program.parse(program.argv)
    if(program.args && program.args.length < 1) {
        program.outputHelp();
    }
}

async function prepare(){
    checkPkgVersion()    // 检查包版本
    rootCheck()             // root账号启动检查和自动降级
    checkUserHome()     //检查用户主目录
    checkEnv()              // 检查环境变量
    await checkGlobalUpdate() //检查是否需要全局更新
}
module.exports = core;

process.on('unhandledRejection', (reason, p) => {
    //我刚刚捕获了一个未处理的promise rejection, 因为我们已经有了对于未处理错误的后备的处理机制（见下面）, 直接抛出，让它来处理
    console.log('unhandledRejection', reason,p)
    throw reason;
  });
  process.on('uncaughtException', (error) => {
    //我刚收到一个从未被处理的错误，现在处理它，并决定是否需要重启应用
    console.log('uncaughtException',error)
      process.exit(1);
  });
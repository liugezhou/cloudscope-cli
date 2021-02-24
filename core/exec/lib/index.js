'use strict';

const path = require('path')
const Package = require('@cloudscope-cli/package')
const log = require('@cloudscope-cli/log')
const { exec:spawn } = require("@cloudscope-cli/utils")

const SETTINGS = {
    init: '@cloudscope-cli/init'
 }

const CATCH_DIR = 'dependencies'

async function exec() {
    // 1. targetPath -> modulePath
   // 2. modulePath -> Package(npm模块)
   // 3. Package.getRootFile(获取入口文件)
   // 4. Package.update / Package.install'
    let targetPath = process.env.CLI_TARGET_PATH
    const homePath = process.env.CLI_HOME_PATH
    let storeDir ='';
    let pkg;
    log.verbose('targetPath', targetPath);
    log.verbose('homePath', homePath);
    const cmdObj = arguments[arguments.length - 1];
    const cmdName = cmdObj.name(); 
    const packageName = SETTINGS[cmdName];
    const packageVersion = 'latest';
    if(!targetPath){
       //生成缓存路径
       targetPath = path.resolve(homePath,CATCH_DIR);
       storeDir = path.resolve(targetPath,'node_modules')
       log.verbose('targetPath:',targetPath)
       log.verbose('storeDir:',storeDir)
       pkg = new Package({
         targetPath,
         storeDir,
         packageName,
         packageVersion
      });
      if(await pkg.exists()){
         // 更新package
         log.verbose('更新package')
         await pkg.update();
      }else{
         // 安装package
         await pkg.install();
      }
    }else{
      pkg = new Package({
         targetPath,
         packageName,
         packageVersion
      })
    }
    const rootFile = pkg.getRootFilePath();
    if(rootFile){
      try {
         //在当前进程调用
         // require(rootFile).call(null,Array.from(arguments));

         // 在node子进程中调用
         let args = Array.from(arguments).splice(0,2)
         // const cmd = args[args.length - 2]
         // const o = Object.create(null)
         // Object.keys(cmd).forEach(key =>{
         //    if(cmd.hasOwnProperty(key) && !key.startsWith('_') && key!=='parent'){
         //       o[key] = cmd[key]
         //    }
         // })
         // args[args.length - 1] = o
         const code = `require('${rootFile}').call(null,${JSON.stringify(args)})`
         //win32下：cp.spawn('cmd',['/c','node','e',code])
         const child = spawn( 'node',['-e', code],{
            cwd: process.cwd(),
            stdio:'inherit',
         });
         child.on('error', e =>{
            log.error(e.message);
            process.exit(1);
         })
         child.on('exit', e=>{
            log.verbose('命令执行成功' + e);
            process.exit(e);
         })
      } catch (error) {
         log.error(error.message)
      }
      }
    
}

module.exports = exec;

'use strict';

const path = require('path')
const Package = require('@cloudscope-cli/package')
const log = require('@cloudscope-cli/log')

const SETTINGS = {
    init: '@imooc-cli/init'
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
      console.log(rootFile)
      if(rootFile){
         require(rootFile).apply(null,arguments);
      }
}

module.exports = exec;

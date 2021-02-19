'use strict';

const Package = require('@cloudscope-cli/package')
const log = require('@cloudscope-cli/log')

const SETTINGS = {
    init: '@cloudscope-cli/init'
 }
function exec() {
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
     pkg = new Package({
        targetPath,
        storeDir,
        packageName,
        packageVersion
     })
     console.log(pkg)
}

module.exports = exec;

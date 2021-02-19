'use strict';

const Package = require('@cloudscope-cli/package')
module.exports = exec;

function exec() {
    // 1. targetPath -> modulePath
   // 2. modulePath -> Package(npm模块)
   // 3. Package.getRootFile(获取入口文件)
   // 4. Package.update / Package.install
    let targetPath = process.env.CLI_TARGET_PATH
    const homePath = process.env.CLI_HOME_PATH
    const pkg = new Package()
}

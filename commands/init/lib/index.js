'use strict';
const Command = require('@cloudscope-cli/command')
const log = require('@cloudscope-cli/log')
class InitCommand extends Command {
    init(){
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose(this.projectName)
        log.verbose(this.projectName)
    }
    exec(){
        console.log('init的业务逻辑')
    }
}
// function init(projectName,options,command)  {
    // console.log('init',projectName,command.opts().force,process.env.CLI_TARGET_PATH)
// }
function init(argv)  {
    return new InitCommand(argv)
}
module.exports = init
module.exports.InitCommand = InitCommand;

'use strict';

function init(projectName,options,command)  {
    console.log('init',projectName,command.opts().force,process.env.CLI_TARGET_PATH)
}

module.exports = init;

'use strict';
const Command = require('@cloudscope-cli/command')
const log = require('@cloudscope-cli/log')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const fs = require('fs')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
class InitCommand extends Command {
    init(){
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose(this.projectName)
        log.verbose(this.force)
    }
    async exec(){
        try {
             //1.准备阶段
        const projectInfo = await this.prepare()
        if(projectInfo){
            log.verbose('projectInfo:',projectInfo)
            //2.下载模版
            this.downloadTemplate()
        }
        //3.安装模版
        } catch (e) {
            log.error(e.message)
        }
       
    }

    downloadTemplate(){
        //1.通过项目模板API获取项目模板信息
        //1.1 通过egg.js搭建一套后端系统
        //1.2通过npm存储项目模版
        //1.3将项目模版信息存储大盘mongodb中去
        //1.4通过egg.js获取mongodb中的数据并通过API返回
    }

    async prepare(){
        const localPath = process.cwd()
        // 1.判断当前目录是否为空
        if(!this.isDirEmpty(localPath)){
            let ifContinue = false
            if(!this.force){
                //询问是否继续创建
                 ifContinue = (await inquirer.prompt([{
                    type:'confirm',
                    name:'ifContinue',
                    default:false,
                    message:'当前文件夹不为空，是否继续创建项目？'
                }])).ifContinue
                if(!ifContinue){
                    return
                }
            }
            
            //2.是否强制清空
            if(ifContinue || this.force){
                //给用户做二次确认
                const { confirmDelete } = await inquirer.prompt({
                    type:'confirm',
                    name:'confirmDelete',
                    default:false,
                    message:'是否确认将当前文件夹目录清空？'
                })
                if(confirmDelete){
                    //清空当前目录
                    fse.emptyDirSync(localPath)
                }
            }
        }
        return  this.getProjectInfo()
    }

    async getProjectInfo(){
        let projectInfo = {};
        //1.选取创建项目或组件
        const { type } = await inquirer.prompt({
            type:'list',
            name:'type',
            message:'请选择初始化类型', 
            default:TYPE_PROJECT,
            choices: [{
                name: '项目',
                value: TYPE_PROJECT,
              }, {
                name: '组件',
                value: TYPE_COMPONENT,
              }]
        })
        //2.获取项目/组件的基本信息
        if(type === TYPE_PROJECT){
            //2.获取项目的基本信息
            const project = await inquirer.prompt([{
                type:'input',
                name:'projectName',
                message:'请输入项目的名称',
                default:'',
                validate:function(v){
                    const done = this.async()
                    setTimeout(function(){
                        if(!/^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)){
                            done('请输入合法的项目名称')
                            return;
                        }
                        done(null,true)
                    }, 0);
                },
                filter:function(v){
                    return v
                }
            },{
                type:'input',
                name:'projectVersion',
                message:'请输入项目版本号',
                default:'1.0.0',
                validate:function(v){
                    const done = this.async()
                    setTimeout(function(){
                        if(!(!!semver.valid(v))){
                            done('请输入合法的版本号')
                            return;
                        }
                        done(null,true)
                    }, 0);
                },
                filter:function(v){
                    if(!!semver.valid(v)){
                        return semver.valid(v)
                    }else{
                        return v
                    }
                }
            }])
            projectInfo = {
                type,
                ...project
            }
        }else if (type === TYPE_COMPONENT){
                // 获取组件的基本信息
        }
        return projectInfo
    }
    isDirEmpty(localPath){
        let fileList = fs.readdirSync(localPath)
        // 文件过滤逻辑
        fileList = fileList.filter(file => (
            !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
          ));
        return !fileList || fileList.length <= 0
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

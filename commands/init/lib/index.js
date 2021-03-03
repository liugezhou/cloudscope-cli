'use strict';

const path = require('path')
const Command = require('@cloudscope-cli/command')
const Package = require('@cloudscope-cli/package')
const { spinnerStart,sleep,execAsync } = require('@cloudscope-cli/utils')
const log = require('@cloudscope-cli/log')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const userHome = require('user-home')
const semver = require('semver')
const fs = require('fs')
const glob = require('glob')
const ejs = require('ejs')

const getTemplateProject = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_NORMALCUSTOM = 'custom'
const WHITE_COMMAND =['npm', 'cnpm']

class InitCommand extends Command {
    init(){
        this.projectName = this._argv[0] || '';
        this.force = !!this._cmd.force;
        log.verbose('projectName',this.projectName)
        log.verbose('force',this.force)
    }
    async exec(){
        try {
        //1.准备阶段
        const projectInfo = await this.prepare()
        if(projectInfo){
            this.projectInfo = projectInfo
            log.verbose('projectInfo:',projectInfo)
            //2.下载模版
            await this.downloadTemplate()
        }
        //3.安装模版
        await this.installTemplate()
        } catch (e) {
            if(process.env.LOG_LEVEL === 'verbose'){
                log.error(e.message)
            }
        }
    }

    async installTemplate(){
        if(this.templateInfo ){
            if( !this.templateInfo.type){
                this.templateInfo.type = TEMPLATE_TYPE_NORMAL
            }else if(this.templateInfo.type === TEMPLATE_TYPE_NORMAL){
                //标准安装
                await this.installNormalTemplate()
            }else if(this.templateInfo.type === TEMPLATE_TYPE_NORMALCUSTOM){
                //自定义安装
                await this.installCustomTemplate()
            }else{
                throw new Error('项目模板信息无法识别！')
            }
        }else{
            throw new Error('项目模版信息不存在！')
        }
    }
    async installNormalTemplate(){
        log.verbose('Package:',this.templateNpm)
        //拷贝模板代码至当前目录
        const spinner = spinnerStart('正在安装模板...')
        await sleep()
        try {
            // 去缓存目录中拿template下的文件路径
            const templatePath = path.resolve(this.templateNpm.cacheFilePath,'template')
            //当前执行脚手架目录
            const targetPath = process.cwd()
            fse.ensureDirSync(templatePath)//确保使用前缓存生成目录存在，若不存在则创建
            fse.ensureDirSync(targetPath)   //确保当前脚手架安装目录存在，若不存在则创建
            fse.copySync(templatePath,targetPath) //将缓存目录下文件copy至当前目录
        } catch (error) {
            throw error
        } finally{ 
            spinner.stop(true)
            log.success('模板安装成功')
        }
        //依赖安装
        const  templateIgnore = this.templateInfo.ignore || []
        const ignore = ['**/node_modules/**',...templateIgnore]
        await this.ejsRender({ignore})
        const { installCommand,startCommand } = this.templateInfo
        //依赖安装
        await this.execCommand(installCommand,'依赖过程安装失败！')
        //启动命令执行
        await this.execCommand(startCommand,'启动命令执行失败！')
    }
    async installCustomTemplate(){
        //查询自定义模版的入口文件
        if(await this.templateNpm.exists()){
            const rootFile = this.templateNpm.getRootFilePath()
            if(fs.existsSync(rootFile)){
                log.verbose('开始执行自定义模板')
                const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
                const options = {
                    templateInfo: this.templateInfo,
                    projectInfo: this.projectInfo,
                    sourcePath: templatePath,
                    targetPath: process.cwd(),
                  };
                const code = `require('${rootFile}')(${JSON.stringify(options)})`
                await execAsync('node',  ['-e', code], {stdio:'inherit',cwd: process.cwd()})
                log.success('自定义模版安装成功')
            }else{
                throw new Error('自定义模板入口文件不存在')
            }
        }
    }

    async ejsRender(options){
        const dir = process.cwd()
        const projectInfo = this.projectInfo
        return new Promise((resolve,reject)=>{
            glob('**',{
                cwd:dir,
                ignore:options.ignore || '',
                nodir:true   //不输出文件夹，只输出文件
            },(err,files) =>{
                if(err){
                    reject(err)
                }
                Promise.all(files.map(file=>{
                    const filePath = path.join(dir,file)
                    return new Promise( (resolve1,reject1) => {
                        ejs.renderFile( filePath,projectInfo,{},(err,result) => {
                            if(err){
                                reject1(err)
                            }
                            fse.writeFileSync(filePath,result)
                            resolve1(result)
                        })
                    })
                })).then(()=>{
                    resolve()
                }).catch(err=>{
                    reject(err)
                })
            })
        })
    }
    async downloadTemplate(){
        const {projectTemplate} = this.projectInfo
        const templateInfo = this.template.find(item=> item.npmName === projectTemplate)
        const targetPath = path.resolve(userHome,'.cloudscope-cli','template')
        const storeDir = path.resolve(userHome,'.cloudscope-cli','template','node_modules')
        const {npmName,version} = templateInfo
        this.templateInfo = templateInfo
        const templateNpm = new Package({
            targetPath,
            storeDir,
            packageName:npmName,
            packageVersion:version
        })
        if(await templateNpm.exists()){
            // 更新package
            log.verbose('更新template')
            const spinner = spinnerStart('正在更新模版...')
            await sleep();
            try {
                await templateNpm.update();
            } catch (error) {
                throw new Error(error)
            } finally{
                spinner.stop(true)
                if(await templateNpm.exists()){
                    log.success('更新模版成功！')
                    this.templateNpm = templateNpm
                }
            }
        }else{
            // 安装package
            log.verbose('安装template')
            const spinner = spinnerStart('正在下载模版...')
            await sleep();
            try {
                await templateNpm.install();
            } catch (error) {
                throw new Error(error)
            } finally{
                spinner.stop(true);
                if(await templateNpm.exists()){
                     log.success('下载模版成功！')
                     this.templateNpm = templateNpm
                }
            }
            
        }
    }

    async prepare(){
        //0 判断项目模板是否存在
        const template = await getTemplateProject();
        if(!template || template.length ===0){
            throw new Error('项目模版不存在')
        }
        this.template = template
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
        function isValidName(v) {
            return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v);
        } 
        let projectInfo = {};
        let isProjectNameValid = false //默认情况项目名称不合法 
        if (isValidName(this.projectName)) {
            isProjectNameValid = true;
            projectInfo.projectName = this.projectName;
          }
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
        this.template = this.template.filter(template =>template.tag && template.tag.includes(type))
        const title =  type === TYPE_PROJECT ? '项目':'组件'
        const projectNamePrompt = {
            type:'input',
            name:'projectName',
            message:`请输入${title}的名称`,
            default:'',
            validate:function(v){
                const done = this.async()
                setTimeout(function(){
                    if(!isValidName(v)){
                        done(`请输入合法的${title}名称`)
                        return;
                    }
                    done(null,true)
                }, 0);
            },
            filter:function(v){
                return v
            }
        }
        const projectPrompt = []
        if (!isProjectNameValid) {
            projectPrompt.push(projectNamePrompt);
          }
          projectPrompt.push({
            type:'input',
            name:'projectVersion',
            default:'1.0.0',
            message:`请输入${title}版本号`,
            validate:function(v){
                const done = this.async();
                // Do async stuff
                setTimeout(function() {
                if (!(!!semver.valid(v))) {
                    done(`请输入合法的${title}版本号`);
                    return;
                }
                done(null, true);
                }, 0);
            },
            filter:function(v){
                if(semver.valid(v)){
                    return semver.valid(v)
                } else {
                    return v
                }
            },
            },{
                type:'list',
                name:'projectTemplate',
                message:`请选择${title}模板`,
                choices: this.createTemplateChoice()
            })
        //2.获取项目/组件的基本信息
        if(type === TYPE_PROJECT){
            //2.获取项目的基本信息
            const project = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...project
            }
        }else if (type === TYPE_COMPONENT){
            // 获取组件的基本信息
            const descriptionPrompt = {
                type:'input',
                name:'componentDescription',
                message:'请输入组件描述信息',
                default:'',
                validate:function(v){
                    const done = this.async()
                    setTimeout(() => {
                        if(!v){
                            done('请输入组件描述信息')
                            return 
                        }
                        done(null,true)
                    }, 0);
                }
            }
            projectPrompt.push(descriptionPrompt)
            const component = await inquirer.prompt(projectPrompt)
            projectInfo = {
                ...projectInfo,
                type,
                ...component
            }
        }
        //生成className
        if(projectInfo.projectName){
            projectInfo.name = projectInfo.projectName
            projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/,'');
        }
        if(projectInfo.projectVersion){
            projectInfo.version = projectInfo.projectVersion
        }
         if(projectInfo.componentDescription){
            projectInfo.description = projectInfo.componentDescription
        }
        return projectInfo
    }

    createTemplateChoise(){
        return this.template.map(item=> ({
            value:item.npmName,
            name:item.name
        }))
    }

    isDirEmpty(localPath){
        let fileList = fs.readdirSync(localPath)
        // 文件过滤逻辑
        fileList = fileList.filter(file => (
            !file.startsWith('.') && ['node_modules'].indexOf(file) < 0
          ));
        return !fileList || fileList.length <= 0
    }

    async execCommand(command,errMsg){
        let ret 
        if(command){
            const cmdArray=command.split(' ')
            const cmd = this.checkCommand(cmdArray[0])
            if(!cmd){
                throw new Error(errMsg)
            }
            const args = cmdArray.slice(1)
            ret = await execAsync(cmd,args,{
                stdio:'inherit',
                cwd:process.cwd()
            })
            if(ret !== 0){//执行成功
                throw new Error(errMsg)
            }
            return ret
        }
    }

    checkCommand(cmd){
        if(WHITE_COMMAND.includes(cmd)){
            return cmd
        }
        return null;
    }

    createTemplateChoice(){
        return this.template.map(item=>({
            value: item.npmName,
            name:item.name
        }))
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

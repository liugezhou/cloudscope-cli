'use strict';

const path = require('path')
const fs = require('fs')
const SimpleGit = require('simple-git')
const userHome = require('user-home')
const semver = require('semver')
const log = require('@cloudscope-cli/log')
const { readFile,writeFile,spinnerStart } = require('@cloudscope-cli/utils')
const CloudBuild = require('@cloudscope-cli/cloudbuild')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const terminalLink = require('terminal-link')
const Github = require('./Github')
const Gitee = require('./Gitee');

const DEFAULT_CLI_HOME = '.cloudscope-cli'
const GIT_ROOT_DIR = '.git'
const GIT_SERVER_FILE = '.git_server'
const GIT_TOKEN_FILE = '.git_token'
const GIT_OWN_FILE = '.git_own'
const GIT_LOGIN_FILE = '.git_login'
const GIT_PUBLISH_FILE='.git_publish'

const GITHUB = 'github'
const GITEE ='gitee'
const REPO_OWNER_USER = 'user'
const REPO_OWNER_ORG = 'org'
const GIT_IGNORE_FILE='.gitignore'
const VERSION_RELEASE = 'release'
const VERSION_DEVELOP = 'dev'

const GIT_SERVER_TYPE = [{
    name:'Github',
    value: GITHUB
},{
    name: 'Gitee',
    value: GITEE
}]
const GIT_OWNER_TYPE = [{
    name:'个人',
    value: REPO_OWNER_USER
},{
    name: '组织',
    value: REPO_OWNER_ORG
}]
const GIT_OWNER_TYPE_ONLY = [{
    name:'个人',
    value: REPO_OWNER_USER
}]
const GIT_PUBLISH_TYPE=[{
    name:'OSS',
    value:'oss'
}]

class Git {
    constructor({name, version, dir},{
        refreshServer = false,
        refreshOwner = false ,
        buildCmd  = '',
        prod  = false }){
        this.name = name    //发布项目名称
        this.version = version  //发布项目版本
        this.dir = dir      // 源码目录
        this.git = SimpleGit(dir)   //SimpleGit实例
        this.gitServer = null   //gitServer实例
        this.homePath = null    //本地缓存目录
        this.refreshServer = refreshServer  //是否重新选择托管平台
        this.refreshOwner = refreshOwner  //是否重新选择用户类型
        this.buildCmd = buildCmd //构建命令
        this.prod = prod //正式环境命令
        this.token = null   // GitServer Token
        this.user = null    //用户信息
        this.orgs = null    //用户所属组织列表
        this.owner = null  //远程仓库类型
        this.login = null   //远程仓库登录名
        this.repo = null //远程仓库信息
        this.branch = null //本地开发分支
        this.gitPublish=null //缓存文件.git_publish内容,静态资源服务器类型
    }
    
    async prepare(){
        this.checkHomePath();// 检查缓存主目录
        await  this.checkGitServer();//检查用户远程仓库类型
        await this.checkGitToken(); //获取远程仓库Token
        await this.getUserAndOrgs();//获取远程仓库用户和组织信息
        await this.checkGitOwner();//确认远程仓库类型
        await this.checkRepo(); //  检查并创建远程仓库
        this.checkGitIgnore();//检查并创建.gitignore文件
        await this.init(); //完成本地仓库初始化
    }
    async commit(){
        // 1.生成开发分支
        await this.getCorrectVersion()
        // 2.检查stash区
        await this.checkStash();
        // 3.检查代码冲突
        await this.checkConflicted()
        // 4.检查未提交代码
        await this.checkNotCommitted();
        //5.切换开发分支
        await this.checkoutBranch(this.branch)
        // 6.合并远程master分支和开发分支代码
        await this.pullRemoteMasterAndBranch();
        // 7.将开发分支推送到远程仓库
        await this.pushRemoteRepo(this.branch);
    }
    
    async publish(){
        await this.preparePublish()
        const cloudBuild = new CloudBuild(this,{
            buildCmd:this.buildCmd,
            type:this.gitPublish ,
            prod:this.prod
        })
        // await cloudBuild.prepare()
        await cloudBuild.init()
        await cloudBuild.build()
    }

    async preparePublish(){
        log.info('开始进行云构建前代码检查')
        // 是否为前端项目
        const pkg = this.getPackageJson()
        if(this.buildCmd){
            const buildCmdArray = this.buildCmd.split(' ')
            if(!Object.is(buildCmdArray[0],'npm') && !Object.is(buildCmdArray[0],'cnpm')){
                throw new Error('Build命令非法，必须使用npm或cnpm！')
            }
        }else{
            this.buildCmd = 'npm run build'
        }
        const buildCmdArray = this.buildCmd.split(' ')
        const lastCmd = buildCmdArray.slice(-1).toString()
        if(!pkg.scripts || !Object.keys(pkg.scripts).includes(lastCmd)){
            throw new Error(`${this.buildCmd}命令不存在`)
        }
        log.success('云构建代码预检查通过')
        const gitPublishPath = this.createPath(GIT_PUBLISH_FILE)
        let gitPublish = readFile(gitPublishPath)
        if(!gitPublish){ // 如果没有读取到.git-publish文件中的内容
            gitPublish = await this.choicePublish(gitPublishPath)
            log.success('git publish 写入成功',`${gitPublish} -> ${gitPublishPath}`)
        }else{ // 如果读取到了 内容
           log.success('git publish 文件读取成功！')
        }
        this.gitPublish = gitPublish
    }

    getPackageJson(){
        const pkgPath = path.resolve(this.dir,'package.json')
        if(!fs.existsSync(pkgPath)){
            throw new Error(`package.json不存在,源码目录:${this.dir}`)
        }
        return fse.readJsonSync(pkgPath)
    }
    async pullRemoteMasterAndBranch(){
        log.info(`合并[master] -> [${this.branch}]`)
        await this.pullRemoteRepo('master')
        log.success('合并远程[mater]分支代码成功')
        await this.checkConflicted()
        log.info('检查远程开发分支')
        const remoteBranchList = await this.getRemoteBranchList()
       if(remoteBranchList.indexOf(this.version) >=0){
            log.info(`合并[${this.branch}] -> [${this.branch}]`)
            await this.pullRemoteRepo(this.branch);
            log.success(`合并远程[${this.branch}]分支代码成功`)
            await this.checkConflicted()
       }else{
           log.success(`不存在远程分支[${this.branch}]`)
       }
    }
    async checkoutBranch(branch){
        const localBranchList = await this.git.branchLocal()
        if(localBranchList.all.indexOf(branch) >-1){
            await this.git.checkout(branch)
        }else{
            await this.git.checkoutLocalBranch(branch)
        }
        log.success(`分支切换到${branch}`)
    }
    async checkStash(){
        //1. 检查stash list
        const stashList = await this.git.stashList()
        if(stashList.all.length >0){
            await this.git.stash['pop']
            log.success('stash pop成功')
        }
    }
    async getCorrectVersion(){
         // 1.获取远程发布分支
         // 规范：release/x.y.z ,dev/x.y.z
         // 版本号递增规范：major/minor/patch
         log.info('获取远程仓库代码分支')
         const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE)
         let releaseVersion = null;
         if(remoteBranchList && remoteBranchList.length>0){
             releaseVersion = remoteBranchList[0]
         }
         log.verbose('releaseVersion',releaseVersion)
         //2.生成本地开发分支
         const devVersion = this.version
         if(!releaseVersion){  // 不存在远程发布分支
             this.branch = `${VERSION_DEVELOP}/${devVersion}`
         }else if(semver.gt(this.version,releaseVersion)){ //本地分支大于远程发布分支
            log.info('当前版本大于线上最新版本',`${devVersion} >= ${releaseVersion}`)
            this.branch = `${VERSION_DEVELOP}/${devVersion}`
         }  else {
             log.info('当前线上版本大于本地版本',`${releaseVersion} > ${devVersion}`)
             const incType = (await inquirer.prompt({
                type:'list',
                name:'incType',
                message:'自动升级版本，请选择升级版本',
                default:'patch',
                choices:[{
                    name:`小版本(${releaseVersion} -> ${semver.inc(releaseVersion,'patch')})`,
                    value:'patch'
                },{
                    name:`中版本(${releaseVersion} -> ${semver.inc(releaseVersion,'minor')})`,
                    value:'minor'
                },{
                    name:`大版本(${releaseVersion} -> ${semver.inc(releaseVersion,'major')})`,
                    value:'major'
                }]
             })).incType
             const incVersion = semver.inc(releaseVersion,incType)
             this.branch = `${VERSION_DEVELOP}/${incVersion}`
             this.version = incVersion
         }
         log.verbose('本地开发分支',this.branch)
         //3.将version同步到package.json
         this.syncVersionToPackageJson()
    }

    syncVersionToPackageJson(){
        const pkg = fse.readJsonSync(`${this.dir}/package.json`)
        if(pkg && pkg.version!== this.version){
            pkg.version = this.version
            fse.writeJsonSync(`${this.dir}/package.json`,pkg,{spaces:2})
        }
    }
    async getRemoteBranchList(type){
        const remoteList = await this.git.listRemote(['--refs'])
        let reg;
         if(type === VERSION_RELEASE ){
            reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g
         }else{
            reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g
         }
        return remoteList.split('\n').map(remote =>{
            const  match = reg.exec(remote)
            reg.lastIndex = 0
            if(match &&semver.valid(match[1]) ){
                return match[1]
            }
        }).filter(_ => _ ).sort((a,b) => {
            if(semver.lte(b,a)){
                if(a===b) return 0;
                return -1
            }
            return 1
        })
        
    }
    
    checkHomePath(){
        if(!this.homePath){
            if(process.env.CLI_HOME_PATH){
                this.homePath = process.env.CLI_HOME_PATH
            }else{
                this.homePath = path.resolve(userHome,DEFAULT_CLI_HOME)
            }
        }
        log.verbose('home:',this.homePath )
        fse.ensureDirSync(this.homePath);
        if(!fs.existsSync(this.homePath)){
            throw new Error('用户主目录获取失败！')
        }
    }

    async checkGitToken(){
        const tokenPath = this.createPath(GIT_TOKEN_FILE)
        let token = readFile(tokenPath)
        if(!token || this.refreshServer){
            log.warn(this.gitServer.type + ' token未生成,请先生成' + this.gitServer.type + ' token,' + terminalLink('链接', this.gitServer.getTokenUrl() )) ;
            token = (await inquirer.prompt({
                type:'password',
                name:'token',
                message:'请将token复制到这里',
                default:'',
            })).token
            writeFile(tokenPath,token)
            log.success('token 写入成功',` ${tokenPath}`)
        }else{
            log.success('token获取成功',tokenPath)
        }
        this.token  = token
        this.gitServer.setToken(token)
    }

    async checkGitServer(){
        const gitServerPath = this.createPath(GIT_SERVER_FILE)
        let gitServer = readFile(gitServerPath)
        if(!gitServer){ // 如果没有读取到.git-server文件中的内容
            gitServer = await this.choiceServer(gitServerPath)
            log.success('git server 写入成功',`${gitServer} -> ${gitServerPath}`)
        }else{ // 如果读取到了 内容
            if(this.refreshServer){ // 是否重写标识
                const refresh = (await inquirer.prompt([{
                    type:'confirm',
                    name:'ifContinue',
                    default:false,
                    message:'当前.git-server目录已存在，是否要重写选择托管平台？'
                }])).ifContinue
                if(refresh){
                    gitServer = await this.choiceServer(gitServerPath)
                    log.success('git server 重写成功',`${gitServer} -> ${gitServerPath}`)
                }else{
                    log.success('git server 获取成功 ', gitServer)
                }
            }else{ //不重写，直接读取
                log.success('git server 获取成功 ', gitServer)
            }
        }
        this.gitServer = this.createServer(gitServer)
        if(!this.gitServer){
            throw new Error('GitServer初始化失败。请添加--refreshServer参数重新生成.git-server文件')
        }
    }

    async getUserAndOrgs(){
        this.user = await this.gitServer.getUser()
        if(!this.user){
            throw new Error('用户信息获取失败')
        }
        log.verbose('user',this.user)
        this.orgs = await this.gitServer.getOrg(this.user.login)
        if(!this.orgs){
            throw new Error('组织信息获取失败')
        }
        log.verbose('orgs',this.orgs)
        log.success(this.gitServer.type + ' 用户和组织信息获取成功')
    }

    async checkGitOwner(){
        const ownerPath =this.createPath(GIT_OWN_FILE) ;
        const loginPath =this.createPath(GIT_LOGIN_FILE) ;
        let owner = readFile(ownerPath)
        let login = readFile(loginPath)
        if(!owner || !login || this.refreshOwner){
            owner = (await inquirer.prompt({
                type:'list',
                name:'owner',
                message:'请选择远程仓库类型',
                default: REPO_OWNER_USER,
                choices:this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY
            })).owner
            if(owner === REPO_OWNER_USER){
                login = this.user.login
            }else{
                login = (await inquirer.prompt({
                    type:'list',
                    name:'login',
                    message:'请选择',
                    choices:this.orgs.map(item =>({
                        name:item.login,
                        value: item.login,
                    }))
                })).login
            }
            writeFile(ownerPath,owner)
            writeFile(loginPath,login)
            log.success('owner 写入成功',`${owner} -> ${ownerPath}`)
            log.success('login 写入成功',`${login} -> ${loginPath}`)
        }else{
            log.success('owner 读取成功',`${owner} -> ${ownerPath}`)
            log.success('login 读取成功',`${login} -> ${loginPath}`)
        }
        this.owner = owner
        this.login = login
    }

    async checkRepo(){
        let repo = await this.gitServer.getRepo(this.login,this.name)
        if(!repo){ //如果远程仓库不存在，就去创建
            let spinner = spinnerStart('开始创建远程仓库')
            try {
                if(this.owner === REPO_OWNER_USER){
                     repo = await this.gitServer.createRepo(this.name)
                     log.success('用户个人远程仓库创建成功！')
                }else{
                    repo = await this.gitServer.createOrgRepo(this.name,this.login)
                    log.success('用户组织远程仓库创建成功!')
                }
            } catch (error) {
                log.error(error)
            }finally {
                spinner.stop(true)
            }
            if(!repo){
                throw new Error('远程仓库创建失败')
            }
        }else{
            log.success('远程仓库已存在且获取成功！')
        }
        this.repo = repo
    }
    createServer(gitServer){
        if(gitServer === GITHUB){
            return new Github()
        }
        if(gitServer === GITEE){
            return new Gitee()
        }
        return null
    }

    async choiceServer(gitServerPath){
        const gitServer = (await inquirer.prompt({
            type:'list',
            name:'server',
            message:'请选择你想要托管的Git平台',
            default: GITHUB,
            choices:GIT_SERVER_TYPE
        })).server;
        writeFile(gitServerPath,gitServer)
        return gitServer
    }

    async choicePublish(gitPublishPath){
        const gitPublish = (await inquirer.prompt({
            type:'list',
            name:'gitPublish',
            message:'请选择你想要上传代码的平台',
            choices:GIT_PUBLISH_TYPE
        })).gitPublish;
        writeFile(gitPublishPath,gitPublish)
        return gitPublish
    }
    checkGitIgnore(){
        const gitIgnorePath = path.resolve(this.dir,GIT_IGNORE_FILE)
        if(!fs.existsSync(gitIgnorePath)){
            writeFile(gitIgnorePath,`.DS_Store
node_modules
/dist


# local env files
.env.local
.env.*.local

# Log files
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor directories and files
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
`)
            log.success(`自动写入${GIT_IGNORE_FILE}文件成功！`)
        }
    }
    createPath(file){
        const rootDir = path.resolve(this.homePath,GIT_ROOT_DIR)
        const serverDir = path.resolve(rootDir,file)
        fse.ensureDirSync(rootDir)
        return serverDir
    }
    
    async init(){
        if( await this.getRemote()){ //如果已经完成了.git初始化那么就不再执行下面的方法
            return
        }
        await this.initAndAddRemote(); // 如果本地仓库没有.git文件，那么就git init 和git remote add origin repos
        await this.initCommit(); // 在项目初始化的过程中，如果此时代码有.git文件，除了以上两部外，还要检查前代码是否有冲突等操作去推送此时的本地文件代码
    }

    async initAndAddRemote(){
        log.info('执行git初始化')
        await this.git.init(this.dir)
        log.info('添加git remote')
        const remotes = await this.git.getRemotes();
        if(!remotes.find(item => item.name === 'origin')){
            await this.git.addRemote('origin',this.remote)
        }
    }
    async getRemote(){
        const gitPath = path.resolve(this.dir,GIT_ROOT_DIR)
        this.remote = this.gitServer.getRemote(this.login,this.name)
        if(fs.existsSync(gitPath)){
            log.success('git已完成初始化')
            return true
        }
    }

    async initCommit(){
        await this.checkConflicted(); //检查代码冲突
        await this.checkNotCommitted();//检查代码未提交
        if(await this.checkRemoteMaster()){ //判断远程仓库master分支是否已存在
            await this.pullRemoteRepo('master',{
                '--allow-unrelated-histories':null
            })
        } else {
            await this.pushRemoteRepo('master')  //如果不存在直接push代码
        }

    }
    async checkConflicted(){
        log.info('代码冲突检查')
        const status = await this.git.status()
        if(status.conflicted.length > 0 ){
            throw new Error('当然代码存在冲突，请手动处理合并后再试')
        }
        log.success('代码冲突检查通过')
    }

    async checkNotCommitted(){
        const status = await this.git.status()
        if(status.not_added.length >0 || 
            status.created.length >0 ||
            status.deleted.length>0 ||
            status.modified.length>0 ||
            status.renamed.length>0
           ){
            log.verbose('status',status)
            await this.git.add(status.not_added)
            await this.git.add(status.created)
            await this.git.add(status.deleted)
            await this.git.add(status.modified)
            await this.git.add(status.renamed)
            let message;
            while (!message) {
                message = (await inquirer.prompt({
                    type:'text',
                    name:'message',
                    message:'请输入commit信息'
                })).message
            }
            await this.git.commit(message)
            log.success('本次commit提交成功！')
        }
    }
    async checkRemoteMaster(){
        // git ls-remote
        return (await this.git.listRemote(['--refs'])).indexOf('refs/heads/master') >=0
    }
    async pushRemoteRepo(branchName){
        log.info(`推送代码至${branchName} 分支`)
        await this.git.push('origin',branchName)
        log.success('推送代码成功！')
    }
    async pullRemoteRepo(branchName,options){
        log.info(`同步远程${branchName}分支代码`)
        await this.git.pull('origin',branchName,options)
            .catch(err=>{
                log.error(err.message)
            })
    }
}

module.exports = Git;
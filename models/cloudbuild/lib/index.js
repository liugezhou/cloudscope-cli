'use strict';

const io = require('socket.io-client');
const inquirer = require('inquirer')
const log = require('@cloudscope-cli/log')
const get =require('lodash/get')
const getProjectOSS = require('./getProjectOSS')
const TIME_OUT = 5* 60*1000
const CONNET_TIME_OUT = 5*1000
const WS_SERVER = 'http://liugezhou.com:7001'

const FAILED_CODE = ['prepare failed','download failed','install failed','build failed','pre-publish failed','publish failed']

function parseMsg(msg){
  const action = get(msg,'data.action')
  const message = get(msg,'data.payload.message')
  return {
    action,
    message
  }
}
class CloudBuild {
  constructor(git, options){
     this.git = git
     this.buildCmd = options.buildCmd
     this.timeout = TIME_OUT
     this.socket = null
     this.type = options.type
     this.prod = options.prod
  }

  doTimeout(fn,timeout){
    this.timer && clearTimeout(this.timer)
    log.info('设置任务超时时间：',`${timeout/1000}秒`)
    this.timer = setTimeout(fn,timeout);
  }

  async prepare(){
    // 判断是否处于正式发布
    if(this.prod){
    // 1.获取OSS文件 
      const name = this.git.name
      const type = this.prod ? 'prod':'dev'
      const ossProject = await getProjectOSS({name,type})
      console.log(ossProject)
    //2.判断当前项目OSS文件是否存在
      if(Object.is(ossProject.code,0) && ossProject.data.length>0){
    // 3.询问客户是否进行覆盖安装
        const cover = (await inquirer.prompt({
          type:'list',
          defaultValue:true,
          name:'cover',
          message:`OSS已存在[${name}]项目，是否强行覆盖发布？`,
          choices:[{
            name:'覆盖发布',
            value:true
          },{
            name:'放弃发布',
            value:false
          }]
        })).cover
        if(!cover){ //放弃发布
          throw new Error('发布终止')
        }
      }
    
    }
   
  }
   init(){
    return new Promise((resolve,reject)=>{
      const socket = io(WS_SERVER,{
        query:{
          repo:this.git.remote,
          name:this.git.name,
          branch:this.git.branch,
          version:this.git.version,
          buildCmd:this.buildCmd,
          type:this.type,
          prod:this.prod
        }
      })
      const disconnect = ()=>{
        clearTimeout(this.timer)
        socket.disconnect()
        socket.close()
      }
      this.doTimeout(()=>{
      log.error('云构建服务连接超时，自动终止')    
      disconnect()
      }, CONNET_TIME_OUT);
  
      socket.on('connect', () => {
        clearTimeout(this.timer)
        const {id} = socket
        socket.on(id,msg=>{
          const parsedMsg = parseMsg(msg)
          log.success(parsedMsg.action,parsedMsg.message,`任务ID：${id}`)
        })
        resolve()
      });
  
      socket.on('disconnect',()=>{
        log.success('disconnect','云构建任务断开')
        disconnect();
      })
  
      socket.on('error',(err)=>{
        log.error('error','云构建错误',err)
        disconnect()
        reject(err)
      })
      this.socket = socket
    })
  }

   build(){
    return new Promise((resolve,reject)=>{
      this.socket.emit('build')
      this.socket.on("build",msg=>{
        const parsedMsg = parseMsg(msg)
        if(FAILED_CODE.indexOf(parsedMsg.action)>-1){
          log.error(parsedMsg.message)
          clearTimeout(this.timer)
          this.socket.disconnect()
          this.socket.close()
        }else{
          log.success(parsedMsg.action,parsedMsg.message)
        }
      })
      this.socket.on('building',msg=>{
        console.log(msg)
      }) 
    })
  }
}
 module.exports = CloudBuild
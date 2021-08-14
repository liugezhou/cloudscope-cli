'use strict';

const io = require('socket.io-client');
const log = require('@cloudscope-cli/log')
const TIME_OUT = 5* 60*1000
const CONNET_TIME_OUT = 5*1000
const WS_SERVER = 'http://liugezhou.com:7001'
class CloudBuild {
  constructor(git, options){
    this.git = git
     this.buildCmd = options.buildCmd
     this.timeout = TIME_OUT
  }

  doTtimeout(fn,timeout){
    this.timer && clearTimeout(this.timer)
    log.info('设置任务超时时间：',`${timeout/1000}秒`)
    this.timer = setTimeout(fn,timeout);
  }
  init(){
    const socket = io(WS_SERVER,{
      query:{
        repo:this.git.remote
      }
    })
    const disconnect = ()=>{
      clearTimeout(this.timer)
      socket.disconnect()
      socket.close()
    }
   this.doTtimeout(()=>{
    log.error('云构建服务连接超时，自动终止')    
    disconnect()
    }, CONNET_TIME_OUT);
    socket.on('connect', () => {
    console.log('connect!');
    // socket.emit('chat', 'hello world!');
  });
  }
}
 module.exports = CloudBuild
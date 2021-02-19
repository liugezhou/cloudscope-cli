'use strict';

const path = require('path');
const pkgDir = require('pkg-dir').sync;
const { isObject }  = require('@liugezhou-cli-dev/utils');
const formatPath  = require('@liugezhou-cli-dev/format-path');
class Package {
    constructor(options){
        if( !options){
            throw new Error('Package类的options参数不能为空！')
        }
        if( !isObject(options) ){
            throw new Error('Package类的options参数必须为对象！')
        }
        // package路径
        this.targetPath = options.targetPath
        // package的存储路径
        this.storeDir = options.storeDir
        // package的name
        this.packageName = options.packageName
        // package的version
        this.packageVersion = options.packageVersion;
        // package的缓存目录前缀
        this.cacheFilePathPrefix = this.packageName.replace('/', '_')
    }
    get cacheFilePath() {
        return path.resolve(this.storeDir,`_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
    }
    // 判断当前Package是否存在
    exists(){

    }

    // 安装Package
    install(){

    }
    //更新Package
    update(){

    }

    //获取入口文件路径
    getRootFilePath(){
        function _getRootFile(targetPath) {
            // 1. 获取package.json所在目录
            const dir = pkgDir(targetPath);
            if (dir) {
              // 2. 读取package.json
              const pkgFile = require(path.resolve(dir, 'package.json'));
              // 3. 寻找main/lib
              if (pkgFile && pkgFile.main) {
                // 4. 路径的兼容(macOS/windows)
                return formatPath(path.resolve(dir, pkgFile.main));
              }
            }
            return null;
          }
          if (this.storeDir) {
            return _getRootFile(this.cacheFilePath);
          } else {
            return _getRootFile(this.targetPath);
          }
    }
}

module.exports = Package;

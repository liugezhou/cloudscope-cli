'use strict';

const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

 function getNpmInfo(npmName,registry) {
    if(!npmName){
        return null;
    }
    const registryUrl =  registry || getDefaultRegistry();
    const npmInfoUrl = urlJoin(registryUrl,npmName);
    return axios.get(npmInfoUrl).then(res => {
        if(res.status === 200){
            return res.data
        }else{
            return null;
        }
    }).catch(err => {
        return Promise.reject(err)
    })
}

async function getNpmVersions(npmName,registry){
    const data = await getNpmInfo(npmName,registry)
    if(data){
        return Object.keys(data.versions)
    }else{
        return [];
    }
}

 function getSemverVersion(baseVersion,versions){
    return versions
            .filter(version =>semver.satisfies(version, `>${baseVersion}`))
            .sort((a,b) => semver.gt(b,a))
}

async function getNpmSemverVersion(baseVersion,npmName,registry){
    const versions = await getNpmVersions(npmName,registry)
    const newVersions =   getSemverVersion(baseVersion,versions)
    if(newVersions && newVersions.length > 0){
        return newVersions[0] 
    }else{
        return null
    }
}

function getLatestVersion(npmName,registry){
    if(!npmName){
        return null;
    }
    const registryUrl =  registry || getDefaultRegistry();
    const npmInfoUrl = urlJoin(registryUrl,npmName);
    return axios.get(npmInfoUrl).then(res => {
        if(res.status === 200){
            return res.data['dist-tags'].latest
        }else{
            return null;
        }
    }).catch(err => {
        return Promise.reject(err)
    })
}
function getDefaultRegistry(isOriginal = false){
    return isOriginal ? 'https://registry.npmjs.com' : 'https://registry.npm.taobao.org'
}

async function getNpmLatestVersion(npmName,registry){
    let versions = await getNpmVersions(npmName,registry)
    if(versions){
        return versions.sort((a, b) => semver.gt(b, a))[0];
    }
    return null
}

module.exports = {
    getNpmInfo,
    getNpmVersions,
    getNpmSemverVersion,
    getDefaultRegistry,
    getNpmLatestVersion,
    getLatestVersion
};

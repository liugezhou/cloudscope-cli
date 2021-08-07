function error(methodName) {
    throw new Error(`${methodName} must be implemented!` )
}

class GitServer {
    constructor(type,token){
        this.type= type
        this.token = token
    }

    setToken(token){
       this.token = token
    }

    createRepo(){
        error('createRepo')
    }

    createOrgRepo(){
        error('createOrgRepo')
    }

    getRemote(){
        error('getRemote')
    }
    getUser(){
        error('getUser')
    }
    getOrg(){
        error('getOrg')
    }
    getTokenUrl(){
        error('getTokenUrl')
    }
    getTokenHelpUrl(){
        error('getTokenHelpUrl')
    }
    
}

module.exports = GitServer
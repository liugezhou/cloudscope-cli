const GitServer = require('./GitServer')
const GithubRequest = require('./GithubRequest')

class Github extends GitServer{
    constructor(){
        super('github')
        this.request = null
    }
    getTokenUrl(){
        return 'https://github.com/settings/tokens';
    }
    getTokenHelpUrl(){
        return 'https://docs.github.com/en/github/authenticating-to-github/connecting-to-github-with-ssh'
    }
    
    setToken(token){
        super.setToken(token)
        this.request = new GithubRequest(token)
    }
    getUser(){
        return this.request.get('/user').then(response=>{
            return response
        })
    }
    getOrg(username){
        return this.request.get(`/user/orgs`,{
            page:1,
            per_page:100
        }).then(res => {
            return res
        })
    }
}

module.exports = Github
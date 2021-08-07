const GitServer = require('./GitServer')
const GiteeRequest = require('./GiteeRequest')

class Gitee extends GitServer{
    constructor(){
        super('gitee');
        this.request = null
    }

    getTokenUrl(){
        return 'https://gitee.com/personal_access_tokens';
    }
    getTokenHelpUrl(){
        return 'https://gitee.com/personal_access_tokens'
    }
    setToken(token){
        super.setToken(token)
        this.request = new GiteeRequest(token)
    }
    getUser(){
        return this.request.get('/user').then(response=>{
            return response
        })
    }
    getOrg(username){
        return this.request.get(`/users/${username}/orgs`,{
            page:1,
            per_page:100
        }).then(res => {
            return res
        })
    }
}

module.exports = Gitee
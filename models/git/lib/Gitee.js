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
        return 'https://gitee.com/help/articles/4191';
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
    getRepo(login,name){
        //GET https://gitee.com/api/v5/repos/{owner}/{repo}
        return this.request
                .get(`/repos/${login}/${name}`)
                .then(response =>{
                    return this.handleResponse(response)
                })
    }
    createRepo(name){
        // POST https://gitee.com/api/v5/user/repos
        return this.request.post(`/user/repos`,{
            name,
        },{
            accept:'application/vnd.github.v3+json'
        })
    }
    createOrgRepo(name,login){
        return this.request.post(`/orgs/${login}/repos`,{
            name
        })
    }
}

module.exports = Gitee
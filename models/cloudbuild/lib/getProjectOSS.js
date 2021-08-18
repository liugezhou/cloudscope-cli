const request = require('@cloudscope-cli/request')

module.exports = function (data) {
    return request({
        url:'/project/oss',
        method:'get',
        params:data
    })
}
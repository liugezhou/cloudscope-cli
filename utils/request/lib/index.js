'use strict';

const axios = require('axios')
const baseURL=process.env.CLOUDSCOPE_CLI_BASEURL ? process.env.CLOUDSCOPE_CLI_BASEURL:'http://liugezhou.com:7002'
const request =axios.create({
    baseURL,
    timeout:5000
})

request.interceptors.response.use(
    response =>{
            return response.data
    },
    error =>{
        return Promise.reject(error)
    }
)
module.exports = request;
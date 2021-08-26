const axios = require('axios');
const log = require('@cloudscope-cli/log');

module.exports = {
  createComponent: async function(component) {
    try {
      const response = await axios.post('http://liugezhou.com:7001/api/v1/components', component);
      const { data } = response;
      if (data.code === 0) {
        return data.data;
      }
      return null;
    } catch (e) {
      throw e;
    }
  },
};
'use strict';

const log = require('npmlog')
log.level = process.env.LOG_LEVEL? process.env.LOG_LEVEL : 'info'
log.headingStyle = { fg: 'red', bg: 'white' }
log.heading = 'liugezhou'
log.addLevel('success', 2500, { fg: 'green' })

module.exports = log;
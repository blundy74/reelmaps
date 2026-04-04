const serverlessExpress = require('@vendia/serverless-express')
const { app } = require('./server.js')

exports.handler = serverlessExpress({ app })

require('json-dotenv')('.config.json')
require('dotenv').config({path:'credentials.env'})
const express = require('express')
const router = require('./router')
const logger = require('./log/logConfig')
const moment = require('moment')
const redis = require('redis');
const client = redis.createClient();
client.auth(process.env.redisAuth)
const template = require('./lib/template')
require('moment-timezone')
moment.tz.setDefault("Asia/Seoul");
const proBatch = require('./batch/productBatch')
const ordBatch = require('./batch/orderBatch')
const app = express()


app.use(express.json())

app.use('/voider',(req,res,next)=>{
    req.cache = client
    next()
})
app.use('/voider',router)

app.listen(process.env.port, ()=>{
    logger.log("voider port is "+ process.env.port)
})


const today = moment().format('YYYYMMDD')
const now = moment().format('YYYYMMDDHHmm')
//ordBatch.orderBatch("kis6473",today+"0000",now,process.env.openapikey)
//proBatch.productBatch("kis6473",process.env.openapikey)
/*
template.getVoider("kis6473",(err, result)=>{
    console.log(result)
})
*/
/*
template.updateSender("kis6473","2","한진택배ㄴ","232323",(err, result)=>{
    console.log(result)
})
*/
// 주문 목록 가져오기
// 상품 재고, 가격 변경
// 상품 재고, 가격 조회
// 운송장 조회


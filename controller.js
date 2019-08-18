'use strict'
const request = require('request')
const iconv = require('iconv-lite')
const xml2js = require('xml2js')
const logger = require('./log/logConfig')
const parser = new xml2js.Parser()
const pool = require('./lib/db')
const db = require('./lib/template')
const moment = require('moment')
require('moment-timezone')

exports.cs_inquire_csNumber = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const order_inquireNumber = parseInt(req.body.action.parameters["order_inquireNumber"].value)
    const startTime = moment().format('YYYYMMDD')
    const endTime = moment().format('YYYYMMDD')
    const userAPI = process.env.openapikey
    const userID = "kis6473"
    const result = await getProductQnA(startTime-1,endTime,userAPI)
    if(result['ns2:result_code']==500){
        responseObj['output'] = {'cs_inquireNumber_prompt':'새로운 고객 컴플레인이 없습니다.'}
    }
    else if(result['ns2:result_code']==-1000){
        responseObj['output'] = {'cs_inquireNumber_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
    }else{
        const QnA = result['ns2:productQna']
        if(QnA.length<order_inquireNumber){
            responseObj['output'] = {'cs_inquireNumber_prompt':"해당 문의번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}
        }else{
            const obj = {"state":process.env.informCode, "informNumber":order_inquireNumber}
            hmsetRedis(req, userID, obj, 60*5)
            responseObj['output'] = {'cs_inquireNumber_prompt':order_inquireNumber+"번 문의 "+ QnA[order_inquireNumber-1].memNM+" 고객님, "+QnA[order_inquireNumber-1].brdInfoSbjct+" 라는 제목의 "+ QnA[order_inquireNumber-1].qnaDtlsCdNm+" 관련 문의가 있습니다. 자세하게 들으시려면 상세조회라고 말씀해주세요." }
        }        
        console.log(QnA)
    }    
    return res.json(responseObj)
}
exports.cs_inquire = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const startTime = moment().format('YYYYMMDD')
    const endTime = moment().format('YYYYMMDD')
    const userAPI = process.env.openapikey
    const userID = "kis6473"
    const result = await getProductQnA(startTime-1,endTime,userAPI)
    if(result['ns2:result_code']==500){
        responseObj['output'] = {'cs_inquire_prompt':'새로운 고객 컴플레인이 없습니다.'}
    }
    else if(result['ns2:result_code']==-1000){
        responseObj['output'] = {'cs_inquire_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
    }else{
        const QnA = result['ns2:productQna']
        const obj = {"state":process.env.informCode, "informNumber":0}
        hmsetRedis(req, userID, obj, 60*5)
        responseObj['output'] = {'cs_inquire_prompt': "신규문의 "+QnA.length+"건이 있습니다. 자세하게 들으시려면, 상세조회라고 말씀해주세요."}
        console.log(QnA)
    }    
    return res.json(responseObj)
}
exports.product_stopdisplay = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const productAlias = req.body.action.parameters["product_stopdisplay_alias"].value
    const userID = "kis6473"
    const userAPI = process.env.openapikey

    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'product_stopdisplay_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    console.log(result[0].productID)
    const clientMessage = await productStopDisplay(result[0].productID,userAPI)
    if(clientMessage.resultCode==200){
        responseObj["output"]= {'product_stopdisplay_prompt': productAlias +" 상품 판매 중지 처리되었습니다."}
    }
    else if(clientMessage.resultCode==500 || clientMessage.resultCode==-1000){
        responseObj["output"]= {'product_stopdisplay_prompt': clientMessage.message}
    }    
    return res.json(responseObj)    
}
exports.product_restartdisplay = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const productAlias = req.body.action.parameters["product_restartdisplay_alias"].value
    const userID = "kis6473"
    const userAPI = process.env.openapikey

    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'product_restartdisplay_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    const clientMessage = await productRestartDisplay(result[0].productID,userAPI)
    if(clientMessage.resultCode==200){
        responseObj["output"]= {'product_restartdisplay_prompt': productAlias +" 상품 판매중으로 변경되었습니다."}
    }
    else if(clientMessage.resultCode==500 || clientMessage.resultCode==-1000){
        responseObj["output"]= {'product_restartdisplay_prompt': clientMessage.message}
    }    
    return res.json(responseObj)    

}
// 송장번호 
exports.waybill_input = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const courierName = req.body.action.parameters["waybill_courierName"].value
    const waybillNumber = req.body.action.parameters["waybill_waybillNumber"].value

    const userID = "kis6473"
    const cache = await hgetallRedis(req, userID)
    if(cache==null){
        responseObj["output"] = {"waybill_input_prompt":"먼저 신규주문 조회를 해주세요."}
        return res.json(responseObj)
    }
    else if(!cache.orderNumber){
        responseObj["output"] = {"waybill_input_prompt":"먼저 신규주문 조회를 해주세요."}
        return res.json(responseObj)
    }
    const orderNumber = parseInt( cache.orderNumber )

    if(pool){
        db.updateWaybill(userID, orderNumber, courierName, waybillNumber, (err, updateWaybill)=>{
            if(err){
                console.error('waybill 업데이트 중 오류 발생 : ' + err.stack)
                return
            }
            if(updateWaybill){
                responseObj["output"] = {"waybill_input_prompt": orderNumber + "번 주문, "+ courierName +", [" + waybillNumber + "]번으로 운송장을 등록했습니다."}
                console.log(responseObj["output"])                
            }else{
                console.log('waybill 업데이트 실패')
                responseObj["output"] = {"waybill_input_prompt": orderNumber + "번 주문의 운송장 등록에 실패했습니다."}
            }
            return res.json(responseObj)
        })    
    }
}

exports.waybill_input_orderNumber = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const courierName = req.body.action.parameters["waybill_courierName"].value
    const waybillNumber = req.body.action.parameters["waybill_waybillNumber"].value
    const orderNumber = req.body.action.parameters["waybill_orderNumber"].value
    const userID = "kis6473"
    const result = await getOrderList(userID, orderNumber)    
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }    
    if(result==-1 || result==1){
        responseObj["output"] = {"waybill_orderNumber_prompt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."} 
        return res.json(responseObj)
    }
    else{
       
    }
    if(pool){
        db.updateWaybill(userID, orderNumber, courierName, waybillNumber, (err, updateWaybill)=>{
            if(err){
                console.error('waybill 업데이트 중 오류 발생 : ' + err.stack)
                return
            }
            if(updateWaybill){
                responseObj["output"] = {"waybill_orderNumber_prompt": orderNumber + "번 주문, "+ courierName +", " + waybillNumber + "번으로 운송장을 등록했습니다."}
                console.dir(updateWaybill) 
                return res.json(responseObj)   
            }else{
                responseObj["output"] = {"waybill_orderNumber_prompt": orderNumber + "번 주문의 운송장 등록에 실패했습니다."}
                console.log('waybill 업데이트 실패')
                return res.json(responseObj)
            }
        }) 
    }       
}

exports.customer_inform = (req, res) => {
    const responseObj = JSON.parse(process.env.response)
    const customerName = req.body.action.parameters["customer_inform_customerName"].value
    const informType = req.body.action.parameters["customer_inform_type"].value
    const userID = "kis6473"
    
    if(pool){
        db.getCustomerOrdersList(userID, customerName, (err, result)=>{
            if(err){
                console.err('product price select 중 오류 발생'+err.stack)
            }
            console.log(result[0])            
            if(result[0]){
                switch (informType) {
                    case '주문내역' :
                        responseObj["output"] = {"customer_inform_prompt": result[0].orderName+" 고객님 "+result[0].siteName+"에서 " +result[0].productName +" 상품을 "+result[0].orderQty+"개 주문했습니다."}
                        break;

                    case '배송메세지' :
                        responseObj["output"] = {"customer_inform_prompt": result[0].orderName+" 고객님 "+ result[0].Msg+"라고 요청하셨습니다."}
                        break;
                    
                    case '전화번호' : 
                        responseObj["output"] = {"customer_inform_prompt": result[0].orderName+' 고객님 전화번호, <say interpret="telephone">'+ result[0].orderTel+"</say>입니다."}
                        break;
                    
                    case '주소' : 
                        responseObj["output"] = {"customer_inform_prompt": result[0].orderName+" 고객님의 주소는, "+ result[0].orderAddress+"입니다."}
                        break;
                    
                    case '우편번호' : 
                        responseObj["output"] = {"customer_inform_prompt": result[0].orderName+" 고객님 우편번호는, ["+ result[0].orderZip+"]입니다."}
                        break;
                    //case '문의사항' : 
                    default : 
                        console.log("customer_name에서 case문을 모두 통과ㄷㄷ")
                        responseObj["output"] = {"customer_inform_prompt": customerName+" 고객님의 주문이 존재하지 않습니다."}
                        break;
                }
            }
            else{
                console.log('customer_inform 실패')
                responseObj["output"] = {"customer_inform_prompt": customerName+" 고객님의 주문이 존재하지 않습니다."}
            }
            
            return res.json(responseObj)
        })
    }
}

//자세히
exports.details = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    const userAPI = process.env.openapikey
    const cache = await hgetallRedis(req, userID)
    
    console.log(cache)
    let number
    if(cache==null){
        responseObj["output"] = {"details_prompt":"먼저 신규 주문이나, 문의 조회를 해주세요."}
        return res.json(responseObj)
    }
    if(cache.state == process.env.orderCode){
        if(!cache.orderNumber){
            responseObj["output"] = {"details_prompt":"먼저 신규 주문 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.orderNumber )
    }
    else if(cache.state == process.env.informCode){
        if(!cache.informNumber){
            responseObj["output"] = {"details_prompt":"먼저 신규 문의 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.informNumber )
    }
    if(cache.orderNumber==0){
        number=1
    }
    if(cache.informNumber==0){
        number=1
    }
    if (cache.state == process.env.orderCode){
        const result = await getOrderList(userID, number)
        if(!result){ 
            responseObj["resultCode"]="db_error" 
            return res.json(responseObj)
        }
        if(result==-1){         
            responseObj["output"] = {"details_prompt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}  
        }
        else{
            const obj = {"state":process.env.orderCode,"orderNumber":number}
            responseObj["output"] = {"details_prompt":(result.orderCount)+"번 주문, "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                                +result.productName+" "+ result.orderQty + "개 주문입니다. 배송 주소는 "+result.orderAddress+" 입니다. "+
                                "배송처리 하시려면 운송장 등록이라고 말씀해주세요. 다음 주문을 들으시려면 "+ 
                                "다음주문이라고 말씀해주세요."}
            if(cache.orderNumber==0){
                const obj = {"state":process.env.orderCode,"orderNumber":number}
                responseObj["output"] = {"details_prompt":(result.orderCount)+"번 주문, "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                                    +result.productName+", "+ result.orderQty + "개 주문입니다. 자세하게 들으시려면 상세조회, 다음 주문을 들으시려면 다음 주문이라고 말씀해주세요."}
            
                hmsetRedis(req, userID, obj, 60*5)        
            }
        }               
    }    
    else if(cache.state == process.env.informCode){
        const startTime = moment().format('YYYYMMDD')
        const endTime = moment().format('YYYYMMDD')
        const result = await getProductQnA(startTime-1,endTime,userAPI)        
        if(result['ns2:result_code']==500){
            responseObj['output'] = {'details_prompt':'새로운 고객 컴플레인이 없습니다.'}
        }
        else if(result['ns2:result_code']==-1000){
            responseObj['output'] = {'details_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
        }else{
            const QnA = result['ns2:productQna']
            if(QnA.length<number){
                responseObj['output'] = {'details_prompt':"해당 문의번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}
            }else{
                const obj = {"state":process.env.informCode, "informNumber":number}
                hmsetRedis(req, userID, obj, 60*5)
                responseObj['output'] = {'details_prompt':QnA[number-1].memNM+" 고객님, "+QnA[number-1].brdInfoCont +"이라고 요청하셨습니다." }
            }        
            console.log(QnA)
        }    
    }
    
    return res.json(responseObj) 
}
exports.repeat = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    const userAPI = process.env.openapikey
    const cache = await hgetallRedis(req, userID)
    console.log(cache)
    let number
    if(cache==null){
        responseObj["output"] = {"repeat_prompt":"먼저 신규 주문이나, 문의 조회를 해주세요."}
        return res.json(responseObj)
    }
    if(cache.state == process.env.orderCode){
        if(!cache.orderNumber){
            responseObj["output"] = {"repeat_prompt":"먼저 신규 주문 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.orderNumber )
    }
    else if(cache.state == process.env.informCode){
        if(!cache.informNumber){
            responseObj["output"] = {"repeat_prompt":"먼저 신규 문의 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.informNumber )
    }
    if (cache.state == process.env.orderCode){
        const result = await getOrderList(userID, number)
        if(!result){ 
            responseObj["resultCode"]="db_error" 
            return res.json(responseObj)
        }
        if(result==-1){         
            responseObj["output"] = {"repeat_prompt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}  
        }
        else{
            const obj = {"state":process.env.orderCode,"orderNumber":number}
            responseObj["output"] = {"repeat_prompt":(result.orderCount)+"번 주문, "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                                +result.productName+", "+ result.orderQty + "개 주문입니다"}
        }               
    }    
    else if(cache.state == process.env.informCode){
        const startTime = moment().format('YYYYMMDD')
        const endTime = moment().format('YYYYMMDD')
        const result = await getProductQnA(startTime-1,endTime,userAPI)        
        if(result['ns2:result_code']==500){
            responseObj['output'] = {'repeat_prompt':'새로운 고객 컴플레인이 없습니다.'}
        }
        else if(result['ns2:result_code']==-1000){
            responseObj['output'] = {'repeat_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
        }else{
            const QnA = result['ns2:productQna']
            if(QnA.length<number){
                responseObj['output'] = {'repeat_prompt':"해당 문의번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}
            }else{
                responseObj['output'] = {'repeat_prompt':number+"번 문의 "+ QnA[number-1].memNM+" 고객님, "+QnA[number-1].brdInfoSbjct+" 라는 제목의 "+ QnA[number-1].qnaDtlsCdNm+" 관련 문의가 있습니다. 자세하게 들으시려면 상세조회라고 말씀해주세요." }
            }        
            console.log(QnA)
        }    
    }   
    return res.json(responseObj) 
}

exports.previous = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    const userAPI = process.env.openapikey
    const cache = await hgetallRedis(req, userID)
    console.log(cache)
    let number
    if(cache==null){
        responseObj["output"] = {"previous_prompt":"먼저 신규 주문이나, 문의 조회를 해주세요."}
        return res.json(responseObj)
    }
    if(cache.state == process.env.orderCode){
        if(!cache.orderNumber){
            responseObj["output"] = {"previous_prompt":"먼저 신규 주문 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.orderNumber ) - 1
    }
    else if(cache.state == process.env.informCode){
        if(!cache.informNumber){
            responseObj["output"] = {"previous_prompt":"먼저 신규 문의 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.informNumber ) - 1
    }

    if(number==0){
        if(cache.state == process.env.orderCode){ responseObj["output"] = {"previous_prompt":"첫 주문 입니다."} }
        else if(cache.state == process.env.informCode){ responseObj["output"] = {"previous_prompt":"첫 문의 입니다."} }
        return res.json(responseObj)
    } 

    if (cache.state == process.env.orderCode){
        const result = await getOrderList(userID, number)
        if(!result){ 
            responseObj["resultCode"]="db_error" 
            return res.json(responseObj)
        }
        if(result==-1){         
            responseObj["output"] = {"previous_prompt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}  
        }
        else{
            const obj = {"state":process.env.orderCode,"orderNumber":number}
            responseObj["output"] = {"previous_prompt":(result.orderCount)+"번 주문, "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                                +result.productName+" "+ result.orderQty + "개 주문입니다."}
          
            hmsetRedis(req, userID, obj, 60*5)        
        }               
    }    
    else if(cache.state == process.env.informCode){
        const startTime = moment().format('YYYYMMDD')
        const endTime = moment().format('YYYYMMDD')
        const result = await getProductQnA(startTime-1,endTime,userAPI)        
        if(result['ns2:result_code']==500){
            responseObj['output'] = {'repeat_prompt':'새로운 고객 컴플레인이 없습니다.'}
        }
        else if(result['ns2:result_code']==-1000){
            responseObj['output'] = {'repeat_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
        }else{
            const QnA = result['ns2:productQna']            
            if(QnA.length<number){
                responseObj['output'] = {'repeat_prompt':"해당 문의번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}
            }else{
                const obj = {"state":process.env.informCode, "informNumber":number}
                hmsetRedis(req, userID, obj, 60*5)
                responseObj['output'] = {'repeat_prompt':number+"번 문의 "+ QnA[number-1].memNM+" 고객님, "+QnA[number-1].brdInfoSbjct+" 라는 제목의 "+ QnA[number-1].qnaDtlsCdNm+" 관련 문의가 있습니다. 자세하게 들으시려면 상세조회라고 말씀해주세요." }
            }        
            console.log(QnA)
        }    
    }   
    return res.json(responseObj) 
}
exports.next = async (req, res) =>{
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    const userAPI = process.env.openapikey
    const cache = await hgetallRedis(req, userID)
    console.log(cache)
    let number
    if(cache==null){
        responseObj["output"] = {"next_prompt":"먼저 신규 주문이나, 문의 조회를 해주세요."}
        return res.json(responseObj)
    }
    if(cache.state == process.env.orderCode){
        if(!cache.orderNumber){
            responseObj["output"] = {"next_prompt":"먼저 신규 주문 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.orderNumber ) + 1
    }
    else if(cache.state == process.env.informCode){
        if(!cache.informNumber){
            responseObj["output"] = {"next_prompt":"먼저 신규 문의 조회를 해주세요."}
            return res.json(responseObj)
        }
        number = parseInt( cache.informNumber ) + 1
    }
   if (cache.state == process.env.orderCode){
        const result = await getOrderList(userID, number)
        if(result==1){
            responseObj["output"] = {"next_prompt":"마지막 주문 입니다."}
            return res.json(responseObj)
        }    
        if(!result){ 
            responseObj["resultCode"]="db_error" 
            return res.json(responseObj)
        }
        if(result==-1){         
            responseObj["output"] = {"next_prompt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."}  
        }
        else{
            const obj = {"state":process.env.orderCode,"orderNumber":number}
            responseObj["output"] = {"next_prompt":(result.orderCount)+"번 주문, "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                                +result.productName+" "+ result.orderQty + "개 주문입니다."}
          
            hmsetRedis(req, userID, obj, 60*5)        
        }               
    }    
    else if(cache.state == process.env.informCode){
        const startTime = moment().format('YYYYMMDD')
        const endTime = moment().format('YYYYMMDD')
        const result = await getProductQnA(startTime-1,endTime,userAPI)        
        if(result['ns2:result_code']==500){
            responseObj['output'] = {'next_prompt':'새로운 고객 컴플레인이 없습니다.'}
        }
        else if(result['ns2:result_code']==-1000){
            responseObj['output'] = {'next_prompt':'11번가 서버 점검중입니다. 잠시 후 다시 시도해주세요.'}
        }else{
            const QnA = result['ns2:productQna']           
            if(QnA.length<number){
                responseObj['output'] = {'next_prompt':"마지막 문의 입니다."}
                return res.json(responseObj) 
            }else{
                const obj = {"state":process.env.informCode, "informNumber":number}
                hmsetRedis(req, userID, obj, 60*5)
                responseObj['output'] = {'next_prompt':number+"번 문의 "+ QnA[number-1].memNM+" 고객님, "+QnA[number-1].brdInfoSbjct+" 라는 제목의 "+ QnA[number-1].qnaDtlsCdNm+" 관련 문의가 있습니다. 자세하게 들으시려면 상세조회라고 말씀해주세요." }
            }        
            console.log(QnA)
        }    
    }   
    return res.json(responseObj) 
}

// 신규 주문 개수
exports.order_inquire = (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    if(pool){
        db.getOrdersCount(userID, (err, result)=>{
            console.log(result[0].orderCount)
            const obj = {"state":process.env.orderCode,"orderNumber":0}
            hmsetRedis(req, userID, obj, 60*5)
            responseObj["output"] = {"order_inquire_promt":"신규주문 "+result[0].orderCount+"건이 있습니다. 자세하게 들으시려면, 상세조회라고 말씀해주세요."}
            return res.json(responseObj)
        })
    }
}
// 특정 신규 주문 내역
exports.order_inquire_orderNumber = async (req, res) => {
    const responseObj = JSON.parse(process.env.response)
    const orderNumber = req.body.action.parameters["order_orderNumber"].value
    const userID = "kis6473"
    
    const result = await getOrderList(userID, orderNumber)    
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    
    if(result==-1){ responseObj["output"] = {"orderNumber_promt": "해당 주문번호는 존재하지 않습니다. 다른 번호로 조회해주세요."} }
    else{
        const obj = {"state":process.env.orderCode,"orderNumber":orderNumber}
        hmsetRedis(req, userID, obj, 60*5)
        responseObj["output"] = {"orderNumber_promt":(result.orderCount)+"번 주문 "+result.orderName+" 고객님, "+ result.siteName+"에서, "
                             +result.productName+" "+ result.orderQty + "개 주문입니다."}
    }
    return res.json(responseObj)   
}
// 가격, 재고 조회
exports.product_inform = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    if(req.body.action.parameters["product_inform_alias"]==undefined){
        responseObj["output"] = {"product_inform_prompt": "해당하는 상품명이 없습니다. 별칭으로 등록한 상품이 아니라면, 상품의 별칭을 등록해주세요."}
        return res.json(responseObj)
    }
    const productAlias = req.body.action.parameters["product_inform_alias"].value
    const informType = req.body.action.parameters["product_inform_type"].value
    const userID = "kis6473"
   
    const result = await getProducts(userID, productAlias)
    switch (informType) {
        case '재고' :
            responseObj["output"] = {"product_inform_prompt": productAlias + "의 재고는 "+result[0].productStock+"개 입니다."}
            break;
        case '가격' :
            responseObj["output"] = {"product_inform_prompt": productAlias + "의 가격은 "+result[0].productPrice+"원 입니다."}
            break;
        default : 
            console.log("product_inform case문을 모두 통과")
            responseObj["output"] = {"product_inform_prompt": "재고 몇개야? 또는 가격 얼마야?로 조회해보세요."}
            break;
    }
    console.log(responseObj["output"])
    return res.json(responseObj)
}
exports.insight = async (req, res) => {
    const responseObj = JSON.parse(process.env.response)
    const userID = "kis6473"
    const result = await sumProductPrice(userID)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'insight_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    responseObj["output"]= {'insight_prompt': "오늘 온라인 주문금액 총 합은, "+result[0].sum + "원 입니다"}
    return res.json(responseObj)  
}
exports.product_soldout = async (req, ers) => {

}
// 재고 업데이트 ( 쇼핑몰에서는 재고 변경하지 않고, 현재는 DB에서만 변경)
exports.product_stock_update = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productStock = req.body.action.parameters["stock_update_amount"].value
    const productAlias = req.body.action.parameters["stock_update_alias"].value
    const userID = "kis6473"
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'stock_update_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    else{
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productStock" : productStock, "pinState" : process.env.stockUpdateCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 재고를 "+ result[0].productStock+"개 에서,"+productStock+"개로 변경합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'stock_update_prompt': message } 
        return res.json(responseObj)        
    }
}
exports.product_stock_up = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productStockUp = req.body.action.parameters["stock_up_amount"].value
    const productAlias = req.body.action.parameters["stock_up_alias"].value
    const userID = "kis6473"
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'stock_up_prompt': "조회 오류입니다."} 
        return res.json(responseObj)
    }
    else{
        const productStock =  parseInt(result[0].productStock) + parseInt(productStockUp)
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productStock" : productStock, "pinState" : process.env.stockUpCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 재고를 "+ result[0].productStock+"개 에서,"+productStock+"개로 변경합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'stock_up_prompt': message } 
        return res.json(responseObj)  
    }
}
exports.product_stock_down = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productStockDown = req.body.action.parameters["stock_down_amount"].value
    const productAlias = req.body.action.parameters["stock_down_alias"].value
    const userID = "kis6473"
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'stock_down_prompt': "조회 오류입니다."} 
        return res.json(responseObj)
    }
    else{
        const productStock =  parseInt(result[0].productStock) - parseInt(productStockDown)
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productStock" : productStock, "pinState" : process.env.stockDownCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 재고를 "+ result[0].productStock+"개 에서,"+productStock+"개로 변경합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'stock_down_prompt': message } 
        return res.json(responseObj)                
    }
}
// 가격 인하
exports.product_price_down = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productPriceDown = req.body.action.parameters["product_price_DOWN_price"].value
    const productAlias = req.body.action.parameters["product_price_DOWN_alias"].value
    const userID = "kis6473"

    // 별칭으로 상품 조회
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'product_price_DOWN_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    else{
        const productPrice = (parseInt(result[0].productPrice) - parseInt(productPriceDown)).toString()
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productPrice" : productPrice, "pinState" : process.env.priceDownCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 가격을 "+ result[0].productPrice+"원에서,"+productPrice+"원으로 인하합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'product_price_DOWN_prompt': message } 
        return res.json(responseObj)        
    }
}
// 가격 인상
exports.product_price_up = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productPriceUp = req.body.action.parameters["product_price_UP_price"].value
    const productAlias = req.body.action.parameters["product_price_UP_alias"].value
    const userID = "kis6473"

    // 1. 별칭으로 상품 조회
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'product_price_UP_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    else{
        const productPrice = (parseInt(result[0].productPrice) + parseInt(productPriceUp)).toString()
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productPrice" : productPrice, "pinState" : process.env.priceUpCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 가격을 "+ result[0].productPrice+"원에서,"+productPrice+"원으로 인상합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'product_price_UP_prompt': message } 
        return res.json(responseObj)
    }
}
// 가격 업데이트 (11번가, DB 모두 업데이트)
exports.product_price_update = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const productPrice = req.body.action.parameters["product_price_UPDATE_price"].value
    const productAlias = req.body.action.parameters["product_price_UPDATE_alias"].value
    const userID = "kis6473"
        
    // 1. 별칭으로 상품 조회
    const result = await getProducts(userID, productAlias)
    if(!result){ 
        responseObj["resultCode"]="db_error" 
        return res.json(responseObj)
    }
    if(result==-1){ 
        responseObj["output"]= {'product_price_UPDATE_prompt': "조회 오류입니다."}
        return res.json(responseObj)
    }
    else{
        const obj = { "productID": result[0].productID, "productAlias": productAlias,"productPrice" : productPrice, "pinState" : process.env.priceUpdateCode }
        hmsetRedis(req, userID + process.env.pinCode, obj, 60)  
        const message = productAlias + "의 가격을 "+ result[0].productPrice+"원에서,"+productPrice+"원으로 변경합니다. 계속 진행하시려면, 등록하신 핀코드 4자리를 불러주세요."
        responseObj["output"]= {'product_price_UPDATE_prompt': message } 
        return res.json(responseObj)       
    }     
}
exports.pincode_input = async (req, res)=>{
    const responseObj = JSON.parse(process.env.response)
    const pincode = req.body.action.parameters["pincode"].value
    const userID = "kis6473"
    const userAPI = process.env.openapikey
    const cache = await hgetallRedis(req, userID + process.env.pinCode)
    if(cache==null){
        responseObj["output"] = {"picode_prompt":"먼저 가격이나 재고 변경을 해주세요."}
        return res.json(responseObj)
    }
    if(!cache.pinState || cache.pinState==process.env.initCode){
        responseObj["output"] = {"picode_prompt":"먼저 가격이나 재고 변경을 해주세요."}
        return res.json(responseObj)
    }
    const result = await getUserPin(userID)
    
    if(pincode!=result[0].userPin){        
        let obj = {}
        if(!cache.accessCount || cache.accessCount==0){
            obj = { "accessCount": 1 }
            responseObj["output"] = {"picode_prompt":"핀코드가 1회 틀렸습니다. 다시 한 번 불러주세요. 연속해서 3번 틀릴 경우 5분간 이용하실 수 없습니다."}
            hmsetRedis(req, userID + process.env.pinCode, obj, 60*5)
            hmsetRedis(req, userID + process.env.accessPinCode, obj, 60*5)
        }        
        else if(3 == cache.accessCount){
            responseObj["output"] = {"picode_prompt":"핀코드가"+cache.accessCount+"회 틀렸습니다. 5분 후에 다시 시도해주세요."}
            const firstAccess = await hgetallRedis(req, userID + process.env.accessPinCode)
            if(!firstAccess){
                obj = { "accessCount": 0 }
                hmsetRedis(req, userID + process.env.pinCode, obj, 60*5)
            }
        }        
        else if(3 > cache.accessCount){
            obj = { "accessCount": ++cache.accessCount }
            responseObj["output"] = {"picode_prompt":"핀코드가"+cache.accessCount+"회 틀렸습니다. 다시 한 번 불러주세요. 연속해서 3번 틀릴 경우 5분간 이용하실 수 없습니다."}
            if(3 == cache.accessCount){
                responseObj["output"] = {"picode_prompt":"핀코드가"+cache.accessCount+"회 틀렸습니다. 5분 후에 다시 시도해주세요."}
            }     
            hmsetRedis(req, userID + process.env.pinCode, obj, 60*5)
        }

        return res.json(responseObj)
    }

    let clientMessage, message
    
    if(cache.pinState==process.env.priceUpCode || cache.pinState==process.env.priceDownCode || cache.pinState==process.env.priceUpdateCode){
        clientMessage = await getProductPriceUpdate(cache.productID, cache.productPrice, userAPI)
        if(clientMessage.resultCode==200){
            updatePrice(userID, cache.productAlias, cache.productPrice)
            if(cache.pinState==process.env.priceUpCode){
                const up = parseInt(cache.productPrice) - parseInt(clientMessage.preSelPrc)
                message = "핀코드가 일치합니다. "+cache.productAlias +"의 가격이 "+clientMessage.preSelPrc+"원에서," + cache.productPrice+"원으로 업데이트 되었습니다."
            }else if(cache.pinState==process.env.priceDownCode){
                const down = parseInt(clientMessage.preSelPrc) - parseInt(cache.productPrice)
                message = "핀코드가 일치합니다. "+cache.productAlias +"의 가격이 "+clientMessage.preSelPrc+"원에서,"+cache.productPrice+"원으로 업데이트 되었습니다."
            }else if(cache.pinState==process.env.priceUpdateCode){
                updatePrice(userID, cache.productAlias, cache.productPrice)            
                message = "핀코드가 일치합니다. "+cache.productAlias +"의 가격이 "+ clientMessage.preSelPrc +"원에서,"+ cache.productPrice +"원으로 업데이트 되었습니다."
            }
        }
        // 비즈니스 error 입니다.
        else if(clientMessage.resultCode==500){
            message = clientMessage.message[0]
        }
        // 서버 점검 중 입니다.
        else if(clientMessage.resultCode==-1000){
            message = clientMessage.message[0]
        }
        console.log(clientMessage)
    }
    else if(cache.pinState==process.env.stockUpCode || cache.pinState==process.env.stockDownCode || cache.pinState==process.env.stockUpdateCode){
        const updateResult = await updateStock(userID, cache.productID, cache.productStock)
        if(!updateResult){
            responseObj["resultCode"]="db_error" 
            return res.json(responseObj)
        }
        if(updateResult==-1){ 
            message = "조회 오류입니다."
        }
        else if(cache.pinState==process.env.stockUpCode){
            message = "핀코드가 일치합니다. "+cache.productAlias +"의 재고가 "+cache.productStock+"개로 업데이트 되었습니다."
        }else if(cache.pinState==process.env.stockDownCode){
            message = "핀코드가 일치합니다. "+cache.productAlias +"의 재고가 "+cache.productStock+"개로 업데이트 되었습니다."
        }else if(cache.pinState==process.env.stockUpdateCode){
            message = "핀코드가 일치합니다. "+cache.productAlias +"의 재고가 "+cache.productStock+"개로 업데이트 되었습니다."
        }
    }       
    
    const obj = { "pinState" : process.env.initCode }
    hmsetRedis(req, userID + process.env.pinCode, obj, 60*5)
    responseObj["output"] = {"picode_prompt": message}
    return res.json(responseObj)
}

// 주문 총합
function sumProductPrice(userID){
    return new Promise((resolve,reject)=>{
        if(pool){
            db.sumProductPrice(userID, (err, result)=>{
                if(err){
                    console.error('sumProductPrice select 중 오류 발생 : ' + err.stack)
                    resolve(false)
                }
                if(result){
                    console.dir(result)
                    resolve(result)
                }else{
                    console.log('sumProductPrice select 실패')
                    resolve(-1)
                }
            })    
        }
    })
}
// 유저 핀 조회
function getUserPin(userID){
    return new Promise((resolve,reject)=>{
        if(pool){
            db.getUserPin(userID, (err, result)=>{
                if(err){
                    console.error('getUserPin select 중 오류 발생 : ' + err.stack)
                    resolve(false)
                }
                if(result){
                    console.dir(result)
                    resolve(result)
                }else{
                    console.log('getUserPin select 실패')
                    resolve(-1)
                }
            })    
        }
    })
}
// 재고 업데이트
function updateStock(userID, productID, productStock){
    return new Promise((resolve,reject)=>{
        if(pool){
            db.updateStock(userID, productID, productStock, (err, result)=>{
                if(err){
                    console.error('product stock 업데이트 중 오류 발생 : ' + err.stack)
                    resolve(false)
                }
                if(result){
                    console.dir(result)
                    resolve(result)
                }else{
                    console.log('product stock 업데이트 실패')
                    resolve(-1)
                }
            })    
        }
    })
}
// 별칭으로 가격 조회
function getProducts(userID, productAlias){
    return new Promise((resolve,reject)=>{
        if(pool){
            db.getProducts(userID, productAlias, (err,result)=>{
                if(err){
                    console.err('product select 중 오류 발생'+err.stack)
                    resolve(false)
                }
                if(result[0]){
                    resolve(result)
                }else{
                    console.log('product select 실패')
                    resolve(-1)
                }
            })
        }
    })    
}

// 가격 업데이트
function updatePrice(userID, productAlias, productPrice){
    if(pool){
        db.updatePrice(userID, productAlias, productPrice, (err, result)=>{
            if(err){
                console.error('product price 업데이트 중 오류 발생 : ' + err.stack)                
            }
            if(result){
                console.dir(result)
               
            }else{
                console.log('product price 업데이트 실패')                
            }
        })
    }
}
// 별칭으로 상품ID 조회
function getProductID(userID, productAlias){
    return new Promise((resolve, reject)=>{
        if(pool){
            db.getProductID(userID,productAlias,(err, result)=>{
                if(err){
                    console.error('product id select 중 오류 발생 : ' + err.stack)
                    resolve(false)
                }
                if(result){
                    resolve(result)
                }else{
                    console.log('product price select 실패')
                    resolve(-1)
                }                           
            })
        }
    })    
}
// 주문번호로 주문 조회
function getOrderList(userID, number){
    return new Promise((resolve, reject)=>{
        if(pool){
            db.getOrdersList(userID,(err, result)=>{
                if(err){
                    console.error('getOrdersList 중 오류 발생 : ' + err.stack)
                    resolve(false)
                }
                if(result.length>0){
                    if(result.length + 1 == number){
                        resolve(1)
                    }
                    for(var i=0; i<result.length; i++){
                        if( number == i+1){
                            resolve(result[i])
                        }                    
                    }
                }
                resolve(-1)                             
            })
        }
    })    
}
// redis set
function setRedis(req, key, value, expire){
        req.cache.set(key,value,(err,data)=>{
            if(err){
                console.log(err)
                return
            }
            req.cache.expire(key,expire)           
        })       
}
// redis get
function getRedis(req, key){
    return new Promise((resolve, reject)=>{
        req.cache.get(key,(err,data)=>{
            if(err){
                console.log(err)
                return
            }
            resolve(data)
        })
    }) 
}
// redis hmset
function hmsetRedis(req, key, obj, expire){
    req.cache.hmset(key,obj,(err,data)=>{
        if(err){
            console.log(err)
            return
        }
        req.cache.expire(key,expire)           
    })       
}
// redis hgetall
function hgetallRedis(req, key){
    return new Promise((resolve, reject)=>{
        req.cache.hgetall(key,(err,data)=>{
            if(err){
                console.log(err)
                return
            }
            resolve(data)
        })
    }) 
}
// 11번가 가격 업데이트
function getProductPriceUpdate(productID, productPrice, userAPI){
    return new Promise((resolve, reject)=>{
        const options = {
            'url' : process.env.productPriceAPI + productID +"/"+productPrice,
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.get(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')            
            parser.parseString(decoded, function(err, result) {
                resolve(result.ClientMessage)
            })
        })
    })    
}
// 11번가 판매중지 처리
function productStopDisplay(productID, userAPI){
    return new Promise((resolve, reject)=>{
        const options = {
            'url' : process.env.productStopDisplayAPI + productID,
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.put(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')            
            parser.parseString(decoded, function(err, result) {
                console.log(result)
                resolve(result.ClientMessage)
            })
        })
    })    
}
// 11번가 판매중지 해제
function productRestartDisplay(productID, userAPI){
    return new Promise((resolve, reject)=>{
        const options = {
            'url' : process.env.productRestartDisplayAPI + productID,
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.put(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')            
            parser.parseString(decoded, function(err, result) {
                resolve(result.ClientMessage)
            })
        })
    })    
}

// 11번가 QnA 조회
function getProductQnA(startTime,endTime,userAPI){
    return new Promise(function(resolve, reject){
        const options = {
            'url' : process.env.productQnA_API + startTime +"/"+endTime +'/02',
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.get(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')            
            parser.parseString(decoded, function(err, result) {
                resolve(result['ns2:productQnas'])
            })
        })
    })
    
}
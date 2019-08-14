const request = require('request')
const iconv = require('iconv-lite')
const xml2js = require('xml2js')
const logger = require('../log/logConfig')
const parser = new xml2js.Parser()
const pool = require('../lib/db')
const db = require('../lib/template')

orderBatch = async function(userID, startTime,endTime, userAPI){
    const orderedProduct = await getOrderProduct(startTime,endTime,userAPI)
    //조회된 결과가 없습니다.
    if(orderedProduct['ns2:result_code']==0){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    //주문/클레임 조회 오류 MSG : OpenAPI Key 에 해당하는 유저가 없습니다. 비지니스 Error. 예외적으로 발생되는 모든 에러. 메시지는 일정하지 않습니다.
    else if(orderedProduct['ns2:result_code']==-1){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    //start_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다. 
    else if(orderedProduct['ns2:result_code']==-3103){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    //end_dt의 조회 기간의 포멧(&#39;YYYYMMDDHH24:MI&#39;)이 올바르지 않습니다.
    else if(orderedProduct['ns2:result_code']==-3104){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    //최대 조회기간은 일주일 입니다. 
    else if(orderedProduct['ns2:result_code']==-3105){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    //서버 점검중입니다. 설명 - 매주 금요일 새벽은 정기점검일입니다.
    else if(orderedProduct['ns2:result_code']==-1000){
        console.log( orderedProduct['ns2:result_text'][0] )
        return
    }
    
    const orders = orderedProduct['ns2:order']
    if(orders.length>0){
        for(var i=0; i<orders.length; i++){
            saveOrder(userID, orders[i],i+1)
        }
    }
    else{
        console.log("주문없음")
    }    

}

function saveOrder(userID, orders, orderCount){
        if(pool){
            db.orderExist(orders,orderCount,(err, result, param)=>{
                if(err){
                    console.error('orderExist select 중 오류 발생 : ' + err.stack)
                    return
                }
                if(result[0].isChk==1){
                    console.log("주문 번호 "+param.orders.ordNo+"는 DB에 이미 존재합니다.")
                }
                else if(result[0].isChk==0){
                    db.saveOrders(userID, param.orders, param.orderCount, async (err, result)=>{
                        if(err){
                            console.error('product 추가 중 오류 발생 : ' + err.stack)
                            return
                        }
                        if(result){
                            console.dir(result)    
                        }else{
                            console.log('product 추가 실패')
                        }
                    })
                }
                else{
                    console.log("orderExist select 실패")
                }
            })            
        }  
}

function getOrderProduct(startTime,endTime,userAPI){
    return new Promise(function(resolve, reject){
        const options = {
            'url' : process.env.searchOrderAPI + startTime +"/"+endTime,
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.get(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')            
            parser.parseString(decoded, function(err, result) {
                resolve(result['ns2:orders'])
            })
        })
    })
    
}

module.exports = { orderBatch }
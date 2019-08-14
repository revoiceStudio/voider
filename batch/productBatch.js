const request = require('request')
const iconv = require('iconv-lite')
const xml2js = require('xml2js')
const logger = require('../log/logConfig')
const parser = new xml2js.Parser()
const pool = require('../lib/db')
const db = require('../lib/template')

productBatch = async function(userID, userAPI){
    const searchedProduct = await postSearchProduct(userAPI)
    parser.parseString(searchedProduct, function(err, result) {
        const products = result['ns2:products']['ns2:product']
        saveProduct(userID, products, userAPI)
    })
}

function saveProduct(userID, products, userAPI){
    for(var i=0; i < products.length; i++){
        if(pool){
            db.productExist(userID, products[i].prdNo, products[i].prdNm, products[i].selPrc, (err, result, param)=>{
                if(err){
                    console.error('productExist select 중 오류 발생 : ' + err.stack)
                    return
                }
                console.log(result[0].isChk)
                if(result[0].isChk==1){
                    console.log("상품 번호 "+param.productID +"는 DB에 이미 존재하는 상품입니다.")
                }
                else if(result[0].isChk==0){
                    db.saveProducts(userID, param.productID, param.productName, param.productPrice, async (err, result, param)=>{
                        if(err){
                            console.error('product 추가 중 오류 발생 : ' + err.stack)
                            return
                        }
                        if(result){
                            console.dir(result)
                            console.log(param.productID)
                            
                            const productStock = await getStockNo(param.productID, userAPI)                    
                            db.updateStock(userID, param.productID, productStock, (err, result)=>{
                                if(err){
                                    console.error('product stock 추가 중 오류 발생 : ' + err.stack)
                                    return
                                }
                                if(result){
                                    console.dir(result)
                                }else{
                                    console.log('product stock 추가 실패')
                                }
                            })
                            
                            
                        }else{
                            console.log('product 추가 실패')
                        }
                    })
                                       
                }else{
                    console.log('productExist select 실패')
                }
            })            
        }
    }
}

function getStockNo(productID, userAPI){
    return new Promise(function(resolve, reject){
        const options = {
            'url' : process.env.searchStockAPI + productID,
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }    
        request.get(options, async (error, response, body) =>{
            const strContents = new Buffer.from(body);
            const decoded = iconv.decode(strContents, 'euc-kr')
            
            parser.parseString(decoded, function(err, result) {
                const productStock = result['ns2:ProductStocks']['ns2:ProductStock'][0]['stckQty']
                resolve(productStock)
            })
        })
    })
    
}

function postSearchProduct(userAPI){
    return new Promise(function(resolve,reject){
        const options = {
            'url' : process.env.searchProductAPI,
            'body' : '<?xml version="1.0" encoding="euc-kr" standalone="yes"?>'+
            '<SearchProduct><selStatCd>103</selStatCd><limit>20</limit><start>0</start></SearchProduct>',
            'headers' : {
                'openapikey': userAPI
            },
            'encoding': null        
        }
        request.post(options, async (error, response, body) =>{
            var strContents = new Buffer.from(body);
            const products = iconv.decode(strContents, 'euc-kr')
            resolve(products)
        })
    })
}

module.exports = { productBatch }
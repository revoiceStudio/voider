const pool = require('./db');

// 상품 저장
const saveProducts = (userID, productID, productName, productPrice, callback)=>{
    console.log("saveProducts 호출됨.")
    const data = {userID:userID, productID:productID, productName:productName, productPrice:productPrice}
    const param = {'productID':productID}
    const sql = 'insert IGNORE into product_list set ?'
    executeSQL(sql,data,param,callback)
}
// 상품 재고 업데이트
const updateStock = (userID, productID, productStock, callback)=>{
    console.log("updateStock 호출됨.")
    const data = [productStock,userID,productID]
    const param = {}
    const sql = 'update product_list set productStock=? where userID=? and productID=?'
    executeSQL(sql,data,param,callback)
}
// 별칭으로 상품 ID 조회
const getProductID = (userID, productAlias, callback)=>{
    console.log("getProductID 호출됨.")
    const data = [ userID, productAlias ]
    const param = {}
    const sql = 'select productID from product_list where userID=? and productAlias=?'
    executeSQL(sql,data,param,callback)
}
// 상품 가격 업데이트
const updatePrice = (userID, productAlias, productPrice, callback)=>{
    console.log("updatePrice 호출됨.")
    const data = [ productPrice, userID, productAlias]
    const param = {}
    const sql = 'update product_list set productPrice=? where userID=? and productAlias=?'
    executeSQL(sql,data,param,callback)
}
// 별칭으로 상품 조회
const getProducts = (userID, productAlias, callback)=>{
    console.log("getProducts 호출됨.")
    const data = [ userID, productAlias ]
    const param = {}
    const sql = 'select productPrice, productName,productID, productStock from product_list where userID=? and productAlias=?'
    executeSQL(sql,data,param,callback)
}
//신규주문 저장
const saveOrders = (userID, orders, orderCount, callback)=>{
    console.log("saveOrders 호출됨.")
    const data = { userID:userID, orderID:orders.ordNo, orderCount:orderCount, orderQty:orders.ordQty, /* 임시 11번가 코드 */ siteCode:"A117", siteName:"11번가", productName:orders.prdNm, /* 옵션은 고유옵션번호로 날아와서 나중에 매칭 */productOption:orders.proStckNo, orderPrice:orders.ordPayAmt, orderName:orders.ordNm, orderTel:orders.ordPrtblTel, orderZip:orders.rcvrMailNo, orderAddress:orders.rcvrBaseAddr + orders.rcvrDtlsAddr, Msg:orders.ordDlvReqCont, delPrice:orders.dlvCst /*sender , senderNo는 채워야하는 것*/}
    const param = {}
    const sql = 'insert IGNORE into order_list set ?'
    executeSQL(sql,data,param,callback)
}
//신규주문의 갯수
const getOrdersCount = (userID, callback)=>{
    console.log("getOrdersCount 호출됨.")   
    const data = [userID]
    const param = {}
    const sql = 'select count(*) orderCount from order_list where userID = ?'
    executeSQL(sql,data,param,callback)
}
//ID별 모든 주문정보 조회
const getOrdersList = (userID, callback)=>{
    console.log("getOrdersList 호출됨.")
    const data = [userID]
    const param = {}
    const sql = "SELECT orderQty, orderCount,orderID,siteName,productName,orderPrice,delPrice,orderName,orderTel, orderAddress, orderZip from order_list WHERE userID=?"
    executeSQL(sql,data,param,callback)
}
//고객 이름으로 주문 조회
const getCustomerOrdersList = (userID, customerName, callback)=>{
    console.log("getCustomerOrdersList 호출됨.")
    const data = [ userID, customerName]
    const param = {}
    const sql = 'select * from order_list where userID = ? and orderName = ?'
    executeSQL(sql,data,param,callback)
}
//유저 핀 조회
const getUserPin = (userID, callback)=>{
    console.log("getUserPin 호출됨.")
    const data = [userID]
    const param = {}
    const sql = "SELECT userPin from users WHERE userID=?"
    executeSQL(sql,data,param,callback)
}
//운송장 등록
const updateWaybill = (userID, orderCount, sender, senderNo, callback)=>{
    console.log("updateWaybill 호출됨.")
    const data = [ sender, senderNo, userID, orderCount]
    const param = {"orderCount":orderCount}
    const sql = 'update order_list set sender=?, senderNo= ? where userID = ? and orderCount = ?'
    executeSQL(sql,data,param,callback)
}

const sumProductPrice = (userID, callback) => {
    console.log("sumProductPrice 호출됨.")
    const data = [userID]
    const param = {}
    const sql = "SELECT SUM(orderPrice) AS sum from order_list WHERE userID=?"
    executeSQL(sql,data,param,callback)
}
// SQL문 실행
const executeSQL = (sql, data, param, callback)=> {
    pool.getConnection((err,conn)=>{
        if(err){
            if(conn){
                conn.release()
            }
            callback(err,null);
            return
        }
        console.log('데이터베이스 연결 스레드 아이디 : ' + conn.threadId)

        const exec = conn.query(sql, data,(err,result)=>{
            conn.release()
            console.log("실행 대상 SQL : " + exec.sql)

            if(err){
                console.log("SQL 실행 시 오류 발생함.")
                console.dir(err)

                callback(err, null)
                return
            }
            callback(null, result, param)
        })
    })
}

module.exports = {saveProducts , updateStock, updatePrice, getProductID, getProducts,sumProductPrice, 
                  saveOrders, getOrdersCount, getOrdersList, getCustomerOrdersList, getUserPin, updateWaybill}
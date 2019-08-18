const express = require('express')
const controller = require('./controller')
const router = express.Router()

router.use(express.json())

router.post('/customer_inform',controller.customer_inform)
router.post('/product_inform',controller.product_inform)

router.post('/cs_inquire',controller.cs_inquire)
router.post('/cs_inquire_csNumber', controller.cs_inquire_csNumber)

router.post('/insight',controller.insight)

router.post('/details',controller.details)
router.post('/next',controller.next)
router.post('/repeat',controller.repeat)
router.post('/previous',controller.previous)

router.post('/order_inquire_orderNumber',controller.order_inquire_orderNumber)
router.post('/order_inquire',controller.order_inquire)

router.post('/pincode_input',controller.pincode_input)

router.post('/product_price_DOwN',controller.product_price_down)
router.post('/product_price_UP',controller.product_price_up)
router.post('/product_price_UPDATE',controller.product_price_update)

router.post('/product_stock_down',controller.product_stock_down)
router.post('/product_stock_up',controller.product_stock_up)
router.post('/product_stock_update',controller.product_stock_update)

router.post('/product_stopdisplay',controller.product_stopdisplay)
router.post('/product_restartdisplay',controller.product_restartdisplay)

router.post('/waybill_input',controller.waybill_input)
router.post('/waybill_input_orderNumber',controller.waybill_input_orderNumber)

module.exports = router
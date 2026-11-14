import express from "express"
import dotenv from "dotenv"
import { connectDB } from "./configs/db.js"
import billingRouter from "./routes/billing.route.js"
import { verifyGatewayOrigin } from "./middleware/gatewayAuth.js"

dotenv.config()

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 6005

app.get("/",(req,res)=>{
    res.send("Hello from Billing-service")
})

app.use(verifyGatewayOrigin)
app.use("/",billingRouter)

app.listen(PORT , ()=>{
    console.log(`Billing-service Started on ${PORT}`)
    connectDB()
    
})
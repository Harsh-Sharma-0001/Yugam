import express from "express"
import dotenv from "dotenv"
import { connectDB } from "./configs/db.js"
import roadmapRouter from "./routes/roadmap.route.js"
import { verifyGatewayOrigin } from "./middleware/gatewayAuth.js"
dotenv.config()

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 6004

app.get("/", (req, res) => {
    res.send("Hello from Roadmap-service")
})

app.use(verifyGatewayOrigin)
app.use("/",roadmapRouter)

app.listen(PORT , ()=>{
    console.log(`Roadmap-service Started on ${PORT}`)
    connectDB()
    
})
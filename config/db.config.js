require("dotenv").config()
const mongoose = require("mongoose")
const URI= process.env.MONGODB_CONNECTION_STRING


async function connectDB(){
    try {
        await mongoose.connect(URI)
        console.log("Connected to the DB")
    } catch (error) {
        console.error("Error connecting to database",error)
        process.exit(1)
    }
}

module.exports=connectDB;
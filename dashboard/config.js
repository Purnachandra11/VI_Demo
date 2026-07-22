const mongoose = require("mongoose");

// const url = "mongodb://localhost:27017/VI_DB";
const url = "mongodb+srv://kpurnachandra_db_user:l5AMQMPH7MgEmK1N@automation.hqk012j.mongodb.net/VI_Atomation_DB"
// const url = "mongodb+srv://QdegreesAutomation:Qdegrees@123#@cluster0.z29ljif.mongodb.net/"

mongoose.connect(url)
  .then(() => {
    console.log(" Connected to MongoDB");
  })
  .catch((err) => {
    console.error(" MongoDB connection error:", err.message);
  });

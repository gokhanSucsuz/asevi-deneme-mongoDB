const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.example' }); // try .env or .env.local

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("No MONGODB_URI found. I will use the one from .env manually if needed.");
    // Wait, let's just log process.env
    console.log(process.env);
  }
}
run();

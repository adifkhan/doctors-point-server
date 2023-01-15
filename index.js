const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@docpoint.vfs5tfs.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db('doctors_point').collection('services');
    const bookingCollection = client.db('doctors_point').collection('bookings');

    // get all services //
    app.get('/service', async (req, res) => {
      const query = {}
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // post booking //
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    })
  }
  finally {

  }
}
run().catch(console.dir)



app.get('/', (req, res) => {
  res.send('Say hello to docPoint')
})

app.listen(port, () => {
  console.log('Listening to : ', port);
})
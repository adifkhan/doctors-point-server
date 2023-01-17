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
    const userCollection = client.db('doctors_point').collection('users');

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
      const query = { service: booking.service, patient: booking.patient, date: booking.date };
      const preBooked = await bookingCollection.findOne(query);
      if (preBooked) {
        return res.send({ success: false, booking: preBooked });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    /* // test api //
    app.post('/booked', async (req, res) => {
      const query = req.body;
      const cursor = bookingCollection.find(query);
      const booked = await cursor.toArray();
      res.send(booked);
    })
    // test api // */

    app.get('/availableServices', async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();

      const query = { date: date };
      const thatDayBookings = await bookingCollection.find(query).toArray();

      services.forEach(service => {
        const bookings = thatDayBookings.filter(tdb => tdb.service === service.name);
        const bookedSlots = bookings.map(tdb => tdb.slot);
        const availableSlots = service.slots.filter(slot => !bookedSlots.includes(slot));
        service.slots = availableSlots;
      })
      res.send(services);
    });

    // my appointment //
    app.get('/booking', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      res.send(bookings);
    });

    // PUT user //
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: ture };
      const updatedDoc = {
        $set: user
      };
      const result = await userCollection.updateOne(filter, updatedDoc, options);
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
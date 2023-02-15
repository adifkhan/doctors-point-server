const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@docpoint.vfs5tfs.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const serviceCollection = client.db("doctors_point").collection("services");
    const bookingCollection = client.db("doctors_point").collection("bookings");
    const userCollection = client.db("doctors_point").collection("users");
    const doctorCollection = client.db("doctors_point").collection("doctors");

    /* // verify admin //
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterInfo = await userCollection.findOne({ email: requester });
      if (requesterInfo.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "Forbidden Access" });
      }
    }; */

    // payment control api //
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // get all services //
    app.get("/service", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    // post booking //
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        service: booking.service,
        patient: booking.patient,
        date: booking.date,
      };
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

    app.get("/availableServices", async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();

      const query = { date: date };
      const thatDayBookings = await bookingCollection.find(query).toArray();

      services.forEach((service) => {
        const bookings = thatDayBookings.filter(
          (tdb) => tdb.service === service.name
        );
        const bookedSlots = bookings.map((tdb) => tdb.slot);
        const availableSlots = service.slots.filter(
          (slot) => !bookedSlots.includes(slot)
        );
        service.slots = availableSlots;
      });
      res.send(services);
    });

    // my appointment //
    app.get("/booking", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.query.email;
      const query = { email: email };
      const bookings = await bookingCollection.find(query).toArray();
      if (decodedEmail === email) {
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });

    // get single booking by id //
    app.get("/booking/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const booking = await bookingCollection.findOne(query);
      res.send(booking);
    });

    // PUT user //
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const user = req.body;
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token });
    });

    // get all users //
    app.get("/users", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    //for check admin role and get the admin if admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    //post new doctor
    app.put("/doctors", verifyJWT, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor);
      res.send(result);
    });

    // get all doctors //
    app.get("/doctors", verifyJWT, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors);
    });

    // delete doctor info //
    app.delete("/doctor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorCollection.deleteOne(filter);
      res.send(result);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Say hello to docPoint");
});

app.listen(port, () => {
  console.log("Listening to : ", port);
});
